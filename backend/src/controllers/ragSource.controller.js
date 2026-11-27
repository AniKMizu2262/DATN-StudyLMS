
"use strict";

const fs = require("fs/promises");
const path = require("path");

const pool = require("../config/database");

const {
    checkDocumentRagAccess
} = require("../services/ragAccess.service");

// ======================================================
// KDOCUMENT | DAY20
// RAG SOURCE CONTROLLER
//
// [01] Xác thực dữ liệu đầu vào
// [02] Kiểm tra quyền truy cập
// [03] Lấy chunk từ MySQL
// [04] Đọc Markdown của trang từ cache Docling
// [05] Trả dữ liệu cho SourcePreview
//
// QUAN TRỌNG:
// - content là văn bản chunk gốc trong MySQL.
// - readable_markdown là nội dung toàn trang.
// - Không sửa chunk_id hoặc dữ liệu embedding.
// - Không chạy Docling trong request.
// ======================================================

const CACHE_DIR = path.resolve(
    __dirname,
    "../../storage/rag-previews"
);

// ======================================================
// [A] ĐỌC MARKDOWN ĐÃ ĐƯỢC LƯU
// ======================================================

const getCachedPageMarkdown = async (
    fileKey,
    pageNumber
) => {
    if (
        typeof fileKey !== "string" ||
        !/^[a-zA-Z0-9_-]+\.pdf$/i.test(fileKey) ||
        !Number.isSafeInteger(pageNumber) ||
        pageNumber <= 0
    ) {
        return null;
    }

    const cacheName = fileKey.replace(
        /\.pdf$/i,
        ".json"
    );

    const cachePath = path.join(
        CACHE_DIR,
        cacheName
    );

    try {
        const raw = await fs.readFile(
            cachePath,
            "utf8"
        );

        const cached = JSON.parse(raw);

        if (!Array.isArray(cached.pages)) {
            return null;
        }

        const page = cached.pages.find(
            (item) =>
                Number(item.page_number) === pageNumber
        );

        if (
            !page ||
            typeof page.readable_markdown !== "string" ||
            !page.readable_markdown.trim()
        ) {
            return null;
        }

        return page.readable_markdown;

    } catch (error) {
        if (error.code !== "ENOENT") {
            console.warn(
                "[RAG Source] Không đọc được cache:",
                error.message
            );
        }

        // Không có cache thì frontend dùng dữ liệu cũ.
        return null;
    }
};

// ======================================================
// [B] GET /api/rag/sources/:documentId/:chunkId
// ======================================================

const getRagSource = async (req, res) => {
    const documentId = Number(req.params.documentId);
    const chunkId = Number(req.params.chunkId);

    // [01] Kiểm tra ID
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
        // [02] Kiểm tra quyền xem tài liệu
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

        // [03] Lấy chunk đúng tài liệu,
        // đồng thời lấy file_key của PDF gốc.
        const [rows] = await pool.query(
            `SELECT
                rc.chunk_id,
                rc.document_id,
                rc.page_number,
                rc.text,
                d.file_key
             FROM rag_chunks AS rc
             INNER JOIN documents AS d
                ON d.document_id = rc.document_id
             WHERE rc.document_id = ?
               AND rc.chunk_id = ?
               AND d.deleted_at IS NULL
             LIMIT 1`,
            [documentId, chunkId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đoạn nguồn tương ứng"
            });
        }

        const chunk = rows[0];
        const content = chunk.text;

        if (
            typeof content !== "string" ||
            !content.trim()
        ) {
            return res.status(500).json({
                success: false,
                message: "Nội dung đoạn nguồn không hợp lệ"
            });
        }

        // [04] Đọc Markdown theo trang chứa chunk.
        // Đây là nội dung toàn trang, KHÔNG phải
        // bản chuyển đổi chính xác riêng chunk này.
        const pageNumber = Number(
            chunk.page_number
        );

        const readableMarkdown =
            await getCachedPageMarkdown(
                chunk.file_key,
                pageNumber
            );

        // [05] Không cache response được bảo vệ.
        res.set("Cache-Control", "no-store");

        // [06] Trả dữ liệu về React
        return res.status(200).json({
            success: true,
            data: {
                document_id: chunk.document_id,
                chunk_id: chunk.chunk_id,
                page_number: chunk.page_number,

                // Chuỗi chunk đang lưu trong MySQL
                content: content,

                // Markdown từ Docling (toàn trang)
                readable_markdown: readableMarkdown,

                // Cho frontend biết phạm vi hiển thị
                readable_scope: readableMarkdown
                    ? "page"
                    : null
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

module.exports = {
    getRagSource
};
