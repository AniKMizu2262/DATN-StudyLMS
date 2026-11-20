
const { Router } = require("express");

const {
    askRag
} = require("../controllers/rag.controller");

const {
    getRagSource
} = require("../controllers/ragSource.controller");

// ======================================================
// KDOCUMENT - ROUTES RAG
// JWT + HỎI ĐÁP + NGUỒN TRÍCH DẪN
// ======================================================

const createRagRouter = (verifyAccessToken) => {

    // [01] Kiểm tra middleware JWT
    if (typeof verifyAccessToken !== "function") {
        throw new Error(
            "Middleware xác thực JWT không hợp lệ"
        );
    }

    const router = Router();

    // [02] Hỏi đáp theo tài liệu
    router.post(
        "/ask",
        verifyAccessToken,
        askRag
    );

    // [03] Xem nội dung chunk gốc của nguồn trích dẫn
    router.get(
        "/sources/:documentId/:chunkId",
        verifyAccessToken,
        getRagSource
    );

    return router;
};

module.exports = createRagRouter;
