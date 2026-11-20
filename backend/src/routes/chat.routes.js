
const { Router } = require("express");

const {
    createSession,
    listSessions,
    getSessionDetails,
    updateSession,
    deleteSession
} = require("../controllers/chat.controller");

// ======================================================
// KDOCUMENT - DAY 17
// ROUTES QUẢN LÝ LỊCH SỬ HỘI THOẠI
// ======================================================

const createChatRouter = (verifyAccessToken) => {
    if (typeof verifyAccessToken !== "function") {
        throw new Error(
            "Middleware JWT không hợp lệ"
        );
    }

    const router = Router();

    // [01] Bắt buộc JWT với mọi route.
    router.use(verifyAccessToken);

    // [02] Danh sách phiên hội thoại.
    router.get("/sessions", listSessions);

    // [03] Tạo phiên hội thoại.
    router.post("/sessions", createSession);

    // [04] Xem lịch sử của một phiên.
    router.get("/sessions/:id", getSessionDetails);

    // [05] Đổi tiêu đề phiên.
    router.patch("/sessions/:id", updateSession);

    // [06] Xóa phiên và tin nhắn.
    router.delete("/sessions/:id", deleteSession);

    return router;
};

module.exports = createChatRouter;
