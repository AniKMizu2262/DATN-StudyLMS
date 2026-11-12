
 // ======================================================
 // KDOCUMENT - DỊCH VỤ TẠO EMBEDDING
 // Model đa ngôn ngữ, chạy cục bộ trên CPU
 // ======================================================

 // [A] CẤU HÌNH MODEL
 const MODEL_NAME = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
 const EMBEDDING_DIM = 384;

 // Tái sử dụng model thay vì tải lại cho từng chunk
 let modelPromise = null;

 // ======================================================
 // [B] KHỞI TẠO MODEL
 // ======================================================

 const getEmbeddingModel = async () => {
     if (!modelPromise) {
         modelPromise = (async () => {
             const { pipeline } = await import("@huggingface/transformers");

             console.log("Đang nạp model embedding...");

             return pipeline("feature-extraction", MODEL_NAME, {
                 device: "cpu",
                 dtype: "q8"
             });
         })().catch((error) => {
             modelPromise = null;
             throw error;
         });
     }

     return modelPromise;
 };

 // ======================================================
 // [C] CHUYỂN VĂN BẢN THÀNH VECTOR
 // ======================================================

 const createEmbedding = async (text) => {
     if (typeof text !== "string" || !text.trim()) {
         throw new Error("Nội dung embedding không hợp lệ");
     }

     const model = await getEmbeddingModel();

     const output = await model(text.trim(), {
         pooling: "mean",
         normalize: true
     });

     const vector = Array.from(output.data);

     // Kiểm tra vector trước khi lưu MySQL
     if (
         vector.length !== EMBEDDING_DIM ||
         !vector.every(Number.isFinite)
     ) {
         throw new Error("Vector embedding không hợp lệ");
     }

     return vector;
 };

 // ======================================================
 // [D] GIẢI PHÓNG MODEL
 // ======================================================

 const releaseEmbeddingModel = async () => {
     if (!modelPromise) return;

     try {
         const model = await modelPromise;

         if (typeof model.dispose === "function") {
             await model.dispose();
         }
     } finally {
         modelPromise = null;
     }
 };

 // ======================================================
 // [E] XUẤT DỊCH VỤ
 // ======================================================

 module.exports = {
     MODEL_NAME,
     EMBEDDING_DIM,
     createEmbedding,
     releaseEmbeddingModel
 };
