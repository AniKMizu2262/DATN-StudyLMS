
const pool = require("../config/database");

// ======================================================
// 1. LẤY DANH SÁCH TÀI LIỆU CHỜ DUYỆT
// GET /api/documents/pending
// ======================================================

const getPendingDocuments = async (req, res) => {
    try {
        let sql = `
            SELECT
                d.document_id,
                d.subject_id,
                s.subject_code,
                s.subject_name,
                d.title,
                d.file_type,
                d.file_size,
                d.document_type,
                d.source_type,
                d.status,
                d.review_status,
                d.created_at,
                u.full_name AS uploader_name
            FROM documents d
            LEFT JOIN subjects s
                ON d.subject_id = s.subject_id
            LEFT JOIN users u
                ON d.uploaded_by = u.user_id
            WHERE d.review_status = 'PENDING'
              AND d.status = 'READY'
        `;

        const params = [];

        // Giảng viên chỉ xem tài liệu thuộc môn được phân công.
        if (req.user.role === "TEACHER") {
            sql += `
                AND d.subject_id IN (
                    SELECT subject_id
                    FROM subject_teachers
                    WHERE teacher_id = ?
                )
            `;

            params.push(req.user.userId);
        }

        // ADMIN chỉ xem tài liệu dùng chung.
        else if (req.user.role === "ADMIN") {
            sql += " AND d.subject_id IS NULL";
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

// ======================================================
// 2. KIỂM TRA QUYỀN XỬ LÝ TÀI LIỆU
// Hàm hỗ trợ nội bộ, không phải API
// ======================================================

const checkDocumentPermission = async (document, user) => {

    // Tài liệu dùng chung chỉ ADMIN được xử lý.
    if (document.subject_id === null) {
        return user.role === "ADMIN";
    }

    // Tài liệu thuộc môn học chỉ TEACHER được phân công
    // môn đó mới có quyền xử lý.
    if (user.role !== "TEACHER") {
        return false;
    }

    const [rows] = await pool.query(
        `SELECT subject_id
         FROM subject_teachers
         WHERE subject_id = ?
           AND teacher_id = ?`,
        [document.subject_id, user.userId]
    );

    return rows.length > 0;
};

// ======================================================
// 3. DUYỆT TÀI LIỆU
// PATCH /api/documents/:id/approve
// ======================================================

const approveDocument = async (req, res) => {
    try {
        // 3.1. Kiểm tra mã tài liệu.
        const documentId = Number(req.params.id);

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        // 3.2. Tìm tài liệu.
        const [rows] = await pool.query(
            `SELECT document_id, subject_id, status, review_status
             FROM documents
             WHERE document_id = ?`,
            [documentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        const document = rows[0];

        // 3.3. Kiểm tra quyền duyệt.
        if (!(await checkDocumentPermission(document, req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền duyệt tài liệu này"
            });
        }

        // 3.4. Kiểm tra trạng thái xét duyệt.
        if (document.review_status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "Tài liệu không còn ở trạng thái chờ duyệt"
            });
        }

        // 3.5. Chỉ duyệt tài liệu đã xử lý thành công.
        if (document.status !== "READY") {
            return res.status(409).json({
                success: false,
                message: "Chỉ có thể duyệt tài liệu đã xử lý thành công"
            });
        }

        // 3.6. Cập nhật trạng thái duyệt.
        const [result] = await pool.query(
            `UPDATE documents
             SET review_status = 'APPROVED',
                 reviewed_by = ?,
                 reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = NULL
             WHERE document_id = ?
               AND review_status = 'PENDING'
               AND status = 'READY'`,
            [req.user.userId, documentId]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã được xử lý bởi người khác"
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

// ======================================================
// 4. TỪ CHỐI TÀI LIỆU
// PATCH /api/documents/:id/reject
// ======================================================

const rejectDocument = async (req, res) => {
    try {
        // 4.1. Kiểm tra mã tài liệu và lý do từ chối.
        const documentId = Number(req.params.id);
        const { rejection_reason } = req.body;

        if (!Number.isInteger(documentId) || documentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        if (
            typeof rejection_reason !== "string" ||
            !rejection_reason.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập lý do từ chối"
            });
        }

        // 4.2. Tìm tài liệu.
        const [rows] = await pool.query(
            `SELECT document_id, subject_id, status, review_status
             FROM documents
             WHERE document_id = ?`,
            [documentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        const document = rows[0];

        // 4.3. Kiểm tra quyền từ chối.
        if (!(await checkDocumentPermission(document, req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền từ chối tài liệu này"
            });
        }

        // 4.4. Kiểm tra trạng thái xét duyệt.
        if (document.review_status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "Tài liệu không còn ở trạng thái chờ duyệt"
            });
        }

        // 4.5. Chỉ từ chối tài liệu đã xử lý thành công.
        if (document.status !== "READY") {
            return res.status(409).json({
                success: false,
                message: "Chỉ có thể từ chối tài liệu đã xử lý thành công"
            });
        }

        // 4.6. Cập nhật trạng thái từ chối.
        const [result] = await pool.query(
            `UPDATE documents
             SET review_status = 'REJECTED',
                 reviewed_by = ?,
                 reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = ?
             WHERE document_id = ?
               AND review_status = 'PENDING'
               AND status = 'READY'`,
            [
                req.user.userId,
                rejection_reason.trim(),
                documentId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã được xử lý bởi người khác"
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

// ======================================================
// 5. LẤY DANH SÁCH TÀI LIỆU CÔNG KHAI
// GET /api/documents/public
// ======================================================

const getPublicDocuments = async (req, res) => {
    try {
        const sql = `
            SELECT
                d.document_id,
                d.subject_id,
                s.subject_code,
                s.subject_name,
                d.title,
                d.file_type,
                d.file_size,
                d.document_type,
                d.source_type,
                d.created_at
            FROM documents d
            LEFT JOIN subjects s
                ON d.subject_id = s.subject_id
            WHERE d.visibility = 'PUBLIC'
              AND d.status = 'READY'
              AND d.review_status = 'APPROVED'
            ORDER BY d.created_at DESC
        `;

        const [rows] = await pool.query(sql);

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


// ======================================================
// 6. XUẤT CÁC CONTROLLER
// Cho phép file routes sử dụng các hàm xử lý tài liệu.
// ======================================================

module.exports = {
    getPendingDocuments,
    getPublicDocuments,
    approveDocument,
    rejectDocument
};
