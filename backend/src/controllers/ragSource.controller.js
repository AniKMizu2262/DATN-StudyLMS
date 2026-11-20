
const pool = require("../config/database");

const {
    checkDocumentRagAccess
} = require("../services/ragAccess.service");

// ======================================================
// KDOCUMENT - CITATION VIEWER
// DAY 16 - XEM NGUỒN TRÍCH DẪN RAG
// ======================================================

// [01] GET /api/rag/sources/:documentId/:chunkId
// Lấy nội dung chunk gốc để đối chiếu câu trả lời AI.
const getRagSource = async (req, res) => {
    const documentId = Number(req.params.documentId);
    const chunkId = Number(req.params.chunkId);

    // --------------------------------------------------
    // [02] KIỂM TRA THAM SỐ ĐẦU VÀO
    // --------------------------------------------------
    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0 ||
        !Number.isSafeInteger(chunkId) ||
        chunkId <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Mã tài liệu hoặc mã nguồn không hợp lệ"
        });
    }

    try {
        // --------------------------------------------------
        // [03] KIỂM TRA QUYỀN TRUY CẬP TÀI LIỆU
        // --------------------------------------------------
        const document = await checkDocumentRagAccess(
            documentId,
            req.user
        );

        if (!document) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xem nguồn tài liệu này"
            });
        }

        // --------------------------------------------------
        // [04] TRUY VẤN CHUNK THUỘC ĐÚNG TÀI LIỆU
        // --------------------------------------------------
        const [rows] = await pool.query(
            `SELECT
                chunk_id,
                document_id,
                page_number,
                text
             FROM rag_chunks
             WHERE document_id = ?
               AND chunk_id = ?
             LIMIT 1`,
            [documentId, chunkId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đoạn nguồn tương ứng"
            });
        }

        // --------------------------------------------------
        // [05] LẤY NỘI DUNG GỐC CỦA CHUNK
        // --------------------------------------------------
        const chunk = rows[0];
        const content = chunk.text;

        if (
            typeof content !== "string" ||
            content.trim().length === 0
        ) {
            return res.status(500).json({
                success: false,
                message: "Nội dung đoạn nguồn không hợp lệ"
            });
        }

        // --------------------------------------------------
        // [06] KHÔNG CACHE DỮ LIỆU ĐƯỢC BẢO VỆ
        // --------------------------------------------------
        res.set("Cache-Control", "no-store");

        // --------------------------------------------------
        // [07] TRẢ THÔNG TIN NGUỒN CHO FRONTEND
        // --------------------------------------------------
        return res.status(200).json({
            success: true,
            data: {
                document_id: chunk.document_id,
                chunk_id: chunk.chunk_id,
                page_number: chunk.page_number,
                content: content
            }
        });

    } catch (error) {
        console.error(
            "[RAG Source] Lỗi đọc nguồn:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Không thể tải nội dung nguồn tham khảo"
        });
    }
};

// ======================================================
// [08] EXPORT CONTROLLER
// ======================================================
module.exports = {
    getRagSource
};
