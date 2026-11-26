
"use strict";

const pool = require("../config/database");

const {
    extractPdfText
} = require("../services/pdf.service");

const {
    createDocumentChunks
} = require("../services/chunk.service");

const {
    MODEL_NAME,
    EMBEDDING_DIM,
    createEmbedding
} = require("../services/embedding.service");

// ======================================================
// KDOCUMENT - XỬ LÝ PDF CHO RAG
//
// POST /api/documents/:id/process
//
// [01] Kiểm tra quyền xử lý
// [02] Kiểm tra tài liệu
// [03] Trích xuất PDF
// [04] Chia chunk
// [05] Tạo embedding
// [06] Lưu MySQL bằng transaction
// [07] Chuyển trạng thái READY
//
// Chỉ READY khi lưu thành công toàn bộ dữ liệu RAG.
// ======================================================

// Giới hạn dành cho giai đoạn thử nghiệm.
const MAX_TEST_CHUNKS = 200;

// Chống hai request xử lý cùng một tài liệu
// trong cùng tiến trình Node.js.
const processingIds = new Set();

// ======================================================
// [01] KIỂM TRA QUYỀN XỬ LÝ
// ======================================================

const hasProcessPermission = async (db, document, user) => {
    const role = user?.role;
    const userId = Number(user?.userId);

    // Tài liệu dùng chung: ADMIN quản lý.
    if (document.subject_id === null) {
        return role === "ADMIN";
    }

    // Tài liệu môn học: TEACHER được phân công.
    if (
        role !== "TEACHER" ||
        !Number.isSafeInteger(userId) ||
        userId <= 0
    ) {
        return false;
    }

    const [rows] = await db.query(
        `SELECT 1
         FROM subject_teachers
         WHERE subject_id = ?
           AND teacher_id = ?
         LIMIT 1`,
        [document.subject_id, userId]
    );

    return rows.length > 0;
};

// ======================================================
// [02] API XỬ LÝ TÀI LIỆU PDF
// ======================================================

const processDocumentForRag = async (req, res) => {
    // [02.1] Kiểm tra ID tài liệu.
    const documentId = Number(req.params.id);

    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Mã tài liệu không hợp lệ"
        });
    }

    // [02.2] Không cho xử lý trùng đồng thời.
    if (processingIds.has(documentId)) {
        return res.status(409).json({
            success: false,
            message: "Tài liệu này đang được xử lý"
        });
    }

    processingIds.add(documentId);

    try {
        // ==================================================
        // [03] LẤY THÔNG TIN TÀI LIỆU
        // ==================================================

        const [rows] = await pool.query(
            `SELECT
                document_id,
                subject_id,
                file_key,
                status,
                review_status
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL
             LIMIT 1`,
            [documentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        const document = rows[0];

        // [03.1] Kiểm tra quyền xử lý.
        const allowed = await hasProcessPermission(
            pool,
            document,
            req.user
        );

        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xử lý tài liệu này"
            });
        }

        // [03.2] Chỉ xử lý tài liệu đã duyệt.
        if (document.review_status !== "APPROVED") {
            return res.status(409).json({
                success: false,
                message: "Tài liệu chưa được phê duyệt"
            });
        }

        // [03.3] Chỉ xử lý tài liệu đang PENDING.
        if (document.status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "Chỉ xử lý tài liệu đang PENDING"
            });
        }

        // [03.4] Không ghi đè dữ liệu chunk cũ.
        const [existingChunks] = await pool.query(
            `SELECT chunk_id
             FROM rag_chunks
             WHERE document_id = ?
             LIMIT 1`,
            [documentId]
        );

        if (existingChunks.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã có dữ liệu chunk"
            });
        }

        // ==================================================
        // [04] TRÍCH XUẤT NỘI DUNG PDF
        // ==================================================

        // Tái sử dụng pdf.service.js hiện có.
        const pdf = await extractPdfText(
            document.file_key
        );

        // ==================================================
        // [05] CHIA VĂN BẢN THÀNH CÁC CHUNK
        // ==================================================

        // Giữ số trang phục vụ trích dẫn nguồn.
        const chunks = createDocumentChunks(
            documentId,
            pdf.pages
        ).filter(
            (chunk) => chunk.text.trim().length > 0
        );

        if (chunks.length === 0) {
            return res.status(422).json({
                success: false,
                message: "PDF không tạo được chunk văn bản"
            });
        }

        // Giới hạn số chunk khi chạy thử trên CPU.
        if (chunks.length > MAX_TEST_CHUNKS) {
            return res.status(422).json({
                success: false,
                message:
                    `PDF có ${chunks.length} chunk, ` +
                    `vượt giới hạn ${MAX_TEST_CHUNKS}`
            });
        }

        // ==================================================
        // [06] TẠO EMBEDDING
        // ==================================================

        // Tạo đủ embedding trước khi INSERT database.
        // Nếu model lỗi, tài liệu vẫn ở PENDING.
        const vectors = [];

        for (const chunk of chunks) {
            const vector = await createEmbedding(
                chunk.text
            );

            vectors.push(vector);
        }

        // ==================================================
        // [07] LƯU CHUNK VÀ EMBEDDING VÀO MYSQL
        // ==================================================

        const connection = await pool.getConnection();

        try {
            // [07.1] Bắt đầu transaction.
            await connection.beginTransaction();

            // [07.2] Khóa bản ghi tài liệu.
            // Kiểm tra lại vì quyền/trạng thái có thể
            // đã thay đổi trong khi tạo embedding.
            const [lockedRows] = await connection.query(
                `SELECT
                    document_id,
                    subject_id,
                    file_key,
                    status,
                    review_status
                 FROM documents
                 WHERE document_id = ?
                   AND deleted_at IS NULL
                 FOR UPDATE`,
                [documentId]
            );

            const current = lockedRows[0];

            const permissionValid =
                current
                    ? await hasProcessPermission(
                        connection,
                        current,
                        req.user
                    )
                    : false;

            if (
                !current ||
                current.status !== "PENDING" ||
                current.review_status !== "APPROVED" ||
                current.file_key !== document.file_key ||
                !permissionValid
            ) {
                const error = new Error(
                    "Tài liệu hoặc quyền truy cập đã thay đổi"
                );

                error.statusCode = 409;
                throw error;
            }

            // [07.3] Kiểm tra lại dữ liệu chunk.
            const [oldChunks] = await connection.query(
                `SELECT chunk_id
                 FROM rag_chunks
                 WHERE document_id = ?
                 LIMIT 1`,
                [documentId]
            );

            if (oldChunks.length > 0) {
                const error = new Error(
                    "Tài liệu đã có dữ liệu chunk"
                );

                error.statusCode = 409;
                throw error;
            }

            // [07.4] Lưu từng chunk và vector tương ứng.
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                const [inserted] =
                    await connection.query(
                        `INSERT INTO rag_chunks (
                            document_id,
                            chunk_index,
                            page_number,
                            text,
                            char_count
                         ) VALUES (?, ?, ?, ?, ?)`,
                        [
                            documentId,
                            chunk.chunk_index,
                            chunk.page_number,
                            chunk.text,
                            chunk.char_count
                        ]
                    );

                await connection.query(
                    `INSERT INTO rag_embeddings (
                        chunk_id,
                        model,
                        dimension,
                        embedding
                     ) VALUES (?, ?, ?, ?)`,
                    [
                        inserted.insertId,
                        MODEL_NAME,
                        EMBEDDING_DIM,
                        JSON.stringify(vectors[i])
                    ]
                );
            }

            // ==================================================
            // [08] CHUYỂN TRẠNG THÁI READY
            // ==================================================

            // Chỉ chạy sau khi toàn bộ chunk và vector
            // đã INSERT thành công.
            const [updated] = await connection.query(
                `UPDATE documents
                 SET status = 'READY'
                 WHERE document_id = ?
                   AND status = 'PENDING'
                   AND review_status = 'APPROVED'
                   AND deleted_at IS NULL`,
                [documentId]
            );

            if (updated.affectedRows !== 1) {
                throw new Error(
                    "Không thể cập nhật trạng thái READY"
                );
            }

            // [08.1] Lưu tất cả thay đổi.
            await connection.commit();

        } catch (error) {
            // Nếu có lỗi, hủy toàn bộ thay đổi.
            await connection.rollback();
            throw error;

        } finally {
            // Luôn trả connection về pool.
            connection.release();
        }

        // ==================================================
        // [09] TRẢ KẾT QUẢ THÀNH CÔNG
        // ==================================================

        return res.status(200).json({
            success: true,
            message: "Xử lý PDF thành công",
            data: {
                document_id: documentId,
                total_pages: pdf.totalPages,
                total_chunks: chunks.length,
                embedding_model: MODEL_NAME,
                status: "READY"
            }
        });

    } catch (error) {
        console.error(
            "[DOCUMENT PROCESS]",
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Không thể xử lý PDF. Kiểm tra log backend."
        });

    } finally {
        // Cho phép thử lại sau khi xử lý kết thúc.
        processingIds.delete(documentId);
    }
};

// ======================================================
// [10] EXPORT CONTROLLER
// ======================================================

module.exports = {
    processDocumentForRag
};
