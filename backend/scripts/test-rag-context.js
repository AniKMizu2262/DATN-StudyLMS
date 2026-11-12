
const path = require("path");

// ======================================================
// [A] NẠP MÔI TRƯỜNG
// ======================================================

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const pool = require("../src/config/database");

const {
    buildRagContext
} = require("../src/services/ragContext.service");

const {
    releaseEmbeddingModel
} = require("../src/services/embedding.service");

// ======================================================
// [B] KIỂM THỬ NGỮ CẢNH VÀ TRÍCH DẪN
// ======================================================

const main = async () => {
    const documentId = Number(process.argv[2]);
    const question = process.argv.slice(3).join(" ").trim();

    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    if (!question) {
        throw new Error("Vui lòng nhập câu hỏi");
    }

    const result = await buildRagContext(documentId, question);

    console.log("\n===== KẾT QUẢ RAG =====");
    console.log("Câu hỏi:", result.question);
    console.log("Có ngữ cảnh:", result.hasContext);
    console.log("Số nguồn:", result.totalSources);

    console.log("\n===== DANH SÁCH TRÍCH DẪN =====");
    console.log(JSON.stringify(result.citations, null, 2));

    console.log("\n===== NGỮ CẢNH CHO AI =====");
    console.log(
        result.hasContext
            ? result.context
            : "Không tìm thấy nguồn đủ liên quan."
    );
};

main()
    .catch((error) => {
        console.error("Lỗi tạo ngữ cảnh RAG:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await releaseEmbeddingModel();
        } finally {
            await pool.end();
        }
    });
