
"use strict";

const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

// ======================================================
// KDOCUMENT | DAY20 - AUTO SOURCE PREVIEW CACHE
//
// Tái sử dụng cache_source_preview.js đã kiểm thử.
// Tạo Markdown Docling sau khi xử lý RAG thành công.
// Không thay đổi chunk, embedding hoặc database.
// ======================================================

const BACKEND_DIR = path.resolve(
    __dirname,
    "../.."
);

const CACHE_SCRIPT = path.join(
    BACKEND_DIR,
    "scripts",
    "cache_source_preview.js"
);

// ======================================================
// [01] TẠO CACHE CHO TÀI LIỆU
// ======================================================

const ensureSourcePreviewCache = async (documentId) => {
    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0
    ) {
        throw new Error("documentId không hợp lệ");
    }

    // Dùng một tiến trình Node riêng.
    // Không kết thúc database pool của server chính.
    const { stdout } = await execFileAsync(
        process.execPath,
        [
            "-r",
            "dotenv/config",
            CACHE_SCRIPT,
            String(documentId)
        ],
        {
            cwd: BACKEND_DIR,
            windowsHide: true,
            timeout: 600000,
            maxBuffer: 16 * 1024 * 1024,

            // Tránh lỗi UnicodeEncodeError trên Windows.
            env: {
                ...process.env,
                PYTHONIOENCODING: "utf-8",
                PYTHONUTF8: "1"
            }
        }
    );

    console.log(
        "[SOURCE PREVIEW]",
        stdout.trim()
    );
};

// ======================================================
// [02] EXPORT
// ======================================================

module.exports = {
    ensureSourcePreviewCache
};
