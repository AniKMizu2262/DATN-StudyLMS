
const {
    searchDocumentChunks
} = require("./vectorSearch.service");

// ======================================================
// KDOCUMENT - TẠO NGỮ CẢNH RAG VÀ TRÍCH DẪN NGUỒN
// ======================================================

// Ngưỡng thử nghiệm, sẽ điều chỉnh sau khi đánh giá
const MIN_SCORE = 0.35;

// [01] LẤY NHỮNG CHUNK LIÊN QUAN ĐẾN CÂU HỎI
const buildRagContext = async (documentId, question) => {

    const results = await searchDocumentChunks(
        documentId,
        question,
        3
    );

    // [02] Lọc kết quả theo mức độ tương đồng
    const relevantChunks = results.filter(
        (chunk) => chunk.score >= MIN_SCORE
    );

    // [03] Tạo danh sách trích dẫn
    const citations = relevantChunks.map((chunk, index) => ({
        source_number: index + 1,
        document_id: chunk.document_id,
        chunk_id: chunk.chunk_id,
        page_number: chunk.page_number,
        score: chunk.score
    }));

    // [04] Ghép nội dung làm ngữ cảnh cho AI
    const context = relevantChunks.map((chunk, index) => {
        return [
            `[NGUỒN ${index + 1}]`,
            `Mã tài liệu: ${chunk.document_id}`,
            `Mã chunk: ${chunk.chunk_id}`,
            `Trang: ${chunk.page_number}`,
            `Nội dung:`,
            chunk.text,
            `[KẾT THÚC NGUỒN ${index + 1}]`
        ].join("\n");
    }).join("\n\n");

    // [05] Trả về dữ liệu chuẩn bị cho LLM
    return {
        question,
        hasContext: relevantChunks.length > 0,
        totalSources: relevantChunks.length,
        context,
        citations
    };
};

module.exports = {
    buildRagContext
};
