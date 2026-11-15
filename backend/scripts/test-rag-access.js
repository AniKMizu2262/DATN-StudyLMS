
const path = require("path");

// ======================================================
// [A] NẠP MÔI TRƯỜNG
// ======================================================

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const pool = require("../src/config/database");

const {
    checkDocumentRagAccess
} = require("../src/services/ragAccess.service");

// ======================================================
// [B] KIỂM THỬ QUY TẮC PHÂN QUYỀN RAG
// ======================================================

const main = async () => {
    const documentId = 9;

    // Tài khoản giảng viên kiểm thử:
    // userId = 2, phụ trách subject_id = 1
    const teacher = {
        userId: 2,
        role: "TEACHER"
    };

    // Mô phỏng quyền STUDENT để kiểm thử điều kiện SQL
    // Không phải kiểm thử xác thực JWT
    const simulatedStudent = {
        userId: 2,
        role: "STUDENT"
    };

    console.log("\n===== KIỂM THỬ PHÂN QUYỀN RAG =====");

    // [01] Giảng viên phụ trách tài liệu
    const teacherAccess = await checkDocumentRagAccess(
        documentId,
        teacher
    );

    console.log(
        "Giảng viên phụ trách:",
        teacherAccess ? "CHO PHÉP" : "TỪ CHỐI"
    );

    // [02] Kiểm tra quy tắc quyền sinh viên
    const studentAccess = await checkDocumentRagAccess(
        documentId,
        simulatedStudent
    );

    console.log(
        "Quy tắc sinh viên:",
        studentAccess ? "CHO PHÉP" : "TỪ CHỐI"
    );
};

// ======================================================
// [C] CHẠY SCRIPT
// ======================================================

main()
    .catch((error) => {
        console.error("Lỗi kiểm thử:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
