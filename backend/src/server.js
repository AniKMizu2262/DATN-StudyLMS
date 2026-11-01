const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import cấu hình và các nhóm API
const pool = require("./config/database");
const subjectRoutes = require("./routes/subject.routes");
const authRoutes = require("./routes/auth.routes");

// Khởi tạo ứng dụng Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware xử lý request
app.use(cors());
app.use(express.json());

// Kiểm tra trạng thái server
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Kdocument API is running"
    });
});

// Kiểm tra kết nối MySQL
app.get("/api/health/db", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT DATABASE() AS database_name, 1 AS connection_test"
        );

        res.json({
            success: true,
            message: "MySQL connection successful",
            database: rows[0].database_name
        });
    } catch (error) {
        console.error("MySQL connection error:", error.message);

        res.status(500).json({
            success: false,
            message: "MySQL connection failed"
        });
    }
});

// Nhóm API xác thực
app.use("/api/auth", authRoutes);

// Nhóm API liên quan đến môn học
app.use("/api/subjects", subjectRoutes);

// Khởi chạy server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});