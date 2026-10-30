const pool = require("../config/database");

// GET /api/subjects
// Lấy danh sách môn học
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

        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error("Get all subjects error:", error.message);

        res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách môn học"
        });
    }
};

// GET /api/subjects/:id
// Lấy thông tin một môn học theo ID
const getSubjectById = async (req, res) => {
    try {
        const subjectId = Number(req.params.id);

        // ID phải là số nguyên dương hợp lệ
        if (!Number.isInteger(subjectId) || subjectId <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID môn học không hợp lệ"
            });
        }

        // Dùng dấu ? để truyền tham số an toàn, tránh SQL Injection
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

        res.status(200).json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error("Get subject by ID error:", error.message);

        res.status(500).json({
            success: false,
            message: "Không thể lấy thông tin môn học"
        });
    }
};

module.exports = {
    getAllSubjects,
    getSubjectById
};