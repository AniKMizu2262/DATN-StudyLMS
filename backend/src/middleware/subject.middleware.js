
const pool = require("../config/database");

// Kiểm tra quyền truy cập môn học của giảng viên
const verifySubjectTeacher = async (req, res, next) => {
    try {
        const subjectId = Number(req.params.subjectId);

        // Kiểm tra mã môn học
        if (!Number.isInteger(subjectId) || subjectId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã môn học không hợp lệ"
            });
        }

        // Chỉ ADMIN và TEACHER được sử dụng middleware này
        if (req.user.role === "ADMIN") {
            return next();
        }

        if (req.user.role !== "TEACHER") {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập môn học này"
            });
        }

        // Kiểm tra giảng viên có được phân công môn học không
        const [rows] = await pool.query(
            `SELECT subject_id
             FROM subject_teachers
             WHERE subject_id = ?
               AND teacher_id = ?`,
            [subjectId, req.user.userId]
        );

        if (rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Bạn chưa được phân công giảng dạy môn học này"
            });
        }

        next();

    } catch (error) {
        console.error("Subject authorization error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể kiểm tra quyền truy cập môn học"
        });
    }
};

module.exports = verifySubjectTeacher;
