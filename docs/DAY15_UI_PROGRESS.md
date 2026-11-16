
### UI-06 – LLM trả lời thành công nhưng thiếu trích dẫn

- Triệu chứng: Backend trả HTTP 502 dù LLM có nội dung.
- Nguyên nhân: `generateAnswer()` thành công nhưng
  `validateAnswerCitations()` không tìm được mã nguồn hợp lệ.
- Giải pháp: Cho phép tạo lại câu trả lời tối đa một lần
  khi kiểm tra trích dẫn thất bại.
- An toàn: Không tự gắn nguồn giả vào kết quả AI.
- Trạng thái: Đã viết bản sửa, chờ kiểm thử thực tế.

### UI-07 – Markdown trong câu trả lời chưa được render

- Triệu chứng: Hiển thị dấu `**`, cú pháp danh sách
  và các ký hiệu Markdown nguyên dạng.
- Nguyên nhân: React đang hiển thị chuỗi văn bản thuần.
- Giải pháp dự kiến: Tích hợp react-markdown,
  tách CSS trình bày câu trả lời.
- Trạng thái: Chưa triển khai.

### UI-08 – Model LLM chưa được cố định

- Hiện trạng: OpenRouter đang dùng openrouter/free.
- Rủi ro: Câu trả lời có chất lượng và định dạng
  khác nhau giữa các model.
- Hướng xử lý: Chọn một model ổn định sau khi đánh giá.
- Trạng thái: Chưa chốt model.



## Đề xuất nâng cấp sau Day 15

### UI-09 – Trải nghiệm hội thoại AI
- [ ] Gửi tin nhắn bằng Enter
- [ ] Hiển thị tin nhắn ngay sau khi gửi
- [ ] Hiệu ứng AI đang xử lý / trả lời
- [ ] Tự cuộn theo hội thoại
- [ ] Render Markdown
- [ ] Sao chép và thử lại câu hỏi
- [ ] Nghiên cứu streaming AI thật

### UI-10 – Trích dẫn nguồn tương tác
- [ ] Biến [NGUỒN n] thành trích dẫn có thể nhấn
- [ ] Xem đoạn chunk được trích dẫn
- [ ] Hiển thị tên tài liệu và số trang
- [ ] Mở PDF đúng trang
- [ ] Kiểm tra quyền khi tải và xem PDF
- [ ] Đối chiếu nội dung AI với nguồn tài liệu

### Thứ tự ưu tiên
1. Hoàn thiện giao diện Chat UX
2. Xây dựng CitationCard / SourcePreview
3. Kết nối trình xem PDF
4. Bổ sung kiểm chứng nội dung
5. Tối ưu streaming và lịch sử hội thoại

Trạng thái: Đã ghi nhận yêu cầu, chưa triển khai.
```
