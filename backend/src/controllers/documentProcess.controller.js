
"use strict";

const pool = require("../config/database");

const {
    extractPdfText
} = require("../services/pdf.service");

const {
    createDocumentChunks
} = require("../services/chunk.service");

const {
    MODEL_NAME,
    EMBEDDING_DIM,
    createEmbedding
} = require("../services/embedding.service");

const {
    ensureSourcePreviewCache
} = require("../services/sourcePreviewCache.service");

// ======================================================
// KDOCUMENT | DAY20 - XỬ LÝ PDF CHO RAG
// POST /api/documents/:id/process
//
// QUY TẮC NGHIỆP VỤ:
// 1. ADMIN xử lý tài liệu dùng chung.
// 2. TEACHER xử lý tài liệu của môn được phân công.
// 3. Tài liệu phải APPROVED và đang PENDING.
// 4. Chỉ chuyển READY khi toàn bộ chunk và embedding
//    được lưu thành công trong một transaction MySQL.
//
// BỔ SUNG DAY20:
// - Tự động tạo cache Docling sau khi commit.
// - Không thay đổi dữ liệu RAG đã lưu.
// - Lỗi cache không làm thất bại xử lý RAG.
// ======================================================

// Giới hạn dành cho giai đoạn thử nghiệm.
// Tránh quá tải CPU khi xử lý PDF quá lớn.
const MAX_TEST_CHUNKS = 200;

// Chống xử lý trùng trong CÙNG một tiến trình Node.js.
//
// Nếu sau này chạy nhiều Node.js instances,
// cần sử dụng cơ chế lock/queue ở cấp hệ thống.
const processingIds = new Set();

// ======================================================
// [A] KIỂM TRA ID TÀI LIỆU
// ======================================================

// Express truyền req.params.id dưới dạng string.
//
// Chỉ chấp nhận ID nguyên dương, hệ thập phân.
// Ví dụ:
// "10"   -> hợp lệ
// "0"    -> không hợp lệ
// "1e3"  -> không hợp lệ
// "0x10" -> không hợp lệ
const getDocumentId = (req) => {
    const rawId = req.params?.id;

    if (
        typeof rawId !== "string" ||
        !/^[1-9]\d*$/.test(rawId)
    ) {
        return null;
    }

    const documentId = Number(rawId);

    return Number.isSafeInteger(documentId)
        ? documentId
        : null;
};

// ======================================================
// [B] KIỂM TRA QUYỀN XỬ LÝ
// ======================================================

// db có thể là:
// - pool: khi kiểm tra ban đầu.
// - connection: khi kiểm tra lại trong transaction.
//
// Không chỉ dựa vào role middleware, vì hai TEACHER
// có thể được phân công phụ trách hai môn khác nhau.
const hasProcessPermission = async (db, document, user) => {
    if (!user || !document) {
        return false;
    }

    // Tài liệu dùng chung:
    // Chỉ ADMIN được quyền quản lý và xử lý.
    if (document.subject_id === null) {
        return user.role === "ADMIN";
    }

    const userId = Number(user.userId);

    // Tài liệu môn học:
    // Chỉ TEACHER được phân công mới được xử lý.
    if (
        user.role !== "TEACHER" ||
        !Number.isSafeInteger(userId) ||
        userId <= 0
    ) {
        return false;
    }

    const [assignments] = await db.query(
        `SELECT 1
         FROM subject_teachers
         WHERE subject_id = ?
           AND teacher_id = ?
         LIMIT 1`,
        [document.subject_id, userId]
    );

    return assignments.length > 0;
};

// ======================================================
// [C] KIỂM TRA VÀ CHUẨN HÓA EMBEDDING
// ======================================================

// Một embedding hợp lệ phải:
// - Là mảng số.
// - Có đúng số chiều do EMBEDDING_DIM quy định.
// - Không chứa NaN hoặc Infinity.
//
// Hỗ trợ Array, Float32Array và Float64Array.
//
// Chuẩn hóa về Array để JSON.stringify() luôn tạo
// JSON array, không phải object đánh số thuộc tính.
const normalizeEmbedding = (vector) => {
    if (
        !Array.isArray(vector) &&
        !ArrayBuffer.isView(vector)
    ) {
        throw new Error(
            "Embedding không có định dạng mảng hợp lệ"
        );
    }

    const values = Array.from(vector);
    const expectedDimension = Number(EMBEDDING_DIM);

    if (
        !Number.isSafeInteger(expectedDimension) ||
        expectedDimension <= 0 ||
        values.length !== expectedDimension ||
        !values.every(
            (value) =>
                typeof value === "number" &&
                Number.isFinite(value)
        )
    ) {
        throw new Error(
            "Embedding có số chiều hoặc giá trị không hợp lệ"
        );
    }

    return values;
};

// ======================================================
// [D] API XỬ LÝ PDF CHO RAG
// ======================================================

const processDocumentForRag = async (req, res) => {
    // --------------------------------------------------
    // [01] KIỂM TRA DOCUMENT ID
    // --------------------------------------------------

    const documentId = getDocumentId(req);

    if (!documentId) {
        return res.status(400).json({
            success: false,
            message: "Mã tài liệu không hợp lệ"
        });
    }

    // --------------------------------------------------
    // [02] KIỂM TRA XÁC THỰC VÀ VAI TRÒ
    // --------------------------------------------------

    // Middleware trong document.routes.js vẫn là lớp
    // xác thực JWT chính.
    //
    // Kiểm tra tại controller là lớp bảo vệ bổ sung.
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    if (
        req.user.role !== "ADMIN" &&
        req.user.role !== "TEACHER"
    ) {
        return res.status(403).json({
            success: false,
            message: "Bạn không có quyền xử lý tài liệu"
        });
    }

    // --------------------------------------------------
    // [03] CHỐNG XỬ LÝ TRÙNG
    // --------------------------------------------------

    if (processingIds.has(documentId)) {
        return res.status(409).json({
            success: false,
            message: "Tài liệu này đang được xử lý"
        });
    }

    processingIds.add(documentId);

    // connection chỉ được tạo khi chuẩn bị ghi MySQL.
    let connection = null;

    // Đánh dấu transaction đã bắt đầu nhưng chưa commit.
    // Nhờ đó tránh rollback khi transaction chưa tồn tại.
    let transactionStarted = false;

    try {
        // ==================================================
        // [04] LẤY THÔNG TIN TÀI LIỆU
        // ==================================================

        const [rows] = await pool.query(
            `SELECT
                document_id,
                subject_id,
                file_key,
                status,
                review_status
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL
             LIMIT 1`,
            [documentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu"
            });
        }

        const document = rows[0];

        // ==================================================
        // [05] KIỂM TRA QUYỀN QUẢN LÝ TÀI LIỆU
        // ==================================================

        const allowed = await hasProcessPermission(
            pool,
            document,
            req.user
        );

        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xử lý tài liệu này"
            });
        }

        // ==================================================
        // [06] KIỂM TRA TRẠNG THÁI TÀI LIỆU
        // ==================================================

        // APPROVED: tài liệu đã được giảng viên hoặc
        // quản trị viên có thẩm quyền phê duyệt.
        if (document.review_status !== "APPROVED") {
            return res.status(409).json({
                success: false,
                message: "Tài liệu chưa được phê duyệt"
            });
        }

        // PENDING: chưa được xử lý thành công cho RAG.
        //
        // Không cho chạy lại trên tài liệu READY
        // để tránh ghi đè chunks và embeddings cũ.
        if (document.status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "Chỉ xử lý tài liệu đang PENDING"
            });
        }

        // ==================================================
        // [07] KIỂM TRA FILE KEY
        // ==================================================

        // Đồng bộ với quy tắc file_key ở API download.
        //
        // Không cho phép:
        // - Đường dẫn ../
        // - Tên chứa dấu phân cách thư mục
        // - File không có phần mở rộng PDF
        //
        // Việc kiểm tra nội dung PDF thực tế vẫn thuộc
        // trách nhiệm của pdf.service và upload config.
        if (
            typeof document.file_key !== "string" ||
            !/^[a-zA-Z0-9_-]+\.pdf$/i.test(
                document.file_key
            )
        ) {
            return res.status(422).json({
                success: false,
                message: "Thông tin file PDF không hợp lệ"
            });
        }

        // ==================================================
        // [08] KIỂM TRA DỮ LIỆU RAG CŨ
        // ==================================================

        const [existingChunks] = await pool.query(
            `SELECT chunk_id
             FROM rag_chunks
             WHERE document_id = ?
             LIMIT 1`,
            [documentId]
        );

        if (existingChunks.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Tài liệu đã có dữ liệu chunk"
            });
        }

        // ==================================================
        // [09] TRÍCH XUẤT PDF
        // ==================================================

        // Tái sử dụng pdf.service.js.
        // Service chịu trách nhiệm đọc file PDF
        // và cung cấp dữ liệu các trang.
        const pdf = await extractPdfText(
            document.file_key
        );

        // ==================================================
        // [10] CHIA TÀI LIỆU THÀNH CHUNKS
        // ==================================================

        // Giữ lại page_number để RAG có thể:
        // - Trích dẫn đúng trang.
        // - Mở PDF tại nguồn tham khảo tương ứng.
        const chunks = createDocumentChunks(
            documentId,
            pdf.pages
        ).filter(
            (chunk) =>
                typeof chunk?.text === "string" &&
                chunk.text.trim().length > 0
        );

        if (chunks.length === 0) {
            return res.status(422).json({
                success: false,
                message: "PDF không tạo được chunk văn bản"
            });
        }

        // Giữ giới hạn cũ để tránh thay đổi hành vi hệ thống.
        if (chunks.length > MAX_TEST_CHUNKS) {
            return res.status(422).json({
                success: false,
                message:
                    `PDF có ${chunks.length} chunk, ` +
                    `vượt giới hạn ${MAX_TEST_CHUNKS}`
            });
        }

        // ==================================================
        // [11] TẠO EMBEDDING
        // ==================================================

        // Tạo toàn bộ embeddings TRƯỚC transaction.
        //
        // Lý do:
        // Mô hình embedding có thể xử lý khá lâu,
        // nhất là khi chạy trên CPU.
        //
        // Không nên giữ transaction và khóa MySQL
        // trong lúc chờ mô hình tính toán.
        const vectors = [];

        for (const chunk of chunks) {
            const rawVector = await createEmbedding(
                chunk.text
            );

            // Không lưu vector sai chiều hoặc có NaN.
            const vector = normalizeEmbedding(
                rawVector
            );

            vectors.push(vector);
        }

        // ==================================================
        // [12] BẮT ĐẦU TRANSACTION MYSQL
        // ==================================================

        connection = await pool.getConnection();

        await connection.beginTransaction();

        transactionStarted = true;

        // ==================================================
        // [13] KHÓA VÀ KIỂM TRA LẠI TÀI LIỆU
        // ==================================================

        // Trong thời gian tạo embedding, tài liệu có thể:
        // - Bị xóa mềm.
        // - Bị thay đổi trạng thái.
        // - Bị rút phê duyệt.
        // - Bị thay đổi file_key.
        //
        // SELECT FOR UPDATE giúp giữ khóa bản ghi
        // trong transaction hiện tại.
        const [lockedRows] = await connection.query(
            `SELECT
                document_id,
                subject_id,
                file_key,
                status,
                review_status
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL
             FOR UPDATE`,
            [documentId]
        );

        const current = lockedRows[0];

        // Kiểm tra lại quyền giảng viên bằng connection
        // đang tham gia transaction.
        const permissionValid = current
            ? await hasProcessPermission(
                connection,
                current,
                req.user
            )
            : false;

        if (
            !current ||
            current.status !== "PENDING" ||
            current.review_status !== "APPROVED" ||
            current.file_key !== document.file_key ||
            !permissionValid
        ) {
            const error = new Error(
                "Tài liệu hoặc quyền truy cập đã thay đổi"
            );

            error.statusCode = 409;
            throw error;
        }

        // ==================================================
        // [14] KIỂM TRA LẠI CHUNKS
        // ==================================================

        // Phòng trường hợp một request khác đã hoàn tất
        // việc xử lý khi request này còn tạo embedding.
        const [oldChunks] = await connection.query(
            `SELECT chunk_id
             FROM rag_chunks
             WHERE document_id = ?
             LIMIT 1`,
            [documentId]
        );

        if (oldChunks.length > 0) {
            const error = new Error(
                "Tài liệu đã có dữ liệu chunk"
            );

            error.statusCode = 409;
            throw error;
        }

        // ==================================================
        // [15] LƯU CHUNKS VÀ EMBEDDINGS
        // ==================================================

        // Mỗi chunk được INSERT trước để lấy chunk_id.
        // Sau đó embedding được lưu theo chunk_id.
        //
        // Tất cả INSERT đều dùng chung transaction.
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Lưu nội dung chunk và thông tin trang.
            const [inserted] = await connection.query(
                `INSERT INTO rag_chunks (
                    document_id,
                    chunk_index,
                    page_number,
                    text,
                    char_count
                 ) VALUES (?, ?, ?, ?, ?)`,
                [
                    documentId,
                    chunk.chunk_index,
                    chunk.page_number,
                    chunk.text,
                    chunk.char_count
                ]
            );

            // Lưu vector tương ứng với chunk vừa tạo.
            //
            // JSON.stringify(vectors[i]) tạo JSON array,
            // ví dụ [0.1, 0.2, ...].
            await connection.query(
                `INSERT INTO rag_embeddings (
                    chunk_id,
                    model,
                    dimension,
                    embedding
                 ) VALUES (?, ?, ?, ?)`,
                [
                    inserted.insertId,
                    MODEL_NAME,
                    EMBEDDING_DIM,
                    JSON.stringify(vectors[i])
                ]
            );
        }

        // ==================================================
        // [16] CẬP NHẬT TRẠNG THÁI READY
        // ==================================================

        // Chỉ thực hiện sau khi toàn bộ dữ liệu RAG
        // đã được ghi thành công.
        //
        // Nếu UPDATE không đúng một bản ghi,
        // transaction sẽ bị rollback.
        const [updated] = await connection.query(
            `UPDATE documents
             SET status = 'READY'
             WHERE document_id = ?
               AND status = 'PENDING'
               AND review_status = 'APPROVED'
               AND deleted_at IS NULL`,
            [documentId]
        );

        if (updated.affectedRows !== 1) {
            throw new Error(
                "Không thể cập nhật trạng thái READY"
            );
        }

        // ==================================================
        // [17] COMMIT TRANSACTION
        // ==================================================

        // Tất cả chunks, embeddings và trạng thái READY
        // được lưu thành một đơn vị công việc.
        await connection.commit();

        transactionStarted = false;

        // ==================================================
        // [18] TỰ ĐỘNG TẠO CACHE DOCLING
        // ==================================================

        // Giải phóng connection trước khi xử lý Docling.
        // Tránh giữ kết nối MySQL khi Python đang chạy.
        connection.release();
        connection = null;

        // Cache chỉ phục vụ giao diện xem nguồn.
        // Không ảnh hưởng dữ liệu chunk và embedding.
        let previewStatus = "READY";

        try {
            await ensureSourcePreviewCache(documentId);
        } catch (previewError) {
            previewStatus = "UNAVAILABLE";

            console.warn(
                `[SOURCE PREVIEW] Tài liệu #${documentId}:`,
                previewError.message
            );
        }

        // ==================================================
        // [19] TRẢ KẾT QUẢ THÀNH CÔNG
        // ==================================================

        return res.status(200).json({
            success: true,
            message: "Xử lý PDF thành công",
            data: {
                document_id: documentId,
                total_pages: pdf.totalPages,
                total_chunks: chunks.length,
                embedding_model: MODEL_NAME,
                status: "READY",
                preview_status: previewStatus
            }
        });

    } catch (error) {
        // ==================================================
        // [20] XỬ LÝ LỖI VÀ ROLLBACK
        // ==================================================

        // Chỉ rollback nếu transaction đã bắt đầu
        // nhưng chưa commit thành công.
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                // Ghi log riêng để không che mất lỗi gốc.
                console.error(
                    "[DOCUMENT PROCESS] Rollback lỗi:",
                    rollbackError
                );
            }
        }

        console.error(
            "[DOCUMENT PROCESS]",
            error
        );

        // Không gửi thêm response nếu headers đã gửi.
        if (res.headersSent) {
            return;
        }

        return res.status(
            error.statusCode || 500
        ).json({
            success: false,
            message: error.statusCode
                ? error.message
                : "Không thể xử lý PDF. Kiểm tra log backend."
        });

    } finally {
        // ==================================================
        // [21] DỌN TÀI NGUYÊN
        // ==================================================

        // Trả connection về pool dù thành công hay thất bại.
        if (connection) {
            connection.release();
        }

        // Mở khóa trong bộ nhớ để request sau có thể xử lý.
        processingIds.delete(documentId);
    }
};

// ======================================================
// [E] EXPORT CONTROLLER
// ======================================================

module.exports = {
    processDocumentForRag
};
