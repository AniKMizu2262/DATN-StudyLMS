
const multer = require("multer");
const path = require("path");

// Cấu hình nơi lưu trữ và cách đặt tên cho file được tải lên
const storage = multer.diskStorage({
    // Xác định thư mục lưu file trên máy chủ
    destination: (req, file, cb) => {
        // __dirname là thư mục hiện tại (src/config)
        // Đi ngược 2 cấp để đến backend, sau đó vào uploads/documents
        cb(null, path.join(__dirname, "../../uploads/documents"));
    },

    // Tạo tên file mới để tránh trùng tên file gốc
    filename: (req, file, cb) => {
        // Kết hợp thời gian hiện tại và số ngẫu nhiên để tạo tên tương đối duy nhất
        // Giữ lại phần mở rộng của file và chuyển về chữ thường
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname).toLowerCase()}`;

        cb(null, uniqueName);
    }
});

// Kiểm tra loại file trước khi cho phép tải lên
const fileFilter = (req, file, cb) => {
    // Chỉ chấp nhận file có MIME type là application/pdf
    if (file.mimetype !== "application/pdf") {
        // Trả về lỗi nếu file không phải PDF
        return cb(new Error("Chỉ chấp nhận file PDF"));
    }

    // Chấp nhận file nếu vượt qua điều kiện kiểm tra
    cb(null, true);
};

// Khởi tạo cấu hình Multer
const upload = multer({
    storage,       // Sử dụng cấu hình lưu file ở phía trên
    fileFilter,    // Áp dụng bộ lọc loại file
    limits: {
    fileSize: 500 * 1024 * 1024 // Giới hạn 500 MB
}
});

// Xuất cấu hình để các route có thể sử dụng
module.exports = upload;
