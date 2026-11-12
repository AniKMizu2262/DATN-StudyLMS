
const pool = require("../config/database");

// ======================================================
// KDOCUMENT - TÌM KIẾM VÀ LỌC TÀI LIỆU
// Day10 - API: GET /api/documents/search
// ======================================================

// [01] DANH SÁCH GIÁ TRỊ HỢP LỆ
const validDocumentTypes = [
    "LECTURE",
    "REFERENCE",
    "QUESTION_BANK",
    "EXAM",
    "OTHER"
];

const validSourceTypes = [
    "OFFICIAL",
    "SUPPLEMENTARY"
];

// [02] XỬ LÝ TÌM KIẾM
const searchDocuments = async (req, res) => {
    try {
        // Lấy bộ lọc từ URL
        const {
            q = "",
            subject_id,
            document_type,
            source_type
        } = req.query;

        // ----------------------------------------------
        // 2.1. Kiểm tra từ khóa
        // ----------------------------------------------
        if (typeof q !== "string" || q.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Từ khóa tìm kiếm không hợp lệ hoặc quá 100 ký tự"
            });
        }

        // ----------------------------------------------
        // 2.2. Kiểm tra các bộ lọc
        // ----------------------------------------------
        let subjectId = null;

        if (subject_id !== undefined && subject_id !== "") {
            subjectId = Number(subject_id);

            if (
                typeof subject_id !== "string" ||
                !/^[1-9]\d*$/.test(subject_id) ||
                !Number.isSafeInteger(subjectId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Mã môn học không hợp lệ"
                });
            }
        }

        if (
            document_type !== undefined &&
            document_type !== "" &&
            !validDocumentTypes.includes(document_type)
        ) {
            return res.status(400).json({
                success: false,
                message: "Loại tài liệu không hợp lệ"
            });
        }

        if (
            source_type !== undefined &&
            source_type !== "" &&
            !validSourceTypes.includes(source_type)
        ) {
            return res.status(400).json({
                success: false,
                message: "Nguồn tài liệu không hợp lệ"
            });
        }

        // ----------------------------------------------
        // 2.3. Kiểm tra vai trò người dùng
        // ----------------------------------------------
        const role = req.user?.role;
        const userId = req.user?.userId;

        if (!["STUDENT", "TEACHER", "ADMIN"].includes(role)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền tìm kiếm tài liệu"
            });
        }

        // ----------------------------------------------
        // 2.4. Truy vấn tài liệu có phân quyền
        // ----------------------------------------------
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
                  (
                      d.visibility = 'PUBLIC'
                      AND d.status = 'READY'
                      AND d.review_status = 'APPROVED'
                  )
                  OR (
                      ? = 'TEACHER'
                      AND EXISTS (
                          SELECT 1
                          FROM subject_teachers st
                          WHERE st.subject_id = d.subject_id
                            AND st.teacher_id = ?
                      )
                  )
                  OR (
                      ? = 'ADMIN'
                      AND d.subject_id IS NULL
                  )
              )
        `;

        const params = [role, userId, role];

        // ----------------------------------------------
        // 2.5. Tìm theo từ khóa
        // ----------------------------------------------
        if (q.trim()) {
            // Coi %, _ và ! là ký tự thường, không phải wildcard.
            const keyword = `%${q.trim().replace(
                /[!%_]/g,
                (char) => `!${char}`
            )}%`;

            sql += `
                AND (
                    d.title LIKE ? ESCAPE '!'
                    OR s.subject_name LIKE ? ESCAPE '!'
                    OR s.subject_code LIKE ? ESCAPE '!'
                )
            `;

            params.push(keyword, keyword, keyword);
        }

        // ----------------------------------------------
        // 2.6. Lọc theo môn học
        // ----------------------------------------------
        if (subjectId !== null) {
            sql += " AND d.subject_id = ?";
            params.push(subjectId);
        }

        // ----------------------------------------------
        // 2.7. Lọc theo loại tài liệu
        // ----------------------------------------------
        if (document_type) {
            sql += " AND d.document_type = ?";
            params.push(document_type);
        }

        // ----------------------------------------------
        // 2.8. Lọc theo nguồn tài liệu
        // ----------------------------------------------
        if (source_type) {
            sql += " AND d.source_type = ?";
            params.push(source_type);
        }

        // ----------------------------------------------
        // 2.9. Sắp xếp và giới hạn kết quả
        // ----------------------------------------------
        sql += `
            ORDER BY d.created_at DESC, d.document_id DESC
            LIMIT 50
        `;

        const [rows] = await pool.query(sql, params);

        return res.status(200).json({
            success: true,
            message: "Tìm kiếm tài liệu thành công",
            data: rows,
            count: rows.length
        });

    } catch (error) {
        console.error("Search documents error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể tìm kiếm tài liệu"
        });
    }
};

// ======================================================
// XUẤT CONTROLLER
// ======================================================

module.exports = {
    searchDocuments
};
