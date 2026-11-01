
/**
 * Middleware phân quyền theo vai trò người dùng.
 * Phải chạy sau verifyToken.
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        // Kiểm tra thông tin người dùng đã được xác thực
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập để tiếp tục"
            });
        }

        // Kiểm tra vai trò có được phép truy cập không
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập chức năng này"
            });
        }

        next();
    };
};

module.exports = authorizeRoles;
