-- =========================================================
-- Kdocument - Rollback baseline
--
-- Baseline chi ghi nhan schema hien tai.
-- Script nay chi xoa ban ghi theo doi baseline,
-- KHONG xoa cac bang nghiep vu.
--
-- Chi chay khi da xac nhan khong con migration nao
-- phu thuoc vao baseline va muon dat lai viec theo doi.
-- =========================================================

USE kdocument_db;

DELETE FROM schema_migrations
WHERE migration_version = '000_baseline';