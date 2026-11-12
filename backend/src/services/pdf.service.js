
const fs = require("fs/promises");
const path = require("path");
const { PDFParse } = require("pdf-parse");

// ======================================================
// KDOCUMENT - DỊCH VỤ XỬ LÝ PDF
// Trích xuất văn bản và giữ thông tin từng trang
// ======================================================

// [A] CẤU HÌNH THƯ MỤC VÀ GIỚI HẠN FILE

const UPLOAD_DIR = path.resolve(
    __dirname,
    "../../uploads/documents"
);

// Giới hạn xử lý thử nghiệm: 20 MB
const MAX_PDF_SIZE = 20 * 1024 * 1024;

// ======================================================
// [B] TRÍCH XUẤT NỘI DUNG PDF
// ======================================================

// [01] Đọc file và lấy nội dung từng trang
const extractPdfText = async (fileKey) => {

    // 1. Kiểm tra tên file
    if (
        typeof fileKey !== "string" ||
        !/^[a-zA-Z0-9_-]+\.pdf$/i.test(fileKey)
    ) {
        throw new Error("Tên file PDF không hợp lệ");
    }

    // 2. Xác định đường dẫn file
    const filePath = path.join(UPLOAD_DIR, fileKey);
    const fileInfo = await fs.stat(filePath);

    // 3. Kiểm tra dung lượng
    if (fileInfo.size === 0 || fileInfo.size > MAX_PDF_SIZE) {
        throw new Error(
            "PDF rỗng hoặc vượt giới hạn xử lý thử nghiệm 20 MB"
        );
    }

    // 4. Đọc file PDF vào bộ nhớ
    const buffer = await fs.readFile(filePath);

    // 5. Kiểm tra chữ ký PDF cơ bản
    if (buffer.subarray(0, 5).toString() !== "%PDF-") {
        throw new Error("File không có định dạng PDF hợp lệ");
    }

    // 6. Khởi tạo PDF parser
    const parser = new PDFParse({
        data: new Uint8Array(buffer)
    });

    try {
        // 7. Trích xuất văn bản
        const result = await parser.getText();

        // 8. Chuẩn hóa nội dung
        const text = result.text
            .replace(/\r\n/g, "\n")
            .replace(/[ \t]+\n/g, "\n")
            .trim();

        // 9. Kiểm tra nội dung trích xuất
        if (text.length < 20) {
            throw new Error(
                "Không trích xuất đủ văn bản; PDF có thể là bản scan"
            );
        }

        // 10. Lưu nội dung riêng theo từng trang
        // Phục vụ chia chunk và trích dẫn nguồn trong RAG
        const pages = result.pages.map((page) => ({
            pageNumber: page.num,
            text: page.text
                .replace(/\r\n/g, "\n")
                .replace(/[ \t]+\n/g, "\n")
                .trim()
        }));

        // 11. Trả về dữ liệu đã xử lý
        return {
            text,
            totalPages: result.total,
            characterCount: text.length,
            pages
        };

    } finally {
        // 12. Giải phóng tài nguyên kể cả khi xảy ra lỗi
        await parser.destroy();
    }
};

// ======================================================
// [C] XUẤT DỊCH VỤ
// ======================================================

module.exports = {
    extractPdfText
};
