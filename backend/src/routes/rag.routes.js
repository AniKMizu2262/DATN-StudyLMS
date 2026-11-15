
const { Router } = require("express");

const {
    askRag
} = require("../controllers/rag.controller");

// ======================================================
// KDOCUMENT - ROUTES HỎI ĐÁP RAG
// DAY 13 - JWT VÀ PHÂN QUYỀN
// ======================================================

const createRagRouter = (verifyAccessToken) => {

    // [01] Kiểm tra middleware xác thực
    if (typeof verifyAccessToken !== "function") {
        throw new Error(
            "Middleware xác thực JWT không hợp lệ"
        );
    }

    const router = Router();

    // [02] API hỏi đáp theo tài liệu
    router.post(
        "/ask",
        verifyAccessToken,
        askRag
    );

    return router;
};

// [03] Xuất hàm tạo router
module.exports = createRagRouter;
