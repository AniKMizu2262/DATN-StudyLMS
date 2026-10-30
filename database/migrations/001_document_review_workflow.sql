
-- =========================================================
-- Kdocument - Migration 001
-- MySQL 8.0.46
--
-- Muc dich:
--   Bo sung phan loai va quy trinh kiem duyet tai lieu.
--
-- LUU Y:
--   Chi chay mot lan tren database hien tai.
-- =========================================================

USE kdocument_db;

-- Bo sung thong tin phan loai va kiem duyet tai lieu.
ALTER TABLE documents
    ADD COLUMN document_type ENUM(
        'LECTURE',
        'REFERENCE',
        'QUESTION_BANK',
        'EXAM',
        'OTHER'
    ) NOT NULL DEFAULT 'OTHER',

    ADD COLUMN source_type ENUM(
        'OFFICIAL',
        'SUPPLEMENTARY'
    ) NOT NULL DEFAULT 'SUPPLEMENTARY',

    ADD COLUMN review_status ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED'
    ) NOT NULL DEFAULT 'PENDING',

    ADD COLUMN reviewed_by INT UNSIGNED DEFAULT NULL,

    ADD COLUMN reviewed_at DATETIME DEFAULT NULL,

    ADD COLUMN rejection_reason TEXT DEFAULT NULL,

    ADD KEY idx_documents_review_status (review_status),

    ADD KEY idx_documents_reviewed_by (reviewed_by),

    ADD CONSTRAINT fk_documents_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users (user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

-- Ghi nhan migration da ap dung.
INSERT IGNORE INTO schema_migrations (
    migration_version,
    description
)
VALUES (
    '001_document_review_workflow',
    'Bo sung phan loai va quy trinh kiem duyet tai lieu'
);

-- Kiem tra migration.
SELECT migration_version, description, applied_at
FROM schema_migrations
ORDER BY migration_version;
