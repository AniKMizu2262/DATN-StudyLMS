

# Kdocument — Hướng dẫn Rollback

## 1. Nguyên tắc

Rollback dùng để hoàn tác một thay đổi database khi cần. Phải xác định chính xác migration cần hoàn tác trước khi thực hiện.

## 2. Quy trình

1. Xác định migration gây lỗi.
2. Sao lưu database trước khi sửa.
3. Đọc nội dung migration và xác định dữ liệu có nguy cơ bị mất.
4. Chuẩn bị câu lệnh rollback tương ứng.
5. Thử rollback trên database thử nghiệm.
6. Kiểm tra lại cấu trúc và dữ liệu sau khi rollback.

## 3. Quy tắc

- Không xóa toàn bộ database chỉ để hoàn tác một migration.
- Không tự động chạy rollback cho mọi migration.
- Nếu migration đã xóa dữ liệu, rollback cấu trúc không có nghĩa là dữ liệu đã được khôi phục.
- Một số thay đổi không thể hoàn tác hoàn toàn nếu không có bản sao lưu.
- Chỉ xóa bản ghi trong `schema_migrations` sau khi đã xử lý migration tương ứng và xác nhận trạng thái database.

## 4. Baseline

`000_baseline` chỉ ghi nhận trạng thái ban đầu. Không dùng rollback để xóa 8 bảng nghiệp vụ.

Nếu cần dựng lại database thử nghiệm từ đầu, hãy thực hiện như một quy trình riêng sau khi đã xác nhận đúng database và có bản sao lưu cần thiết.

## 5. Rollback migration 001

Migration `001_document_review_workflow` bổ sung các trường phân loại và kiểm duyệt vào bảng `documents`, bao gồm:

- `document_type`
- `source_type`
- `review_status`
- `reviewed_by`
- `reviewed_at`
- `rejection_reason`

Đồng thời tạo các chỉ mục và khóa ngoại liên quan đến thông tin kiểm duyệt.

### Câu lệnh rollback

```sql
USE kdocument_db;

ALTER TABLE documents
    DROP FOREIGN KEY fk_documents_reviewer,
    DROP INDEX idx_documents_review_status,
    DROP INDEX idx_documents_reviewed_by,
    DROP COLUMN rejection_reason,
    DROP COLUMN reviewed_at,
    DROP COLUMN reviewed_by,
    DROP COLUMN review_status,
    DROP COLUMN source_type,
    DROP COLUMN document_type;

DELETE FROM schema_migrations
WHERE migration_version = '001_document_review_workflow';
```

### Lưu ý

- Các cột bị xóa sẽ làm mất dữ liệu phân loại và kiểm duyệt đã lưu.
- Chỉ thực hiện rollback khi đã xác nhận dữ liệu trong các cột này không còn cần thiết hoặc đã được sao lưu.
- Câu lệnh trên chỉ hoàn tác migration 001, không xóa dữ liệu tài liệu hay các bảng nghiệp vụ khác.
- Thực hiện rollback trên database thử nghiệm trước khi áp dụng trên môi trường chính.
- Chỉ xóa bản ghi migration khỏi `schema_migrations` sau khi xác nhận các thay đổi cấu trúc đã được hoàn tác thành công.

