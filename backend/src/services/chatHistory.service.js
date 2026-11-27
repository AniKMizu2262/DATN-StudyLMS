"use strict";

const pool = require("../config/database");

// ======================================================
// KDOCUMENT | DAY20 - DỊCH VỤ LỊCH SỬ HỘI THOẠI RAG
//
// Giữ nguyên giao diện sử dụng của Day17/Day18:
// - isOwnedSession(sessionId, userId) -> boolean
// - saveRagTurn({...}) -> session_id
//
// Quy tắc:
// - Mỗi phiên thuộc một user_id.
// - Một lượt hỏi đáp lưu cả USER và ASSISTANT.
// - Hai tin nhắn phải cùng commit hoặc cùng rollback.
// - Phiên mới tự lấy tối đa 80 ký tự đầu từ câu hỏi.
// ======================================================

// Kiểm tra ID ở cả lớp service, không chỉ phụ thuộc controller.
// Chấp nhận number hoặc chuỗi chữ số thập phân dương.
const parsePositiveId = (value) => {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0
            ? value
            : null;
    }

    if (
        typeof value === "string" &&
        /^[1-9]\d*$/.test(value)
    ) {
        const parsed = Number(value);

        return Number.isSafeInteger(parsed)
            ? parsed
            : null;
    }

    return null;
};

// ======================================================
// [01] KIỂM TRA QUYỀN SỞ HỮU PHIÊN CHAT
// ======================================================

// Trả false với ID không hợp lệ, không cần truy vấn MySQL.
const isOwnedSession = async (sessionId, userId) => {
    const validSessionId = parsePositiveId(sessionId);
    const validUserId = parsePositiveId(userId);

    if (
        validSessionId === null ||
        validUserId === null
    ) {
        return false;
    }

    const [rows] = await pool.query(
        `SELECT session_id
         FROM chat_sessions
         WHERE session_id = ?
           AND user_id = ?
         LIMIT 1`,
        [validSessionId, validUserId]
    );

    return rows.length > 0;
};

// ======================================================
// [02] LƯU MỘT LƯỢT HỎI ĐÁP RAG
// ======================================================

// rag.controller.js phải kiểm tra quyền truy cập tài liệu
// trước khi gọi hàm này.
//
// Service chịu trách nhiệm:
// - Xác minh quyền sở hữu phiên.
// - Tạo phiên mới khi cần.
// - Lưu câu hỏi và câu trả lời nguyên vẹn.
// - Rollback nếu quá trình lưu thất bại.

const saveRagTurn = async ({
    userId,
    sessionId = null,
    documentId,
    question,
    answer,
    model = null,
    citations = []
}) => {
    // --------------------------------------------------
    // [02.1] KIỂM TRA DỮ LIỆU ĐẦU VÀO
    // --------------------------------------------------

    const validUserId = parsePositiveId(userId);
    const validDocumentId = parsePositiveId(documentId);

    const validSessionId = sessionId === null
        ? null
        : parsePositiveId(sessionId);

    // Kiểm tra trước khi mở transaction.
    //
    // Không cho lưu nếu:
    // - ID không hợp lệ.
    // - Câu hỏi hoặc câu trả lời rỗng.
    // - Citations không phải mảng.
    if (
        validUserId === null ||
        validDocumentId === null ||
        (sessionId !== null && validSessionId === null) ||
        typeof question !== "string" ||
        !question.trim() ||
        typeof answer !== "string" ||
        !answer.trim() ||
        !Array.isArray(citations)
    ) {
        const error = new Error(
            "Dữ liệu lượt hỏi đáp không hợp lệ"
        );

        error.code = "INVALID_RAG_TURN";

        throw error;
    }

    // --------------------------------------------------
    // [02.2] TẠO TIÊU ĐỀ CHO PHIÊN MỚI
    // --------------------------------------------------

    // Giữ nguyên cách tạo tiêu đề từ Day18.
    //
    // Ví dụ câu hỏi:
    // "Python có những kiểu dữ liệu nào?"
    //
    // Tiêu đề phiên mới:
    // "Python có những kiểu dữ liệu nào?"
    //
    // Chỉ lấy tối đa 80 ký tự Unicode đầu tiên.
    // Các khoảng trắng liên tiếp được gộp lại.
    const generatedTitle = Array.from(
        question.trim().replace(/\s+/g, " ")
    )
        .slice(0, 80)
        .join("") || "Hỏi đáp mới";

    // --------------------------------------------------
    // [02.3] LẤY CONNECTION MYSQL
    // --------------------------------------------------

    const connection = await pool.getConnection();

    // Đánh dấu transaction đã bắt đầu.
    // Tránh rollback khi beginTransaction() thất bại.
    let transactionStarted = false;

    try {
        await connection.beginTransaction();

        transactionStarted = true;

        let currentSessionId = validSessionId;

        // --------------------------------------------------
        // [02.4] TẠO PHIÊN HỘI THOẠI MỚI
        // --------------------------------------------------

        if (currentSessionId === null) {

            // Tạo phiên trong cùng transaction với tin nhắn.
            //
            // Nếu bước lưu câu hỏi/câu trả lời thất bại,
            // bản ghi phiên mới cũng được rollback.
            const [result] = await connection.query(
                `INSERT INTO chat_sessions
                    (user_id, title)
                 VALUES (?, ?)`,
                [
                    validUserId,
                    generatedTitle
                ]
            );

            currentSessionId = result.insertId;

        } else {

            // --------------------------------------------------
            // [02.5] KIỂM TRA PHIÊN HỘI THOẠI HIỆN CÓ
            // --------------------------------------------------

            // Khi tiếp tục phiên cũ, luôn kiểm tra:
            // - Session có tồn tại không?
            // - Session có thuộc đúng user không?
            //
            // FOR UPDATE khóa bản ghi trong transaction,
            // tránh phiên bị xóa giữa lúc đang ghi tin nhắn.
            const [rows] = await connection.query(
                `SELECT session_id
                 FROM chat_sessions
                 WHERE session_id = ?
                   AND user_id = ?
                 FOR UPDATE`,
                [
                    currentSessionId,
                    validUserId
                ]
            );

            if (rows.length === 0) {

                const error = new Error(
                    "Không tìm thấy phiên hội thoại hợp lệ"
                );

                error.code = "SESSION_NOT_FOUND";

                throw error;
            }
        }

        // --------------------------------------------------
        // [02.6] LƯU CÂU HỎI CỦA NGƯỜI DÙNG
        // --------------------------------------------------

        // sender_type = USER
        //
        // document_id được lưu để xác định câu hỏi
        // thuộc tài liệu nào trong hệ thống.
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
                validDocumentId
            ]
        );

        // --------------------------------------------------
        // [02.7] LƯU CÂU TRẢ LỜI CỦA AI
        // --------------------------------------------------

        // sender_type = ASSISTANT
        //
        // Lưu kèm:
        // - Nội dung trả lời.
        // - Document ID.
        // - Model đã sử dụng.
        // - Danh sách nguồn trích dẫn.
        //
        // JSON.stringify() chuyển mảng citations thành
        // JSON để lưu đúng cấu trúc hiện tại.
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
                validDocumentId,
                model,
                JSON.stringify(citations)
            ]
        );

        // --------------------------------------------------
        // [02.8] CẬP NHẬT THỜI GIAN HOẠT ĐỘNG
        // --------------------------------------------------

        // Dùng updated_at để sắp xếp những phiên
        // người dùng vừa tương tác lên trước.
        await connection.query(
            `UPDATE chat_sessions
             SET updated_at = CURRENT_TIMESTAMP
             WHERE session_id = ?`,
            [currentSessionId]
        );

        // --------------------------------------------------
        // [02.9] COMMIT TRANSACTION
        // --------------------------------------------------

        // Chỉ commit sau khi lưu thành công:
        // - Phiên mới (nếu có).
        // - Câu hỏi USER.
        // - Câu trả lời ASSISTANT.
        // - Thời gian cập nhật phiên.
        await connection.commit();

        transactionStarted = false;

        return currentSessionId;

    } catch (error) {

        // --------------------------------------------------
        // [02.10] ROLLBACK KHI CÓ LỖI
        // --------------------------------------------------

        // Nếu lỗi xảy ra sau khi transaction đã bắt đầu,
        // hủy các thay đổi chưa commit.
        //
        // Bọc rollback trong try/catch riêng:
        // lỗi rollback không được che mất lỗi gốc.
        if (transactionStarted) {

            try {
                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "[CHAT HISTORY] Rollback thất bại:",
                    rollbackError
                );
            }
        }

        // Để rag.controller.js xử lý response lỗi.
        throw error;

    } finally {

        // --------------------------------------------------
        // [02.11] GIẢI PHÓNG CONNECTION
        // --------------------------------------------------

        // Dù thành công hay thất bại,
        // connection phải được trả về pool.
        connection.release();
    }
};

// ======================================================
// [03] EXPORT SERVICE
// ======================================================

module.exports = {
    isOwnedSession,
    saveRagTurn
};