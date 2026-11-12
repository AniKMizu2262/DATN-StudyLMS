
const path = require("path");

// ======================================================
// [A] NẠP MÔI TRƯỜNG
// ======================================================

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const pool = require("../src/config/database");

const {
    searchDocumentChunks
} = require("../src/services/vectorSearch.service");

const {
    releaseEmbeddingModel
} = require("../src/services/embedding.service");

// ======================================================
// [B] KIỂM THỬ TÌM KIẾM NGỮ NGHĨA
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

    console.log("\n===== TÌM KIẾM NGỮ NGHĨA =====");
    console.log("Tài liệu:", documentId);
    console.log("Câu hỏi:", question);

    // Tìm tối đa 3 chunk liên quan nhất
    const results = await searchDocumentChunks(
        documentId,
        question,
        3
    );

    console.log("\nSố kết quả:", results.length);

    for (const [index, result] of results.entries()) {
        console.log(`\n----- KẾT QUẢ ${index + 1} -----`);
        console.log("Chunk ID:", result.chunk_id);
        console.log("Trang:", result.page_number);
        console.log("Độ tương đồng:", result.score);
        console.log("Nội dung:", result.text.slice(0, 300));
    }
};

// ======================================================
// [C] CHẠY VÀ GIẢI PHÓNG TÀI NGUYÊN
// ======================================================

main()
    .catch((error) => {
        console.error("Lỗi tìm kiếm:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await releaseEmbeddingModel();
        } finally {
            await pool.end();
        }
    });
