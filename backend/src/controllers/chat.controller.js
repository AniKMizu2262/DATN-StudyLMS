
const pool = require("../config/database");

const {
    checkDocumentRagAccess
} = require("../services/ragAccess.service");

// ======================================================
// KDOCUMENT - DAY 17
// CONTROLLER QUẢN LÝ LỊCH SỬ HỘI THOẠI
// ======================================================

// [01] LẤY ID NGƯỜI DÙNG TỪ JWT
const getUserId = (req) => {
    const userId = Number(req.user?.userId);

    return Number.isSafeInteger(userId) && userId > 0
        ? userId
        : null;
};

// [02] KIỂM TRA ID PHIÊN
const getSessionId = (req) => {
    const sessionId = Number(req.params.id);

    return Number.isSafeInteger(sessionId) && sessionId > 0
        ? sessionId
        : null;
};

// [03] ĐỌC CITATIONS TỪ MYSQL JSON
const parseCitations = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
};

// ======================================================
// [04] POST /api/chat/sessions
// TẠO PHIÊN HỘI THOẠI MỚI
// ======================================================

const createSession = async (req, res) => {
    const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    const suppliedTitle = req.body?.title;

    if (
        suppliedTitle !== undefined &&
        (
            typeof suppliedTitle !== "string" ||
            !suppliedTitle.trim() ||
            suppliedTitle.trim().length > 255
        )
    ) {
        return res.status(400).json({
            success: false,
            message: "Tiêu đề phiên không hợp lệ"
        });
    }

    const title = suppliedTitle?.trim() || "Hỏi đáp mới";

    try {
        const [result] = await pool.query(
            `INSERT INTO chat_sessions
                (user_id, title)
             VALUES (?, ?)`,
            [userId, title]
        );

        return res.status(201).json({
            success: true,
            data: {
                session_id: result.insertId,
                title
            }
        });
    } catch (error) {
        console.error(
            "[Chat] Lỗi tạo phiên:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Không thể tạo phiên hội thoại"
        });
    }
};

// ======================================================
// [05] GET /api/chat/sessions
// LẤY DANH SÁCH PHIÊN CỦA TÀI KHOẢN
// ======================================================

const listSessions = async (req, res) => {
    const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    try {
        const [rows] = await pool.query(
            `SELECT
                session_id,
                subject_id,
                title,
                created_at,
                updated_at
             FROM chat_sessions
             WHERE user_id = ?
             ORDER BY updated_at DESC, session_id DESC
             LIMIT 100`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error(
            "[Chat] Lỗi lấy danh sách:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Không thể tải danh sách hội thoại"
        });
    }
};

// ======================================================
// [06] GET /api/chat/sessions/:id
// LẤY PHIÊN VÀ TIN NHẮN
// ======================================================

const getSessionDetails = async (req, res) => {
    const userId = getUserId(req);
    const sessionId = getSessionId(req);

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: "Mã phiên hội thoại không hợp lệ"
        });
    }

    try {
        // [06.1] Chỉ tìm phiên thuộc tài khoản hiện tại.
        const [sessions] = await pool.query(
            `SELECT
                session_id,
                subject_id,
                title,
                created_at,
                updated_at
             FROM chat_sessions
             WHERE session_id = ?
               AND user_id = ?
             LIMIT 1`,
            [sessionId, userId]
        );

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phiên hội thoại"
            });
        }

        // [06.2] Lấy tin nhắn theo thứ tự tạo.
        const [rows] = await pool.query(
            `SELECT
                message_id,
                sender_type,
                content,
                document_id,
                model,
                citations,
                created_at
             FROM chat_messages
             WHERE session_id = ?
             ORDER BY message_id ASC`,
            [sessionId]
        );

        // [06.3] Kiểm tra lại quyền của từng tài liệu.
        const documentIds = [
            ...new Set(
                rows
                    .map((row) => row.document_id)
                    .filter((id) => id !== null)
            )
        ];

        const allowedDocuments = new Set();

        for (const documentId of documentIds) {
            const document = await checkDocumentRagAccess(
                Number(documentId),
                req.user
            );

            if (document) {
                allowedDocuments.add(Number(documentId));
            }
        }

        // [06.4] Ẩn nội dung đã bị thu hồi quyền.
        const messages = rows.map((row) => {
            const hasDocument = row.document_id !== null;

            const allowed =
                !hasDocument ||
                allowedDocuments.has(Number(row.document_id));

            if (!allowed) {
                return {
                    message_id: row.message_id,
                    sender_type: row.sender_type,
                    content:
                        "Nội dung đã được ẩn vì quyền truy cập " +
                        "tài liệu đã thay đổi.",
                    document_id: null,
                    model: null,
                    citations: [],
                    restricted: true,
                    created_at: row.created_at
                };
            }

            return {
                message_id: row.message_id,
                sender_type: row.sender_type,
                content: row.content,
                document_id: row.document_id,
                model: row.model,
                citations: parseCitations(row.citations),
                restricted: false,
                created_at: row.created_at
            };
        });

        res.set("Cache-Control", "no-store");

        return res.status(200).json({
            success: true,
            data: {
                session: sessions[0],
                messages
            }
        });
    } catch (error) {
        console.error(
            "[Chat] Lỗi xem phiên:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Không thể tải nội dung hội thoại"
        });
    }
};

// ======================================================
// [07] PATCH /api/chat/sessions/:id
// ĐỔI TIÊU ĐỀ PHIÊN
// ======================================================

const updateSession = async (req, res) => {
    const userId = getUserId(req);
    const sessionId = getSessionId(req);
    const title = req.body?.title;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: "Mã phiên hội thoại không hợp lệ"
        });
    }

    if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 255
    ) {
        return res.status(400).json({
            success: false,
            message: "Tiêu đề không hợp lệ"
        });
    }

    try {
        const [result] = await pool.query(
            `UPDATE chat_sessions
             SET title = ?
             WHERE session_id = ?
               AND user_id = ?`,
            [title.trim(), sessionId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phiên hội thoại"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                session_id: sessionId,
                title: title.trim()
            }
        });
    } catch (error) {
        console.error(
            "[Chat] Lỗi đổi tiêu đề:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Không thể đổi tiêu đề hội thoại"
        });
    }
};

// ======================================================
// [08] DELETE /api/chat/sessions/:id
// XÓA PHIÊN CỦA CHÍNH NGƯỜI DÙNG
// ======================================================

const deleteSession = async (req, res) => {
    const userId = getUserId(req);
    const sessionId = getSessionId(req);

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: "Mã phiên hội thoại không hợp lệ"
        });
    }

    try {
        // FK ON DELETE CASCADE sẽ xóa các tin nhắn.
        const [result] = await pool.query(
            `DELETE FROM chat_sessions
             WHERE session_id = ?
               AND user_id = ?`,
            [sessionId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phiên hội thoại"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Đã xóa phiên hội thoại"
        });
    } catch (error) {
        console.error(
            "[Chat] Lỗi xóa phiên:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Không thể xóa phiên hội thoại"
        });
    }
};

// ======================================================
// [09] EXPORT CONTROLLER
// ======================================================

module.exports = {
    createSession,
    listSessions,
    getSessionDetails,
    updateSession,
    deleteSession
};
