
const pool = require("../config/database");

// ======================================================
// KDOCUMENT - DAY 17
// DỊCH VỤ LƯU LỊCH SỬ HỘI THOẠI
// ======================================================

// [01] KIỂM TRA QUYỀN SỞ HỮU PHIÊN CHAT
const isOwnedSession = async (sessionId, userId) => {
    const [rows] = await pool.query(
        `SELECT session_id
         FROM chat_sessions
         WHERE session_id = ?
           AND user_id = ?
         LIMIT 1`,
        [sessionId, userId]
    );

    return rows.length > 0;
};

// ------------------------------------------------------
// [02] LƯU MỘT LƯỢT HỎI ĐÁP RAG
// ------------------------------------------------------

const saveRagTurn = async ({
    userId,
    sessionId = null,
    documentId,
    question,
    answer,
    model = null,
    citations = []
}) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let currentSessionId = sessionId;

        // [02.1] Chưa có phiên thì tạo phiên mới.
        
        // [DAY 18] Tự đặt tiêu đề cho phiên mới.
        if (currentSessionId === null) {
            const generatedTitle = Array.from(
                question.trim().replace(/\s+/g, " ")
            )
                .slice(0, 80)
                .join("") || "Hỏi đáp mới";

            const [result] = await connection.query(
                `INSERT INTO chat_sessions
                    (user_id, title)
                 VALUES (?, ?)`,
                [userId, generatedTitle]
            );

            currentSessionId = result.insertId;
        }
 else {
            // [02.2] Khóa và xác minh phiên thuộc user.
            const [rows] = await connection.query(
                `SELECT session_id
                 FROM chat_sessions
                 WHERE session_id = ?
                   AND user_id = ?
                 FOR UPDATE`,
                [currentSessionId, userId]
            );

            if (rows.length === 0) {
                const error = new Error(
                    "Không tìm thấy phiên hội thoại hợp lệ"
                );

                error.code = "SESSION_NOT_FOUND";
                throw error;
            }
        }

        // [02.3] Lưu câu hỏi của người dùng.
        await connection.query(
            `INSERT INTO chat_messages
                (
                    session_id,
                    sender_type,
                    content,
                    document_id
                )
             VALUES (?, 'USER', ?, ?)`,
            [
                currentSessionId,
                question,
                documentId
            ]
        );

        // [02.4] Lưu câu trả lời và citations.
        await connection.query(
            `INSERT INTO chat_messages
                (
                    session_id,
                    sender_type,
                    content,
                    document_id,
                    model,
                    citations
                )
             VALUES (?, 'ASSISTANT', ?, ?, ?, ?)`,
            [
                currentSessionId,
                answer,
                documentId,
                model,
                JSON.stringify(citations)
            ]
        );

        // [02.5] Cập nhật lần hoạt động gần nhất.
        await connection.query(
            `UPDATE chat_sessions
             SET updated_at = CURRENT_TIMESTAMP
             WHERE session_id = ?`,
            [currentSessionId]
        );

        // [02.6] Ghi toàn bộ transaction.
        await connection.commit();

        return currentSessionId;
    } catch (error) {
        // Không để lại câu hỏi hoặc câu trả lời bị thiếu.
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// ======================================================
// [03] EXPORT
// ======================================================

module.exports = {
    isOwnedSession,
    saveRagTurn
};
