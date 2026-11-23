
const pool = require("../config/database");

// ======================================================
// KDOCUMENT - SUBJECT CONTROLLER
//
// [01] GET   /api/subjects
// [02] GET   /api/subjects/:id
// [03] GET   /api/subjects/mine
// [04] POST  /api/subjects
// [05] PATCH /api/subjects/:id
// [06] POST  /api/subjects/:id/teachers
// [07] GET   /api/subjects/admin/teachers
// [08] GET   /api/subjects/:id/teachers
//
// Lưu ý:
// - Router chịu trách nhiệm xác thực và phân quyền.
// - Giảng viên và môn học liên kết qua subject_teachers.
// - Môn INACTIVE vẫn có thể được giảng viên phụ trách.
// ======================================================


// ======================================================
// [01] LẤY DANH SÁCH MÔN HỌC
// GET /api/subjects
// ======================================================

const getAllSubjects = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                subject_id,
                subject_code,
                subject_name,
                description,
                status,
                created_at,
                updated_at
            FROM subjects
            ORDER BY subject_id ASC
        `);

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Get all subjects error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách môn học"
        });
    }
};


// ======================================================
// [02] LẤY CHI TIẾT MỘT MÔN HỌC
// GET /api/subjects/:id
// ======================================================

const getSubjectById = async (req, res) => {
    try {
        const subjectId = Number(req.params.id);

        // [02.1] Kiểm tra ID môn học.
        if (
            !Number.isSafeInteger(subjectId) ||
            subjectId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "ID môn học không hợp lệ"
            });
        }

        // [02.2] Truy vấn môn học theo ID.
        const [rows] = await pool.query(
            `SELECT
                subject_id,
                subject_code,
                subject_name,
                description,
                status,
                created_at,
                updated_at
             FROM subjects
             WHERE subject_id = ?`,
            [subjectId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy môn học"
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("Get subject by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy thông tin môn học"
        });
    }
};


// ======================================================
// [03] LẤY MÔN HỌC GIẢNG VIÊN PHỤ TRÁCH
// GET /api/subjects/mine
// Quyền: TEACHER
// ======================================================

const getMySubjects = async (req, res) => {
    try {
        // [03.1] Kiểm tra vai trò.
        if (req.user?.role !== "TEACHER") {
            return res.status(403).json({
                success: false,
                message: "Chức năng chỉ dành cho giảng viên"
            });
        }

        // [03.2] Lấy ID giảng viên từ JWT.
        const teacherId = Number(req.user.userId);

        if (
            !Number.isSafeInteger(teacherId) ||
            teacherId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message: "Thông tin đăng nhập không hợp lệ"
            });
        }

        // [03.3] Lấy môn được phân công.
        // Không loại bỏ môn INACTIVE.
        const [rows] = await pool.query(
            `SELECT
                s.subject_id,
                s.subject_code,
                s.subject_name,
                s.description,
                s.status,
                s.created_at,
                s.updated_at
             FROM subjects AS s
             INNER JOIN subject_teachers AS st
                 ON st.subject_id = s.subject_id
             WHERE st.teacher_id = ?
             ORDER BY s.subject_id ASC`,
            [teacherId]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Get my subjects error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể tải danh sách môn phụ trách"
        });
    }
};


// ======================================================
// [04] ADMIN - TẠO MÔN HỌC
// POST /api/subjects
// ======================================================

const createSubject = async (req, res) => {
    try {
        // [04.1] Nhận dữ liệu.
        const {
            subject_code,
            subject_name,
            description = "",
            status = "ACTIVE"
        } = req.body || {};

        // [04.2] Chuẩn hóa mã và tên môn học.
        const code = typeof subject_code === "string"
            ? subject_code.trim()
            : "";

        const name = typeof subject_name === "string"
            ? subject_name.trim()
            : "";

        // [04.3] Kiểm tra dữ liệu bắt buộc.
        if (
            !code || code.length > 50 ||
            !name || name.length > 150
        ) {
            return res.status(400).json({
                success: false,
                message: "Mã hoặc tên môn học không hợp lệ"
            });
        }

        // [04.4] Kiểm tra mô tả và trạng thái.
        if (typeof description !== "string") {
            return res.status(400).json({
                success: false,
                message: "Mô tả môn học không hợp lệ"
            });
        }

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái môn học không hợp lệ"
            });
        }

        // [04.5] Thêm môn học vào MySQL.
        const [result] = await pool.query(
            `INSERT INTO subjects (
                subject_code,
                subject_name,
                description,
                status,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [
                code,
                name,
                description.trim(),
                status
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Tạo môn học thành công",
            data: {
                subject_id: result.insertId
            }
        });

    } catch (error) {
        // [04.6] Xử lý mã môn bị trùng.
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Mã môn học đã tồn tại"
            });
        }

        console.error("Create subject error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể tạo môn học"
        });
    }
};


// ======================================================
// [05] ADMIN - CẬP NHẬT MÔN HỌC
// PATCH /api/subjects/:id
//
// Chỉ cập nhật các trường được gửi lên.
// Không ghi đè các trường không có trong request.
// ======================================================

const updateSubject = async (req, res) => {
    try {
        // [05.1] Kiểm tra ID môn học.
        const subjectId = Number(req.params.id);

        if (
            !Number.isSafeInteger(subjectId) ||
            subjectId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "ID môn học không hợp lệ"
            });
        }

        // [05.2] Chỉ cho phép cập nhật 4 trường này.
        const allowedFields = [
            "subject_code",
            "subject_name",
            "description",
            "status"
        ];

        const updates = [];
        const values = [];
        const body = req.body || {};

        // [05.3] Kiểm tra dữ liệu từng trường.
        for (const field of allowedFields) {
            const hasField = Object.prototype.hasOwnProperty.call(
                body,
                field
            );

            if (!hasField) continue;

            let value = body[field];

            if (typeof value !== "string") {
                return res.status(400).json({
                    success: false,
                    message: `${field} không hợp lệ`
                });
            }

            value = value.trim();

            // [05.4] Kiểm tra độ dài và trạng thái.
            const invalid =
                (field === "subject_code" &&
                    (!value || value.length > 50)) ||
                (field === "subject_name" &&
                    (!value || value.length > 150)) ||
                (field === "status" &&
                    !["ACTIVE", "INACTIVE"].includes(value));

            if (invalid) {
                return res.status(400).json({
                    success: false,
                    message: `${field} không hợp lệ`
                });
            }

            // Tên cột lấy từ danh sách cố định phía backend.
            updates.push(`${field} = ?`);
            values.push(value);
        }

        // [05.5] Không có trường nào để cập nhật.
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Không có dữ liệu cần cập nhật"
            });
        }

        // [05.6] Thực hiện cập nhật.
        updates.push("updated_at = NOW()");
        values.push(subjectId);

        const [result] = await pool.query(
            `UPDATE subjects
             SET ${updates.join(", ")}
             WHERE subject_id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy môn học"
            });
        }

        // [05.7] Lấy dữ liệu mới sau cập nhật.
        const [rows] = await pool.query(
            "SELECT * FROM subjects WHERE subject_id = ?",
            [subjectId]
        );

        return res.status(200).json({
            success: true,
            message: "Cập nhật môn học thành công",
            data: rows[0]
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Mã môn học đã tồn tại"
            });
        }

        console.error("Update subject error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật môn học"
        });
    }
};


// ======================================================
// [06] ADMIN - PHÂN CÔNG GIẢNG VIÊN
// POST /api/subjects/:id/teachers
//
// Một môn học có thể có nhiều giảng viên.
// Không phân công trùng cùng một giảng viên.
// ======================================================

const assignSubjectTeacher = async (req, res) => {
    try {
        // [06.1] Lấy ID môn và giảng viên.
        const subjectId = Number(req.params.id);
        const teacherId = Number(req.body?.teacher_id);

        if (
            !Number.isSafeInteger(subjectId) ||
            subjectId <= 0 ||
            !Number.isSafeInteger(teacherId) ||
            teacherId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "ID môn học hoặc giảng viên không hợp lệ"
            });
        }

        // [06.2] Kiểm tra môn học tồn tại.
        const [subjects] = await pool.query(
            `SELECT subject_id
             FROM subjects
             WHERE subject_id = ?`,
            [subjectId]
        );

        if (subjects.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy môn học"
            });
        }

        // [06.3] Kiểm tra tài khoản giảng viên.
        const [teachers] = await pool.query(
            `SELECT user_id
             FROM users
             WHERE user_id = ?
               AND role = 'TEACHER'`,
            [teacherId]
        );

        if (teachers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giảng viên hợp lệ"
            });
        }

        // [06.4] Kiểm tra phân công đã tồn tại.
        const [existing] = await pool.query(
            `SELECT subject_id
             FROM subject_teachers
             WHERE subject_id = ?
               AND teacher_id = ?`,
            [subjectId, teacherId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Giảng viên đã phụ trách môn học này"
            });
        }

        // [06.5] Lưu phân công.
        await pool.query(
            `INSERT INTO subject_teachers
                (subject_id, teacher_id)
             VALUES (?, ?)`,
            [subjectId, teacherId]
        );

        return res.status(201).json({
            success: true,
            message: "Phân công giảng viên thành công",
            data: {
                subject_id: subjectId,
                teacher_id: teacherId
            }
        });

    } catch (error) {
        // [06.6] Xử lý trùng phân công ở cấp MySQL.
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Giảng viên đã phụ trách môn học này"
            });
        }

        console.error("Assign subject teacher error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể phân công giảng viên"
        });
    }
};


// ======================================================
// [07] ADMIN - DANH SÁCH GIẢNG VIÊN
// GET /api/subjects/admin/teachers
// ======================================================

const getAvailableTeachers = async (req, res) => {
    try {
        // [07.1] Chỉ lấy tài khoản TEACHER.
        const [rows] = await pool.query(
            `SELECT
                user_id,
                full_name,
                email
             FROM users
             WHERE role = 'TEACHER'
             ORDER BY full_name ASC, user_id ASC`
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Get teachers error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách giảng viên"
        });
    }
};


// ======================================================
// [08] ADMIN - GIẢNG VIÊN ĐANG PHỤ TRÁCH MÔN
// GET /api/subjects/:id/teachers
// ======================================================

const getSubjectTeachers = async (req, res) => {
    try {
        // [08.1] Kiểm tra ID môn học.
        const subjectId = Number(req.params.id);

        if (
            !Number.isSafeInteger(subjectId) ||
            subjectId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "ID môn học không hợp lệ"
            });
        }

        // [08.2] Kiểm tra môn học tồn tại.
        const [subjects] = await pool.query(
            `SELECT subject_id
             FROM subjects
             WHERE subject_id = ?`,
            [subjectId]
        );

        if (subjects.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy môn học"
            });
        }

        // [08.3] Lấy giảng viên được phân công.
        const [rows] = await pool.query(
            `SELECT
                u.user_id,
                u.full_name,
                u.email
             FROM subject_teachers AS st
             INNER JOIN users AS u
                 ON u.user_id = st.teacher_id
             WHERE st.subject_id = ?
             ORDER BY u.full_name ASC, u.user_id ASC`,
            [subjectId]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Get subject teachers error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy giảng viên phụ trách"
        });
    }
};

// ======================================================
// [09] ADMIN - GỠ PHÂN CÔNG GIẢNG VIÊN
// DELETE /api/subjects/:id/teachers/:teacherId
//
// Chỉ xóa quan hệ trong bảng subject_teachers.
// Không xóa tài khoản, môn học hoặc tài liệu.
// ======================================================

const removeSubjectTeacher = async (req, res) => {
    try {
        // [01] Kiểm tra ID môn học và giảng viên.
        const subjectId = Number(req.params.id);
        const teacherId = Number(req.params.teacherId);

        if (
            !Number.isSafeInteger(subjectId) ||
            subjectId <= 0 ||
            !Number.isSafeInteger(teacherId) ||
            teacherId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "ID môn học hoặc giảng viên không hợp lệ"
            });
        }

        // [02] Chỉ xóa đúng quan hệ phân công được chọn.
        const [result] = await pool.query(
            `DELETE FROM subject_teachers
             WHERE subject_id = ?
               AND teacher_id = ?`,
            [subjectId, teacherId]
        );

        // [03] Không tìm thấy phân công.
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phân công giảng viên"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Gỡ phân công giảng viên thành công"
        });

    } catch (error) {
        console.error("Remove subject teacher error:", error);

        return res.status(500).json({
            success: false,
            message: "Không thể gỡ phân công giảng viên"
        });
    }
};


// ======================================================
// [09] EXPORT CONTROLLER
// ======================================================

module.exports = {
    getAllSubjects,
    getSubjectById,
    getMySubjects,
    createSubject,
    updateSubject,
    assignSubjectTeacher,
    getAvailableTeachers,
    getSubjectTeachers,
    removeSubjectTeacher
};
