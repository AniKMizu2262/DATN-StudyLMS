
const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const pool = require("../src/config/database");
const { extractPdfText } = require("../src/services/pdf.service");
const { createDocumentChunks } = require("../src/services/chunk.service");

// ======================================================
// KDOCUMENT - KIỂM THỬ CHIA CHUNK
// Chỉ đọc dữ liệu, chưa ghi vào MySQL
// ======================================================

const main = async () => {
    const documentId = Number(process.argv[2]);

    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    const [rows] = await pool.query(
        `SELECT document_id, title, file_key
         FROM documents
         WHERE document_id = ?
           AND deleted_at IS NULL`,
        [documentId]
    );

    if (!rows.length) {
        throw new Error("Không tìm thấy tài liệu");
    }

    const document = rows[0];

    // [01] Đọc PDF
    const pdf = await extractPdfText(document.file_key);

    // [02] Chia chunk
    const chunks = createDocumentChunks(documentId, pdf.pages);

    // [03] In kết quả kiểm thử
    console.log("\n===== KIỂM THỬ CHUNKING =====");
    console.log("Tài liệu:", document.title);
    console.log("Tổng trang:", pdf.totalPages);
    console.log("Tổng chunk:", chunks.length);

    for (const chunk of chunks) {
        console.log(`\n----- CHUNK ${chunk.chunk_index} -----`);
        console.log("Trang:", chunk.page_number);
        console.log("Số ký tự:", chunk.char_count);
        console.log("Nội dung:", chunk.text.slice(0, 200));
    }
};

main()
    .catch((error) => {
        console.error("Lỗi chia chunk:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
