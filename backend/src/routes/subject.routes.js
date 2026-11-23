
const express = require("express");

const verifyToken = require("../middleware/auth.middleware");
const verifySubjectTeacher = require("../middleware/subject.middleware");

const {
    getAllSubjects,
    getSubjectById,
    getMySubjects,
    createSubject,
    updateSubject,
    assignSubjectTeacher,
    getAvailableTeachers,
    getSubjectTeachers,
    removeSubjectTeacher
} = require("../controllers/subject.controller");

// ======================================================
// KDOCUMENT - SUBJECT ROUTES
//
// [01] Middleware phân quyền ADMIN
// [02] API tra cứu môn học
// [03] API dành cho giảng viên
// [04] API quản trị môn học
// [05] API quản lý phân công giảng viên
// ======================================================

const router = express.Router();

// ======================================================
// [01] MIDDLEWARE KIỂM TRA QUYỀN ADMIN
//
// verifyToken phải chạy trước để xác thực JWT
// và cung cấp thông tin req.user.
// ======================================================

const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({
            success: false,
            message: "Chỉ quản trị viên được thực hiện"
        });
    }

    next();
};

// ======================================================
// [02] API TRA CỨU MÔN HỌC
// ======================================================

// [02.1] Lấy danh sách môn học toàn hệ thống.
// GET /api/subjects
router.get("/", getAllSubjects);

// ======================================================
// [03] API DÀNH CHO GIẢNG VIÊN
// ======================================================

// [03.1] Lấy các môn học được phân công phụ trách.
// GET /api/subjects/mine
router.get(
    "/mine",
    verifyToken,
    getMySubjects
);

// [03.2] Kiểm tra quyền phụ trách một môn học.
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
// [04] API QUẢN TRỊ MÔN HỌC
// Chỉ ADMIN được tạo hoặc cập nhật môn học.
// ======================================================

// [04.1] Tạo môn học mới.
// POST /api/subjects
router.post(
    "/",
    verifyToken,
    verifyAdmin,
    createSubject
);

// [04.2] Cập nhật mã, tên, mô tả hoặc trạng thái.
// PATCH /api/subjects/:id
router.patch(
    "/:id",
    verifyToken,
    verifyAdmin,
    updateSubject
);

// ======================================================
// [05] API QUẢN LÝ PHÂN CÔNG GIẢNG VIÊN
// Chỉ ADMIN được sử dụng các API bên dưới.
// ======================================================

// [05.1] Lấy danh sách tài khoản giảng viên.
// GET /api/subjects/admin/teachers
router.get(
    "/admin/teachers",
    verifyToken,
    verifyAdmin,
    getAvailableTeachers
);

// [05.2] Lấy giảng viên đang phụ trách một môn học.
// GET /api/subjects/:id/teachers
router.get(
    "/:id/teachers",
    verifyToken,
    verifyAdmin,
    getSubjectTeachers
);

// [05.3] Phân công giảng viên cho môn học.
// POST /api/subjects/:id/teachers
router.post(
    "/:id/teachers",
    verifyToken,
    verifyAdmin,
    assignSubjectTeacher
);

// ======================================================
// [06] API CHI TIẾT MÔN HỌC
//
// Đặt route động /:id sau các route GET cụ thể
// để tránh xung đột khi mở rộng API sau này.
// ======================================================

// ======================================================
// [ADMIN] GỠ GIẢNG VIÊN KHỎI MÔN HỌC
// DELETE /api/subjects/:id/teachers/:teacherId
// ======================================================

router.delete(
    "/:id/teachers/:teacherId",
    verifyToken,
    verifyAdmin,
    removeSubjectTeacher
);

// GET /api/subjects/:id
router.get("/:id", getSubjectById);

// ======================================================
// [07] EXPORT ROUTER
// ======================================================

module.exports = router;
