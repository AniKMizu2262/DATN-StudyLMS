
const path = require("path");

// ======================================================
// [A] NẠP MÔI TRƯỜNG
// ======================================================

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const pool = require("../src/config/database");

const {
    MODEL_NAME,
    EMBEDDING_DIM,
    createEmbedding,
    releaseEmbeddingModel
} = require("../src/services/embedding.service");

// ======================================================
// [B] TẠO VÀ LƯU EMBEDDING
// ======================================================

const saveEmbeddings = async (documentId) => {

    // [01] Kiểm tra tài liệu còn tồn tại
    const [documents] = await pool.query(
        `SELECT document_id, title
         FROM documents
         WHERE document_id = ?
           AND deleted_at IS NULL`,
        [documentId]
    );

    if (documents.length === 0) {
        throw new Error("Không tìm thấy tài liệu hợp lệ");
    }

    // [02] Lấy các chunk đã lưu trong MySQL
    const [chunks] = await pool.query(
        `SELECT chunk_id, chunk_index, text
         FROM rag_chunks
         WHERE document_id = ?
         ORDER BY chunk_index`,
        [documentId]
    );

    if (chunks.length === 0) {
        throw new Error("Tài liệu chưa có chunk");
    }

    console.log("\n===== TẠO EMBEDDING =====");
    console.log("Tài liệu:", documents[0].title);
    console.log("Số chunk:", chunks.length);
    console.log("Model:", MODEL_NAME);

    // [03] Tạo embedding thật, chưa ghi database
    const embeddings = [];

    for (const chunk of chunks) {
        const vector = await createEmbedding(chunk.text);

        embeddings.push({
            chunkId: chunk.chunk_id,
            chunkIndex: chunk.chunk_index,
            text: chunk.text,
            vector
        });

        console.log(
            `Đã tạo embedding chunk ${chunk.chunk_index}: ${vector.length} chiều`
        );
    }

    // ==================================================
    // [C] GHI MYSQL BẰNG TRANSACTION
    // ==================================================

    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
        await connection.beginTransaction();
        transactionStarted = true;

        // [04] Khóa tài liệu để tránh thay đổi khi ghi
        const [currentDocuments] = await connection.query(
            `SELECT document_id
             FROM documents
             WHERE document_id = ?
               AND deleted_at IS NULL
             FOR UPDATE`,
            [documentId]
        );

        if (currentDocuments.length === 0) {
            throw new Error("Tài liệu đã bị xóa mềm");
        }

        // [05] Kiểm tra chunk chưa bị thay thế
        const [currentChunks] = await connection.query(
            `SELECT chunk_id, chunk_index, text
             FROM rag_chunks
             WHERE document_id = ?
             ORDER BY chunk_index
             FOR UPDATE`,
            [documentId]
        );

        if (
            currentChunks.length !== embeddings.length ||
            currentChunks.some((chunk, index) =>
                chunk.chunk_id !== embeddings[index].chunkId ||
                chunk.chunk_index !== embeddings[index].chunkIndex ||
                chunk.text !== embeddings[index].text
            )
        ) {
            throw new Error(
                "Nội dung chunk đã thay đổi, cần tạo lại embedding"
            );
        }

        // [06] Lưu hoặc cập nhật embedding
        for (const item of embeddings) {
            const vectorJson = JSON.stringify(item.vector);

            await connection.query(
                `INSERT INTO rag_embeddings (
                    chunk_id, model, dimension, embedding
                )
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    model = ?,
                    dimension = ?,
                    embedding = ?,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    item.chunkId,
                    MODEL_NAME,
                    EMBEDDING_DIM,
                    vectorJson,
                    MODEL_NAME,
                    EMBEDDING_DIM,
                    vectorJson
                ]
            );
        }

        await connection.commit();
        transactionStarted = false;

        console.log("\n===== HOÀN THÀNH =====");
        console.log("Tài liệu:", documentId);
        console.log("Embedding đã lưu:", embeddings.length);
        console.log("Số chiều:", EMBEDDING_DIM);

    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
        }

        throw error;

    } finally {
        connection.release();
    }
};

// ======================================================
// [D] CHẠY SCRIPT
// ======================================================

const main = async () => {
    const rawId = process.argv[2];

    if (!/^[1-9]\d*$/.test(rawId || "")) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    const documentId = Number(rawId);

    if (!Number.isSafeInteger(documentId)) {
        throw new Error("Mã tài liệu vượt giới hạn cho phép");
    }

    await saveEmbeddings(documentId);
};

main()
    .catch((error) => {
        console.error("Lỗi tạo embedding:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await releaseEmbeddingModel();
        } finally {
            await pool.end();
        }
    });
