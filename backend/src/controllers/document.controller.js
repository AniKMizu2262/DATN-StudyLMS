const pool = require("../config/database");
const fs = require("fs/promises");
const path = require("path");

// =============================================================
// KDOCUMENT | QUẢN LÝ TÀI LIỆU
// Day20: Rà soát quyền truy cập, dữ liệu đầu vào và xử lý file.
// Giữ nguyên tên API và cấu trúc JSON để tránh ảnh hưởng frontend.
// =============================================================

// =============================================================
// [A] HÀM HỖ TRỢ
// =============================================================

// Chỉ chấp nhận ID là số nguyên dương hệ thập phân.
// Không chấp nhận 0x10, 1e3, số âm, số thập phân hoặc khoảng trắng.
const getDocumentId = (req) => {
    const rawId = req.params?.id;

    if (typeof rawId !== "string" || !/^[1-9]\d*$/.test(rawId)) {
        return null;
    }

    const id = Number(rawId);
    return Number.isSafeInteger(id) ? id : null;
};

// Kiểm tra quyền quản lý tài liệu.
// - ADMIN: chỉ quản lý tài liệu dùng chung (subject_id = NULL).
// - TEACHER: chỉ quản lý tài liệu thuộc môn được phân công.
// - STUDENT: không có quyền quản lý.
const checkDocumentPermission = async (document, user) => {
    if (!user) return false;

    if (document.subject_id === null) {
        return user.role === "ADMIN";
    }

    if (user.role !== "TEACHER") return false;

    const [rows] = await pool.query(
        `SELECT subject_id
         FROM subject_teachers
         WHERE subject_id = ? AND teacher_id = ?`,
        [document.subject_id, user.userId]
    );

    return rows.length > 0;
};

// Điều kiện đọc tài liệu:
// - Tài liệu đã xóa mềm: không được xem.
// - PUBLIC + READY + APPROVED: được phép đọc.
// - Các trường hợp khác: phải có quyền quản lý tài liệu.
//
// Lưu ý: API truy vấn tài liệu bên dưới cũng lọc deleted_at IS NULL.
const canReadDocument = async (document, user) => {
    if (document.deleted_at != null) return false;

    if (
        document.visibility === "PUBLIC" &&
        document.status === "READY" &&
        document.review_status === "APPROVED"
    ) {
        return true;
    }

    return checkDocumentPermission(document, user);
};

// =============================================================
// [B] DANH SÁCH TÀI LIỆU
// =============================================================

// [01] GET /api/documents/pending
// Lấy danh sách tài liệu đang chờ kiểm duyệt.
const getPendingDocuments = async (req, res) => {
    try {
        // Phòng trường hợp middleware xác thực chưa chạy.
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập"
            });
        }

        let sql = `
            SELECT d.document_id, d.subject_id, s.subject_code,
                   s.subject_name, d.title, d.file_type, d.file_size,
                   d.document_type, d.source_type, d.status,
                   d.review_status, d.created_at,
                   u.full_name AS uploader_name
            FROM documents d
            LEFT JOIN subjects s ON d.subject_id = s.subject_id
            LEFT JOIN users u ON d.uploaded_by = u.user_id
            WHERE d.review_status = 'PENDING'
              AND d.deleted_at IS NULL
        `;

        const params = [];

        if (req.user.role === "TEACHER") {
            // Giảng viên chỉ thấy tài liệu của môn mình phụ trách.
            sql += `
                AND d.subject_id IN (
                    SELECT subject_id
                    FROM subject_teachers
                    WHERE teacher_id = ?
                )`;
            params.push(req.user.userId);

        } else if (req.user.role === "ADMIN") {
            // Admin chỉ kiểm duyệt tài liệu dùng chung.
            sql += " AND d.subject_id IS NULL";

        } else {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xem danh sách này"
            });
        }

        sql += " ORDER BY d.created_at DESC";

        const [rows] = await pool.query(sql, params);

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách tài liệu chờ duyệt thành công",
            data: rows
        });

    } catch (error) {
        console.error("Get pending documents error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách tài liệu chờ duyệt"
        });
    }
};

// [02] GET /api/documents/public
// Danh sách tài liệu công khai toàn hệ thống.
const getPublicDocuments = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.document_id, d.subject_id, s.subject_code,
                   s.subject_name, d.title, d.file_type, d.file_size,
                   d.document_type, d.source_type, d.created_at
            FROM documents d
            LEFT JOIN subjects s ON d.subject_id = s.subject_id
            WHERE d.visibility = 'PUBLIC'
              AND d.status = 'READY'
              AND d.review_status = 'APPROVED'
              AND d.deleted_at IS NULL
            ORDER BY d.created_at DESC
        `);

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách tài liệu công khai thành công",
            data: rows
        });

    } catch (error) {
        console.error("Get public documents error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy danh sách tài liệu công khai"
        });
    }
};

// =============================================================
// [C] KIỂM DUYỆT TÀI LIỆU
// =============================================================

// [03] PATCH /api/documents/:id/approve
const approveDocument = async (req, res) => {
    try {
        const documentId = getDocumentId(req);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        const [rows] = await pool.query(
            `SELECT document_id, subject_id, review_status
             FROM documents
             WHERE document_id = ? AND deleted_at IS NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        // Kiểm tra quyền trước khi cập nhật.
        if (!(await checkDocumentPermission(rows[0], req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền duyệt tài liệu này"
            });
        }

        if (rows[0].review_status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "Tài liệu không còn ở trạng thái chờ duyệt"
            });
        }

        // Phê duyệt không đồng nghĩa với xử lý RAG thành công.
        // Chỉ tài liệu READY + APPROVED + PUBLIC mới được công khai.
        //
        // Kiểm tra PENDING một lần nữa ngay trong UPDATE để hạn chế
        // trường hợp hai người cùng duyệt hoặc từ chối một tài liệu.
        const [result] = await pool.query(
            `UPDATE documents
             SET review_status = 'APPROVED',
                 reviewed_by = ?,
                 reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = NULL
             WHERE document_id = ?
               AND review_status = 'PENDING'
               AND deleted_at IS NULL`,
            [req.user.userId, documentId]
        );

        if (!result.affectedRows) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã được xử lý hoặc bị xóa"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Duyệt tài liệu thành công"
        });

    } catch (error) {
        console.error("Approve document error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể duyệt tài liệu"
        });
    }
};

// [04] PATCH /api/documents/:id/reject
const rejectDocument = async (req, res) => {
    try {
        const documentId = getDocumentId(req);
        const rejectionReason = req.body?.rejection_reason;

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        if (
            typeof rejectionReason !== "string" ||
            !rejectionReason.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập lý do từ chối"
            });
        }

        const [rows] = await pool.query(
            `SELECT document_id, subject_id, review_status
             FROM documents
             WHERE document_id = ? AND deleted_at IS NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        if (!(await checkDocumentPermission(rows[0], req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền từ chối tài liệu này"
            });
        }

        if (rows[0].review_status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "Tài liệu không còn ở trạng thái chờ duyệt"
            });
        }

        const [result] = await pool.query(
            `UPDATE documents
             SET review_status = 'REJECTED',
                 reviewed_by = ?,
                 reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = ?
             WHERE document_id = ?
               AND review_status = 'PENDING'
               AND deleted_at IS NULL`,
            [
                req.user.userId,
                rejectionReason.trim(),
                documentId
            ]
        );

        if (!result.affectedRows) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã được xử lý hoặc bị xóa"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Từ chối tài liệu thành công"
        });

    } catch (error) {
        console.error("Reject document error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể từ chối tài liệu"
        });
    }
};

// =============================================================
// [D] UPLOAD / XEM / DOWNLOAD PDF
// =============================================================

// [05] POST /api/documents/upload
const uploadDocument = async (req, res) => {
    // Biến đánh dấu INSERT đã thành công.
    // Khi DB đã lưu document_id, không xóa file PDF dù gửi response lỗi.
    let savedToDb = false;

    const removeUploadedFile = async () => {
        if (!savedToDb && req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
    };

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng chọn file PDF để tải lên"
            });
        }

        // Multer có thể đã lưu file trước khi controller được gọi.
        // Nếu người dùng chưa xác thực thì xóa file vừa upload.
        if (!req.user) {
            await removeUploadedFile();

            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập"
            });
        }

        const {
            title,
            subject_id,
            visibility = "PUBLIC",
            document_type = "OTHER",
            source_type = "SUPPLEMENTARY"
        } = req.body || {};

        if (
            typeof title !== "string" ||
            !title.trim() ||
            title.trim().length > 255
        ) {
            await removeUploadedFile();

            return res.status(400).json({
                success: false,
                message: "Tiêu đề không hợp lệ hoặc vượt quá 255 ký tự"
            });
        }

        // Không truyền subject_id nghĩa là tài liệu dùng chung.
        // Chỉ ADMIN mới có quyền upload loại tài liệu này.
        const subjectId =
            subject_id === undefined || subject_id === ""
                ? null
                : Number(subject_id);

        if (
            subjectId !== null &&
            (!Number.isSafeInteger(subjectId) || subjectId <= 0)
        ) {
            await removeUploadedFile();

            return res.status(400).json({
                success: false,
                message: "Mã môn học không hợp lệ"
            });
        }

        // -------------------------------
        // KIỂM TRA PHÂN QUYỀN UPLOAD
        // -------------------------------
        if (req.user.role === "ADMIN") {
            if (subjectId !== null) {
                await removeUploadedFile();

                return res.status(403).json({
                    success: false,
                    message: "ADMIN chỉ được upload tài liệu dùng chung"
                });
            }

        } else if (req.user.role === "TEACHER") {
            if (subjectId === null) {
                await removeUploadedFile();

                return res.status(403).json({
                    success: false,
                    message: "TEACHER không được upload tài liệu dùng chung"
                });
            }

            const [assignments] = await pool.query(
                `SELECT subject_id
                 FROM subject_teachers
                 WHERE subject_id = ? AND teacher_id = ?`,
                [subjectId, req.user.userId]
            );

            if (!assignments.length) {
                await removeUploadedFile();

                return res.status(403).json({
                    success: false,
                    message: "Bạn không được phân công phụ trách môn học này"
                });
            }

        } else {
            await removeUploadedFile();

            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền upload tài liệu"
            });
        }

        // -------------------------------
        // KIỂM TRA THÔNG TIN PHÂN LOẠI
        // -------------------------------
        const validVisibility = ["PUBLIC", "PRIVATE"];

        const validDocumentTypes = [
            "LECTURE",
            "REFERENCE",
            "QUESTION_BANK",
            "EXAM",
            "OTHER"
        ];

        const validSourceTypes = [
            "OFFICIAL",
            "SUPPLEMENTARY"
        ];

        if (
            !validVisibility.includes(visibility) ||
            !validDocumentTypes.includes(document_type) ||
            !validSourceTypes.includes(source_type)
        ) {
            await removeUploadedFile();

            return res.status(400).json({
                success: false,
                message: "Thông tin phân loại tài liệu không hợp lệ"
            });
        }

        // File được lưu bởi middleware upload.
        // DB quản lý metadata và dùng file_key để tìm file vật lý.
        //
        // Các giá trị mặc định của DB:
        // status = PENDING
        // review_status = PENDING
        // deleted_at = NULL
        const [result] = await pool.query(
            `INSERT INTO documents (
                subject_id, uploaded_by, title, file_key, file_type,
                file_size, visibility, document_type, source_type
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                subjectId,
                req.user.userId,
                title.trim(),
                req.file.filename,
                req.file.mimetype,
                req.file.size,
                visibility,
                document_type,
                source_type
            ]
        );

        // Từ đây DB đã lưu thành công.
        savedToDb = true;

        return res.status(201).json({
            success: true,
            message: "Upload tài liệu thành công",
            data: {
                document_id: result.insertId,
                title: title.trim(),
                subject_id: subjectId,
                file_type: req.file.mimetype,
                file_size: req.file.size,
                visibility,
                document_type,
                source_type,
                status: "PENDING",
                review_status: "PENDING"
            }
        });

    } catch (error) {
        await removeUploadedFile();

        console.error("Upload document error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể upload tài liệu"
        });
    }
};

// [06] GET /api/documents/:id
const getDocumentDetails = async (req, res) => {
    try {
        const documentId = getDocumentId(req);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        const [rows] = await pool.query(
            `SELECT d.document_id, d.subject_id, s.subject_code,
                    s.subject_name, d.uploaded_by,
                    u.full_name AS uploader_name,
                    d.title, d.file_type, d.file_size, d.visibility,
                    d.document_type, d.source_type,
                    d.status, d.review_status,
                    d.reviewed_by, d.reviewed_at, d.rejection_reason,
                    d.created_at, d.updated_at
             FROM documents d
             LEFT JOIN subjects s ON d.subject_id = s.subject_id
             LEFT JOIN users u ON d.uploaded_by = u.user_id
             WHERE d.document_id = ?
               AND d.deleted_at IS NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        // Không cho đọc tài liệu PRIVATE hoặc chưa được duyệt
        // nếu người dùng không có quyền quản lý.
        if (!(await canReadDocument(rows[0], req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xem tài liệu này"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy thông tin tài liệu thành công",
            data: rows[0]
        });

    } catch (error) {
        console.error("Get document details error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể lấy thông tin tài liệu"
        });
    }
};

// [07] GET /api/documents/:id/download
const downloadDocument = async (req, res) => {
    try {
        const documentId = getDocumentId(req);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        const [rows] = await pool.query(
            `SELECT document_id, subject_id, title, file_key,
                    file_type, visibility, status, review_status
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        const document = rows[0];

        if (!(await canReadDocument(document, req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền tải tài liệu này"
            });
        }

        // Không được sử dụng file_key bất kỳ để truy cập file hệ thống.
        // Chỉ chấp nhận tên file PDF hợp lệ do hệ thống lưu.
        if (
            typeof document.file_key !== "string" ||
            !/^[a-zA-Z0-9_-]+\.pdf$/i.test(document.file_key)
        ) {
            return res.status(500).json({
                success: false,
                message: "Thông tin file tài liệu không hợp lệ"
            });
        }

        const storagePath = path.resolve(
            __dirname,
            "../../uploads/documents"
        );

        const pdfPath = path.join(
            storagePath,
            document.file_key
        );

        // Kiểm tra file có tồn tại trước khi gửi về client.
        try {
            await fs.access(pdfPath);
        } catch (error) {
            if (error.code === "ENOENT") {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy file PDF trên máy chủ"
                });
            }

            throw error;
        }

        // Dùng tiêu đề tài liệu làm tên file khi tải xuống.
        // Không sử dụng trực tiếp tên gốc từ phía người dùng làm đường dẫn.
        const safeTitle = path
            .basename(document.title)
            .replace(/\.pdf$/i, "");

        const downloadName = `${safeTitle || "tai-lieu"}.pdf`;

        return res.download(
            pdfPath,
            downloadName,
            (error) => {
                if (error) {
                    console.error(
                        "Download document error:",
                        error.message
                    );

                    // Không gửi JSON nếu header đã được gửi.
                    if (!res.headersSent) {
                        res.status(500).json({
                            success: false,
                            message: "Không thể tải file PDF"
                        });
                    }
                }
            }
        );

    } catch (error) {
        console.error("Download document error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể tải file PDF"
        });
    }
};

// =============================================================
// [E] CẬP NHẬT METADATA
// =============================================================

// [08] PATCH /api/documents/:id
const updateDocument = async (req, res) => {
    try {
        const documentId = getDocumentId(req);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        // Chỉ cho phép cập nhật 4 trường metadata.
        // Không nhận status, review_status, uploaded_by,
        // subject_id hoặc file_key từ request.
        const allowedValues = {
            title: null,
            visibility: ["PUBLIC", "PRIVATE"],
            document_type: [
                "LECTURE",
                "REFERENCE",
                "QUESTION_BANK",
                "EXAM",
                "OTHER"
            ],
            source_type: ["OFFICIAL", "SUPPLEMENTARY"]
        };

        const body = req.body;

        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            !Object.keys(body).length
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập thông tin cần cập nhật"
            });
        }

        const changes = {};

        // Kiểm tra từng trường từ request.
        // Không đưa tên cột SQL tùy ý từ người dùng vào câu UPDATE.
        for (const [field, value] of Object.entries(body)) {
            if (!Object.hasOwn(allowedValues, field)) {
                return res.status(400).json({
                    success: false,
                    message: `Không được phép cập nhật trường ${field}`
                });
            }

            if (field === "title") {
                if (
                    typeof value !== "string" ||
                    !value.trim() ||
                    value.trim().length > 255
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Tiêu đề tài liệu không hợp lệ"
                    });
                }

                changes[field] = value.trim();

            } else {
                if (!allowedValues[field].includes(value)) {
                    return res.status(400).json({
                        success: false,
                        message: `Giá trị ${field} không hợp lệ`
                    });
                }

                changes[field] = value;
            }
        }

        const [rows] = await pool.query(
            `SELECT document_id, subject_id, title, visibility,
                    document_type, source_type
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        if (!(await checkDocumentPermission(rows[0], req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền cập nhật tài liệu này"
            });
        }

        const updateParts = [];
        const params = [];

        // Chỉ cập nhật những trường thật sự thay đổi.
        for (const [field, value] of Object.entries(changes)) {
            if (rows[0][field] !== value) {
                updateParts.push(`${field} = ?`);
                params.push(value);
            }
        }

        if (!updateParts.length) {
            return res.status(200).json({
                success: true,
                message: "Thông tin tài liệu không có thay đổi"
            });
        }

        // Bất kỳ thay đổi metadata nào cũng cần xét duyệt lại.
        // Không thay đổi status xử lý RAG vì nội dung PDF không đổi.
        updateParts.push(
            "review_status = 'PENDING'",
            "reviewed_by = NULL",
            "reviewed_at = NULL",
            "rejection_reason = NULL"
        );

        params.push(documentId);

        const [result] = await pool.query(
            `UPDATE documents
             SET ${updateParts.join(", ")}
             WHERE document_id = ?
               AND deleted_at IS NULL`,
            params
        );

        if (!result.affectedRows) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã bị xóa hoặc thay đổi"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật tài liệu thành công, đang chờ duyệt lại"
        });

    } catch (error) {
        console.error("Update document error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể cập nhật tài liệu"
        });
    }
};

// =============================================================
// [F] XÓA MỀM VÀ KHÔI PHỤC
// =============================================================

// [09] DELETE /api/documents/:id
const deleteDocument = async (req, res) => {
    try {
        const documentId = getDocumentId(req);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        const [rows] = await pool.query(
            `SELECT document_id, subject_id
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu hoặc tài liệu đã bị xóa"
            });
        }

        if (!(await checkDocumentPermission(rows[0], req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xóa tài liệu này"
            });
        }

        // Xóa mềm:
        // - Không DELETE bản ghi documents.
        // - Không xóa file PDF.
        // - Không xóa chunks / embeddings.
        // - Chỉ đánh dấu deleted_at.
        //
        // Các API đọc tài liệu phải luôn kiểm tra deleted_at IS NULL.
        const [result] = await pool.query(
            `UPDATE documents
             SET deleted_at = CURRENT_TIMESTAMP
             WHERE document_id = ?
               AND deleted_at IS NULL`,
            [documentId]
        );

        if (!result.affectedRows) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã bị xóa bởi thao tác khác"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Xóa mềm tài liệu thành công",
            data: {
                document_id: documentId
            }
        });

    } catch (error) {
        console.error("Soft delete document error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể xóa tài liệu"
        });
    }
};

// [10] PATCH /api/documents/:id/restore
const restoreDocument = async (req, res) => {
    try {
        const documentId = getDocumentId(req);

        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        // Chỉ tìm tài liệu đã xóa mềm.
        const [rows] = await pool.query(
            `SELECT document_id, subject_id
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NOT NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu đã xóa"
            });
        }

        if (!(await checkDocumentPermission(rows[0], req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền khôi phục tài liệu này"
            });
        }

        // Khôi phục tài liệu:
        // - Gỡ deleted_at.
        // - Đưa review_status về PENDING.
        // - Xóa thông tin kiểm duyệt trước đó.
        // - Giữ nguyên status xử lý RAG.
        //
        // Dù tài liệu đã READY, nó vẫn chưa công khai cho Student
        // cho đến khi được duyệt lại.
        const [result] = await pool.query(
            `UPDATE documents
             SET deleted_at = NULL,
                 review_status = 'PENDING',
                 reviewed_by = NULL,
                 reviewed_at = NULL,
                 rejection_reason = NULL
             WHERE document_id = ?
               AND deleted_at IS NOT NULL`,
            [documentId]
        );

        if (!result.affectedRows) {
            return res.status(409).json({
                success: false,
                message: "Trạng thái tài liệu đã thay đổi"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Khôi phục tài liệu thành công, đang chờ duyệt lại",
            data: {
                document_id: documentId
            }
        });

    } catch (error) {
        console.error("Restore document error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể khôi phục tài liệu"
        });
    }
};

// =============================================================
// [G] EXPORT CONTROLLER
// =============================================================

// Giữ nguyên tên export vì document.routes.js đang sử dụng chúng.
module.exports = {
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
};