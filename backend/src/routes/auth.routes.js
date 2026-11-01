
const express = require("express");
const router = express.Router();

const { login } = require("../controllers/auth.controller");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

// Đăng nhập
router.post("/login", login);

// Lấy thông tin người dùng hiện tại
router.get("/me", verifyToken, (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Lấy thông tin người dùng thành công",
        data: {
            user: req.user
        }
    });
});

// Kiểm tra quyền ADMIN
router.get(
    "/test-admin",
    verifyToken,
    authorizeRoles("ADMIN"),
    (req, res) => {
        return res.json({
            success: true,
            message: "ADMIN access granted",
            user: req.user
        });
    }
);

// Kiểm tra quyền TEACHER
router.get(
    "/test-teacher",
    verifyToken,
    authorizeRoles("TEACHER"),
    (req, res) => {
        return res.json({
            success: true,
            message: "TEACHER access granted",
            user: req.user
        });
    }
);

// Kiểm tra quyền STUDENT
router.get(
    "/test-student",
    verifyToken,
    authorizeRoles("STUDENT"),
    (req, res) => {
        return res.json({
            success: true,
            message: "STUDENT access granted",
            user: req.user
        });
    }
);

module.exports = router;
