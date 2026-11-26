
"use strict";

// ======================================================
// KDOCUMENT - CHUNK SERVICE
//
// [01] Giữ xuống dòng văn bản
// [02] Giữ ranh giới các hàng bảng khi có thể
// [03] Chia chunk tối đa 600 ký tự
// [04] Giữ ngữ cảnh giữa các chunk
// [05] Bảo toàn số trang trích dẫn
// ======================================================

const MAX_CHARS = 600;
const OVERLAP_CHARS = 100;

// [01] Chia dòng quá dài mà không cắt mất ký tự.
const splitLongLine = (line) => {
    const result = [];
    let rest = line;

    while (rest.length > MAX_CHARS) {
        let cut = rest.lastIndexOf(" ", MAX_CHARS);

        if (cut < MAX_CHARS / 2) {
            cut = MAX_CHARS;
        }

        result.push(
            rest.slice(0, cut).trim()
        );

        rest = rest.slice(cut).trim();
    }

    if (rest) {
        result.push(rest);
    }

    return result;
};

// [02] Chia văn bản theo dòng thay vì xóa xuống dòng.
const splitText = (text) => {
    if (
        typeof text !== "string" ||
        !text.trim()
    ) {
        return [];
    }

    const normalized = text
        .replace(/\r\n?/g, "\n")
        .replace(/\u00a0/g, " ")
        // Giữ ranh giới cột dưới dạng dấu |.
        .replace(/\t+/g, " | ")
        .replace(/[ ]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const chunks = [];
    let current = "";

    for (const rawLine of normalized.split("\n")) {
        // [02.1] Giữ khoảng cách giữa các đoạn.
        if (!rawLine.trim()) {
            if (
                current &&
                !current.endsWith("\n\n")
            ) {
                current += "\n";
            }

            continue;
        }

        const parts = splitLongLine(
            rawLine.trim()
        );

        for (const line of parts) {
            const joiner =
                current && !current.endsWith("\n")
                    ? "\n"
                    : "";

            const candidate =
                current + joiner + line;

            // [02.2] Đẩy chunk khi vượt giới hạn.
            if (
                candidate.length > MAX_CHARS &&
                current.trim()
            ) {
                chunks.push(current.trim());

                // [02.3] Giữ lại dòng cuối làm ngữ cảnh
                // nếu dòng đó không quá dài.
                const lastLine =
                    current
                        .trim()
                        .split("\n")
                        .filter(Boolean)
                        .at(-1) || "";

                const withOverlap =
                    `${lastLine}\n${line}`;

                current = (
                    lastLine.length > 0 &&
                    lastLine.length <= OVERLAP_CHARS &&
                    lastLine !== line &&
                    withOverlap.length <= MAX_CHARS
                )
                    ? withOverlap
                    : line;

            } else {
                current = candidate;
            }
        }
    }

    if (current.trim()) {
        chunks.push(current.trim());
    }

    return chunks;
};

// [03] Tạo chunk theo từng trang PDF.
const createDocumentChunks = (documentId, pages) => {
    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
    ) {
        throw new Error("Mã tài liệu không hợp lệ");
    }

    if (!Array.isArray(pages)) {
        throw new Error(
            "Danh sách trang PDF không hợp lệ"
        );
    }

    const result = [];

    for (const page of pages) {
        if (
            !Number.isSafeInteger(page.pageNumber) ||
            page.pageNumber <= 0 ||
            typeof page.text !== "string"
        ) {
            throw new Error(
                "Dữ liệu trang PDF không hợp lệ"
            );
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
