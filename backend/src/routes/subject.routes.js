
const express = require("express");

// ======================================================
// KDOCUMENT - SUBJECT ROUTES
//
// [01] Middleware phân quyền
// [02] API danh sách môn học
// [03] API dành cho giảng viên
// [04] API quản lý môn học
// [05] API phân công giảng viên
// [06] API tài liệu theo môn học
// [07] API chi tiết môn học
// [08] Export router
// ======================================================

// [01] Import middleware.
const verifyToken = require("../middleware/auth.middleware");
const verifySubjectTeacher = require("../middleware/subject.middleware");

// [02] Import controller.
const {
    getAllSubjects,
    getSubjectById,
    getMySubjects,
    createSubject,
    updateSubject,
    assignSubjectTeacher,
    getAvailableTeachers,
    getSubjectTeachers,
    removeSubjectTeacher,
    getSubjectDocuments
} = require("../controllers/subject.controller");

const router = express.Router();

// ======================================================
// [01] MIDDLEWARE PHÂN QUYỀN ADMIN
// ======================================================

const verifyAdmin = (req, res, next) => {
    // Middleware này phải chạy sau verifyToken.
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({
            success: false,
            message: "Chỉ quản trị viên được thực hiện"
        });
    }

    next();
};

// ======================================================
// [02] API DANH SÁCH MÔN HỌC
// ======================================================

// [02.1] Lấy tất cả môn học.
// GET /api/subjects
router.get("/", getAllSubjects);

// ======================================================
// [03] API DÀNH CHO GIẢNG VIÊN
// ======================================================

// [03.1] Lấy môn học giảng viên phụ trách.
// GET /api/subjects/mine
router.get(
    "/mine",
    verifyToken,
    getMySubjects
);

// [03.2] Kiểm tra quyền phụ trách môn học.
// GET /api/subjects/:subjectId/teacher-access
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

// ======================================================
// [04] API QUẢN LÝ MÔN HỌC - ADMIN
// ======================================================

// [04.1] Tạo môn học mới.
// POST /api/subjects
router.post(
    "/",
    verifyToken,
    verifyAdmin,
    createSubject
);

// [04.2] Cập nhật thông tin môn học.
// PATCH /api/subjects/:id
router.patch(
    "/:id",
    verifyToken,
    verifyAdmin,
    updateSubject
);

// ======================================================
// [05] API QUẢN LÝ PHÂN CÔNG GIẢNG VIÊN - ADMIN
// ======================================================

// [05.1] Lấy danh sách tài khoản TEACHER.
// GET /api/subjects/admin/teachers
router.get(
    "/admin/teachers",
    verifyToken,
    verifyAdmin,
    getAvailableTeachers
);

// [05.2] Lấy giảng viên đang phụ trách môn học.
// GET /api/subjects/:id/teachers
router.get(
    "/:id/teachers",
    verifyToken,
    verifyAdmin,
    getSubjectTeachers
);

// [05.3] Phân công giảng viên vào môn học.
// POST /api/subjects/:id/teachers
router.post(
    "/:id/teachers",
    verifyToken,
    verifyAdmin,
    assignSubjectTeacher
);

// [05.4] Gỡ phân công giảng viên.
// DELETE /api/subjects/:id/teachers/:teacherId
router.delete(
    "/:id/teachers/:teacherId",
    verifyToken,
    verifyAdmin,
    removeSubjectTeacher
);

// ======================================================
// [06] API TÀI LIỆU THEO MÔN HỌC
// ======================================================

// [06.1] Lấy tài liệu thuộc một môn học.
// GET /api/subjects/:id/documents
//
// Yêu cầu đăng nhập.
// Controller xử lý quyền theo vai trò:
// - ADMIN
// - TEACHER
// - STUDENT
router.get(
    "/:id/documents",
    verifyToken,
    getSubjectDocuments
);

// ======================================================
// [07] API CHI TIẾT MÔN HỌC
//
// Đặt GET /:id sau các GET có đường dẫn cụ thể.
// ======================================================

// [07.1] Lấy thông tin môn học theo ID.
// GET /api/subjects/:id
router.get(
    "/:id",
    getSubjectById
);

// ======================================================
// [08] EXPORT ROUTER
// ======================================================

module.exports = router;
