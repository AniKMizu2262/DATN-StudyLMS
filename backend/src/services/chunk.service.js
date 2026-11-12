
 // ======================================================
 // KDOCUMENT - DỊCH VỤ CHIA NHỎ VĂN BẢN
 // ======================================================

const MAX_CHARS = 600;
const OVERLAP_CHARS = 100;

// [01] CHIA NỘI DUNG THÀNH CÁC ĐOẠN CÓ CHỒNG LẤN
const splitText = (text) => {
    const words = text.trim().split(/\s+/u).filter(Boolean);
    const chunks = [];

    let start = 0;

    while (start < words.length) {
        let end = start;
        let length = 0;

        // Gom từ vào chunk, tối đa khoảng 600 ký tự
        while (end < words.length) {
            const wordLength = words[end].length;
            const nextLength = length + (end > start ? 1 : 0) + wordLength;

            if (end > start && nextLength > MAX_CHARS) break;

            length = nextLength;
            end++;
        }

        chunks.push(words.slice(start, end).join(" "));

        if (end >= words.length) break;

        // Giữ lại khoảng 100 ký tự cuối làm ngữ cảnh
        let overlapStart = end;
        let overlapLength = 0;

        while (
            overlapStart > start + 1 &&
            overlapLength < OVERLAP_CHARS
        ) {
            overlapStart--;
            overlapLength += words[overlapStart].length + 1;
        }

        start = overlapStart;
    }

    return chunks;
};

// [02] TẠO CHUNK THEO TỪNG TRANG PDF
const createDocumentChunks = (documentId, pages) => {
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    if (!Array.isArray(pages)) {
        throw new Error("Danh sách trang PDF không hợp lệ");
    }

    const result = [];

    for (const page of pages) {
        if (
            !Number.isSafeInteger(page.pageNumber) ||
            page.pageNumber <= 0 ||
            typeof page.text !== "string"
        ) {
            throw new Error("Dữ liệu trang PDF không hợp lệ");
        }

        const parts = splitText(page.text);

        for (const part of parts) {
            result.push({
                document_id: documentId,
                chunk_index: result.length,
                page_number: page.pageNumber,
                text: part,
                char_count: part.length
            });
        }
    }

    return result;
};

module.exports = {
    createDocumentChunks
};
