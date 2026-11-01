
const express = require("express");
const router = express.Router();

// Middleware xác thực và phân quyền
const verifyToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

// Import các controller tài liệu
const {
    getPendingDocuments,
    approveDocument,
    rejectDocument
} = require("../controllers/document.controller");

// ======================================================
// 1. LẤY DANH SÁCH TÀI LIỆU CHỜ DUYỆT
// GET /api/documents/pending
// ADMIN, TEACHER
// ======================================================

router.get(
    "/pending",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    getPendingDocuments
);

// ======================================================
// 2. DUYỆT TÀI LIỆU
// PATCH /api/documents/:id/approve
// ADMIN, TEACHER
// ======================================================

router.patch(
    "/:id/approve",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    approveDocument
);

// ======================================================
// 3. TỪ CHỐI TÀI LIỆU
// PATCH /api/documents/:id/reject
// ADMIN, TEACHER
// ======================================================

router.patch(
    "/:id/reject",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    rejectDocument
);

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;
