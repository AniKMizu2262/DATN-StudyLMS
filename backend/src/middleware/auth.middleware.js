const jwt = require("jsonwebtoken");
const pool = require("../config/database");

// Middleware xác thực JWT
const verifyToken = async (req, res, next) => {
    try {
        // Lấy token từ Authorization Header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập để tiếp tục"
            });
        }

        const token = authHeader.split(" ")[1];

        // Kiểm tra tính hợp lệ và thời hạn của JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Kiểm tra tài khoản hiện tại trong database
        const [rows] = await pool.query(
            `SELECT user_id, full_name, email, role, status
             FROM users
             WHERE user_id = ?`,
            [decoded.userId]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản không tồn tại"
            });
        }

        const user = rows[0];

        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Tài khoản hiện không hoạt động"
            });
        }

        // Gắn thông tin người dùng vào request
        req.user = {
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            role: user.role
        };

        next();

    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Token không hợp lệ hoặc đã hết hạn"
            });
        }

        console.error("Authentication error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Lỗi xác thực người dùng"
        });
    }
};

module.exports = verifyToken;