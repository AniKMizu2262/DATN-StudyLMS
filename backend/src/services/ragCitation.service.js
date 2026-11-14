
 // ======================================================
 // KDOCUMENT - KIỂM TRA TRÍCH DẪN NGUỒN RAG
 // ======================================================

 // [01] KIỂM TRA NGUỒN ĐƯỢC AI SỬ DỤNG
 const validateAnswerCitations = (answer, availableCitations) => {

     if (typeof answer !== "string" || !answer.trim()) {
         throw new Error("Câu trả lời AI không hợp lệ");
     }

     if (!Array.isArray(availableCitations)) {
         throw new Error("Danh sách nguồn không hợp lệ");
     }

     // [02] Lấy các mã [NGUỒN 1], [NGUỒN 2]...
     const matches = [
         ...answer.matchAll(/\[\s*NGUỒN\s+([1-9]\d*)\s*\]/giu)
     ];

     const sourceNumbers = [
         ...new Set(matches.map((match) => Number(match[1])))
     ];

     // [03] Không chấp nhận câu trả lời thiếu trích dẫn
     if (sourceNumbers.length === 0) {
         throw new Error(
             "AI chưa cung cấp trích dẫn nguồn hợp lệ"
         );
     }

     // [04] Lập danh sách nguồn thực sự có trong RAG
     const sourceMap = new Map(
         availableCitations.map((citation) => [
             citation.source_number,
             citation
         ])
     );

     // [05] Phát hiện nguồn do AI tự tạo
     const invalidSources = sourceNumbers.filter(
         (number) => !sourceMap.has(number)
     );

     if (invalidSources.length > 0) {
         throw new Error(
             "AI sử dụng nguồn không tồn tại: " +
             invalidSources.join(", ")
         );
     }

     // [06] Chỉ lấy những nguồn AI có dẫn trong câu trả lời
     const usedCitations = sourceNumbers.map(
         (number) => sourceMap.get(number)
     );

     return {
         valid: true,
         retrievedCount: availableCitations.length,
         citedCount: usedCitations.length,
         usedCitations
     };
 };

 module.exports = {
     validateAnswerCitations
 };
