
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Kiem tra server
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Kdocument API is running"
    });
});

// Kiem tra ket noi MySQL
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

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
