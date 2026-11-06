# Kết quả kiểm thử API quản lý tài liệu

> Phạm vi: API duyệt/từ chối tài liệu và API lấy danh sách tài liệu công khai của Kdocument.  
> Môi trường kiểm thử: Backend Express chạy tại `http://localhost:3000`, cơ sở dữ liệu MySQL `kdocument_db`, kiểm thử thủ công bằng Postman và đối chiếu dữ liệu bằng MySQL Workbench.  
> Thời gian kiểm thử: 06–07/11/2026.

## 1. Tài khoản kiểm thử

| Vai trò | Email | Mục đích |
|---|---|---|
| ADMIN | `admin@kdocument.local` | Quản lý tài liệu dùng chung và kiểm tra quyền |
| TEACHER | `teacher.test@kdocument.local` | Quản lý tài liệu thuộc môn học được phân công |
| STUDENT | `student.test@kdocument.local` | Truy cập tài liệu công khai |

Không lưu mật khẩu hoặc JWT trong tài liệu kiểm thử.

## 2. Kết quả kiểm thử

| STT | Chức năng / trường hợp | Dữ liệu hoặc thao tác | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---:|---|---|---|---|---|
| 1 | ADMIN lấy danh sách tài liệu chờ duyệt | `GET /api/documents/pending`, token ADMIN; chưa có tài liệu chờ duyệt phù hợp | `200 OK`, danh sách rỗng | API trả về danh sách rỗng | Đạt |
| 2 | ADMIN duyệt tài liệu dùng chung | `PATCH /api/documents/3/approve`, tài liệu có `subject_id = NULL` | Duyệt thành công; `review_status = APPROVED` | `200 OK`; DB ghi `reviewed_by = 1`, có `reviewed_at` | Đạt |
| 3 | ADMIN từ chối tài liệu dùng chung | `PATCH /api/documents/4/reject`, có `rejection_reason` | Từ chối thành công; lưu lý do | `200 OK`; DB ghi `review_status = REJECTED`, `reviewed_by = 1` và lý do từ chối | Đạt |
| 4 | TEACHER xem tài liệu chờ duyệt thuộc môn được phân công | `GET /api/documents/pending`; giảng viên ID 2 được phân công môn ID 1 | Chỉ hiển thị tài liệu thuộc môn được phân công | Tài liệu môn ID 1 xuất hiện; tài liệu dùng chung không xuất hiện | Đạt |
| 5 | TEACHER duyệt tài liệu thuộc môn được phân công | `PATCH /api/documents/5/approve` | Duyệt thành công | `200 OK`; DB ghi `review_status = APPROVED`, `reviewed_by = 2` | Đạt |
| 6 | TEACHER từ chối tài liệu thuộc môn được phân công | `PATCH /api/documents/6/reject`, có `rejection_reason` | Từ chối thành công và lưu lý do | `200 OK`; DB ghi `review_status = REJECTED`, `reviewed_by = 2` và lý do từ chối | Đạt |
| 7 | TEACHER thao tác tài liệu dùng chung | Dùng token TEACHER gọi `PATCH /api/documents/3/approve` | `403 Forbidden` | API trả về `403` | Đạt |
| 8 | ADMIN lấy danh sách tài liệu chờ duyệt sau khi xử lý | `GET /api/documents/pending` | Danh sách rỗng nếu không còn tài liệu chờ duyệt phù hợp | API trả về danh sách rỗng | Đạt |
| 9 | STUDENT lấy danh sách tài liệu công khai | `GET /api/documents/public`, token STUDENT | `200 OK`; chỉ trả tài liệu `PUBLIC`, `READY`, `APPROVED` | API trả về tài liệu ID 5 và ID 3; các tài liệu không thỏa điều kiện bị loại | Đạt |
| 10 | STUDENT không thấy tài liệu bị từ chối | Tài liệu ID 4 và ID 6 có `review_status = REJECTED` | Không xuất hiện trong danh sách | Không xuất hiện | Đạt |
| 11 | STUDENT không thấy tài liệu chờ duyệt | Tài liệu ID 7 có `review_status = PENDING` | Không xuất hiện trong danh sách | Không xuất hiện | Đạt |
| 12 | STUDENT không thấy tài liệu riêng tư | Tài liệu ID 8 có `visibility = PRIVATE` | Không xuất hiện trong danh sách | Không xuất hiện | Đạt |
| 13 | ADMIN gọi API chỉ dành cho STUDENT | `GET /api/documents/public`, token ADMIN | `403 Forbidden` | API trả `success: false`, thông báo không có quyền truy cập | Đạt |

## 3. Dữ liệu kiểm thử cho API tài liệu công khai

| Document ID | Visibility | Status | Review status | Kết quả với STUDENT |
|---:|---|---|---|---|
| 3 | PUBLIC | READY | APPROVED | Được hiển thị |
| 4 | PUBLIC | READY | REJECTED | Bị loại |
| 5 | PUBLIC | READY | APPROVED | Được hiển thị |
| 6 | PUBLIC | READY | REJECTED | Bị loại |
| 7 | PUBLIC | READY | PENDING | Bị loại |
| 8 | PRIVATE | READY | APPROVED | Bị loại |

Điều kiện truy vấn đã kiểm thử:

```sql
WHERE d.visibility = 'PUBLIC'
  AND d.status = 'READY'
  AND d.review_status = 'APPROVED'
```

Tài liệu dùng chung có `subject_id = NULL` và tài liệu thuộc môn học đều có thể xuất hiện nếu thỏa các điều kiện trên. Truy vấn không lọc trạng thái `subjects.status`, phù hợp với quy tắc nghiệp vụ đã thống nhất: môn học `INACTIVE` không tự động làm mất quyền truy cập tài liệu.

## 4. Kết luận

- Các trường hợp đã thực hiện trong bảng kiểm thử đều đạt kết quả mong đợi.
- Luồng duyệt và từ chối tài liệu đã được kiểm tra với ADMIN đối với tài liệu dùng chung và TEACHER đối với tài liệu thuộc môn học được phân công.
- API dành cho STUDENT chỉ trả tài liệu công khai, đã xử lý và được phê duyệt.
- Middleware phân quyền đã chặn ADMIN khỏi API chỉ dành cho STUDENT và chặn TEACHER thao tác với tài liệu dùng chung.

**Lưu ý:** Đây là kết quả kiểm thử thủ công cho các trường hợp liệt kê ở trên, không phải xác nhận toàn bộ hệ thống đã được kiểm thử đầy đủ. Các trường hợp chưa thực hiện không được xem là đã đạt.
