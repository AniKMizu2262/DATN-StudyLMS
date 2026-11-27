"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");

// ======================================================
// KDOCUMENT | DAY20 - CẤU HÌNH UPLOAD TÀI LIỆU PDF
//
// Giữ tương thích với document.routes.js hiện có:
//     upload.single("file")(req, res, callback)
//
// Bảo vệ theo 3 lớp:
// 1. Kiểm tra MIME và đuôi .pdf trước khi ghi file.
// 2. Tạo tên file ngẫu nhiên do máy chủ kiểm soát.
// 3. Kiểm tra chữ ký %PDF- của nội dung sau khi ghi.
//
// Lưu ý: chữ ký PDF không chứng minh toàn bộ file an toàn.
// pdf.service.js vẫn cần parse và xử lý lỗi PDF hỏng.
// ======================================================

const UPLOAD_DIR = path.resolve(
    __dirname,
    "../../uploads/documents"
);

// Giữ mức 500 MB đang được dùng ở document.routes.js.
// Có thể giảm sau khi thống nhất giới hạn với frontend.
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// ======================================================
// [A] CẤU HÌNH NƠI LƯU FILE
// ======================================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        // Tự tạo thư mục nếu chạy trên máy/hosting mới.
        // Không cần tạo uploads/documents bằng tay.
        fs.mkdir(
            UPLOAD_DIR,
            { recursive: true },
            (error) => {
                cb(error, UPLOAD_DIR);
            }
        );
    },

    filename: (req, file, cb) => {
        // Không dùng tên gốc của người dùng làm tên file.
        //
        // randomBytes(16) tạo tên ngẫu nhiên khó đoán,
        // tránh va chạm tên khi nhiều người cùng upload.
        //
        // Ví dụ:
        // 0d5e93f16a2c4b879b8d21f783af600c.pdf
        //
        // Tên mới chỉ chứa a-f, 0-9 và .pdf nên phù hợp
        // với kiểm tra file_key trong document.controller.js.
        const safeName =
            `${crypto.randomBytes(16).toString("hex")}.pdf`;

        cb(null, safeName);
    }
});

// ======================================================
// [B] KIỂM TRA MIME VÀ PHẦN MỞ RỘNG
// ======================================================

const fileFilter = (req, file, cb) => {

    // MIME được trình duyệt hoặc client gửi lên.
    const isPdfMime =
        file.mimetype === "application/pdf";

    // Kiểm tra thêm đuôi file gốc.
    // Chấp nhận cả .pdf và .PDF.
    const isPdfExtension =
        path.extname(
            file.originalname || ""
        ).toLowerCase() === ".pdf";

    // MIME có thể bị giả mạo nên không được
    // coi đây là bước xác thực nội dung cuối cùng.
    if (!isPdfMime || !isPdfExtension) {
        return cb(
            new Error(
                "Chỉ chấp nhận file PDF có đuôi .pdf"
            )
        );
    }

    return cb(null, true);
};

// ======================================================
// [C] KHỞI TẠO MULTER
// ======================================================

const upload = multer({
    storage,
    fileFilter,

    limits: {
        // Giữ giới hạn hiện tại để không thay đổi
        // hành vi của frontend và document.routes.js.
        fileSize: MAX_FILE_SIZE,

        // Chỉ nhận tối đa một file.
        files: 1
    }
});

// ======================================================
// [D] KIỂM TRA CHỮ KÝ NỘI DUNG PDF
// ======================================================

// PDF thông thường bắt đầu bằng 5 byte "%PDF-".
//
// Ví dụ nội dung:
// %PDF-1.7
//
// Đổi đuôi .exe thành .pdf không tạo được chữ ký này.
//
// Đây là kiểm tra định dạng tối thiểu:
// - Không thay thế trình phân tích PDF.
// - Không phải công cụ quét mã độc.
// - Có thể từ chối một số PDF không chuẩn có dữ liệu
//   đứng trước header PDF.
const checkPdfSignature = async (filePath) => {

    const handle = await fsp.open(filePath, "r");

    try {
        const header = Buffer.alloc(5);

        const { bytesRead } = await handle.read(
            header,
            0,
            header.length,
            0
        );

        if (
            bytesRead !== 5 ||
            header.toString("ascii") !== "%PDF-"
        ) {
            throw new Error(
                "Nội dung file không phải PDF hợp lệ"
            );
        }

    } finally {
        // Đóng file dù việc đọc thành công hay thất bại.
        await handle.close();
    }
};

// ======================================================
// [E] TÍCH HỢP KIỂM TRA VÀO upload.single()
// ======================================================

// Giữ nguyên cách gọi upload.single("file")
// đang được document.routes.js sử dụng.
//
// Sau khi Multer ghi file, chúng ta kiểm tra chữ ký.
// Nếu không hợp lệ:
// - Xóa file vừa ghi.
// - Trả lỗi cho middleware xử lý upload.
// - Không cho chuyển tiếp sang uploadDocument().
//
// Nếu hợp lệ:
// - Gọi next() để controller tiếp tục lưu MySQL.

const multerSingle = upload.single.bind(upload);

upload.single = (fieldName) => {

    const multerMiddleware = multerSingle(fieldName);

    return (req, res, next) => {

        multerMiddleware(req, res, (error) => {

            // Lỗi từ Multer:
            // Sai MIME, sai đuôi, vượt dung lượng,...
            if (error) {
                return next(error);
            }

            // Nếu chưa chọn file, để document.controller.js
            // trả thông báo "Vui lòng chọn file PDF".
            if (!req.file) {
                return next();
            }

            // Kiểm tra nội dung file vừa được lưu.
            checkPdfSignature(req.file.path)

                .then(() => {
                    // PDF có chữ ký hợp lệ.
                    // Cho phép controller tiếp tục.
                    next();
                })

                .catch(async (validationError) => {

                    // File không hợp lệ:
                    // Dọn file vừa upload để tránh rác đĩa.
                    try {
                        await fsp.unlink(req.file.path);

                    } catch (cleanupError) {
                        if (cleanupError.code !== "ENOENT") {
                            console.error(
                                "[UPLOAD] Không thể xóa file không hợp lệ:",
                                cleanupError.message
                            );
                        }
                    }

                    // Không giữ tham chiếu tới file đã xóa.
                    req.file = undefined;

                    // Chuyển lỗi cho handleDocumentUpload
                    // trong document.routes.js.
                    next(validationError);
                });
        });
    };
};

// ======================================================
// [F] EXPORT CẤU HÌNH UPLOAD
// ======================================================

module.exports = upload;