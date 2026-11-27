"use strict";

const {
    searchDocumentChunks
} = require("./vectorSearch.service");

// ======================================================
// KDOCUMENT | DAY20 - TẠO NGỮ CẢNH RAG VÀ TRÍCH DẪN
//
// Giữ nguyên cách truy xuất Day19:
// - Lấy tối đa 3 chunk từ vectorSearch.service.
// - Chỉ nhận chunk có score >= 0.35.
// - Giữ định dạng [NGUỒN n] mà prompt và bộ kiểm tra
//   trích dẫn của hệ thống đang sử dụng.
// ======================================================

const MIN_SCORE = 0.35;
const TOP_K = 3;

// ID từ MySQL có thể là number hoặc chuỗi số thập phân.
// Không chấp nhận ID rỗng, số âm, số thực hay số vượt
// giới hạn an toàn của JavaScript.
const toPositiveId = (value) => {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0
            ? value
            : null;
    }

    if (
        typeof value === "string" &&
        /^[1-9]\d*$/.test(value)
    ) {
        const id = Number(value);
        return Number.isSafeInteger(id) ? id : null;
    }

    return null;
};

// [01] Tạo ngữ cảnh cho một tài liệu cụ thể.
const buildRagContext = async (documentId, question) => {
    const validDocumentId = toPositiveId(documentId);

    // Controller đã kiểm tra đầu vào; service vẫn tự bảo vệ
    // để có thể được gọi an toàn từ các luồng khác.
    if (
        validDocumentId === null ||
        typeof question !== "string" ||
        !question.trim()
    ) {
        throw new Error(
            "Mã tài liệu hoặc câu hỏi RAG không hợp lệ"
        );
    }

    // [02] Giữ nguyên top-3 và thứ tự xếp hạng của vector search.
    const results = await searchDocumentChunks(
        validDocumentId,
        question,
        TOP_K
    );

    if (!Array.isArray(results)) {
        // Lỗi dữ liệu từ service khác với trường hợp tìm kiếm
        // hợp lệ nhưng không có chunk phù hợp.
        throw new Error(
            "Kết quả tìm kiếm vector không hợp lệ"
        );
    }

    // [03] Chỉ dùng các chunk hợp lệ và đúng tài liệu.
    //
    // Không cho điểm NaN/Infinity, văn bản rỗng hoặc
    // metadata thiếu lọt vào prompt/trích dẫn.
    const relevantChunks = results
        .filter((chunk) => {
            if (!chunk || typeof chunk !== "object") {
                return false;
            }

            const score = Number(chunk.score);

            return (
                toPositiveId(chunk.document_id) === validDocumentId &&
                toPositiveId(chunk.chunk_id) !== null &&
                toPositiveId(chunk.page_number) !== null &&
                typeof chunk.text === "string" &&
                chunk.text.trim().length > 0 &&
                Number.isFinite(score) &&
                score >= MIN_SCORE
            );
        })
        .map((chunk) => ({
            ...chunk,
            document_id: validDocumentId,
            chunk_id: toPositiveId(chunk.chunk_id),
            page_number: toPositiveId(chunk.page_number),
            score: Number(chunk.score)
        }));

    // [04] Tạo trích dẫn từ chính các chunk đã lọc.
    //
    // Số nguồn liên tiếp 1, 2, 3.
    // Không đổi định dạng JSON mà frontend sử dụng.
    const citations = relevantChunks.map((chunk, index) => ({
        source_number: index + 1,
        document_id: chunk.document_id,
        chunk_id: chunk.chunk_id,
        page_number: chunk.page_number,
        score: chunk.score
    }));

    // [05] Ghép ngữ cảnh.
    //
    // Giữ nguyên text gốc của chunk để không làm mất
    // thông tin hoặc sai vị trí trích dẫn.
    const context = relevantChunks
        .map((chunk, index) => {
            return [
                `[NGUỒN ${index + 1}]`,
                `Mã tài liệu: ${chunk.document_id}`,
                `Mã chunk: ${chunk.chunk_id}`,
                `Trang: ${chunk.page_number}`,
                "Nội dung:",
                chunk.text,
                `[KẾT THÚC NGUỒN ${index + 1}]`
            ].join("\n");
        })
        .join("\n\n");

    // [06] Giữ nguyên contract với rag.controller.js.
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