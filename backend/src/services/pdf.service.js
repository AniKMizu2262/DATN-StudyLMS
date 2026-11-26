
"use strict";

const fs = require("fs/promises");
const path = require("path");
const { PDFParse } = require("pdf-parse");

// ======================================================
// KDOCUMENT - PDF SERVICE
//
// [01] Kiểm tra file PDF
// [02] Trích xuất văn bản theo trang
// [03] Giữ xuống dòng và dấu phân cách cột
// ======================================================

const UPLOAD_DIR = path.resolve(
    __dirname,
    "../../uploads/documents"
);

const MAX_PDF_SIZE = 20 * 1024 * 1024;

// [01] Chuẩn hóa văn bản nhưng KHÔNG xóa xuống dòng.
const normalizeText = (text) => {
    if (typeof text !== "string") return "";

    return text
        .replace(/\r\n?/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ ]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

// [02] Trích xuất văn bản từ file PDF.
const extractPdfText = async (fileKey) => {
    if (
        typeof fileKey !== "string" ||
        !/^[a-zA-Z0-9_-]+\.pdf$/i.test(fileKey)
    ) {
        throw new Error("Tên file PDF không hợp lệ");
    }

    const filePath = path.join(UPLOAD_DIR, fileKey);
    const fileInfo = await fs.stat(filePath);

    if (
        fileInfo.size === 0 ||
        fileInfo.size > MAX_PDF_SIZE
    ) {
        throw new Error(
            "PDF rỗng hoặc vượt giới hạn 20 MB"
        );
    }

    const buffer = await fs.readFile(filePath);

    if (buffer.subarray(0, 5).toString() !== "%PDF-") {
        throw new Error("File PDF không hợp lệ");
    }

    const parser = new PDFParse({
        data: new Uint8Array(buffer)
    });

    try {
        // [03] Yêu cầu parser giữ dòng và phân cách cột.
        // Tab sẽ được chuyển thành " | " ở chunk.service.
        const result = await parser.getText({
            lineEnforce: true,
            cellSeparator: "\t",
            cellThreshold: 7,
            pageJoiner: "\n"
        });

        // [04] Giữ nội dung từng trang để đối chiếu PDF.
        const pages = result.pages.map((page) => ({
            pageNumber: page.num,
            text: normalizeText(page.text)
        }));

        const text = pages
            .map((page) => page.text)
            .join("\n\n")
            .trim();

        if (text.length < 20) {
            throw new Error(
                "Không trích xuất đủ văn bản; PDF có thể là bản scan"
            );
        }

        return {
            text,
            totalPages: result.total,
            characterCount: text.length,
            pages
        };

    } finally {
        await parser.destroy();
    }
};

module.exports = {
    extractPdfText
};
