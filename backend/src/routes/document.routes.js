
const express = require("express");
const multer = require("multer");
const router = express.Router();

// Middleware xác thực và phân quyền
const verifyToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

// Cấu hình Multer để tiếp nhận file upload
const upload = require("../config/upload");

// Import các controller tài liệu
const {
    getPendingDocuments,
    getPublicDocuments,
    approveDocument,
    rejectDocument,
    uploadDocument
} = require("../controllers/document.controller");

// ======================================================
// MIDDLEWARE XỬ LÝ LỖI UPLOAD
// ======================================================

// Tiếp nhận file và xử lý lỗi phát sinh từ Multer
const handleDocumentUpload = (req, res, next) => {
    upload.single("file")(req, res, (error) => {
        if (error) {
            console.log("Multer error code:", error.code);
            console.log("Multer error field:", error.field);
            console.log("Multer error stack:", error.stack);
            // Xử lý lỗi khi file vượt quá dung lượng cho phép
            if (
                error instanceof multer.MulterError &&
                error.code === "LIMIT_FILE_SIZE"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "File vượt quá dung lượng tối đa 500 MB"
                });
            }

            // Xử lý lỗi định dạng file hoặc lỗi upload khác
            return res.status(400).json({
                success: false,
                message: error.message || "Không thể upload file"
            });
        }

        // Không có lỗi thì chuyển sang controller
        next();
    });
};

// ======================================================
// 1. UPLOAD TÀI LIỆU
// POST /api/documents/upload
// ======================================================

// Chỉ ADMIN và TEACHER được phép upload tài liệu
// Xác thực và phân quyền trước khi tiếp nhận file
router.post(
    "/upload",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    handleDocumentUpload,
    uploadDocument
);

// ======================================================
// 2. LẤY DANH SÁCH TÀI LIỆU CÔNG KHAI
// GET /api/documents/public
// ======================================================

router.get(
    "/public",
    verifyToken,
    authorizeRoles("STUDENT"),
    getPublicDocuments
);

// ======================================================
// 3. LẤY DANH SÁCH TÀI LIỆU CHỜ DUYỆT
// GET /api/documents/pending
// ======================================================

router.get(
    "/pending",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    getPendingDocuments
);

// ======================================================
// 4. DUYỆT TÀI LIỆU
// PATCH /api/documents/:id/approve
// ======================================================

router.patch(
    "/:id/approve",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    approveDocument
);

// ======================================================
// 5. TỪ CHỐI TÀI LIỆU
// PATCH /api/documents/:id/reject
// ======================================================

router.patch(
    "/:id/reject",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    rejectDocument
);

module.exports = router;
