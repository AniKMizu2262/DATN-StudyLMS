
const express = require("express");
const multer = require("multer");
const router = express.Router();

// ======================================================
// [A] IMPORT MIDDLEWARE VÀ CẤU HÌNH
// ======================================================

// Xác thực và phân quyền
const verifyToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

// Cấu hình tải file PDF
const upload = require("../config/upload");

// Controller quản lý tài liệu - Day06 đến Day09
const {
    getPendingDocuments,
    getPublicDocuments,
    approveDocument,
    rejectDocument,
    uploadDocument,
    getDocumentDetails,
    downloadDocument,
    updateDocument,
    deleteDocument,
    restoreDocument
} = require("../controllers/document.controller");

// Controller tìm kiếm tài liệu - Day10
const {
    searchDocuments
} = require("../controllers/documentSearch.controller");

// ======================================================
// [B] MIDDLEWARE XỬ LÝ LỖI UPLOAD
// ======================================================

const handleDocumentUpload = (req, res, next) => {
    upload.single("file")(req, res, (error) => {
        if (error) {
            console.error("Lỗi tải tài liệu:", error.message);

            // File vượt quá dung lượng cho phép
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
// [C] ROUTE CỐ ĐỊNH - ĐẶT TRƯỚC ROUTE CÓ :id
// ======================================================

// ------------------------------------------------------
// [01] DAY07 - TẢI TÀI LIỆU LÊN
// POST /api/documents/upload
// ------------------------------------------------------

router.post(
    "/upload",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    handleDocumentUpload,
    uploadDocument
);

// ------------------------------------------------------
// [02] DAY06 - DANH SÁCH TÀI LIỆU CÔNG KHAI
// GET /api/documents/public
// ------------------------------------------------------

router.get(
    "/public",
    verifyToken,
    authorizeRoles("STUDENT"),
    getPublicDocuments
);

// ------------------------------------------------------
// [03] DAY06 - DANH SÁCH TÀI LIỆU CHỜ DUYỆT
// GET /api/documents/pending
// ------------------------------------------------------

router.get(
    "/pending",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    getPendingDocuments
);

// ------------------------------------------------------
// [04] DAY10 - TÌM KIẾM VÀ LỌC TÀI LIỆU
// GET /api/documents/search
// ------------------------------------------------------

// Quan trọng: /search phải nằm trước GET /:id
router.get(
    "/search",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER", "STUDENT"),
    searchDocuments
);

// ======================================================
// [D] ROUTE ĐỘNG - QUẢN LÝ THEO ID TÀI LIỆU
// ======================================================

// ------------------------------------------------------
// [05] DAY06 - DUYỆT TÀI LIỆU
// PATCH /api/documents/:id/approve
// ------------------------------------------------------

router.patch(
    "/:id/approve",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    approveDocument
);

// ------------------------------------------------------
// [06] DAY06 - TỪ CHỐI TÀI LIỆU
// PATCH /api/documents/:id/reject
// ------------------------------------------------------

router.patch(
    "/:id/reject",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    rejectDocument
);

// ------------------------------------------------------
// [07] DAY09 - KHÔI PHỤC TÀI LIỆU ĐÃ XÓA MỀM
// PATCH /api/documents/:id/restore
// ------------------------------------------------------

router.patch(
    "/:id/restore",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    restoreDocument
);

// ------------------------------------------------------
// [08] DAY08 - TẢI FILE PDF
// GET /api/documents/:id/download
// ------------------------------------------------------

router.get(
    "/:id/download",
    verifyToken,
    downloadDocument
);

// ------------------------------------------------------
// [09] DAY08 - XEM CHI TIẾT TÀI LIỆU
// GET /api/documents/:id
// ------------------------------------------------------

router.get(
    "/:id",
    verifyToken,
    getDocumentDetails
);

// ------------------------------------------------------
// [10] DAY09 - CẬP NHẬT THÔNG TIN TÀI LIỆU
// PATCH /api/documents/:id
// ------------------------------------------------------

router.patch(
    "/:id",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    updateDocument
);

// ------------------------------------------------------
// [11] DAY09 - XÓA MỀM TÀI LIỆU
// DELETE /api/documents/:id
// ------------------------------------------------------

router.delete(
    "/:id",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    deleteDocument
);

// ======================================================
// [E] XUẤT ROUTER - LUÔN ĐỂ CUỐI FILE
// ======================================================

module.exports = router;
