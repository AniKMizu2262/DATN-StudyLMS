
"use strict";

// ======================================================
// KDOCUMENT | DAY20
// TẠO CACHE SOURCE PREVIEW CHO PDF
//
// Chạy:
// node scripts/cache_source_preview.js 10
//
// - Lấy file PDF theo document_id từ MySQL.
// - Chạy PyMuPDF + Docling qua Python 3.11.
// - Lưu JSON vào thư mục private.
// - Không thay đổi chunk, embedding hay citation.
// ======================================================

const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const pool = require("../src/config/database");

const execFileAsync = promisify(execFile);

const DOCUMENT_DIR = path.resolve(
    __dirname,
    "../uploads/documents"
);

const CACHE_DIR = path.resolve(
    __dirname,
    "../storage/rag-previews"
);

const PYTHON_SCRIPT = path.resolve(
    __dirname,
    "extract_pdf.py"
);

const main = async () => {
    // [01] Kiểm tra document_id
    const documentId = Number(process.argv[2]);

    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
    ) {
        throw new Error(
            "Sử dụng: node scripts/cache_source_preview.js 10"
        );
    }

    // [02] Lấy file_key đúng tài liệu
    const [rows] = await pool.query(
        `SELECT document_id, file_key, status
         FROM documents
         WHERE document_id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [documentId]
    );

    if (rows.length === 0) {
        throw new Error("Không tìm thấy tài liệu");
    }

    const document = rows[0];
    const fileKey = document.file_key;

    if (
        typeof fileKey !== "string" ||
        !/^[a-zA-Z0-9_-]+\.pdf$/i.test(fileKey)
    ) {
        throw new Error("File key PDF không hợp lệ");
    }

    const pdfPath = path.join(DOCUMENT_DIR, fileKey);

    const cacheName = fileKey.replace(
        /\.pdf$/i,
        ".json"
    );

    const cachePath = path.join(
        CACHE_DIR,
        cacheName
    );

    const tempPath = `${cachePath}.${process.pid}.tmp`;

    // [03] Kiểm tra PDF tồn tại
    await fs.access(pdfPath);
    await fs.access(PYTHON_SCRIPT);

    await fs.mkdir(CACHE_DIR, {
        recursive: true
    });

    // Không ghi đè cache hiện có.
    try {
        await fs.access(cachePath);

        console.log(
            "[CACHE] Đã tồn tại:",
            cachePath
        );

        return;
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    console.log(
        `[CACHE] Đang xử lý tài liệu #${documentId}`
    );

    console.log("[PDF]", pdfPath);

    try {
        // [04] Chạy bộ extractor Python đã kiểm thử.
        const { stdout, stderr } = await execFileAsync(
            "py",
            [
                "-3.11",
                PYTHON_SCRIPT,
                pdfPath,
                tempPath
            ],
            {
                windowsHide: true,
                timeout: 600000,
                maxBuffer: 16 * 1024 * 1024
            }
        );

        if (stdout) {
            console.log(stdout);
        }

        if (stderr) {
            console.warn(stderr);
        }

        // [05] Kiểm tra dữ liệu trước khi lưu chính thức.
        const raw = await fs.readFile(
            tempPath,
            "utf8"
        );

        const data = JSON.parse(raw);

        if (
            !Array.isArray(data.pages) ||
            data.pages.length === 0 ||
            !data.pages.every(
                (page) =>
                    Number.isSafeInteger(page.page_number) &&
                    typeof page.readable_markdown === "string"
            )
        ) {
            throw new Error(
                "Dữ liệu Markdown không hợp lệ"
            );
        }

        // Chỉ công bố cache khi trích xuất hoàn tất.
        await fs.rename(tempPath, cachePath);

        console.log("[CACHE] Thành công");
        console.log("[TRANG]", data.pages.length);
        console.log("[FILE]", cachePath);

    } finally {
        // Dọn file tạm khi lỗi hoặc kết thúc.
        await fs.rm(tempPath, {
            force: true
        });
    }
};

main()
    .catch((error) => {
        console.error(
            "[SOURCE PREVIEW ERROR]",
            error.message
        );

        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
