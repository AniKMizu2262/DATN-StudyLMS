
const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// POST /api/auth/login
// Xử lý đăng nhập người dùng.
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Kiểm tra dữ liệu đầu vào.
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập email và mật khẩu"
            });
        }

        // Tìm tài khoản theo email.
        const [rows] = await pool.query(
            `SELECT
                user_id,
                full_name,
                email,
                password_hash,
                role,
                status
             FROM users
             WHERE email = ?`,
            [email.trim()]
        );

        // Không tiết lộ email có tồn tại hay không.
        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không chính xác"
            });
        }

        const user = rows[0];

        // Kiểm tra mật khẩu với hash trong database.
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không chính xác"
            });
        }

        // Chỉ cho phép tài khoản đang hoạt động đăng nhập.
        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Tài khoản hiện không thể đăng nhập"
            });
        }

        // Tạo JWT chứa thông tin định danh và vai trò.
        const token = jwt.sign(
            {
                userId: user.user_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d"
            }
        );

        // Không trả password_hash về client.
        return res.status(200).json({
            success: true,
            message: "Đăng nhập thành công",
            data: {
                token,
                user: {
                    user_id: user.user_id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể xử lý đăng nhập"
        });
    }
};

module.exports = {
    login
};
