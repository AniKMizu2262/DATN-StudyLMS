
-- =========================================================
-- Kdocument - Du lieu mau de kiem tra database
-- MySQL 8.0.46
-- Chi dung de thu nghiem, khong phai tai khoan that
-- =========================================================

USE kdocument_db;

-- =========================================================
-- 1. TAO TAI KHOAN MAU
-- =========================================================
-- DEMO_HASH_* chi la chuoi gia lap, chua dang nhap duoc.
-- Mat khau that se duoc bam trong backend.

INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    status
)
VALUES
    ('Quan tri mau', 'admin@example.com', 'DEMO_HASH_ADMIN', 'ADMIN', 'ACTIVE'),
    ('Giang vien Nguyen Van An', 'an.teacher@example.com', 'DEMO_HASH_TEACHER_1', 'TEACHER', 'ACTIVE'),
    ('Giang vien Tran Thi Binh', 'binh.teacher@example.com', 'DEMO_HASH_TEACHER_2', 'TEACHER', 'ACTIVE'),
    ('Sinh vien Le Minh', 'minh.student@example.com', 'DEMO_HASH_STUDENT_1', 'STUDENT', 'ACTIVE'),
    ('Sinh vien Pham Hoa', 'hoa.student@example.com', 'DEMO_HASH_STUDENT_2', 'STUDENT', 'ACTIVE')
AS new_user
ON DUPLICATE KEY UPDATE
    full_name = new_user.full_name;

-- =========================================================
-- 2. TAO MON HOC MAU
-- =========================================================

INSERT INTO subjects (
    subject_code,
    subject_name,
    description,
    status
)
VALUES
    ('IT001', 'Co so lap trinh', 'Mon hoc co so ve lap trinh', 'ACTIVE'),
    ('IT002', 'Co so du lieu', 'Mon hoc ve thiet ke co so du lieu', 'ACTIVE')
AS new_subject
ON DUPLICATE KEY UPDATE
    subject_name = new_subject.subject_name;

-- =========================================================
-- 3. PHAN CONG GIANG VIEN
-- Chi them neu chua ton tai
-- =========================================================

INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT s.subject_id, u.user_id
FROM subjects s
JOIN users u ON u.email = 'an.teacher@example.com'
WHERE s.subject_code = 'IT001'
  AND NOT EXISTS (
      SELECT 1
      FROM subject_teachers st
      WHERE st.subject_id = s.subject_id
        AND st.teacher_id = u.user_id
  );

INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT s.subject_id, u.user_id
FROM subjects s
JOIN users u ON u.email = 'binh.teacher@example.com'
WHERE s.subject_code = 'IT001'
  AND NOT EXISTS (
      SELECT 1
      FROM subject_teachers st
      WHERE st.subject_id = s.subject_id
        AND st.teacher_id = u.user_id
  );

INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT s.subject_id, u.user_id
FROM subjects s
JOIN users u ON u.email = 'an.teacher@example.com'
WHERE s.subject_code = 'IT002'
  AND NOT EXISTS (
      SELECT 1
      FROM subject_teachers st
      WHERE st.subject_id = s.subject_id
        AND st.teacher_id = u.user_id
  );

-- =========================================================
-- 4. KIEM TRA DU LIEU MAU
-- =========================================================

SELECT user_id, full_name, email, role, status
FROM users
ORDER BY user_id;

SELECT subject_id, subject_code, subject_name, status
FROM subjects
ORDER BY subject_id;

SELECT
    s.subject_code,
    s.subject_name,
    u.full_name AS giang_vien
FROM subject_teachers st
JOIN subjects s ON s.subject_id = st.subject_id
JOIN users u ON u.user_id = st.teacher_id
ORDER BY s.subject_code, u.full_name;

-- =========================================================
-- KET THUC SEED
-- =========================================================
