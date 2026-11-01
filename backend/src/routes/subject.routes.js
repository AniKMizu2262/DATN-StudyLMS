const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth.middleware");
const verifySubjectTeacher = require("../middleware/subject.middleware");

const {
    getAllSubjects,
    getSubjectById
} = require("../controllers/subject.controller");

// GET /api/subjects
router.get("/", getAllSubjects);

// GET /api/subjects/:id
router.get("/:id", getSubjectById);

// Kiểm tra quyền truy cập môn học của giảng viên
router.get(
    "/:subjectId/teacher-access",
    verifyToken,
    verifySubjectTeacher,
    (req, res) => {
        return res.status(200).json({
            success: true,
            message: "Bạn có quyền truy cập môn học này",
            user: req.user
        });
    }
);

module.exports = router;