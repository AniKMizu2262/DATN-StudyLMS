const express = require("express");
const multer = require("multer");

const router = express.Router();

// ======================================================
// KDOCUMENT | DOCUMENT ROUTES
// Day20 - Core Audit
//
// Nhiệm vụ:
// 1. Khai báo các API quản lý tài liệu.
// 2. Xác thực tài khoản bằng JWT.
// 3. Kiểm tra vai trò trước khi vào controller.
// 4. Xử lý lỗi upload từ Multer.
//
// LƯU Ý BẢO MẬT:
// role.middleware chỉ kiểm tra quyền theo VAI TRÒ.
// Quyền sở hữu tài liệu / môn học phải được kiểm tra
// thêm ở controller trước khi thực hiện thao tác.
// ======================================================

// ======================================================
// [A] IMPORT MIDDLEWARE VÀ CONTROLLER
// ======================================================

// Xác thực người dùng.
const verifyToken = require("../middleware/auth.middleware");

// Kiểm tra vai trò: ADMIN, TEACHER, STUDENT.
const authorizeRoles = require("../middleware/role.middleware");

// Middleware lưu file PDF.
// Cấu hình dung lượng, định dạng, đường dẫn nằm tại
// backend/src/config/upload.js.
const upload = require("../config/upload");

// Các API quản lý tài liệu.
const {
    getPendingDocuments,
    getPublicDocuments,
    approveDocument,
    rejectDocument,
    uploadDocument,
    getDocumentDetails,
    downloadDocument,
    updateDocument,
    deleteDocument,
    restoreDocument
} = require("../controllers/document.controller");

// API tìm kiếm tài liệu.
const {
    searchDocuments
} = require("../controllers/documentSearch.controller");

// API xử lý PDF phục vụ RAG.
const {
    processDocumentForRag
} = require("../controllers/documentProcess.controller");

// ======================================================
// [B] MIDDLEWARE XỬ LÝ UPLOAD
// ======================================================

const handleDocumentUpload = (req, res, next) => {

    // "file" phải trùng với tên field FormData
    // mà frontend gửi lên.
    upload.single("file")(req, res, (error) => {

        if (!error) {
            return next();
        }

        console.error(
            "[DOCUMENT UPLOAD ERROR]",
            error.message
        );

        // File vượt giới hạn dung lượng do upload.js quy định.
        if (
            error instanceof multer.MulterError &&
            error.code === "LIMIT_FILE_SIZE"
        ) {
            return res.status(400).json({
                success: false,
                message: "File vượt quá dung lượng tối đa 500 MB"
            });
        }

        // Frontend gửi nhiều file hoặc sai tên field.
        if (
            error instanceof multer.MulterError &&
            error.code === "LIMIT_UNEXPECTED_FILE"
        ) {
            return res.status(400).json({
                success: false,
                message: "Chỉ được tải lên một file PDF với trường file"
            });
        }

        // Các lỗi khác từ middleware upload.
        return res.status(400).json({
            success: false,
            message: error.message || "Không thể tải tài liệu lên"
        });
    });
};

// ======================================================
// [C] ROUTE CỐ ĐỊNH
//
// Những route như /public, /pending, /search
// phải được đặt trước các route động /:id
// để tránh nhầm đường dẫn trong quá trình mở rộng.
// ======================================================

// ------------------------------------------------------
// [01] UPLOAD PDF
// POST /api/documents/upload
//
// ADMIN:
// - Chỉ upload tài liệu dùng chung.
//
// TEACHER:
// - Chỉ upload cho môn học được phân công.
//
// STUDENT:
// - Không có quyền upload.
//
// Controller tiếp tục kiểm tra subject_id.
// ------------------------------------------------------

router.post(
    "/upload",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    handleDocumentUpload,
    uploadDocument
);

// ------------------------------------------------------
// [02] DANH SÁCH TÀI LIỆU CÔNG KHAI
// GET /api/documents/public
//
// QUY TẮC KDOCUMENT:
// - Admin được xem tài liệu PUBLIC.
// - Teacher được xem tài liệu PUBLIC.
// - Student được xem tài liệu PUBLIC.
//
// Không giới hạn tài liệu theo môn học đối với
// quyền xem tài liệu công khai.
//
// Controller chỉ trả về tài liệu:
// visibility = PUBLIC
// status = READY
// review_status = APPROVED
// deleted_at IS NULL
// ------------------------------------------------------

router.get(
    "/public",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER", "STUDENT"),
    getPublicDocuments
);

// ------------------------------------------------------
// [03] DANH SÁCH TÀI LIỆU CHỜ DUYỆT
// GET /api/documents/pending
//
// ADMIN:
// - Chỉ thấy tài liệu dùng chung chờ duyệt.
//
// TEACHER:
// - Chỉ thấy tài liệu của các môn được phân công.
//
// STUDENT:
// - Không được xem danh sách chờ duyệt.
//
// Controller thực hiện lọc dữ liệu theo quyền.
// ------------------------------------------------------

router.get(
    "/pending",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    getPendingDocuments
);

// ------------------------------------------------------
// [04] TÌM KIẾM TÀI LIỆU
// GET /api/documents/search
//
// Cả ba vai trò đều được tìm kiếm.
// documentSearch.controller phải tự lọc tài liệu
// theo visibility, review_status, status và
// quyền của người dùng.
// ------------------------------------------------------

router.get(
    "/search",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER", "STUDENT"),
    searchDocuments
);

// ======================================================
// [D] ROUTE ĐỘNG THEO DOCUMENT ID
// ======================================================

// ------------------------------------------------------
// [05] PHÊ DUYỆT TÀI LIỆU
// PATCH /api/documents/:id/approve
//
// Chỉ ADMIN / TEACHER.
// Controller phải kiểm tra quyền quản lý cụ thể.
// ------------------------------------------------------

router.patch(
    "/:id/approve",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    approveDocument
);

// ------------------------------------------------------
// [06] TỪ CHỐI TÀI LIỆU
// PATCH /api/documents/:id/reject
//
// Chỉ ADMIN / TEACHER.
// ------------------------------------------------------

router.patch(
    "/:id/reject",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    rejectDocument
);

// ------------------------------------------------------
// [07] KHÔI PHỤC TÀI LIỆU ĐÃ XÓA MỀM
// PATCH /api/documents/:id/restore
//
// Chỉ ADMIN / TEACHER.
// Sau khi khôi phục, tài liệu phải chờ duyệt lại.
// ------------------------------------------------------

router.patch(
    "/:id/restore",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    restoreDocument
);

// ------------------------------------------------------
// [08] XỬ LÝ PDF CHO RAG
// POST /api/documents/:id/process
//
// Chỉ ADMIN / TEACHER.
//
// QUAN TRỌNG:
// Controller phải kiểm tra:
// - Tài liệu có tồn tại hay không.
// - Tài liệu có bị xóa mềm không.
// - Người dùng có quyền quản lý tài liệu không.
// - Tài liệu đang ở trạng thái xử lý nào.
//
// Route này không tự bảo đảm các điều kiện trên.
// ------------------------------------------------------

router.post(
    "/:id/process",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    processDocumentForRag
);

// ------------------------------------------------------
// [09] DOWNLOAD PDF
// GET /api/documents/:id/download
//
// Mọi người dùng đã đăng nhập đều có thể gọi API.
//
// Controller quyết định có được tải hay không:
//
// - Tài liệu PUBLIC + READY + APPROVED:
//   Cho phép truy cập.
//
// - Tài liệu riêng tư / chưa duyệt:
//   Chỉ người có quyền quản lý được truy cập.
//
// - Tài liệu đã xóa mềm:
//   Không được tải.
// ------------------------------------------------------

router.get(
    "/:id/download",
    verifyToken,
    downloadDocument
);

// ------------------------------------------------------
// [10] XEM CHI TIẾT TÀI LIỆU
// GET /api/documents/:id
//
// Controller kiểm tra quyền đọc trước khi trả dữ liệu.
// ------------------------------------------------------

router.get(
    "/:id",
    verifyToken,
    getDocumentDetails
);

// ------------------------------------------------------
// [11] CẬP NHẬT METADATA
// PATCH /api/documents/:id
//
// Chỉ ADMIN / TEACHER.
// Controller kiểm tra quyền sở hữu tài liệu.
//
// Việc thay đổi metadata đưa tài liệu về trạng thái
// chờ kiểm duyệt lại.
// ------------------------------------------------------

router.patch(
    "/:id",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    updateDocument
);

// ------------------------------------------------------
// [12] XÓA MỀM TÀI LIỆU
// DELETE /api/documents/:id
//
// Chỉ ADMIN / TEACHER.
//
// Controller cập nhật deleted_at.
// Không xóa vật lý file PDF hoặc embeddings.
// ------------------------------------------------------

router.delete(
    "/:id",
    verifyToken,
    authorizeRoles("ADMIN", "TEACHER"),
    deleteDocument
);

// ======================================================
// [E] EXPORT ROUTER
// ======================================================

module.exports = router;