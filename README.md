# Kdocument — Learning Management System with AI Assistant

**Hệ thống quản lý học tập tích hợp trợ lý ảo hỏi đáp theo tài liệu môn học**

Kdocument là đồ án tốt nghiệp hướng đến việc xây dựng một hệ thống quản lý học tập (Learning Management System — LMS), tích hợp trợ lý ảo AI có khả năng trả lời câu hỏi dựa trên tài liệu môn học được cung cấp.

Hệ thống hỗ trợ giảng viên quản lý tài liệu học tập, sinh viên tra cứu kiến thức và kiểm chứng câu trả lời thông qua nguồn tài liệu tham khảo.

## 1. Giới thiệu | Overview

### Tiếng Việt

Kdocument kết hợp chức năng quản lý học tập với công nghệ Retrieval-Augmented Generation (RAG), giúp trợ lý ảo truy xuất nội dung liên quan từ tài liệu trước khi tạo câu trả lời.

Mục tiêu là xây dựng một ứng dụng có cấu trúc rõ ràng, dễ bảo trì, phù hợp với phạm vi đồ án tốt nghiệp và có khả năng mở rộng trong tương lai.

### English

Kdocument combines learning management capabilities with Retrieval-Augmented Generation (RAG), allowing the AI assistant to retrieve relevant content from learning documents before generating answers.

The project aims to deliver a maintainable, well-structured application suitable for a graduation project, with room for future improvements.

## 2. Mục tiêu | Objectives

- Quản lý tài khoản và phân quyền người dùng.
- Quản lý môn học và tài liệu học tập.
- Hỗ trợ giảng viên tải lên và cập nhật tài liệu môn học.
- Hỗ trợ sinh viên hỏi đáp dựa trên nội dung tài liệu bằng AI.
- Cung cấp nguồn tham khảo để kiểm chứng câu trả lời.
- Lưu trữ và xem lại lịch sử hội thoại.
- Xây dựng hệ thống dễ bảo trì, dễ kiểm thử và có thể triển khai trực tuyến.

## 3. Công nghệ dự kiến | Planned Technology Stack

| Thành phần | Công nghệ dự kiến |
|---|---|
| Frontend | React, TypeScript |
| Backend | Node.js, Express |
| Database | MySQL |
| AI Question Answering | Large Language Model (LLM) API |
| RAG Pipeline | Document Processing, Embeddings, Vector Retrieval |
| Version Control | Git, GitHub |

**Lưu ý:** Công nghệ trên là định hướng ban đầu và có thể được điều chỉnh trong quá trình nghiên cứu, thiết kế và triển khai.

## 4. Phạm vi chức năng | Planned Features

### Quản lý hệ thống

- Đăng nhập, đăng xuất và phân quyền.
- Quản lý người dùng.
- Quản lý môn học và phân công giảng viên.

### Quản lý tài liệu

- Tải lên, xem và quản lý tài liệu môn học.
- Xử lý nội dung và lập chỉ mục phục vụ truy xuất.
- Kiểm soát quyền truy cập tài liệu.

### Trợ lý ảo AI

- Tiếp nhận câu hỏi bằng ngôn ngữ tự nhiên.
- Truy xuất các đoạn nội dung liên quan từ tài liệu.
- Sinh câu trả lời dựa trên nội dung truy xuất.
- Hiển thị nguồn tham khảo cho câu trả lời.
- Lưu trữ và xem lại lịch sử hội thoại.

## 5. Vai trò người dùng | User Roles

- **Admin:** Quản lý người dùng, môn học và các thiết lập quản trị.
- **Giảng viên (Teacher):** Quản lý tài liệu thuộc môn học được phân công.
- **Sinh viên (Student):** Tra cứu tài liệu và sử dụng trợ lý ảo hỏi đáp.

## 6. Trạng thái dự án | Project Status

**Giai đoạn hiện tại:** Phân tích yêu cầu và thiết kế hệ thống.

Các chức năng, kiến trúc và công nghệ sẽ được hoàn thiện dần theo kế hoạch phát triển của đồ án.

## 7. Cấu trúc dự án | Project Structure

Cấu trúc thư mục sẽ được cập nhật khi quá trình triển khai bắt đầu.

## 8. Tác giả | Author

Đồ án tốt nghiệp (Graduation Project).

## 9. Giấy phép | License

Giấy phép sử dụng và phân phối sẽ được xác định khi cần thiết.