"use strict";

const pool = require("../config/database");

const {
    MODEL_NAME,
    EMBEDDING_DIM,
    createEmbedding
} = require("./embedding.service");

// ======================================================
// KDOCUMENT | DAY20 - TÌM KIẾM NGỮ NGHĨA RAG
//
// Giữ nguyên thuật toán cosine similarity và giao diện:
// searchDocumentChunks(documentId, question, topK = 3)
//
// Lưu ý: Service này chỉ lọc theo tài liệu và trạng thái
// đã xử lý. Quyền của người dùng phải được kiểm tra bởi
// rag.controller.js và ragAccess.service.js trước khi gọi.
// ======================================================

// [A] TÍNH ĐỘ TƯƠNG ĐỒNG COSINE
const cosineSimilarity = (vectorA, vectorB) => {
    if (
        !Array.isArray(vectorA) ||
        !Array.isArray(vectorB) ||
        vectorA.length !== EMBEDDING_DIM ||
        vectorB.length !== EMBEDDING_DIM
    ) {
        throw new Error("Hai vector không cùng số chiều");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        const a = vectorA[i];
        const b = vectorB[i];

        if (
            typeof a !== "number" ||
            typeof b !== "number" ||
            !Number.isFinite(a) ||
            !Number.isFinite(b)
        ) {
            throw new Error("Vector chứa giá trị không hợp lệ");
        }

        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    if (normA === 0 || normB === 0) {
        throw new Error("Không thể so sánh vector có độ dài bằng 0");
    }

    // Sai số dấu phẩy động đôi khi khiến cosine hơi vượt 1/-1.
    // Chặn về miền toán học hợp lệ mà không đổi thuật toán.
    const score = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(-1, Math.min(1, score));
};

// [B] CHUYỂN VECTOR TỪ MYSQL
// Cột JSON có thể được driver trả thành Array, string hoặc Buffer.
const parseEmbedding = (value) => {
    const parsed = Buffer.isBuffer(value)
        ? JSON.parse(value.toString("utf8"))
        : typeof value === "string"
            ? JSON.parse(value)
            : value;

    if (
        !Array.isArray(parsed) ||
        parsed.length !== EMBEDDING_DIM ||
        !parsed.every((number) =>
            typeof number === "number" && Number.isFinite(number)
        )
    ) {
        throw new Error("Dữ liệu embedding trong MySQL không hợp lệ");
    }

    return parsed;
};

// [C] TÌM CÁC CHUNK THUỘC MỘT TÀI LIỆU
const searchDocumentChunks = async (documentId, question, topK = 3) => {
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    if (
        typeof question !== "string" ||
        !question.trim() ||
        question.length > 1000
    ) {
        throw new Error("Câu hỏi không hợp lệ");
    }

    if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
        throw new Error("Số lượng kết quả không hợp lệ");
    }

    // [01] Chỉ đọc chunk của tài liệu chưa xóa và đã READY.
    // Không thêm điều kiện APPROVED vì giảng viên có quyền
    // hỏi tài liệu PRIVATE/đang chờ duyệt lại khi đã READY.
    // Việc phân quyền từng người dùng nằm ở ragAccess.service.js.
    const [rows] = await pool.query(
        `SELECT
            c.chunk_id,
            c.document_id,
            c.chunk_index,
            c.page_number,
            c.text,
            e.embedding
         FROM rag_chunks c
         JOIN rag_embeddings e ON c.chunk_id = e.chunk_id
         JOIN documents d ON c.document_id = d.document_id
         WHERE c.document_id = ?
           AND d.deleted_at IS NULL
           AND d.status = 'READY'
           AND e.model = ?
           AND e.dimension = ?`,
        [documentId, MODEL_NAME, EMBEDDING_DIM]
    );

    if (rows.length === 0) {
        return [];
    }

    // [02] Tạo embedding câu hỏi một lần, tái sử dụng để so sánh.
    const questionVector = await createEmbedding(question);

    // Kiểm tra vector câu hỏi riêng, để không nhầm lỗi của
    // model với dữ liệu embedding bị hỏng trong MySQL.
    if (
        !Array.isArray(questionVector) ||
        questionVector.length !== EMBEDDING_DIM ||
        !questionVector.every((number) =>
            typeof number === "number" && Number.isFinite(number)
        ) ||
        !questionVector.some((number) => number !== 0)
    ) {
        throw new Error("Embedding câu hỏi không hợp lệ");
    }

    // [03] So sánh với từng chunk.
    // Nếu một bản ghi vector bị hỏng, bỏ qua bản ghi đó thay
    // vì làm hỏng cả lần hỏi đáp; ghi log để truy vết dữ liệu.
    const results = [];
    let invalidEmbeddings = 0;

    for (const row of rows) {
        try {
            const chunkVector = parseEmbedding(row.embedding);
            const similarity = cosineSimilarity(questionVector, chunkVector);

            results.push({
                chunk_id: row.chunk_id,
                document_id: row.document_id,
                chunk_index: row.chunk_index,
                page_number: row.page_number,
                text: row.text,
                score: Number(similarity.toFixed(4))
            });
        } catch (error) {
            invalidEmbeddings++;
            console.warn(
                `[VECTOR SEARCH] Bỏ qua chunk ${row.chunk_id}: ${error.message}`
            );
        }
    }

    // Nếu mọi vector đều hỏng, báo lỗi thay vì trả lời rằng
    // tài liệu không có thông tin phù hợp (kết luận sai).
    if (invalidEmbeddings > 0 && results.length === 0) {
        throw new Error("Không có embedding hợp lệ trong tài liệu");
    }

    // [04] Sắp xếp theo điểm tương đồng, lấy tối đa topK.
    // Giữ thứ tự truy xuất ban đầu khi hai điểm bằng nhau.
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
};

module.exports = {
    cosineSimilarity,
    searchDocumentChunks
};