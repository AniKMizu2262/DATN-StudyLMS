
-- ======================================================
-- KDOCUMENT - DATABASE MIGRATION 001
-- Tạo các bảng phục vụ hệ thống RAG
-- Ngày triển khai: Day 13
-- ======================================================

-- LƯU Ý:
-- Kết nối đúng database trước khi chạy script.
-- Không xóa hoặc ghi đè dữ liệu hiện có.


-- ======================================================
-- [01] BẢNG RAG_CHUNKS
-- Lưu các đoạn văn bản được trích xuất từ tài liệu PDF
-- ======================================================

CREATE TABLE IF NOT EXISTS rag_chunks (

    chunk_id INT UNSIGNED
        AUTO_INCREMENT PRIMARY KEY,

    document_id INT UNSIGNED NOT NULL,

    chunk_index INT UNSIGNED NOT NULL,

    page_number INT UNSIGNED NOT NULL,

    `text` LONGTEXT NOT NULL,

    char_count INT UNSIGNED NOT NULL,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    -- Một tài liệu không được có hai chunk cùng vị trí
    CONSTRAINT uq_rag_document_chunk
        UNIQUE (document_id, chunk_index),

    -- Hỗ trợ tìm kiếm theo tài liệu và trang
    INDEX idx_rag_document_page (
        document_id,
        page_number
    ),

    -- Liên kết tới tài liệu gốc
    CONSTRAINT fk_rag_chunks_document
        FOREIGN KEY (document_id)
        REFERENCES documents(document_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- ======================================================
-- [02] BẢNG RAG_EMBEDDINGS
-- Lưu vector embedding của từng chunk
-- ======================================================

CREATE TABLE IF NOT EXISTS rag_embeddings (

    -- Mỗi chunk có tối đa một embedding
    chunk_id INT UNSIGNED NOT NULL PRIMARY KEY,

    model VARCHAR(150) NOT NULL,

    dimension SMALLINT UNSIGNED NOT NULL,

    embedding JSON NOT NULL,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Khi chunk bị xóa, embedding tương ứng cũng bị xóa
    CONSTRAINT fk_rag_embeddings_chunk
        FOREIGN KEY (chunk_id)
        REFERENCES rag_chunks(chunk_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;git status --short


-- ======================================================
-- KẾT THÚC MIGRATION 001
-- ======================================================
