
const pool = require("../config/database");

// ======================================================
// KDOCUMENT - KIỂM TRA QUYỀN TRUY CẬP RAG
// DAY 13 - BẢO VỆ TÀI LIỆU
// ======================================================

// [01] KIỂM TRA NGƯỜI DÙNG CÓ ĐƯỢC HỎI TÀI LIỆU
const checkDocumentRagAccess = async (documentId, user) => {

    // Kiểm tra mã tài liệu
    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
    ) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    // Kiểm tra thông tin người dùng đã xác thực
    if (!user || typeof user !== "object") {
        return null;
    }

    const userId = Number(user.userId);
    const role = String(user.role || "").toUpperCase();

    if (
        !Number.isSafeInteger(userId) ||
        userId <= 0 ||
        !["STUDENT", "TEACHER", "ADMIN"].includes(role)
    ) {
        return null;
    }

    // ==================================================
    // [02] TRUY VẤN PHÂN QUYỀN TRONG MYSQL
    // ==================================================

    const [rows] = await pool.query(
        `SELECT
            d.document_id,
            d.title,
            d.subject_id,
            d.visibility,
            d.status,
            d.review_status
         FROM documents d
         WHERE d.document_id = ?
           AND d.deleted_at IS NULL
           AND (
               -- Tài liệu công khai đã xử lý và phê duyệt
               (
                   d.visibility = 'PUBLIC'
                   AND d.status = 'READY'
                   AND d.review_status = 'APPROVED'
               )

               OR

               -- Giảng viên phụ trách môn học
               (
                   ? = 'TEACHER'
                   AND EXISTS (
                       SELECT 1
                       FROM subject_teachers st
                       WHERE st.subject_id = d.subject_id
                         AND st.teacher_id = ?
                   )
               )

               OR

               -- Admin quản lý tài liệu dùng chung
               (
                   ? = 'ADMIN'
                   AND d.subject_id IS NULL
               )
           )
         LIMIT 1`,
        [
            documentId,
            role,
            userId,
            role
        ]
    );

    // Không tồn tại hoặc không có quyền
    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

// ======================================================
// [03] XUẤT DỊCH VỤ
// ======================================================

module.exports = {
    checkDocumentRagAccess
};
