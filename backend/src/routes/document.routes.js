
const express = require("express");
const multer = require("multer");
const router = express.Router();

// Middleware xác thực và phân quyền
const verifyToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

// Cấu hình tải tài liệu lên máy chủ
const upload = require("../config/upload");

// Các hàm xử lý tài liệu
const {
    getPendingDocuments,
    getPublicDocuments,
    approveDocument,
    rejectDocument,
    uploadDocument,
    getDocumentDetails,
    downloadDocument
} = require("../controllers/document.controller");

// ======================================================
// MIDDLEWARE XỬ LÝ LỖI UPLOAD
// ======================================================

const handleDocumentUpload = (req, res, next) => {
    upload.single("file")(req, res, (error) => {
        if (error) {
            console.error("Lỗi tải tài liệu:", error.message);

            // Kiểm tra dung lượng tối đa
            if (
                error instanceof multer.MulterError &&
                error.code === "LIMIT_FILE_SIZE"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "File vượt quá dung lượng tối đa 500 MB"
                });
            }

            // Các lỗi upload khác
            return res.status(400).json({
                success: false,
                message: error.message || "Không thể tải tài liệu lên"
            });
        }

        next();
    });
};

// ======================================================
// 1. TẢI TÀI LIỆU LÊN
// POST /api/documents/upload
// ======================================================

router.post(
    "/upload",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    handleDocumentUpload,
    uploadDocument
);

// ======================================================
// 2. DANH SÁCH TÀI LIỆU CÔNG KHAI
// GET /api/documents/public
// ======================================================

router.get(
    "/public",
    verifyToken,
    authorizeRoles("STUDENT"),
    getPublicDocuments
);

// ======================================================
// 3. DANH SÁCH TÀI LIỆU CHỜ DUYỆT
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

// ======================================================
// 6. TẢI FILE PDF
// GET /api/documents/:id/download
// ======================================================

router.get(
    "/:id/download",
    verifyToken,
    downloadDocument
);

// ======================================================
// 7. XEM CHI TIẾT TÀI LIỆU
// GET /api/documents/:id
// ======================================================

router.get(
    "/:id",
    verifyToken,
    getDocumentDetails
);

// Xuất router
module.exports = router;
