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