const pool = require("../config/database");

const fs = require("fs/promises");
const path = require("path");

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

            `SELECT document_id, subject_id, review_status

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

        // 3.5. Duyệt nội dung độc lập với trạng thái xử lý RAG.
        // Chỉ tài liệu READY và APPROVED mới được sử dụng công khai.
        // Cập nhật trạng thái duyệt.
        const [result] = await pool.query(

            `UPDATE documents

             SET review_status = 'APPROVED',

                 reviewed_by = ?,

                 reviewed_at = CURRENT_TIMESTAMP,

                 rejection_reason = NULL

             WHERE document_id = ?

               AND review_status = 'PENDING'`,

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

            `SELECT document_id, subject_id, review_status

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

        // 4.5. Từ chối nội dung không phụ thuộc trạng thái xử lý RAG.
        // Cập nhật trạng thái từ chối.
        const [result] = await pool.query(

            `UPDATE documents

             SET review_status = 'REJECTED',

                 reviewed_by = ?,

                 reviewed_at = CURRENT_TIMESTAMP,

                 rejection_reason = ?

             WHERE document_id = ?

               AND review_status = 'PENDING'`,

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
// 6. UPLOAD TÀI LIỆU
// POST /api/documents/upload
// ======================================================
const uploadDocument = async (req, res) => {

    // Hàm hỗ trợ xóa file nếu dữ liệu không hợp lệ
    // hoặc quá trình lưu thông tin vào database thất bại.
    const removeUploadedFile = async () => {

        if (req.file?.path) {

            await fs.unlink(req.file.path).catch(() => {});

        }

    };

    try {

        // 6.1. Kiểm tra file được gửi lên.
        if (!req.file) {

            return res.status(400).json({

                success: false,

                message: "Vui lòng chọn file PDF để tải lên"

            });

        }

        // 6.2. Lấy thông tin tài liệu từ request.
        const {

            title,

            subject_id,

            visibility = "PUBLIC",

            document_type = "OTHER",

            source_type = "SUPPLEMENTARY"

        } = req.body;

        // 6.3. Kiểm tra tiêu đề tài liệu.
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

        // 6.4. Kiểm tra mã môn học.
        // Không truyền subject_id hoặc truyền chuỗi rỗng
        // có nghĩa đây là tài liệu dùng chung.
        const subjectId =

            subject_id === undefined || subject_id === ""

                ? null

                : Number(subject_id);

        if (

            subjectId !== null &&

            (!Number.isInteger(subjectId) || subjectId <= 0)

        ) {

            await removeUploadedFile();

            return res.status(400).json({

                success: false,

                message: "Mã môn học không hợp lệ"

            });

        }

        // 6.5. Kiểm tra quyền upload theo vai trò.
        // ADMIN chỉ được upload tài liệu dùng chung.
        // TEACHER chỉ được upload tài liệu thuộc môn được phân công.
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

            // Kiểm tra giảng viên có được phân công phụ trách môn học không.
            const [assignments] = await pool.query(

                `SELECT subject_id

                 FROM subject_teachers

                 WHERE subject_id = ?

                   AND teacher_id = ?`,

                [subjectId, req.user.userId]

            );

            if (assignments.length === 0) {

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

        // 6.6. Kiểm tra các giá trị phân loại tài liệu.
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

        // 6.7. Lưu thông tin tài liệu vào database.
        // file_key sử dụng tên file do máy chủ tự tạo,
        // không sử dụng trực tiếp tên file gốc của người dùng.
        const [result] = await pool.query(

            `INSERT INTO documents (

                subject_id,

                uploaded_by,

                title,

                file_key,

                file_type,

                file_size,

                visibility,

                document_type,

                source_type

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

        // 6.8. Trả kết quả sau khi upload thành công.
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

        // Nếu lưu database thất bại thì xóa file đã upload
        // để tránh tạo file rác trên máy chủ.
        await removeUploadedFile();

        console.error("Upload document error:", error.message);

        return res.status(500).json({

            success: false,

            message: "Không thể upload tài liệu"

        });

    }

};

// ======================================================
// 7. KIỂM TRA QUYỀN XEM/TẢI TÀI LIỆU
// Hàm hỗ trợ nội bộ, không phải API
// ======================================================
const canReadDocument = async (document, user) => {
    // Sinh viên và các vai trò khác chỉ được xem tài liệu đã công bố.
    if (
        document.visibility === "PUBLIC" &&
        document.status === "READY" &&
        document.review_status === "APPROVED"
    ) {
        return true;
    }

    // Tài liệu chưa công bố hoặc riêng tư chỉ người phụ trách được xem.
    if (!user) {
        return false;
    }

    return checkDocumentPermission(document, user);
};

// ======================================================
// 8. XEM CHI TIẾT TÀI LIỆU
// GET /api/documents/:id
// ======================================================
const getDocumentDetails = async (req, res) => {
    try {
        const documentId = Number(req.params.id);

        if (!Number.isSafeInteger(documentId) || documentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        const [rows] = await pool.query(
            `SELECT
                d.document_id,
                d.subject_id,
                s.subject_code,
                s.subject_name,
                d.uploaded_by,
                u.full_name AS uploader_name,
                d.title,
                d.file_type,
                d.file_size,
                d.visibility,
                d.document_type,
                d.source_type,
                d.status,
                d.review_status,
                d.reviewed_by,
                d.reviewed_at,
                d.rejection_reason,
                d.created_at,
                d.updated_at
             FROM documents d
             LEFT JOIN subjects s ON d.subject_id = s.subject_id
             LEFT JOIN users u ON d.uploaded_by = u.user_id
             WHERE d.document_id = ?`,
            [documentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        const document = rows[0];

        if (!(await canReadDocument(document, req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xem tài liệu này"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy thông tin tài liệu thành công",
            data: document
        });
    } catch (error) {
        console.error("Get document details error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Không thể lấy thông tin tài liệu"
        });
    }
};

// ======================================================
// 9. TẢI TÀI LIỆU PDF
// GET /api/documents/:id/download
// ======================================================
const downloadDocument = async (req, res) => {
    try {
        const documentId = Number(req.params.id);

        if (!Number.isSafeInteger(documentId) || documentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã tài liệu không hợp lệ"
            });
        }

        const [rows] = await pool.query(
            `SELECT document_id, subject_id, title, file_key,
                    file_type, visibility, status, review_status
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

        if (!(await canReadDocument(document, req.user))) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền tải tài liệu này"
            });
        }

        // Chỉ chấp nhận tên file an toàn do backend tạo; không cho đi ra khỏi thư mục lưu trữ.
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

        // Chỉ dùng phần tên cơ bản để tránh tên tải xuống có ký tự đường dẫn.
        const title = path.basename(document.title).replace(/\.pdf$/i, "");
        const downloadName = `${title || "tai-lieu"}.pdf`;

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

module.exports = {

    getPendingDocuments,

    getPublicDocuments,

    approveDocument,

    rejectDocument,

    uploadDocument,
    getDocumentDetails,
    downloadDocument

};
