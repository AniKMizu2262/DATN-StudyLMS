"use strict";

const pool = require("../config/database");

// ======================================================
// KDOCUMENT | DAY20 - TÌM KIẾM VÀ LỌC TÀI LIỆU
//
// API: GET /api/documents/search
//
// Nhiệm vụ:
// 1. Kiểm tra từ khóa và các bộ lọc.
// 2. Xác định tài liệu được phép truy cập theo vai trò.
// 3. Tìm kiếm bằng SQL có tham số.
// 4. Chỉ trả về tối đa 50 tài liệu.
//
// QUY TẮC PHÂN QUYỀN:
// - STUDENT: Tài liệu công khai, READY, APPROVED.
// - TEACHER: Tài liệu công khai + môn được phân công.
// - ADMIN: Tài liệu công khai + tài liệu dùng chung.
// - Không trả về tài liệu đã xóa mềm.
//
// Giữ nguyên cấu trúc JSON cho frontend.
// ======================================================

// ======================================================
// [A] CẤU HÌNH
// ======================================================

const MAX_SEARCH_LENGTH = 100;
const MAX_SEARCH_RESULTS = 50;

// Những giá trị phân loại được hệ thống hỗ trợ.
const VALID_DOCUMENT_TYPES = [
    "LECTURE",
    "REFERENCE",
    "QUESTION_BANK",
    "EXAM",
    "OTHER"
];

const VALID_SOURCE_TYPES = [
    "OFFICIAL",
    "SUPPLEMENTARY"
];

const VALID_ROLES = [
    "ADMIN",
    "TEACHER",
    "STUDENT"
];

// ======================================================
// [B] HÀM HỖ TRỢ
// ======================================================

// Kiểm tra ID môn học.
//
// Chỉ chấp nhận chuỗi số nguyên dương hệ thập phân.
// Ví dụ:
// "2"    -> hợp lệ
// "0"    -> không hợp lệ
// "-1"   -> không hợp lệ
// "1e3"  -> không hợp lệ
// "0x10" -> không hợp lệ
const parseSubjectId = (value) => {

    if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
    ) {
        return null;
    }

    const id = Number(value);

    return Number.isSafeInteger(id)
        ? id
        : null;
};

// Kiểm tra ID của người dùng.
//
// ID được lấy từ middleware xác thực JWT,
// không lấy từ query do client tự truyền lên.
const isValidUserId = (value) => {

    const id = Number(value);

    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isSafeInteger(id) &&
        id > 0
    );
};

// Escape ký tự đặc biệt trong LIKE.
//
// MySQL LIKE sử dụng:
// % : Khớp nhiều ký tự
// _ : Khớp một ký tự
//
// Nếu người dùng tìm "C++_01", hệ thống cần
// tìm đúng dấu "_" thay vì coi là wildcard.
//
// Sử dụng ký tự ! làm escape cho LIKE.
const escapeLikeKeyword = (keyword) => {

    return keyword.replace(
        /[!%_]/g,
        (char) => `!${char}`
    );
};

// ======================================================
// [C] API TÌM KIẾM TÀI LIỆU
// ======================================================

const searchDocuments = async (req, res) => {

    try {

        // ==================================================
        // [01] KIỂM TRA XÁC THỰC
        // ==================================================

        // Route đã có verifyToken.
        // Kiểm tra thêm để tránh req.user bị undefined
        // nếu controller được gọi từ nơi khác.
        if (!req.user) {

            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập"
            });
        }

        const role = req.user.role;
        const userId = req.user.userId;

        if (!VALID_ROLES.includes(role)) {

            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền tìm kiếm tài liệu"
            });
        }

        // Teacher cần userId để kiểm tra môn phụ trách.
        //
        // Nếu JWT không chứa ID hợp lệ thì không được
        // chạy truy vấn phân quyền.
        if (
            role === "TEACHER" &&
            !isValidUserId(userId)
        ) {

            return res.status(401).json({
                success: false,
                message: "Thông tin xác thực không hợp lệ"
            });
        }

        // ==================================================
        // [02] LẤY THAM SỐ TỪ QUERY
        // ==================================================

        const {
            q = "",
            subject_id,
            document_type,
            source_type
        } = req.query || {};

        // ==================================================
        // [03] KIỂM TRA TỪ KHÓA
        // ==================================================

        // Không cho phép object hoặc array làm từ khóa.
        //
        // Ví dụ q[]=abc có thể tạo thành array,
        // nhưng API chỉ hỗ trợ một chuỗi tìm kiếm.
        if (typeof q !== "string") {

            return res.status(400).json({
                success: false,
                message: "Từ khóa tìm kiếm không hợp lệ"
            });
        }

        const keyword = q.trim();

        if (keyword.length > MAX_SEARCH_LENGTH) {

            return res.status(400).json({
                success: false,
                message: "Từ khóa tìm kiếm không hợp lệ hoặc quá 100 ký tự"
            });
        }

        // ==================================================
        // [04] KIỂM TRA SUBJECT ID
        // ==================================================

        let subjectId = null;

        // Không truyền subject_id nghĩa là tìm toàn hệ thống
        // trong phạm vi quyền của người dùng.
        if (
            subject_id !== undefined &&
            subject_id !== ""
        ) {

            subjectId = parseSubjectId(subject_id);

            if (subjectId === null) {

                return res.status(400).json({
                    success: false,
                    message: "Mã môn học không hợp lệ"
                });
            }
        }

        // ==================================================
        // [05] KIỂM TRA DOCUMENT TYPE
        // ==================================================

        if (
            document_type !== undefined &&
            document_type !== "" &&
            !VALID_DOCUMENT_TYPES.includes(document_type)
        ) {

            return res.status(400).json({
                success: false,
                message: "Loại tài liệu không hợp lệ"
            });
        }

        // ==================================================
        // [06] KIỂM TRA SOURCE TYPE
        // ==================================================

        if (
            source_type !== undefined &&
            source_type !== "" &&
            !VALID_SOURCE_TYPES.includes(source_type)
        ) {

            return res.status(400).json({
                success: false,
                message: "Nguồn tài liệu không hợp lệ"
            });
        }

        // ==================================================
        // [07] XÂY DỰNG ĐIỀU KIỆN PHÂN QUYỀN
        // ==================================================

        // Tài liệu công khai là tài liệu đáp ứng đủ:
        // PUBLIC + READY + APPROVED.
        //
        // Mọi vai trò hợp lệ đều được xem.
        const accessConditions = [

            `(
                d.visibility = 'PUBLIC'
                AND d.status = 'READY'
                AND d.review_status = 'APPROVED'
            )`

        ];

        const params = [];

        // --------------------------------------------------
        // TEACHER
        // --------------------------------------------------

        if (role === "TEACHER") {

            // Teacher xem thêm tài liệu của những môn
            // đang được phân công phụ trách.
            //
            // Không phụ thuộc visibility hoặc review_status
            // vì Teacher có quyền quản lý các tài liệu đó.
            accessConditions.push(
                `EXISTS (
                    SELECT 1
                    FROM subject_teachers st
                    WHERE st.subject_id = d.subject_id
                      AND st.teacher_id = ?
                )`
            );

            params.push(Number(userId));
        }

        // --------------------------------------------------
        // ADMIN
        // --------------------------------------------------

        if (role === "ADMIN") {

            // Admin xem thêm tài liệu dùng chung.
            //
            // Không tự động cấp Admin quyền xem mọi
            // tài liệu PRIVATE thuộc môn của Teacher.
            accessConditions.push(
                "d.subject_id IS NULL"
            );
        }

        // --------------------------------------------------
        // STUDENT
        // --------------------------------------------------

        // Student không được thêm điều kiện truy cập.
        // Vì vậy chỉ thấy tài liệu công khai hợp lệ.

        // ==================================================
        // [08] TẠO TRUY VẤN CHÍNH
        // ==================================================

        let sql = `
            SELECT
                d.document_id,
                d.subject_id,
                s.subject_code,
                s.subject_name,
                d.title,
                d.file_type,
                d.file_size,
                d.visibility,
                d.document_type,
                d.source_type,
                d.status,
                d.review_status,
                d.created_at

            FROM documents d

            LEFT JOIN subjects s
                ON d.subject_id = s.subject_id

            WHERE d.deleted_at IS NULL

              AND (
                  ${accessConditions.join(" OR ")}
              )
        `;

        // ==================================================
        // [09] TÌM THEO TỪ KHÓA
        // ==================================================

        if (keyword) {

            // Escape ký tự LIKE đặc biệt.
            //
            // Giá trị vẫn được truyền qua placeholder (?),
            // không nối trực tiếp dữ liệu người dùng vào SQL.
            const searchPattern =
                `%${escapeLikeKeyword(keyword)}%`;

            sql += `
                AND (
                    d.title LIKE ? ESCAPE '!'
                    OR s.subject_name LIKE ? ESCAPE '!'
                    OR s.subject_code LIKE ? ESCAPE '!'
                )
            `;

            params.push(
                searchPattern,
                searchPattern,
                searchPattern
            );
        }

        // ==================================================
        // [10] LỌC THEO MÔN HỌC
        // ==================================================

        if (subjectId !== null) {

            sql += `
                AND d.subject_id = ?
            `;

            params.push(subjectId);
        }

        // ==================================================
        // [11] LỌC THEO LOẠI TÀI LIỆU
        // ==================================================

        if (
            document_type !== undefined &&
            document_type !== ""
        ) {

            sql += `
                AND d.document_type = ?
            `;

            params.push(document_type);
        }

        // ==================================================
        // [12] LỌC THEO NGUỒN TÀI LIỆU
        // ==================================================

        if (
            source_type !== undefined &&
            source_type !== ""
        ) {

            sql += `
                AND d.source_type = ?
            `;

            params.push(source_type);
        }

        // ==================================================
        // [13] SẮP XẾP VÀ GIỚI HẠN KẾT QUẢ
        // ==================================================

        // Giữ giới hạn 50 kết quả như Day10.
        //
        // Chưa thêm pagination vì frontend hiện tại
        // chưa được kiểm tra cơ chế phân trang.
        //
        // Không tự ý thay đổi response count.
        sql += `
            ORDER BY
                d.created_at DESC,
                d.document_id DESC
            LIMIT ${MAX_SEARCH_RESULTS}
        `;

        // ==================================================
        // [14] THỰC HIỆN TRUY VẤN
        // ==================================================

        // pool.query truyền params an toàn vào placeholder.
        //
        // Các nhánh điều kiện quyền được tạo từ role
        // đã kiểm tra, không phải chuỗi tùy ý của client.
        const [rows] = await pool.query(
            sql,
            params
        );

        // ==================================================
        // [15] TRẢ KẾT QUẢ
        // ==================================================

        return res.status(200).json({
            success: true,
            message: "Tìm kiếm tài liệu thành công",
            data: rows,
            count: rows.length
        });

    } catch (error) {

        console.error(
            "[DOCUMENT SEARCH ERROR]",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Không thể tìm kiếm tài liệu"
        });
    }
};

// ======================================================
// [D] EXPORT CONTROLLER
// ======================================================

module.exports = {
    searchDocuments
};