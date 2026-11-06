const express = require("express");
const router = express.Router();

// Middleware xác thực và phân quyền
const verifyToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

// Import các controller tài liệu
const {
    getPendingDocuments,
    getPublicDocuments,
    approveDocument,
    rejectDocument
} = require("../controllers/document.controller");

// Lấy danh sách tài liệu công khai dành cho sinh viên
router.get(
    "/public",
    verifyToken,
    authorizeRoles("STUDENT"),
    getPublicDocuments
);

// Lấy danh sách tài liệu chờ duyệt
router.get(
    "/pending",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    getPendingDocuments
);

// Duyệt tài liệu
router.patch(
    "/:id/approve",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    approveDocument
);

// Từ chối tài liệu
router.patch(
    "/:id/reject",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    rejectDocument
);

module.exports = router;