
const path = require("path");

// [01] Nạp biến môi trường trước khi kết nối MySQL
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

// [02] Kết nối database và dịch vụ đọc PDF
const pool = require("../src/config/database");
const { extractPdfText } = require("../src/services/pdf.service");



// ======================================================
// [DAY10] KIỂM THỬ TRÍCH XUẤT PDF TỪ DATABASE
// Chỉ đọc dữ liệu, không cập nhật trạng thái tài liệu
// ======================================================

const main = async () => {
    const documentId = Number(process.argv[2]);

    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Vui lòng truyền ID tài liệu hợp lệ");
    }

    // [01] Tìm file PDF của tài liệu chưa bị xóa mềm
    const [rows] = await pool.query(
        `SELECT document_id, title, file_key
         FROM documents
         WHERE document_id = ?
           AND deleted_at IS NULL`,
        [documentId]
    );

    if (rows.length === 0) {
        throw new Error("Không tìm thấy tài liệu");
    }

    const document = rows[0];

    // [02] Trích xuất nội dung PDF
    const result = await extractPdfText(document.file_key);

    // [03] Hiển thị kết quả kiểm thử
    console.log("\n===== KẾT QUẢ ĐỌC PDF =====");
    console.log("Mã tài liệu:", document.document_id);
    console.log("Tiêu đề:", document.title);
    console.log("Số trang:", result.totalPages);
    console.log("Số ký tự:", result.characterCount);

    console.log("\n===== NỘI DUNG TRÍCH XUẤT =====");
    console.log(result.text.slice(0, 1000));
    console.log("\n===== KẾT THÚC =====");
};

main()
    .catch((error) => {
        console.error("Lỗi xử lý PDF:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
