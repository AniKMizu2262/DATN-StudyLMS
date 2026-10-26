-- =========================================================
-- Kdocument - Baseline migration
-- MySQL 8.0.46
--
-- Muc dich:
--   Ghi nhan schema hien tai da duoc khoi tao va kiem tra.
--
-- LUU Y:
--   File nay KHONG tao lai 8 bang nghiep vu.
--   Chi chay sau khi da xac nhan schema hien tai day du.
-- =========================================================

USE kdocument_db;

-- Bang theo doi cac migration da ap dung.
CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_version VARCHAR(100) NOT NULL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- Ghi nhan baseline, khong ghi de neu da ton tai.
INSERT IGNORE INTO schema_migrations (
    migration_version,
    description
)
VALUES (
    '000_baseline',
    'Ghi nhan schema Kdocument hien tai gom 8 bang nghiep vu'
);

-- Kiem tra migration da duoc ghi nhan.
SELECT migration_version, description, applied_at
FROM schema_migrations
ORDER BY migration_version;