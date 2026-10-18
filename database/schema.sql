-- =========================================================
-- Kdocument - CSDL cho he thong quan ly hoc tap
-- MySQL 8.x
-- =========================================================

CREATE DATABASE IF NOT EXISTS kdocument_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE kdocument_db;

-- =========================================================
-- 1. USERS: Tai khoan va vai tro
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'TEACHER', 'STUDENT')
        NOT NULL DEFAULT 'STUDENT',
    status ENUM('ACTIVE', 'INACTIVE', 'LOCKED')
        NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- =========================================================
-- 2. SUBJECTS: Thong tin mon hoc
-- =========================================================

CREATE TABLE IF NOT EXISTS subjects (
    subject_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(50) NOT NULL UNIQUE,
    subject_name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- =========================================================
-- 3. SUBJECT_TEACHERS: Phan cong giang vien
-- Mot mon hoc co the co nhieu giang vien
-- =========================================================

CREATE TABLE IF NOT EXISTS subject_teachers (
    subject_id INT UNSIGNED NOT NULL,
    teacher_id INT UNSIGNED NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (subject_id, teacher_id),

    CONSTRAINT fk_subject_teachers_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_subject_teachers_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_subject_teachers_teacher (teacher_id)
) ENGINE = InnoDB;

-- =========================================================
-- 4. DOCUMENTS: Thong tin tai lieu
-- File PDF duoc luu ben ngoai MySQL
-- =========================================================

CREATE TABLE IF NOT EXISTS documents (
    document_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subject_id INT UNSIGNED NULL,
    uploaded_by INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_key VARCHAR(500) NOT NULL UNIQUE,
    file_type VARCHAR(50) NOT NULL DEFAULT 'application/pdf',
    file_size BIGINT UNSIGNED NOT NULL,
    visibility ENUM('PUBLIC', 'PRIVATE')
        NOT NULL DEFAULT 'PUBLIC',
    status ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED')
        NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_documents_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_documents_uploader
        FOREIGN KEY (uploaded_by)
        REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_documents_subject (subject_id),
    INDEX idx_documents_uploader (uploaded_by),
    INDEX idx_documents_visibility_status (visibility, status)
) ENGINE = InnoDB;

-- =========================================================
-- 5. DOCUMENT_CHUNKS: Cac doan van ban trich xuat tu tai lieu
-- =========================================================

CREATE TABLE IF NOT EXISTS document_chunks (
    chunk_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id INT UNSIGNED NOT NULL,
    chunk_index INT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    page_number INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_document_chunk
        UNIQUE (document_id, chunk_index),

    CONSTRAINT fk_document_chunks_document
        FOREIGN KEY (document_id)
        REFERENCES documents(document_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_document_chunks_document (document_id)
) ENGINE = InnoDB;

-- =========================================================
-- 6. CHAT_SESSIONS: Phien hoi thoai cua nguoi dung
-- =========================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    subject_id INT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Hoi dap moi',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP