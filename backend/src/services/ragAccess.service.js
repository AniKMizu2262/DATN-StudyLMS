"use strict";

const pool = require("../config/database");

// ======================================================
// KDOCUMENT | DAY20 - KIỂM TRA QUYỀN TRUY CẬP RAG
//
// NHIỆM VỤ:
// 1. Kiểm tra người dùng đã xác thực.
// 2. Kiểm tra tài liệu tồn tại và chưa bị xóa mềm.
// 3. Chỉ cho phép hỏi tài liệu đã xử lý RAG (READY).
// 4. Xác định quyền truy cập theo vai trò.
//
// NGHIỆP VỤ:
// - STUDENT: Hỏi tài liệu PUBLIC + APPROVED.
// - TEACHER: Hỏi tài liệu PUBLIC hoặc tài liệu
//            thuộc môn đang được phân công.
// - ADMIN: Hỏi tài liệu PUBLIC hoặc tài liệu dùng chung.
//
// Điều kiện READY và chưa xóa mềm áp dụng cho tất cả.
//
// Không phụ thuộc subjects.status (ACTIVE/INACTIVE),
// vì trạng thái môn học tách biệt với quyền hỏi đáp.
// ======================================================

// ======================================================
// [A] KIỂM TRA USER ID
// ======================================================

// Chấp nhận userId từ JWT ở dạng số hoặc chuỗi số.
//
// Không dùng userId do frontend tự truyền trong body.
//
// Những ID không hợp lệ sẽ trả về null để không
// thực hiện truy vấn phân quyền với dữ liệu sai.
const parseUserId = (value) => {

    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0
            ? value
            : null;
    }

    if (
        typeof value === "string" &&
        /^[1-9]\d*$/.test(value)
    ) {
        const id = Number(value);

        return Number.isSafeInteger(id)
            ? id
            : null;
    }

    return null;
};

// ======================================================
// [B] KIỂM TRA QUYỀN TRUY CẬP RAG
// ======================================================

const checkDocumentRagAccess = async (documentId, user) => {

    // --------------------------------------------------
    // [01] KIỂM TRA DOCUMENT ID
    // --------------------------------------------------

    // rag.controller.js đã chuẩn hóa document_id.
    // Service vẫn kiểm tra lại để tránh dùng sai
    // khi được gọi từ controller khác.
    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
    ) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    // --------------------------------------------------
    // [02] KIỂM TRA THÔNG TIN ĐĂNG NHẬP
    // --------------------------------------------------

    if (!user || typeof user !== "object") {
        return null;
    }

    const userId = parseUserId(user.userId);

    // Giữ tương thích với middleware JWT hiện tại.
    const role = String(user.role || "").toUpperCase();

    if (
        userId === null ||
        !["STUDENT", "TEACHER", "ADMIN"].includes(role)
    ) {
        return null;
    }

    // --------------------------------------------------
    // [03] TRUY VẤN MYSQL CÓ KIỂM TRA QUYỀN
    // --------------------------------------------------

    // Toàn bộ điều kiện được kiểm tra ngay trong SQL.
    //
    // Điều kiện bắt buộc cho mọi vai trò:
    //
    // - document_id phải tồn tại.
    // - deleted_at IS NULL.
    // - status = READY.
    //
    // Sau đó áp dụng một trong ba nhóm quyền:
    //
    // A. Tài liệu PUBLIC + APPROVED.
    //
    // B. TEACHER đang phụ trách môn học đó.
    //
    // C. ADMIN quản lý tài liệu dùng chung.
    //
    // Sử dụng placeholder (?) để chống SQL injection.
    const [rows] = await pool.query(
        `
        SELECT
            d.document_id,
            d.title,
            d.subject_id,
            d.visibility,
            d.status,
            d.review_status

        FROM documents d

        WHERE d.document_id = ?

          -- Không cho hỏi tài liệu đã xóa mềm.
          AND d.deleted_at IS NULL

          -- Tài liệu phải xử lý xong PDF và embedding.
          -- Điều kiện này áp dụng cho mọi vai trò.
          AND d.status = 'READY'

          AND (

              -- =======================================
              -- [A] TÀI LIỆU CÔNG KHAI
              -- =======================================

              (
                  d.visibility = 'PUBLIC'
                  AND d.review_status = 'APPROVED'
              )

              OR

              -- =======================================
              -- [B] GIẢNG VIÊN PHỤ TRÁCH MÔN HỌC
              -- =======================================

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

              -- =======================================
              -- [C] ADMIN QUẢN LÝ TÀI LIỆU DÙNG CHUNG
              -- =======================================

              (
                  ? = 'ADMIN'
                  AND d.subject_id IS NULL
              )
          )

        LIMIT 1
        `,
        [
            documentId,
            role,
            userId,
            role
        ]
    );

    // --------------------------------------------------
    // [04] XỬ LÝ KẾT QUẢ
    // --------------------------------------------------

    // Không có bản ghi phù hợp có thể nghĩa là:
    //
    // - Tài liệu không tồn tại.
    // - Tài liệu đã bị xóa mềm.
    // - Tài liệu chưa READY.
    // - Người dùng không có quyền truy cập.
    //
    // Trả null thay vì thông tin chi tiết,
    // tránh tiết lộ trạng thái tài liệu không được phép xem.
    if (rows.length === 0) {
        return null;
    }

    // Người dùng có quyền RAG trên tài liệu.
    return rows[0];
};

// ======================================================
// [C] EXPORT SERVICE
// ======================================================

// Giữ nguyên tên export để tương thích rag.controller.js.
module.exports = {
    checkDocumentRagAccess
};