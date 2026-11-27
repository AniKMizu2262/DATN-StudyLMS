"use strict";

// ======================================================
// KDOCUMENT | DAY20 - KIỂM TRA TRÍCH DẪN NGUỒN RAG
//
// Chỉ chấp nhận mã [NGUỒN n] đã được ragContext.service
// cấp cho lượt hỏi đáp hiện tại.
//
// Giữ nguyên cấu trúc trả về để rag.controller.js và
// frontend không phải thay đổi.
// ======================================================

// Kiểm tra số thứ tự nguồn, cho phép number hoặc chuỗi số.
// Không chấp nhận số 0, số thập phân, "01", "1e2" hoặc số
// vượt quá Number.MAX_SAFE_INTEGER.
const parseSourceNumber = (value) => {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0
            ? value
            : null;
    }

    if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) ? parsed : null;
    }

    return null;
};

const validateAnswerCitations = (answer, availableCitations) => {
    // [01] Kiểm tra đầu vào.
    if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("Câu trả lời AI không hợp lệ");
    }

    if (!Array.isArray(availableCitations) || availableCitations.length === 0) {
        throw new Error("Danh sách nguồn không hợp lệ");
    }

    // [02] Lập bản đồ nguồn hợp lệ của đúng lượt truy xuất RAG.
    // Các số nguồn phải duy nhất; không thể có hai chunk khác nhau
    // cùng mang mã [NGUỒN 1].
    const sourceMap = new Map();

    for (const citation of availableCitations) {
        const number = parseSourceNumber(citation?.source_number);

        if (number === null || sourceMap.has(number)) {
            throw new Error("Danh sách nguồn có mã không hợp lệ hoặc trùng lặp");
        }

        sourceMap.set(number, citation);
    }

    // [03] Tìm TẤT CẢ thẻ bắt đầu bằng [NGUỒN, kể cả thẻ sai.
    // Regex cũ chỉ nhận [NGUỒN 1], khiến [NGUỒN 0] hoặc
    // [NGUỒN abc] bị bỏ qua nếu câu trả lời còn có một thẻ đúng.
    const citationStarts = [
        ...answer.matchAll(/\[\s*NGUỒN/giu)
    ];

    const citationTags = [
        ...answer.matchAll(/\[\s*NGUỒN\s*([^\]]*)\]/giu)
    ];

    if (citationTags.length === 0) {
        throw new Error("AI chưa cung cấp trích dẫn nguồn hợp lệ");
    }

    // Phát hiện thẻ thiếu dấu đóng ], ví dụ "[NGUỒN 1".
    if (citationStarts.length !== citationTags.length) {
        throw new Error("AI sử dụng trích dẫn không đúng định dạng");
    }

    // [04] Đọc số nguồn theo thứ tự xuất hiện, không lặp lại.
    const sourceNumbers = [];
    const seen = new Set();

    for (const tag of citationTags) {
        const number = parseSourceNumber(tag[1].trim());

        // Không âm thầm bỏ qua [NGUỒN 0], [NGUỒN abc],
        // [NGUỒN 01] hoặc [NGUỒN 1, 2].
        if (number === null) {
            throw new Error(`AI sử dụng trích dẫn sai định dạng: ${tag[0]}`);
        }

        // Mã hợp lệ về cú pháp nhưng không có trong context:
        // ví dụ AI tự bịa [NGUỒN 9] khi chỉ cung cấp nguồn 1-3.
        if (!sourceMap.has(number)) {
            throw new Error(`AI sử dụng nguồn không tồn tại: ${number}`);
        }

        if (!seen.has(number)) {
            seen.add(number);
            sourceNumbers.push(number);
        }
    }

    // [05] Trả đúng metadata của các nguồn AI thực sự dẫn.
    // Giữ nguyên thứ tự xuất hiện và cấu trúc response Day17.
    const usedCitations = sourceNumbers.map((number) => sourceMap.get(number));

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