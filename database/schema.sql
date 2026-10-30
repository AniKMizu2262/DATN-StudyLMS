
-- ============================================================
-- Kdocument - CƠ SỞ DỮ LIỆU HỆ THỐNG QUẢN LÝ HỌC TẬP
-- Hệ quản trị: MySQL 8.x
--
-- Mục đích:
--   1. Lưu tài khoản và vai trò người dùng.
--   2. Quản lý môn học và giảng viên phụ trách.
--   3. Lưu thông tin tài liệu và nội dung trích xuất từ PDF.
--   4. Lưu lịch sử hỏi đáp với trợ lý AI.
--   5. Lưu nguồn tài liệu được sử dụng trong câu trả lời.
--
-- LƯU Ý:
--   - File PDF được lưu bên ngoài MySQL.
--   - MySQL lưu thông tin file và đường dẫn/khóa định danh file.
--   - File này dùng để khởi tạo cấu trúc database mới.
--   - CREATE TABLE IF NOT EXISTS không tự sửa bảng đã tồn tại.
--   - Không chạy lại file này với mục đích cập nhật cấu trúc
--     của database hiện tại.
-- ============================================================


-- ============================================================
-- 0. KHỞI TẠO DATABASE
-- ============================================================

-- Tạo database nếu database chưa tồn tại.
-- CHARACTER SET utf8mb4 hỗ trợ tiếng Việt và Unicode.
-- COLLATE utf8mb4_unicode_ci quy định cách so sánh chuỗi.
CREATE DATABASE IF NOT EXISTS kdocument_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Chọn database để thực hiện các câu lệnh tiếp theo.
USE kdocument_db;


-- ============================================================
-- 1. USERS - TÀI KHOẢN VÀ VAI TRÒ NGƯỜI DÙNG
-- ============================================================
-- Chức năng:
--   Lưu thông tin tài khoản của quản trị viên, giảng viên
--   và sinh viên.
--
-- Quan hệ:
--   - Có thể được tham chiếu bởi subject_teachers.
--   - Có thể được tham chiếu bởi documents.
--   - Có thể được tham chiếu bởi chat_sessions.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    -- Khóa chính, tự tăng; định danh duy nhất mỗi người dùng.
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Họ tên hiển thị của người dùng.
    full_name VARCHAR(100) NOT NULL,

    -- Email đăng nhập; không được trùng giữa các tài khoản.
    email VARCHAR(255) NOT NULL UNIQUE,

    -- Chỉ lưu mật khẩu đã được băm bằng thuật toán phù hợp.
    -- Tuyệt đối không lưu mật khẩu dạng văn bản thuần.
    password_hash VARCHAR(255) NOT NULL,

    -- Vai trò quyết định các quyền nghiệp vụ ở backend.
    -- ADMIN: quản trị viên.
    -- TEACHER: giảng viên.
    -- STUDENT: sinh viên.
    -- Mặc định tài khoản mới có vai trò STUDENT.
    role ENUM('ADMIN', 'TEACHER', 'STUDENT')
        NOT NULL DEFAULT 'STUDENT',

    -- Trạng thái tài khoản.
    -- ACTIVE: đang hoạt động.
    -- INACTIVE: tạm ngừng hoạt động.
    -- LOCKED: bị khóa.
    status ENUM('ACTIVE', 'INACTIVE', 'LOCKED')
        NOT NULL DEFAULT 'ACTIVE',

    -- Thời điểm tạo tài khoản.
    -- Nếu không truyền giá trị, MySQL tự lấy thời gian hiện tại.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Thời điểm cập nhật thông tin gần nhất.
    -- Tự cập nhật khi bản ghi thay đổi.
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;


-- ============================================================
-- 2. SUBJECTS - THÔNG TIN MÔN HỌC
-- ============================================================
-- Chức năng:
--   Quản lý danh sách môn học được sử dụng trong hệ thống.
--
-- Quan hệ:
--   - Một môn học có thể có nhiều giảng viên.
--   - Một môn học có thể có nhiều tài liệu.
--   - Một phiên hỏi đáp có thể gắn với một môn học.
-- ============================================================

CREATE TABLE IF NOT EXISTS subjects (
    -- Khóa chính, tự tăng; định danh môn học.
    subject_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Mã môn học; không được trùng.
    subject_code VARCHAR(50) NOT NULL UNIQUE,

    -- Tên đầy đủ của môn học.
    subject_name VARCHAR(150) NOT NULL,

    -- Mô tả môn học; có thể để trống.
    description TEXT NULL,

    -- Trạng thái môn học.
    -- ACTIVE: đang sử dụng.
    -- INACTIVE: tạm ngừng sử dụng.
    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',

    -- Thời điểm tạo môn học.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Thời điểm cập nhật thông tin môn học gần nhất.
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;


-- ============================================================
-- 3. SUBJECT_TEACHERS - PHÂN CÔNG GIẢNG VIÊN
-- ============================================================
-- Chức năng:
--   Liên kết giảng viên với môn học được phân công.
--
-- Lý do có bảng riêng:
--   Một môn học có thể có nhiều giảng viên.
--   Một giảng viên cũng có thể phụ trách nhiều môn học.
--   Đây là quan hệ nhiều-nhiều giữa users và subjects.
--
-- Lưu ý:
--   Bảng này không tự kiểm tra users.role = 'TEACHER'.
--   Backend phải kiểm tra vai trò trước khi phân công.
-- ============================================================

CREATE TABLE IF NOT EXISTS subject_teachers (
    -- Mã môn học được phân công.
    subject_id INT UNSIGNED NOT NULL,

    -- Mã người dùng được phân công làm giảng viên.
    teacher_id INT UNSIGNED NOT NULL,

    -- Thời điểm thực hiện phân công.
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Khóa chính ghép:
    -- Một cặp môn học - giảng viên chỉ xuất hiện một lần.
    PRIMARY KEY (subject_id, teacher_id),

    -- Khóa ngoại đến môn học.
    -- ON DELETE CASCADE:
    -- Khi môn học bị xóa, các bản ghi phân công liên quan
    -- cũng bị xóa.
    CONSTRAINT fk_subject_teachers_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Khóa ngoại đến tài khoản giảng viên.
    -- ON DELETE RESTRICT:
    -- Không cho xóa tài khoản nếu vẫn còn bản ghi phân công.
    CONSTRAINT fk_subject_teachers_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Chỉ mục giúp tìm nhanh các môn học của một giảng viên.
    INDEX idx_subject_teachers_teacher (teacher_id)
) ENGINE = InnoDB;


-- ============================================================
-- 4. DOCUMENTS - THÔNG TIN TÀI LIỆU
-- ============================================================
-- Chức năng:
--   Quản lý thông tin các tài liệu được tải lên và sử dụng
--   trong hệ thống Kdocument.
--
-- Lưu trữ:
--   File PDF thực tế được lưu bên ngoài cơ sở dữ liệu.
--   file_key dùng để định danh tệp trong hệ thống lưu trữ;
--   backend chịu trách nhiệm quản lý việc lưu trữ và truy xuất.
--
-- Trạng thái xử lý tài liệu:
--   PENDING: Chờ xử lý.
--   PROCESSING: Đang trích xuất nội dung.
--   READY: Đã xử lý xong, sẵn sàng phục vụ tra cứu.
--   FAILED: Xử lý thất bại.
--
-- Phân loại tài liệu:
--   LECTURE: Tài liệu bài giảng.
--   REFERENCE: Tài liệu tham khảo.
--   QUESTION_BANK: Ngân hàng câu hỏi.
--   EXAM: Tài liệu đề thi.
--   OTHER: Các loại tài liệu khác.
--
-- Nguồn tài liệu:
--   OFFICIAL: Tài liệu chính thức.
--   SUPPLEMENTARY: Tài liệu bổ trợ.
--
-- Trạng thái kiểm duyệt:
--   PENDING: Chờ kiểm duyệt.
--   APPROVED: Đã được chấp thuận.
--   REJECTED: Bị từ chối.
--
-- Lưu ý:
--   Trạng thái xử lý và trạng thái kiểm duyệt là hai quy trình
--   độc lập. Chỉ những tài liệu đáp ứng điều kiện kiểm duyệt
--   và xử lý mới được sử dụng làm nguồn hỏi đáp theo quy định.
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    -- Khóa chính định danh tài liệu.
    document_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Môn học liên kết với tài liệu.
    -- NULL: tài liệu dùng chung, không thuộc riêng một môn học.
    subject_id INT UNSIGNED NULL,

    -- Người tải tài liệu lên hệ thống.
    uploaded_by INT UNSIGNED NOT NULL,

    -- Tên hiển thị của tài liệu.
    title VARCHAR(255) NOT NULL,

    -- Khóa định danh tệp trong hệ thống lưu trữ.
    -- UNIQUE bảo đảm mỗi tệp có một khóa riêng.
    file_key VARCHAR(500) NOT NULL UNIQUE,

    -- Định dạng tệp, mặc định là PDF.
    file_type VARCHAR(50) NOT NULL DEFAULT 'application/pdf',

    -- Dung lượng tệp, tính bằng byte.
    file_size BIGINT UNSIGNED NOT NULL,

    -- Phạm vi hiển thị của tài liệu.
    -- PUBLIC: thuộc phạm vi công khai của hệ thống.
    -- PRIVATE: chỉ được truy cập theo quyền được cấp.
    visibility ENUM('PUBLIC', 'PRIVATE')
        NOT NULL DEFAULT 'PUBLIC',

    -- Trạng thái xử lý tệp và trích xuất nội dung.
    status ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED')
        NOT NULL DEFAULT 'PENDING',

    -- Thời điểm tạo và cập nhật bản ghi.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Phân loại mục đích sử dụng của tài liệu.
    document_type ENUM(
        'LECTURE',
        'REFERENCE',
        'QUESTION_BANK',
        'EXAM',
        'OTHER'
    ) NOT NULL DEFAULT 'OTHER',

    -- Phân biệt tài liệu chính thức và tài liệu bổ trợ.
    source_type ENUM('OFFICIAL', 'SUPPLEMENTARY')
        NOT NULL DEFAULT 'SUPPLEMENTARY',

    -- Trạng thái kiểm duyệt, độc lập với trạng thái xử lý tệp.
    review_status ENUM('PENDING', 'APPROVED', 'REJECTED')
        NOT NULL DEFAULT 'PENDING',

    -- Người thực hiện kiểm duyệt tài liệu.
    -- NULL khi tài liệu chưa được kiểm duyệt.
    reviewed_by INT UNSIGNED DEFAULT NULL,

    -- Thời điểm hoàn tất kiểm duyệt.
    reviewed_at DATETIME DEFAULT NULL,

    -- Lý do từ chối tài liệu (nếu có).
    rejection_reason TEXT DEFAULT NULL,

    -- Liên kết tài liệu với môn học.
    -- Không cho xóa môn học khi vẫn còn tài liệu tham chiếu.
    CONSTRAINT fk_documents_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Liên kết tài liệu với tài khoản người tải lên.
    -- Không cho xóa tài khoản khi vẫn còn tài liệu do tài khoản đó tải lên.
    CONSTRAINT fk_documents_uploader
        FOREIGN KEY (uploaded_by)
        REFERENCES users(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Liên kết tài liệu với người kiểm duyệt.
    -- Khi tài khoản người kiểm duyệt bị xóa, trường này chuyển thành NULL.
    CONSTRAINT fk_documents_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    -- Các chỉ mục hỗ trợ truy vấn và lọc tài liệu.
    INDEX idx_documents_subject (subject_id),
    INDEX idx_documents_uploader (uploaded_by),
    INDEX idx_documents_visibility_status (visibility, status),
    INDEX idx_documents_review_status (review_status),
    INDEX idx_documents_reviewed_by (reviewed_by)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;


-- ============================================================
-- 5. DOCUMENT_CHUNKS - CÁC ĐOẠN VĂN BẢN TRÍCH XUẤT
-- ============================================================
-- Chức năng:
--   Lưu nội dung văn bản được trích xuất từ tài liệu.
--
-- Vai trò trong RAG:
--   Tài liệu được chia thành các đoạn nhỏ (chunks).
--   Hệ thống có thể tìm các đoạn liên quan đến câu hỏi,
--   rồi dùng nội dung đó để xây dựng câu trả lời.
--
-- Lưu ý:
--   Bảng này lưu văn bản, chưa lưu vector embedding.
--   Việc tạo embedding và tìm kiếm vector sẽ được triển khai
--   trong phần xử lý AI phù hợp với kiến trúc được chọn.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_chunks (
    -- Khóa chính, tự tăng; định danh mỗi đoạn văn bản.
    chunk_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Tài liệu gốc chứa đoạn văn bản này.
    document_id INT UNSIGNED NOT NULL,

    -- Thứ tự của đoạn trong tài liệu, bắt đầu từ chỉ số
    -- do backend quy ước, chẳng hạn 0 hoặc 1.
    chunk_index INT UNSIGNED NOT NULL,

    -- Nội dung văn bản của đoạn.
    -- MEDIUMTEXT cho phép lưu nội dung dài.
    content MEDIUMTEXT NOT NULL,

    -- Số trang PDF chứa đoạn văn bản; có thể NULL
    -- nếu không xác định được trang tương ứng.
    page_number INT UNSIGNED NULL,

    -- Thời điểm lưu đoạn văn bản vào database.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Trong cùng một tài liệu, mỗi vị trí chunk chỉ có
    -- một bản ghi.
    CONSTRAINT uq_document_chunk
        UNIQUE (document_id, chunk_index),

    -- Liên kết đoạn văn bản với tài liệu gốc.
    -- Khi tài liệu bị xóa, các đoạn văn bản liên quan
    -- cũng bị xóa.
    CONSTRAINT fk_document_chunks_document
        FOREIGN KEY (document_id)
        REFERENCES documents(document_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Chỉ mục hỗ trợ tìm tất cả các đoạn của một tài liệu.
    INDEX idx_document_chunks_document (document_id)
) ENGINE = InnoDB;


-- ============================================================
-- 6. CHAT_SESSIONS - PHIÊN HỎI ĐÁP
-- ============================================================
-- Chức năng:
--   Lưu từng cuộc hội thoại của người dùng với trợ lý AI.
--
-- Quan hệ:
--   - Một người dùng có thể có nhiều phiên hỏi đáp.
--   - Một phiên có nhiều tin nhắn.
--   - Một phiên có thể gắn với một môn học hoặc không.
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    -- Khóa chính, tự tăng; định danh phiên hỏi đáp.
    session_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Người sở hữu phiên hỏi đáp.
    user_id INT UNSIGNED NOT NULL,

    -- Môn học mà phiên hỏi đáp đang tập trung.
    -- NULL nếu phiên không gắn với môn học cụ thể.
    subject_id INT UNSIGNED NULL,

    -- Tiêu đề hiển thị của phiên.
    -- Có thể được backend cập nhật sau khi bắt đầu hội thoại.
    title VARCHAR(255) NOT NULL DEFAULT 'Hoi dap moi',

    -- Thời điểm tạo phiên.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Thời điểm cập nhật phiên gần nhất.
    -- Có thể dùng để sắp xếp lịch sử hội thoại.
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Liên kết phiên với người sở hữu.
    -- Khi tài khoản bị xóa, các phiên hỏi đáp của tài khoản
    -- cũng bị xóa.
    CONSTRAINT fk_chat_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Liên kết phiên với môn học.
    -- Khi môn học bị xóa, phiên vẫn được giữ lại;
    -- subject_id của phiên sẽ chuyển thành NULL.
    CONSTRAINT fk_chat_sessions_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(subject_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    -- Hỗ trợ lấy các phiên của người dùng và sắp xếp
    -- theo thời điểm cập nhật gần nhất.
    INDEX idx_chat_sessions_user_updated (user_id, updated_at)
) ENGINE = InnoDB;


-- ============================================================
-- 7. CHAT_MESSAGES - TIN NHẮN TRONG PHIÊN HỎI ĐÁP
-- ============================================================
-- Chức năng:
--   Lưu từng tin nhắn do người dùng hoặc trợ lý AI gửi.
--
-- Quan hệ:
--   Một phiên hỏi đáp có thể chứa nhiều tin nhắn.
--   Một tin nhắn có thể có nhiều nguồn trích dẫn.
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    -- Khóa chính, tự tăng; định danh tin nhắn.
    message_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Phiên hỏi đáp chứa tin nhắn.
    session_id INT UNSIGNED NOT NULL,

    -- Bên gửi tin nhắn.
    -- USER: nội dung do người dùng gửi.
    -- ASSISTANT: nội dung do trợ lý AI trả lời.
    sender_type ENUM('USER', 'ASSISTANT') NOT NULL,

    -- Nội dung tin nhắn.
    -- MEDIUMTEXT hỗ trợ câu hỏi và câu trả lời dài.
    content MEDIUMTEXT NOT NULL,

    -- Thời điểm tin nhắn được lưu.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Liên kết tin nhắn với phiên hỏi đáp.
    -- Khi phiên bị xóa, toàn bộ tin nhắn thuộc phiên đó
    -- cũng bị xóa.
    CONSTRAINT fk_chat_messages_session
        FOREIGN KEY (session_id)
        REFERENCES chat_sessions(session_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Hỗ trợ lấy tin nhắn của một phiên theo thời gian.
    INDEX idx_chat_messages_session_time (session_id, created_at)
) ENGINE = InnoDB;


-- ============================================================
-- 8. CITATIONS - NGUỒN TÀI LIỆU ĐƯỢC TRÍCH DẪN
-- ============================================================
-- Chức năng:
--   Liên kết câu trả lời/tin nhắn với các đoạn văn bản nguồn.
--
-- Ví dụ:
--   Trợ lý AI trả lời một câu hỏi dựa trên ba đoạn văn bản.
--   Mỗi đoạn nguồn có thể được lưu thành một bản ghi citation
--   liên kết đến tin nhắn và chunk tương ứng.
--
-- Lưu ý:
--   similarity_score là điểm tương đồng do quy trình tìm kiếm
--   cung cấp; ý nghĩa và thang điểm phụ thuộc cách triển khai.
-- ============================================================

CREATE TABLE IF NOT EXISTS citations (
    -- Khóa chính, tự tăng; định danh bản ghi trích dẫn.
    citation_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Tin nhắn được gắn nguồn.
    message_id INT UNSIGNED NOT NULL,

    -- Đoạn văn bản được sử dụng làm nguồn.
    chunk_id INT UNSIGNED NOT NULL,

    -- Điểm tương đồng của đoạn nguồn, nếu có.
    -- NULL khi không lưu hoặc chưa có điểm này.
    similarity_score DECIMAL(8,6) DEFAULT NULL,

    -- Thời điểm ghi nhận nguồn trích dẫn.
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Một tin nhắn không lưu lặp cùng một chunk nhiều lần.
    CONSTRAINT uq_citation_message_chunk
        UNIQUE (message_id, chunk_id),

    -- Liên kết đến đoạn văn bản nguồn.
    -- Khi chunk bị xóa, bản ghi citation tương ứng bị xóa.
    CONSTRAINT fk_citations_chunk
        FOREIGN KEY (chunk_id)
        REFERENCES document_chunks(chunk_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Liên kết đến tin nhắn.
    -- Khi tin nhắn bị xóa, các citation của tin nhắn đó
    -- cũng bị xóa.
    CONSTRAINT fk_citations_message
        FOREIGN KEY (message_id)
        REFERENCES chat_messages(message_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Hỗ trợ tìm các trích dẫn đang tham chiếu đến một chunk.
    INDEX idx_citations_chunk (chunk_id)
) ENGINE = InnoDB;


-- ============================================================
-- KẾT THÚC FILE SCHEMA
-- ============================================================
-- Sau khi khởi tạo database mới, có thể kiểm tra danh sách
-- bảng bằng:
--
-- USE kdocument_db;
-- SHOW TABLES;
--
-- File này chỉ tạo cấu trúc. Dữ liệu mẫu được quản lý riêng
-- trong database/seed.sql.
-- ============================================================
