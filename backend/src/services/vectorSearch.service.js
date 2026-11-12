
const pool = require("../config/database");

const {
    MODEL_NAME,
    EMBEDDING_DIM,
    createEmbedding
} = require("./embedding.service");

// ======================================================
// KDOCUMENT - DỊCH VỤ TÌM KIẾM NGỮ NGHĨA RAG
// So sánh câu hỏi với embedding của các chunk
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

        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            throw new Error("Vector chứa giá trị không hợp lệ");
        }

        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    if (normA === 0 || normB === 0) {
        throw new Error("Không thể so sánh vector có độ dài bằng 0");
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// [B] CHUYỂN EMBEDDING TỪ MYSQL THÀNH MẢNG SỐ
const parseEmbedding = (value) => {
    const parsed = Buffer.isBuffer(value)
        ? JSON.parse(value.toString("utf8"))
        : typeof value === "string"
            ? JSON.parse(value)
            : value;

    if (!Array.isArray(parsed)) {
        throw new Error("Dữ liệu embedding trong MySQL không hợp lệ");
    }

    return parsed;
};

// [C] TÌM CHUNK LIÊN QUAN TRONG MỘT TÀI LIỆU
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

    // [01] Lấy chunk và embedding của tài liệu chưa bị xóa
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
           AND e.model = ?
           AND e.dimension = ?`,
        [documentId, MODEL_NAME, EMBEDDING_DIM]
    );

    if (rows.length === 0) {
        return [];
    }

    // [02] Tạo embedding cho câu hỏi
    const questionVector = await createEmbedding(question);

    // [03] So sánh câu hỏi với từng chunk
    const results = rows.map((row) => {
        const chunkVector = parseEmbedding(row.embedding);
        const similarity = cosineSimilarity(
            questionVector,
            chunkVector
        );

        return {
            chunk_id: row.chunk_id,
            document_id: row.document_id,
            chunk_index: row.chunk_index,
            page_number: row.page_number,
            text: row.text,
            score: Number(similarity.toFixed(4))
        };
    });

    // [04] Xếp hạng theo mức độ liên quan
    results.sort((a, b) => b.score - a.score);

    // [05] Trả về những chunk liên quan nhất
    return results.slice(0, topK);
};

// ======================================================
// [D] XUẤT DỊCH VỤ
// ======================================================

module.exports = {
    cosineSimilarity,
    searchDocumentChunks
};
