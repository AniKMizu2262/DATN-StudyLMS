# Kdocument — Development Plan

## Phase 1: Analysis and Planning

- [ ] Xác định phạm vi chức năng phiên bản đầu tiên.
- [ ] Xác định vai trò và quyền hạn người dùng.
- [ ] Viết yêu cầu chức năng và phi chức năng.
- [ ] Xây dựng sơ đồ Use Case.
- [ ] Thiết kế ERD và từ điển dữ liệu.
- [ ] Xác định kiến trúc tổng thể và công nghệ dự kiến.

**Hoàn thành khi:** Phạm vi dự án, các vai trò, luồng nghiệp vụ và mô hình dữ liệu đã được thống nhất.

## Phase 2: Project Setup

- [ ] Xây dựng cấu trúc thư mục frontend và backend.
- [ ] Thiết lập cấu hình môi trường.
- [ ] Kết nối MySQL.
- [ ] Thiết lập quy trình Git và quản lý nhánh.
- [ ] Kiểm tra ứng dụng có thể khởi chạy ở môi trường phát triển.

**Hoàn thành khi:** Frontend, backend và database có thể hoạt động cùng nhau.

## Phase 3: Authentication and Authorization

- [ ] Xây dựng chức năng đăng nhập và đăng xuất.
- [ ] Xây dựng phân quyền Admin, Teacher và Student.
- [ ] Bảo vệ các API theo quyền truy cập.
- [ ] Kiểm thử các trường hợp truy cập không hợp lệ.

**Hoàn thành khi:** Người dùng chỉ có thể thực hiện các chức năng được cấp quyền.

## Phase 4: Learning Management

- [ ] Quản lý người dùng.
- [ ] Quản lý môn học.
- [ ] Phân công giảng viên phụ trách môn học.
- [ ] Tải lên và quản lý tài liệu PDF.
- [ ] Theo dõi trạng thái xử lý tài liệu.
- [ ] Kiểm soát quyền truy cập và tải xuống tài liệu.

**Hoàn thành khi:** Các nghiệp vụ quản lý cốt lõi hoạt động đúng và dữ liệu được lưu trữ nhất quán.

## Phase 5: RAG and AI Assistant

- [ ] Trích xuất văn bản từ tài liệu PDF.
- [ ] Chia văn bản thành các đoạn nhỏ (chunking).
- [ ] Tạo embeddings cho các đoạn văn bản.
- [ ] Lưu trữ và truy xuất vector.
- [ ] Tìm các đoạn liên quan đến câu hỏi.
- [ ] Tạo câu trả lời bằng mô hình AI.
- [ ] Hiển thị nguồn tham khảo và thông tin trang khi có thể.
- [ ] Xử lý trường hợp không tìm được đủ thông tin.

**Hoàn thành khi:** Người dùng có thể hỏi đáp dựa trên tài liệu đã lập chỉ mục và kiểm tra được nguồn của câu trả lời.

## Phase 6: Conversation History and Dashboard

- [ ] Lưu lịch sử hội thoại.
- [ ] Xem lại và xóa hội thoại của chính người dùng.
- [ ] Hiển thị thông tin tổng quan cơ bản.
- [ ] Kiểm tra quyền truy cập dữ liệu hội thoại và thống kê.

**Hoàn thành khi:** Lịch sử được lưu đúng người dùng và các thông tin tổng quan phản ánh dữ liệu thực tế.

## Phase 7: Testing and Deployment

- [ ] Kiểm thử các luồng nghiệp vụ chính.
- [ ] Kiểm thử phân quyền và bảo vệ dữ liệu.
- [ ] Kiểm tra độ chính xác của truy xuất tài liệu và trích dẫn.
- [ ] Xử lý lỗi và hoàn thiện giao diện.
- [ ] Viết hướng dẫn cài đặt và sử dụng.
- [ ] Chuẩn bị môi trường triển khai trực tuyến.
- [ ] Hoàn thiện tài liệu báo cáo và kịch bản demo.

**Hoàn thành khi:** Hệ thống có thể được chạy, kiểm thử và trình diễn theo hướng dẫn rõ ràng.

---

## Development Principles

- Ưu tiên chức năng cốt lõi trước tính năng mở rộng.
- Chia nhỏ công việc thành các phần có thể kiểm thử độc lập.
- Giữ code dễ đọc, dễ sửa và có cấu trúc nhất quán.
- Không thêm công nghệ nếu chưa có nhu cầu rõ ràng.
- Mỗi giai đoạn cần có kết quả chạy được trước khi chuyển sang giai đoạn tiếp theo.
- Cập nhật kế hoạch khi phạm vi hoặc công nghệ thay đổi.
