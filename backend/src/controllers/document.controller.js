
const pool = require("../config/database");
const fs = require("fs/promises");
const path = require("path");

// =============================================================
// KDOCUMENT | QUẢN LÝ TÀI LIỆU
// Day09: Chặn truy cập tài liệu đã xóa mềm (deleted_at != NULL)
// Chưa bổ sung API xóa mềm / khôi phục trong file này.
// =============================================================

// ─────────────────────────────────────────────────────────────
// [A] HÀM HỖ TRỢ (không phải API)
// ─────────────────────────────────────────────────────────────

// Kiểm tra ID tài liệu từ URL.
const getDocumentId = (req) => {
    const id = Number(req.params.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// ADMIN quản lý tài liệu dùng chung; TEACHER quản lý môn được phân công.
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

// Tài liệu công khai phải đồng thời READY + APPROVED.
// Tài liệu chưa công khai chỉ người có quyền quản lý mới được xem/tải.
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

// ─────────────────────────────────────────────────────────────
// [B] DANH SÁCH TÀI LIỆU
// ─────────────────────────────────────────────────────────────

// [01] GET /api/documents/pending | Danh sách chờ duyệt
const getPendingDocuments = async (req, res) => {
    try {
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
            sql += `
                AND d.subject_id IN (
                    SELECT subject_id
                    FROM subject_teachers
                    WHERE teacher_id = ?
                )`;
            params.push(req.user.userId);
        } else if (req.user.role === "ADMIN") {
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

// [02] GET /api/documents/public | Danh sách công khai
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

// ─────────────────────────────────────────────────────────────
// [C] DUYỆT / TỪ CHỐI TÀI LIỆU
// ─────────────────────────────────────────────────────────────

// [03] PATCH /api/documents/:id/approve | Duyệt tài liệu
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

        // Duyệt độc lập với xử lý RAG; chỉ READY + APPROVED mới công khai.
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

// [04] PATCH /api/documents/:id/reject | Từ chối tài liệu
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
        if (typeof rejectionReason !== "string" || !rejectionReason.trim()) {
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
            [req.user.userId, rejectionReason.trim(), documentId]
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

// ─────────────────────────────────────────────────────────────
// [D] TẢI LÊN / XEM / TẢI PDF
// ─────────────────────────────────────────────────────────────

// [05] POST /api/documents/upload | Tải tài liệu lên
const uploadDocument = async (req, res) => {
    // Chỉ dọn file upload mới nếu lưu DB thất bại (không phải xóa mềm).
    const removeUploadedFile = async () => {
        if (req.file?.path) {
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

        const {
            title,
            subject_id,
            visibility = "PUBLIC",
            document_type = "OTHER",
            source_type = "SUPPLEMENTARY"
        } = req.body || {};

        if (typeof title !== "string" || !title.trim() || title.trim().length > 255) {
            await removeUploadedFile();
            return res.status(400).json({
                success: false,
                message: "Tiêu đề không hợp lệ hoặc vượt quá 255 ký tự"
            });
        }

        // Không có subject_id nghĩa là tài liệu dùng chung của ADMIN.
        const subjectId = subject_id === undefined || subject_id === ""
            ? null
            : Number(subject_id);

        if (subjectId !== null && (!Number.isSafeInteger(subjectId) || subjectId <= 0)) {
            await removeUploadedFile();
            return res.status(400).json({
                success: false,
                message: "Mã môn học không hợp lệ"
            });
        }

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

        // Chỉ chấp nhận giá trị nằm trong danh sách quy định.
        const validVisibility = ["PUBLIC", "PRIVATE"];
        const validDocumentTypes = ["LECTURE", "REFERENCE", "QUESTION_BANK", "EXAM", "OTHER"];
        const validSourceTypes = ["OFFICIAL", "SUPPLEMENTARY"];

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

        // DB tự gán status=PENDING, review_status=PENDING, deleted_at=NULL.
        const [result] = await pool.query(
            `INSERT INTO documents (
                subject_id, uploaded_by, title, file_key, file_type,
                file_size, visibility, document_type, source_type
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                subjectId, req.user.userId, title.trim(), req.file.filename,
                req.file.mimetype, req.file.size, visibility,
                document_type, source_type
            ]
        );

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

// [06] GET /api/documents/:id | Xem chi tiết
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
                    s.subject_name, d.uploaded_by, u.full_name AS uploader_name,
                    d.title, d.file_type, d.file_size, d.visibility,
                    d.document_type, d.source_type, d.status, d.review_status,
                    d.reviewed_by, d.reviewed_at, d.rejection_reason,
                    d.created_at, d.updated_at
             FROM documents d
             LEFT JOIN subjects s ON d.subject_id = s.subject_id
             LEFT JOIN users u ON d.uploaded_by = u.user_id
             WHERE d.document_id = ? AND d.deleted_at IS NULL`,
            [documentId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }
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

// [07] GET /api/documents/:id/download | Tải file PDF
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
             WHERE document_id = ? AND deleted_at IS NULL`,
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

        // Chống đọc file ngoài thư mục uploads/documents.
        if (
            typeof document.file_key !== "string" ||
            !/^[a-zA-Z0-9_-]+\.pdf$/i.test(document.file_key)
        ) {
            return res.status(500).json({
                success: false,
                message: "Thông tin file tài liệu không hợp lệ"
            });
        }

        const storagePath = path.resolve(__dirname, "../../uploads/documents");
        const pdfPath = path.join(storagePath, document.file_key);

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

        const safeTitle = path.basename(document.title).replace(/\.pdf$/i, "");
        const downloadName = `${safeTitle || "tai-lieu"}.pdf`;

        return res.download(pdfPath, downloadName, (error) => {
            if (error) {
                console.error("Download document error:", error.message);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: "Không thể tải file PDF"
                    });
                }
            }
        });
    } catch (error) {
        console.error("Download document error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Không thể tải file PDF"
        });
    }
};

// ─────────────────────────────────────────────────────────────
// [E] CHỈNH SỬA THÔNG TIN TÀI LIỆU
// ─────────────────────────────────────────────────────────────

// [08] PATCH /api/documents/:id | Cập nhật metadata
const updateDocument = async (req, res) => {
    try {
        const documentId = getDocumentId(req);
        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        const allowedValues = {
            title: null,
            visibility: ["PUBLIC", "PRIVATE"],
            document_type: ["LECTURE", "REFERENCE", "QUESTION_BANK", "EXAM", "OTHER"],
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
                message: "Bạn không có quyền cập nhật tài liệu này"
            });
        }

        const updateParts = [];
        const params = [];

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

        // Sửa metadata -> xét duyệt lại; không thay đổi trạng thái xử lý RAG.
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
             WHERE document_id = ? AND deleted_at IS NULL`,
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


 // ─────────────────────────────────────────────────────────────
 // [F] XÓA MỀM VÀ KHÔI PHỤC TÀI LIỆU
 // ─────────────────────────────────────────────────────────────

 // [09] DELETE /api/documents/:id | Xóa mềm
 const deleteDocument = async (req, res) => {
     try {
         const documentId = getDocumentId(req);

         // 1. Kiểm tra mã tài liệu
         if (!documentId) {
             return res.status(400).json({
                 success: false,
                 message: "Mã tài liệu không hợp lệ"
             });
         }

         // 2. Tìm tài liệu chưa bị xóa
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

         // 3. Kiểm tra quyền xóa
         if (!(await checkDocumentPermission(rows[0], req.user))) {
             return res.status(403).json({
                 success: false,
                 message: "Bạn không có quyền xóa tài liệu này"
             });
         }

         // 4. Xóa mềm - KHÔNG xóa bản ghi hoặc file PDF
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
             data: { document_id: documentId }
         });

     } catch (error) {
         console.error("Soft delete document error:", error.message);
         return res.status(500).json({
             success: false,
             message: "Không thể xóa tài liệu"
         });
     }
 };

 // [10] PATCH /api/documents/:id/restore | Khôi phục
 const restoreDocument = async (req, res) => {
     try {
         const documentId = getDocumentId(req);

         // 1. Kiểm tra mã tài liệu
         if (!documentId) {
             return res.status(400).json({
                 success: false,
                 message: "Mã tài liệu không hợp lệ"
             });
         }

         // 2. Tìm tài liệu đã xóa mềm
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

         // 3. Kiểm tra quyền khôi phục
         if (!(await checkDocumentPermission(rows[0], req.user))) {
             return res.status(403).json({
                 success: false,
                 message: "Bạn không có quyền khôi phục tài liệu này"
             });
         }

         // 4. Khôi phục và yêu cầu xét duyệt lại
         // Không thay đổi status xử lý RAG.
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
             data: { document_id: documentId }
         });

     } catch (error) {
         console.error("Restore document error:", error.message);
         return res.status(500).json({
             success: false,
             message: "Không thể khôi phục tài liệu"
         });
     }
 };


// ─────────────────────────────────────────────────────────────
// [G] XUẤT CONTROLLER
// ─────────────────────────────────────────────────────────────

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
