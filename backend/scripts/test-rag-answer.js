
const path = require("path");

// ======================================================
// KDOCUMENT - KIỂM THỬ HỆ THỐNG RAG DAY 12
// ======================================================

// [A] NẠP BIẾN MÔI TRƯỜNG
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

// [B] KẾT NỐI DATABASE
const pool = require("../src/config/database");

// [C] NẠP CÁC DỊCH VỤ RAG
const {
    buildRagContext
} = require("../src/services/ragContext.service");

const {
    generateAnswer
} = require("../src/services/llm.service");

const {
    validateAnswerCitations
} = require("../src/services/ragCitation.service");

const {
    releaseEmbeddingModel
} = require("../src/services/embedding.service");

// ======================================================
// [D] KIỂM THỬ QUY TRÌNH HỎI ĐÁP RAG
// ======================================================

const main = async () => {

    // [01] Nhận mã tài liệu và câu hỏi
    const documentId = Number(process.argv[2]);
    const question = process.argv.slice(3).join(" ").trim();

    // Kiểm tra mã tài liệu
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    // Kiểm tra câu hỏi
    if (!question || question.length > 1000) {
        throw new Error("Câu hỏi không hợp lệ");
    }

    console.log("\n===== KDOCUMENT AI - DAY 12 =====");
    console.log("Mã tài liệu:", documentId);
    console.log("Câu hỏi:", question);

    // ==================================================
    // [02] TRUY XUẤT NGỮ CẢNH RAG
    // ==================================================

    const rag = await buildRagContext(documentId, question);

    console.log("\nSố nguồn tìm được:", rag.totalSources);

    // Không có nguồn phù hợp thì không gọi LLM
    if (!rag.hasContext) {
        console.log(
            "\nKdocument AI: Không tìm thấy thông tin phù hợp trong tài liệu để trả lời."
        );
        return;
    }

    // ==================================================
    // [03] GỬI CÂU HỎI ĐẾN LLM
    // ==================================================

    console.log("\nĐang tạo câu trả lời bằng AI...");

    const result = await generateAnswer(
        question,
        rag.context
    );

    // ==================================================
    // [04] KIỂM TRA TRÍCH DẪN NGUỒN
    // ==================================================

    const citationCheck = validateAnswerCitations(
        result.answer,
        rag.citations
    );

    if (!citationCheck.valid) {
        throw new Error("Trích dẫn nguồn không hợp lệ");
    }

    // ==================================================
    // [05] HIỂN THỊ CÂU TRẢ LỜI
    // ==================================================

    console.log("\n===== CÂU TRẢ LỜI =====");
    console.log(result.answer);

    // ==================================================
    // [06] HIỂN THỊ NGUỒN THỰC SỰ ĐƯỢC AI DẪN
    // ==================================================

    console.log("\n===== NGUỒN THAM KHẢO =====");

    for (const citation of citationCheck.usedCitations) {
        console.log(
            `[NGUỒN ${citation.source_number}] ` +
            `Tài liệu ${citation.document_id}, ` +
            `trang ${citation.page_number}, ` +
            `chunk ${citation.chunk_id}, ` +
            `score ${citation.score}`
        );
    }

    // ==================================================
    // [07] THỐNG KÊ KẾT QUẢ
    // ==================================================

    console.log("\n===== THỐNG KÊ RAG =====");
    console.log("Nguồn tìm được:", citationCheck.retrievedCount);
    console.log("Nguồn được trích dẫn:", citationCheck.citedCount);
    console.log("Trích dẫn hợp lệ:", citationCheck.valid);
    console.log("Model:", result.model);
};

// ======================================================
// [E] CHẠY SCRIPT VÀ GIẢI PHÓNG TÀI NGUYÊN
// ======================================================

main()
    .catch((error) => {
        console.error("\nLỗi Kdocument AI:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await releaseEmbeddingModel();
        } finally {
            await pool.end();
        }
    });
