\# Kdocument — Thiết kế cơ sở dữ liệu



\## 1. Tổng quan



Tài liệu này mô tả thiết kế cơ sở dữ liệu ban đầu cho Kdocument — hệ thống quản lý học tập tích hợp trợ lý ảo AI hỏi đáp dựa trên tài liệu môn học.



MySQL được sử dụng để lưu trữ dữ liệu nghiệp vụ có cấu trúc. Cách lưu trữ vector phục vụ tìm kiếm ngữ nghĩa sẽ được lựa chọn trong giai đoạn triển khai chức năng RAG.



\## 2. Danh sách bảng



\### 2.1. Bảng `Users` — Người dùng



Lưu thông tin tài khoản và vai trò của người dùng.



| Cột | Ý nghĩa |

|---|---|

| `user\_id` | Khóa chính, mã người dùng |

| `full\_name` | Họ và tên |

| `email` | Email đăng nhập, không được trùng |

| `password\_hash` | Mật khẩu đã được băm |

| `role` | Vai trò: `ADMIN`, `TEACHER` hoặc `STUDENT` |

| `status` | Trạng thái tài khoản |

| `created\_at` | Thời điểm tạo tài khoản |

| `updated\_at` | Thời điểm cập nhật gần nhất |



\### 2.2. Bảng `Subjects` — Môn học



Lưu thông tin các môn học trong hệ thống.



| Cột | Ý nghĩa |

|---|---|

| `subject\_id` | Khóa chính, mã môn học |

| `subject\_code` | Mã môn học duy nhất |

| `subject\_name` | Tên môn học |

| `description` | Mô tả môn học, có thể để trống |

| `status` | Trạng thái môn học |

| `created\_at` | Thời điểm tạo |

| `updated\_at` | Thời điểm cập nhật gần nhất |



\### 2.3. Bảng `SubjectTeachers` — Phân công giảng viên



Liên kết giảng viên với các môn học. Một môn học có thể có nhiều giảng viên và một giảng viên có thể phụ trách nhiều môn.



| Cột | Ý nghĩa |

|---|---|

| `subject\_id` | Khóa ngoại tham chiếu `Subjects` |

| `teacher\_id` | Khóa ngoại tham chiếu `Users` |

| `assigned\_at` | Thời điểm phân công |



Hai cột `subject\_id` và `teacher\_id` kết hợp thành khóa chính. Hệ thống phải kiểm tra người được phân công có vai trò `TEACHER`.



\### 2.4. Bảng `Documents` — Tài liệu



Lưu thông tin của tài liệu được tải lên. File PDF được lưu bên ngoài cơ sở dữ liệu; MySQL chỉ lưu thông tin để quản lý và tìm kiếm file.



| Cột | Ý nghĩa |

|---|---|

| `document\_id` | Khóa chính, mã tài liệu |

| `subject\_id` | Môn học liên quan, có thể để trống nếu là tài liệu dùng chung toàn hệ thống |

| `uploaded\_by` | Khóa ngoại tham chiếu `Users`, người tải lên |

| `title` | Tên tài liệu |

| `file\_key` | Định danh dùng để tìm file trong nơi lưu trữ |

| `file\_type` | Loại file |

| `file\_size` | Dung lượng file tính bằng byte |

| `visibility` | Phạm vi hiển thị: `PUBLIC` hoặc `PRIVATE` |

| `status` | Trạng thái xử lý: `PENDING`, `PROCESSING`, `READY` hoặc `FAILED` |

| `created\_at` | Thời điểm tải lên |

| `updated\_at` | Thời điểm cập nhật gần nhất |



Hệ thống phải kiểm soát quyền xem, tải xuống, cập nhật và xóa tài liệu theo vai trò và quyền được cấp.



\### 2.5. Bảng `DocumentChunks` — Các đoạn nội dung tài liệu



Lưu các đoạn văn bản được trích xuất từ tài liệu để phục vụ tìm kiếm nội dung liên quan khi người dùng đặt câu hỏi.



| Cột | Ý nghĩa |

|---|---|

| `chunk\_id` | Khóa chính, mã đoạn nội dung |

| `document\_id` | Khóa ngoại tham chiếu `Documents` |

| `chunk\_index` | Vị trí của đoạn trong tài liệu |

| `content` | Nội dung văn bản được trích xuất |

| `page\_number` | Số trang nguồn, nếu xác định được |

| `created\_at` | Thời điểm tạo |



Cặp `document\_id` và `chunk\_index` phải là duy nhất. Vector biểu diễn nội dung có thể được lưu riêng, tùy giải pháp tìm kiếm được lựa chọn.



\### 2.6. Bảng `ChatSessions` — Phiên hội thoại



Lưu các phiên trò chuyện của từng người dùng với trợ lý AI.



| Cột | Ý nghĩa |

|---|---|

| `session\_id` | Khóa chính, mã phiên hội thoại |

| `user\_id` | Khóa ngoại tham chiếu `Users` |

| `subject\_id` | Môn học đang trao đổi, có thể để trống |

| `title` | Tiêu đề hội thoại |

| `created\_at` | Thời điểm tạo phiên |

| `updated\_at` | Thời điểm hoạt động gần nhất |



\### 2.7. Bảng `ChatMessages` — Tin nhắn hội thoại



Lưu các tin nhắn trong từng phiên hội thoại.



| Cột | Ý nghĩa |

|---|---|

| `message\_id` | Khóa chính, mã tin nhắn |

| `session\_id` | Khóa ngoại tham chiếu `ChatSessions` |

| `sender\_type` | Người gửi: `USER` hoặc `ASSISTANT` |

| `content` | Nội dung tin nhắn |

| `created\_at` | Thời điểm gửi tin nhắn |



\### 2.8. Bảng `Citations` — Nguồn trích dẫn



Liên kết câu trả lời của trợ lý AI với các đoạn tài liệu được sử dụng làm căn cứ trả lời.



| Cột | Ý nghĩa |

|---|---|

| `citation\_id` | Khóa chính, mã trích dẫn |

| `message\_id` | Khóa ngoại tham chiếu `ChatMessages` |

| `chunk\_id` | Khóa ngoại tham chiếu `DocumentChunks` |

| `similarity\_score` | Điểm tương đồng khi truy xuất, có thể để trống |

| `created\_at` | Thời điểm tạo trích dẫn |



Chỉ tạo trích dẫn cho câu trả lời của trợ lý AI và tránh lưu trùng một đoạn nội dung nhiều lần trong cùng một câu trả lời.



\## 3. Các mối quan hệ giữa bảng



\- Một người dùng có thể tải lên nhiều tài liệu.

\- Một môn học có thể có nhiều tài liệu.

\- Một môn học có thể có nhiều giảng viên; một giảng viên có thể phụ trách nhiều môn.

\- Một tài liệu có thể được chia thành nhiều đoạn nội dung.

\- Một người dùng có thể tạo nhiều phiên hội thoại.

\- Một phiên hội thoại có thể chứa nhiều tin nhắn.

\- Một câu trả lời AI có thể tham chiếu nhiều đoạn nội dung.

\- Một đoạn nội dung có thể được trích dẫn trong nhiều câu trả lời khác nhau.



\## 4. Quy tắc nghiệp vụ



1\. Email của người dùng phải là duy nhất.

2\. Không lưu mật khẩu gốc; chỉ lưu giá trị băm mật khẩu bằng phương pháp phù hợp.

3\. Giảng viên chỉ được quản lý tài liệu trong phạm vi quyền được cấp.

4\. Người dùng không được xem lịch sử hội thoại riêng tư của người khác.

5\. Chỉ sử dụng tài liệu mà người đặt câu hỏi có quyền truy cập để truy xuất và tạo trích dẫn.

6\. Khi cập nhật hoặc xóa tài liệu, phải xử lý các đoạn nội dung và dữ liệu vector cũ tương ứng.

7\. Nếu xử lý tài liệu thất bại, hệ thống cần lưu trạng thái để có thể kiểm tra hoặc thử xử lý lại.

8\. Thống kê cơ bản nên được tính từ dữ liệu hiện có, chưa cần tạo bảng thống kê riêng.



\## 5. Các quyết định cần hoàn thiện khi triển khai



\- Kiểu dữ liệu SQL cụ thể cho từng cột và quy tắc xóa dữ liệu liên quan.

\- Cách lưu trữ file tài liệu.

\- Mô hình embedding và giải pháp lưu trữ vector.

\- Thư viện trích xuất văn bản từ PDF.

\- Nhà cung cấp mô hình AI và cách cấu hình API.

\- Chính sách truy cập tài liệu: sinh viên được xem tất cả tài liệu công khai hay phải đăng ký môn học trước.



\## 6. Thứ tự triển khai



1\. Chốt quan hệ giữa các bảng và quy tắc nghiệp vụ.

2\. Tạo schema MySQL và dữ liệu mẫu ban đầu.

3\. Xây dựng đăng nhập và phân quyền.

4\. Xây dựng quản lý môn học và tài liệu.

5\. Xây dựng quy trình trích xuất PDF, chia đoạn, tạo embedding và truy xuất.

6\. Xây dựng hỏi đáp AI, trích dẫn và lịch sử hội thoại.

7\. Kiểm thử phân quyền, chất lượng truy xuất và tính nhất quán dữ liệu.

