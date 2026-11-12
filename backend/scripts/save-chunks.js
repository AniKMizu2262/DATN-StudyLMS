
const path = require("path");

// ======================================================
// [A] NẠP CẤU HÌNH VÀ DỊCH VỤ
// ======================================================

// Phải nạp .env trước khi kết nối MySQL
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const pool = require("../src/config/database");
const { extractPdfText } = require("../src/services/pdf.service");
const { createDocumentChunks } = require("../src/services/chunk.service");

// ======================================================
// [B] LƯU CHUNK CỦA TÀI LIỆU VÀO MYSQL
// ======================================================

const saveDocumentChunks = async (documentId) => {
    // [01] Kiểm tra mã tài liệu
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    // [02] Tìm tài liệu chưa bị xóa mềm
    const [documents] = await pool.query(
        `SELECT document_id, title, file_key
         FROM documents
         WHERE document_id = ?
           AND deleted_at IS NULL`,
        [documentId]
    );

    if (documents.length === 0) {
        throw new Error("Không tìm thấy tài liệu hợp lệ");
    }

    const document = documents[0];

    console.log("\n===== XỬ LÝ TÀI LIỆU =====");
    console.log("Mã tài liệu:", document.document_id);
    console.log("Tiêu đề:", document.title);

    // [03] Trích xuất văn bản PDF
    const pdf = await extractPdfText(document.file_key);

    // [04] Chia văn bản thành chunk
    const chunks = createDocumentChunks(documentId, pdf.pages);

    if (chunks.length === 0) {
        throw new Error("Không tạo được chunk từ tài liệu");
    }

    console.log("Tổng trang:", pdf.totalPages);
    console.log("Số chunk:", chunks.length);

    // ==================================================
    // [C] LƯU DỮ LIỆU BẰNG TRANSACTION
    // ==================================================

    // Sử dụng cùng một connection để đảm bảo transaction
    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
        await connection.beginTransaction();
        transactionStarted = true;

        // [05] Khóa bản ghi và kiểm tra tài liệu còn hợp lệ
        const [currentDocuments] = await connection.query(
            `SELECT document_id, file_key
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL
             FOR UPDATE`,
            [documentId]
        );

        if (
            currentDocuments.length === 0 ||
            currentDocuments[0].file_key !== document.file_key
        ) {
            throw new Error(
                "Tài liệu đã thay đổi hoặc bị xóa trong khi xử lý"
            );
        }

        // [06] Xóa chunk cũ nếu đang xử lý lại
        // Chỉ xóa dữ liệu trong rag_chunks, không xóa PDF
        const [deleted] = await connection.query(
            `DELETE FROM rag_chunks
             WHERE document_id = ?`,
            [documentId]
        );

        console.log("Chunk cũ được thay thế:", deleted.affectedRows);

        // [07] Lưu từng chunk mới
        for (const chunk of chunks) {
            await connection.query(
                `INSERT INTO rag_chunks (
                    document_id,
                    chunk_index,
                    page_number,
                    text,
                    char_count
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    chunk.document_id,
                    chunk.chunk_index,
                    chunk.page_number,
                    chunk.text,
                    chunk.char_count
                ]
            );
        }

        // [08] Xác nhận toàn bộ dữ liệu
        await connection.commit();
        transactionStarted = false;

        console.log("\n===== LƯU MYSQL THÀNH CÔNG =====");
        console.log("Tài liệu:", documentId);
        console.log("Chunk đã lưu:", chunks.length);
        console.log("Trạng thái: Hoàn thành");

    } catch (error) {
        // Nếu một chunk lỗi, hoàn tác toàn bộ thay đổi
        if (transactionStarted) {
            await connection.rollback();
        }

        throw error;

    } finally {
        // Luôn trả kết nối về pool
        connection.release();
    }
};

// ======================================================
// [D] CHẠY SCRIPT
// ======================================================

const main = async () => {
    const documentId = Number(process.argv[2]);

    await saveDocumentChunks(documentId);
};

main()
    .catch((error) => {
        console.error("\nLỗi lưu chunk:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
