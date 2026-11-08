# Kdocument

**Hệ thống quản lý học tập tích hợp trợ lý ảo hỏi đáp theo tài liệu môn học**

Kdocument là đồ án tốt nghiệp hướng đến việc xây dựng một hệ thống quản lý học tập (LMS), tích hợp trợ lý ảo AI có khả năng trả lời câu hỏi dựa trên tài liệu môn học được cung cấp.

Hệ thống hỗ trợ giảng viên quản lý tài liệu học tập, sinh viên tra cứu kiến thức và kiểm chứng câu trả lời thông qua các nguồn tài liệu tham khảo.

## 1. Giới thiệu

Kdocument kết hợp chức năng quản lý học tập với công nghệ Retrieval-Augmented Generation (RAG), giúp trợ lý ảo truy xuất nội dung liên quan từ tài liệu trước khi tạo câu trả lời.

Mục tiêu là xây dựng một ứng dụng có cấu trúc rõ ràng, dễ bảo trì, phù hợp với phạm vi đồ án tốt nghiệp và có khả năng mở rộng trong tương lai.

## 2. Mục tiêu

- Quản lý tài khoản và phân quyền người dùng.
- Quản lý môn học và tài liệu học tập.
- Hỗ trợ giảng viên tải lên và cập nhật tài liệu môn học.
- Hỗ trợ sinh viên hỏi đáp dựa trên nội dung tài liệu bằng AI.
- Cung cấp nguồn tham khảo để kiểm chứng câu trả lời.
- Lưu trữ và xem lại lịch sử hội thoại.
- Xây dựng hệ thống dễ bảo trì, dễ kiểm thử và có thể triển khai trực tuyến.

## 3. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Giao diện người dùng | React, TypeScript |
| Máy chủ và xử lý nghiệp vụ | Node.js, Express |
| Cơ sở dữ liệu | MySQL |
| Mô hình AI | API mô hình ngôn ngữ lớn (LLM) |
| Quy trình RAG | Xử lý tài liệu, tạo Embeddings, truy xuất vector |
| Quản lý mã nguồn | Git, GitHub |

**Lưu ý:** Công nghệ trên là định hướng ban đầu và có thể được điều chỉnh trong quá trình nghiên cứu, thiết kế và triển khai.

## 4. Phạm vi chức năng

### 4.1. Quản lý hệ thống

- Đăng nhập, đăng xuất và phân quyền.
- Quản lý người dùng.
- Quản lý môn học và phân công giảng viên.

### 4.2. Quản lý tài liệu

- Tải lên, xem và quản lý tài liệu môn học.
- Xử lý nội dung và lập chỉ mục phục vụ truy xuất.
- Kiểm soát quyền truy cập tài liệu.

### 4.3. Trợ lý ảo AI

- Tiếp nhận câu hỏi bằng ngôn ngữ tự nhiên.
- Truy xuất các đoạn nội dung liên quan từ tài liệu.
- Sinh câu trả lời dựa trên nội dung truy xuất.
- Hiển thị nguồn tham khảo cho câu trả lời.
- Lưu trữ và xem lại lịch sử hội thoại.

## 5. Vai trò người dùng

- **Quản trị viên (Admin):** Quản lý người dùng, môn học và các thiết lập quản trị hệ thống.
- **Giảng viên (Teacher):** Quản lý tài liệu thuộc các môn học được phân công.
- **Sinh viên (Student):** Tra cứu tài liệu và sử dụng trợ lý ảo hỏi đáp.

## 6. Trạng thái dự án

**Giai đoạn hiện tại:** Phát triển các chức năng quản lý tài liệu và hoàn thiện hệ thống.

Các chức năng, kiến trúc và công nghệ sẽ tiếp tục được hoàn thiện theo kế hoạch phát triển của đồ án.

## 7. Cấu trúc dự án

Cấu trúc thư mục sẽ được cập nhật theo quá trình triển khai.

## 8. Tác giả

Nguyễn Văn Khải - K23CNT2 .

## 9. Giấy phép

Giấy phép sử dụng và phân phối sẽ được xác định khi cần thiết.
