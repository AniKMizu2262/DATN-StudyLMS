# Kdocument — Quy tắc Migration

## 1. Mục đích

Migration dùng để quản lý các thay đổi cấu trúc database theo từng phiên bản, giúp biết thay đổi nào đã được áp dụng và hỗ trợ khôi phục khi cần.

## 2. Cấu trúc thư mục

```text
database/
├── schema.sql
├── seed.sql
└── migrations/
    ├── 000_baseline.sql
    ├── README.md
    └── rollback/
        └── README.md
```

## 3. Baseline

`000_baseline.sql` ghi nhận schema hiện tại vào bảng `schema_migrations`.

Chỉ chạy baseline sau khi đã xác nhận database có đủ 8 bảng nghiệp vụ:

- users
- subjects
- subject_teachers
- documents
- document_chunks
- chat_sessions
- chat_messages
- citations

Baseline không tạo lại hoặc sửa các bảng nghiệp vụ.

## 4. Quy tắc tạo migration mới

Mỗi thay đổi cấu trúc database cần một file SQL riêng, đánh số tăng dần.

Ví dụ:

- `001_add_document_status.sql`
- `002_add_chat_session_title.sql`

Tên file phải mô tả ngắn gọn mục đích thay đổi.

Mỗi migration cần:
1. Có mục đích rõ ràng.
2. Được kiểm tra trên database thử nghiệm trước.
3. Có hướng dẫn rollback tương ứng nếu có thể.
4. Được ghi nhận vào `schema_migrations` sau khi áp dụng thành công.

Không chạy lại migration đã áp dụng nếu chưa xác định rõ tác động.

## 5. Nguyên tắc an toàn

- Không dùng `DROP DATABASE` để cập nhật schema thông thường.
- Không sửa migration đã áp dụng trên môi trường đang sử dụng; tạo migration mới để điều chỉnh.
- Sao lưu dữ liệu trước các thay đổi có nguy cơ mất dữ liệu.
- `schema.sql` dùng để khởi tạo database mới, không thay thế migration cho database đang tồn tại.
- `seed.sql` chỉ dùng để thêm dữ liệu mẫu phục vụ kiểm thử.

## 6. Lưu ý về MySQL

Một số câu lệnh DDL như `CREATE TABLE`, `ALTER TABLE` và `DROP TABLE` có thể tự commit. Không giả định rằng `ROLLBACK` của transaction sẽ hoàn tác được mọi thay đổi cấu trúc.