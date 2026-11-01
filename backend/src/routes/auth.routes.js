const express = require("express");
const router = express.Router();

const { login } = require("../controllers/auth.controller");
const verifyToken = require("../middleware/auth.middleware");

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

module.exports = router;