# Kdocument – Day 15: Tích hợp giao diện Stitch

**Ngày:** 16/11/2026  
**Nhánh Git:** `Day15-StitchUI`  
**Giai đoạn:** Frontend React + TypeScript  
**Trạng thái:** Đang triển khai

---

## 1. Mục tiêu

Chuyển giao diện Google Stitch thành hệ thống React + TypeScript có ba vai trò: STUDENT, TEACHER, ADMIN.

Giữ nguyên những thành phần đã chạy thành công trong Day 14: đăng nhập JWT, kết nối Express API và trợ lý RAG.

## 2. Nguyên tắc tổ chức code

- Mỗi component giao diện có file TSX riêng.
- CSS của component phải nằm trong file CSS tương ứng.
- Không viết CSS trực tiếp bằng `style={{...}}` nếu không cần thiết.
- Đặt tên CSS theo component để hạn chế xung đột.
- Dùng chung `AppLayout` cho ba vai trò.
- Không dùng dữ liệu minh họa của Stitch như dữ liệu thật.
- Backend chịu trách nhiệm xác thực và phân quyền.

## 3. Tiến độ

### 3.1. Thiết kế Stitch

- [x] Thiết kế AI Chat Desktop
- [x] Thiết kế AI Chat Mobile
- [x] Thiết kế Student Dashboard
- [x] Thiết kế Teacher Dashboard
- [x] Thiết kế Admin Dashboard
- [x] Xuất ZIP tham chiếu

### 3.2. Chuyển sang React

- [ ] Hoàn thiện `AppLayout.tsx`
- [ ] Kiểm tra `AppLayout.css`
- [ ] Hoàn thiện `RoleDashboard.tsx`
- [ ] Tạo `RoleDashboard.css`
- [ ] Ghép Dashboard vào `App.tsx`
- [ ] Kiểm thử đăng nhập và đăng xuất
- [ ] Kiểm thử ba vai trò
- [ ] Kiểm thử lại RAG
- [ ] Chạy build và lint

### 3.3. Chức năng chưa triển khai

- [ ] Trang quản lý môn học
- [ ] Trang tài liệu theo quyền
- [ ] Trang quản lý người dùng
- [ ] Giao diện phê duyệt tài liệu
- [ ] Thống kê từ database
- [ ] Lịch sử hội thoại lưu MySQL
- [ ] Dropdown chọn tài liệu thay ID thủ công
- [ ] OTP xác minh email
- [ ] Kiểm tra và xử lý phiên JWT hết hạn

## 4. Nhật ký thay đổi

### Day 15 – Đợt 1

**Nội dung:** Chuẩn hóa cấu trúc frontend.

- Tách Dashboard thành TSX và CSS riêng.
- Chuyển cấu hình Student, Teacher, Admin vào một component dùng chung.
- Giữ lại `api.ts` và `RagChat.tsx`.
- Chuẩn hóa điều hướng Dashboard / Trợ lý AI.
- Không thay đổi backend hoặc MySQL.

## 5. Nhật ký lỗi và rủi ro

| Mã | Vấn đề | Hướng xử lý | Trạng thái |
|---|---|---|---|
| UI-01 | CSS Dashboard nằm chung file Layout | Tách `RoleDashboard.css` | Chờ kiểm thử |
| UI-02 | Chèn JSX thủ công dễ sai cấu trúc | Viết lại `App.tsx` hoàn chỉnh | Chờ build |
| UI-03 | Chưa xử lý JWT hết hạn khi khôi phục phiên | Bổ sung kiểm tra phiên | Chưa làm |
| UI-04 | Menu chưa có trang hoặc API tương ứng | Hiển thị chức năng chưa triển khai | Tạm thời |
| UI-05 | Dashboard chưa sử dụng dữ liệu MySQL | Kết nối API theo từng vai trò | Chưa làm |

## 6. Kiểm thử bắt buộc

- [ ] `npm run build` thành công
- [ ] `npm run lint` không có lỗi
- [ ] STUDENT đăng nhập đúng Dashboard
- [ ] TEACHER đăng nhập đúng Dashboard
- [ ] ADMIN đăng nhập đúng Dashboard
- [ ] Giảng viên hỏi được tài liệu số 9
- [ ] Sinh viên không được hỏi tài liệu số 9
- [ ] Đăng xuất xóa phiên giao diện
- [ ] Responsive hoạt động trên mobile

## 7. Kế hoạch đợt tiếp theo

1. Kiểm tra giao diện sau khi ghép component.
2. Chỉnh Sidebar và Header sát thiết kế Stitch.
3. Chuyển từng Dashboard thành trang riêng khi cần.
4. Kết nối danh sách môn học và tài liệu thật.
5. Hoàn thiện giao diện AI Chat Desktop.
6. Commit và push nhánh Day 15 sau khi kiểm thử đạt.

## 8. Lưu ý Git

Không commit các nội dung sau:

- `.env` và API key.
- JWT và thông tin đăng nhập kiểm thử.
- `node_modules`, `dist`.
- Các bản sao dữ liệu nhạy cảm.

Chỉ merge vào `main` khi dự án hoàn thiện theo quy tắc quản lý nhánh đã thống nhất.