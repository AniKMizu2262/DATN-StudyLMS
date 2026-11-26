
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import SubjectDocumentsWidget from "./SubjectDocumentsWidget";
import "./SubjectsPage.css";

// ======================================================
// KDOCUMENT - SUBJECTS PAGE
//
// [01] Kiểu dữ liệu và state
// [02] Danh sách môn học, tìm kiếm, lọc
// [03] Admin thêm / sửa môn học
// [04] Admin phân công / gỡ giảng viên
// [05] Giao diện theo vai trò
// ======================================================

type SubjectStatus = "ACTIVE" | "INACTIVE";
type StatusFilter = "ALL" | SubjectStatus;

interface Subject {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  description: string | null;
  status: SubjectStatus;
  created_at: string;
  updated_at: string;
}

interface Teacher {
  user_id: number;
  full_name: string;
  email: string;
}

interface ApiListResponse<T> {
  success: boolean;
  message?: string;
  data?: T[];
}

interface ApiMutationResponse {
  success: boolean;
  message?: string;
}

interface SubjectsPageProps {
  token: string;
  role: string;
}

interface SubjectForm {
  subject_code: string;
  subject_name: string;
  description: string;
  status: SubjectStatus;
}

const EMPTY_FORM: SubjectForm = {
  subject_code: "",
  subject_name: "",
  description: "",
  status: "ACTIVE",
};

export default function SubjectsPage({
  token,
  role,
}: SubjectsPageProps) {
  // ====================================================
  // [01] STATE VÀ PHÂN QUYỀN
  // ====================================================

  const isAdmin = role.toUpperCase() === "ADMIN";
  const isTeacher = role.toUpperCase() === "TEACHER";

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  // Form thêm / sửa môn học.
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SubjectForm>({
    ...EMPTY_FORM,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  // Form phân công giảng viên.
  const [selectedSubject, setSelectedSubject] =
    useState<Subject | null>(null);

  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [assignedTeachers, setAssignedTeachers] =
    useState<Teacher[]>([]);

  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [isTeachersLoading, setIsTeachersLoading] =
    useState(false);

  const [teachersLoadFailed, setTeachersLoadFailed] =
    useState(false);

  const [isAssigning, setIsAssigning] = useState(false);

  const [removingTeacherId, setRemovingTeacherId] =
    useState<number | null>(null);

  const [teachersError, setTeachersError] = useState("");
  const [teacherNotice, setTeacherNotice] = useState("");
  const [teacherReloadKey, setTeacherReloadKey] = useState(0);

  // Không cho chạy hai thao tác ghi dữ liệu cùng lúc.
  const isBusy =
    isSaving ||
    isAssigning ||
    removingTeacherId !== null;

  const selectedSubjectId = selectedSubject?.subject_id ?? null;

  const pageTitle = isTeacher
    ? "Môn học phụ trách"
    : isAdmin
      ? "Quản lý môn học"
      : "Danh sách môn học";

  const pageDescription = isTeacher
    ? "Các môn học được phân công cho giảng viên."
    : isAdmin
      ? "Quản lý môn học và phân công giảng viên phụ trách."
      : "Tra cứu các môn học trong hệ thống Kdocument.";

  // ====================================================
  // [02] DANH SÁCH MÔN HỌC, TÌM KIẾM VÀ LỌC
  // ====================================================

  useEffect(() => {
    const controller = new AbortController();

    const loadSubjects = async () => {
      setIsLoading(true);
      setError("");

      try {
        const endpoint = isTeacher
          ? "/subjects/mine"
          : "/subjects";

        const response =
          await apiRequest<ApiListResponse<Subject>>(
            endpoint,
            {
              method: "GET",
              token,
              signal: controller.signal,
            }
          );

        if (controller.signal.aborted) return;

        if (
          !response.success ||
          !Array.isArray(response.data)
        ) {
          throw new Error(
            response.message ||
              "Không thể tải danh sách môn học."
          );
        }

        setSubjects(response.data);
      } catch (err) {
        if (controller.signal.aborted) return;

        setSubjects([]);

        setError(
          err instanceof Error
            ? err.message
            : "Lỗi tải môn học."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadSubjects();

    return () => controller.abort();
  }, [token, isTeacher, reloadKey]);

  // [02.1] Thống kê môn học.
  const statistics = useMemo(() => {
    const active = subjects.filter(
      (subject) => subject.status === "ACTIVE"
    ).length;

    return {
      total: subjects.length,
      active,
      inactive: subjects.length - active,
    };
  }, [subjects]);

  // [02.2] Tìm kiếm và lọc theo trạng thái.
  const filteredSubjects = useMemo(() => {
    const search = keyword
      .trim()
      .toLocaleLowerCase("vi-VN");

    return subjects.filter((subject) => {
      if (
        statusFilter !== "ALL" &&
        subject.status !== statusFilter
      ) {
        return false;
      }

      if (!search) return true;

      return [
        subject.subject_code,
        subject.subject_name,
        subject.description ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(search);
    });
  }, [subjects, keyword, statusFilter]);

  const refreshSubjects = () => {
    setReloadKey((current) => current + 1);
  };

  // ====================================================
  // [03] ADMIN - THÊM VÀ SỬA MÔN HỌC
  // ====================================================

  // [03.1] Mở form thêm môn học.
  const openCreateForm = () => {
    if (!isAdmin || isBusy) return;

    setSelectedSubject(null);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setNotice("");
    setIsEditorOpen(true);
  };

  // [03.2] Mở form sửa môn học.
  const openEditForm = (subject: Subject) => {
    if (!isAdmin || isBusy) return;

    setSelectedSubject(null);
    setEditingId(subject.subject_id);

    setForm({
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
      description: subject.description ?? "",
      status: subject.status,
    });

    setFormError("");
    setNotice("");
    setIsEditorOpen(true);
  };

  // [03.3] Đóng form.
  const closeForm = () => {
    if (isBusy) return;

    setIsEditorOpen(false);
    setEditingId(null);
    setFormError("");
  };

  // [03.4] Cập nhật dữ liệu nhập.
  // Dùng function để tránh lỗi generic arrow trong TSX.
  function updateForm<K extends keyof SubjectForm>(
    field: K,
    value: SubjectForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // [03.5] Lưu môn học bằng POST hoặc PATCH.
  const handleSaveSubject = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!isAdmin || isBusy) return;

    setFormError("");
    setNotice("");

    const payload: SubjectForm = {
      subject_code: form.subject_code.trim(),
      subject_name: form.subject_name.trim(),
      description: form.description.trim(),
      status: form.status,
    };

    if (
      !payload.subject_code ||
      payload.subject_code.length > 50
    ) {
      setFormError(
        "Mã môn học phải có từ 1 đến 50 ký tự."
      );
      return;
    }

    if (
      !payload.subject_name ||
      payload.subject_name.length > 150
    ) {
      setFormError(
        "Tên môn học phải có từ 1 đến 150 ký tự."
      );
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = editingId !== null;

      const endpoint = isEditing
        ? `/subjects/${editingId}`
        : "/subjects";

      const response =
        await apiRequest<ApiMutationResponse>(
          endpoint,
          {
            method: isEditing ? "PATCH" : "POST",
            token,
            body: JSON.stringify(payload),
          }
        );

      if (!response.success) {
        throw new Error(
          response.message || "Lưu môn học thất bại."
        );
      }

      setIsEditorOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });

      setNotice(
        response.message ||
          (isEditing
            ? "Cập nhật môn học thành công."
            : "Tạo môn học thành công.")
      );

      setKeyword("");
      setStatusFilter("ALL");

      refreshSubjects();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Không thể lưu môn học."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ====================================================
  // [04] ADMIN - PHÂN CÔNG VÀ GỠ GIẢNG VIÊN
  // ====================================================

  // [04.1] Giảng viên chưa được phân công.
  const unassignedTeachers = useMemo(() => {
    const assignedIds = new Set(
      assignedTeachers.map((teacher) => teacher.user_id)
    );

    return allTeachers.filter(
      (teacher) => !assignedIds.has(teacher.user_id)
    );
  }, [allTeachers, assignedTeachers]);

  // [04.2] Tải danh sách giảng viên theo môn.
  useEffect(() => {
    if (!isAdmin || selectedSubjectId === null) return;

    const controller = new AbortController();

    const loadTeachers = async () => {
      setIsTeachersLoading(true);
      setTeachersLoadFailed(false);
      setTeachersError("");

      try {
        const [allResponse, assignedResponse] =
          await Promise.all([
            apiRequest<ApiListResponse<Teacher>>(
              "/subjects/admin/teachers",
              {
                method: "GET",
                token,
                signal: controller.signal,
              }
            ),

            apiRequest<ApiListResponse<Teacher>>(
              `/subjects/${selectedSubjectId}/teachers`,
              {
                method: "GET",
                token,
                signal: controller.signal,
              }
            ),
          ]);

        if (controller.signal.aborted) return;

        if (
          !allResponse.success ||
          !Array.isArray(allResponse.data) ||
          !assignedResponse.success ||
          !Array.isArray(assignedResponse.data)
        ) {
          throw new Error(
            allResponse.message ||
              assignedResponse.message ||
              "Không thể tải danh sách giảng viên."
          );
        }

        setAllTeachers(allResponse.data);
        setAssignedTeachers(assignedResponse.data);
      } catch (err) {
        if (controller.signal.aborted) return;

        setAllTeachers([]);
        setAssignedTeachers([]);
        setTeachersLoadFailed(true);

        setTeachersError(
          err instanceof Error
            ? err.message
            : "Lỗi tải danh sách giảng viên."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsTeachersLoading(false);
        }
      }
    };

    void loadTeachers();

    return () => controller.abort();
  }, [
    token,
    isAdmin,
    selectedSubjectId,
    teacherReloadKey,
  ]);

  // [04.3] Mở khung phân công.
  const openTeacherPanel = (subject: Subject) => {
    if (!isAdmin || isBusy) return;

    setIsEditorOpen(false);
    setEditingId(null);

    setSelectedSubject(subject);
    setAllTeachers([]);
    setAssignedTeachers([]);
    setSelectedTeacherId("");
    setTeachersError("");
    setTeacherNotice("");

    // Cho phép tải lại ngay cả khi chọn cùng môn.
    setTeacherReloadKey((current) => current + 1);
  };

  // [04.4] Đóng khung phân công.
  const closeTeacherPanel = () => {
    if (isBusy) return;

    setSelectedSubject(null);
    setSelectedTeacherId("");
    setTeachersError("");
    setTeacherNotice("");
  };

  // [04.5] Phân công thêm giảng viên.
  const handleAssignTeacher = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (
      !isAdmin ||
      !selectedSubject ||
      isBusy ||
      isTeachersLoading ||
      teachersLoadFailed
    ) {
      return;
    }

    const teacherId = Number(selectedTeacherId);

    const validTeacher = unassignedTeachers.some(
      (teacher) => teacher.user_id === teacherId
    );

    if (!validTeacher) {
      setTeachersError(
        "Vui lòng chọn giảng viên hợp lệ."
      );
      return;
    }

    setIsAssigning(true);
    setTeachersError("");
    setTeacherNotice("");

    try {
      const response =
        await apiRequest<ApiMutationResponse>(
          `/subjects/${selectedSubject.subject_id}/teachers`,
          {
            method: "POST",
            token,
            body: JSON.stringify({
              teacher_id: teacherId,
            }),
          }
        );

      if (!response.success) {
        throw new Error(
          response.message || "Phân công thất bại."
        );
      }

      setTeacherNotice(
        response.message || "Phân công thành công."
      );

      setSelectedTeacherId("");

      // Tải lại phân công từ MySQL.
      setTeacherReloadKey((current) => current + 1);
    } catch (err) {
      setTeachersError(
        err instanceof Error
          ? err.message
          : "Không thể phân công giảng viên."
      );
    } finally {
      setIsAssigning(false);
    }
  };

  // ====================================================
  // [04.6] ADMIN - GỠ PHÂN CÔNG GIẢNG VIÊN
  // DELETE /api/subjects/:id/teachers/:teacherId
  //
  // Chỉ xóa quan hệ phân công.
  // Không xóa giảng viên, môn học hay tài liệu.
  // ====================================================

  const handleRemoveTeacher = async (teacher: Teacher) => {
    if (
      !isAdmin ||
      !selectedSubject ||
      isBusy ||
      isTeachersLoading ||
      teachersLoadFailed
    ) {
      return;
    }

    // Cảnh báo nếu đang gỡ người phụ trách cuối cùng.
    const warning =
      assignedTeachers.length === 1
        ? "\n\nĐây là giảng viên cuối cùng phụ trách môn này."
        : "";

    // [04.6.1] Xác nhận trước khi xóa quan hệ.
    const confirmed = window.confirm(
      `Gỡ "${teacher.full_name}" khỏi môn ` +
        `"${selectedSubject.subject_name}"?\n` +
        `Giảng viên sẽ mất quyền phụ trách môn này.${warning}`
    );

    if (!confirmed) return;

    // [04.6.2] Gửi DELETE tới backend.
    setRemovingTeacherId(teacher.user_id);
    setTeachersError("");
    setTeacherNotice("");

    try {
      const response =
        await apiRequest<ApiMutationResponse>(
          `/subjects/${selectedSubject.subject_id}/teachers/${teacher.user_id}`,
          {
            method: "DELETE",
            token,
          }
        );

      if (!response.success) {
        throw new Error(
          response.message || "Gỡ phân công thất bại."
        );
      }

      // [04.6.3] Cập nhật giao diện sau khi gỡ.
      setTeacherNotice(
        response.message || "Gỡ phân công thành công."
      );

      setSelectedTeacherId("");

      // Tải lại danh sách từ database.
      setTeacherReloadKey((current) => current + 1);
    } catch (err) {
      setTeachersError(
        err instanceof Error
          ? err.message
          : "Không thể gỡ phân công giảng viên."
      );
    } finally {
      setRemovingTeacherId(null);
    }
  };

  // ====================================================
  // [05] GIAO DIỆN
  // ====================================================

  return (
    <section
      className="kd-subjects"
      aria-label={pageTitle}
    >
      {/* ============================================= */}
      {/* [05.1] HEADER */}
      {/* ============================================= */}

      <div className="kd-subjects__header">
        <div>
          <p className="kd-subjects__eyebrow">
            KDOCUMENT LMS
          </p>

          <h2>{pageTitle}</h2>

          <p className="kd-subjects__description">
            {pageDescription}
          </p>
        </div>

        <div className="kd-subjects__header-actions">
          {isAdmin && (
            <button
              type="button"
              className="kd-subjects__add"
              onClick={openCreateForm}
              disabled={isBusy}
            >
              <span className="material-symbols-outlined">
                add
              </span>
              Thêm môn học
            </button>
          )}

          <button
            type="button"
            className="kd-subjects__refresh"
            onClick={refreshSubjects}
            disabled={isLoading || isBusy}
          >
            <span className="material-symbols-outlined">
              refresh
            </span>
            Làm mới
          </button>
        </div>
      </div>

      {/* [05.2] THÔNG BÁO CHUNG */}

      {notice && (
        <div
          className="kd-subjects__notice"
          role="status"
        >
          <span className="material-symbols-outlined">
            check_circle
          </span>
          {notice}
        </div>
      )}

      {/* ============================================= */}
      {/* [05.3] ADMIN - FORM THÊM / SỬA */}
      {/* ============================================= */}

      {isAdmin && isEditorOpen && (
        <section
          className="kd-subjects__editor"
          aria-label={
            editingId !== null
              ? "Chỉnh sửa môn học"
              : "Thêm môn học"
          }
        >
          <div className="kd-subjects__editor-header">
            <div>
              <h3>
                {editingId !== null
                  ? "Chỉnh sửa môn học"
                  : "Thêm môn học mới"}
              </h3>

              <p>
                {editingId !== null
                  ? `Đang chỉnh sửa môn học ID: ${editingId}`
                  : "Nhập thông tin để tạo môn học."}
              </p>
            </div>

            <button
              type="button"
              className="kd-subjects__close"
              onClick={closeForm}
              disabled={isBusy}
              aria-label="Đóng biểu mẫu"
            >
              <span className="material-symbols-outlined">
                close
              </span>
            </button>
          </div>

          <form onSubmit={handleSaveSubject}>
            <div className="kd-subjects__form-grid">
              {/* Mã môn học */}
              <div className="kd-subjects__field">
                <label htmlFor="subject-code">
                  Mã môn học *
                </label>

                <input
                  id="subject-code"
                  type="text"
                  value={form.subject_code}
                  onChange={(event) =>
                    updateForm(
                      "subject_code",
                      event.target.value
                    )
                  }
                  maxLength={50}
                  placeholder="Ví dụ: CNTT101"
                  required
                  disabled={isBusy}
                />
              </div>

              {/* Tên môn học */}
              <div className="kd-subjects__field">
                <label htmlFor="subject-name">
                  Tên môn học *
                </label>

                <input
                  id="subject-name"
                  type="text"
                  value={form.subject_name}
                  onChange={(event) =>
                    updateForm(
                      "subject_name",
                      event.target.value
                    )
                  }
                  maxLength={150}
                  placeholder="Ví dụ: Lập trình Web"
                  required
                  disabled={isBusy}
                />
              </div>

              {/* Trạng thái môn học */}
              <div className="kd-subjects__field">
                <label htmlFor="subject-status">
                  Trạng thái
                </label>

                <select
                  id="subject-status"
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      "status",
                      event.target.value as SubjectStatus
                    )
                  }
                  disabled={isBusy}
                >
                  <option value="ACTIVE">
                    Đang hoạt động
                  </option>

                  <option value="INACTIVE">
                    Ngừng hoạt động
                  </option>
                </select>
              </div>

              {/* Mô tả */}
              <div className="kd-subjects__field kd-subjects__field--full">
                <label htmlFor="subject-description">
                  Mô tả môn học
                </label>

                <textarea
                  id="subject-description"
                  value={form.description}
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value
                    )
                  }
                  rows={3}
                  placeholder="Nhập mô tả môn học..."
                  disabled={isBusy}
                />
              </div>
            </div>

            {formError && (
              <div
                className="kd-subjects__error"
                role="alert"
              >
                {formError}
              </div>
            )}

            <div className="kd-subjects__form-actions">
              <button
                type="button"
                className="kd-subjects__cancel"
                onClick={closeForm}
                disabled={isBusy}
              >
                Hủy
              </button>

              <button
                type="submit"
                className="kd-subjects__save"
                disabled={isBusy}
              >
                <span className="material-symbols-outlined">
                  save
                </span>

                {isSaving
                  ? "Đang lưu..."
                  : editingId !== null
                    ? "Lưu thay đổi"
                    : "Tạo môn học"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ============================================= */}
      {/* [05.4] ADMIN - PHÂN CÔNG / GỠ GIẢNG VIÊN */}
      {/* ============================================= */}

      {isAdmin && selectedSubject && (
        <section
          className="kd-subjects__teacher-panel"
          aria-label="Phân công giảng viên"
        >
          {/* Tiêu đề khung phân công */}
          <div className="kd-subjects__editor-header">
            <div>
              <h3>Phân công giảng viên</h3>

              <p>
                {selectedSubject.subject_code} -{" "}
                {selectedSubject.subject_name}
              </p>
            </div>

            <button
              type="button"
              className="kd-subjects__close"
              onClick={closeTeacherPanel}
              disabled={isBusy}
              aria-label="Đóng phân công"
            >
              <span className="material-symbols-outlined">
                close
              </span>
            </button>
          </div>

          {/* Trạng thái tải dữ liệu */}
          {isTeachersLoading && (
            <p className="kd-subjects__teacher-muted">
              Đang tải danh sách giảng viên...
            </p>
          )}

          {/* Thông báo thành công */}
          {teacherNotice && (
            <div
              className="kd-subjects__notice"
              role="status"
            >
              <span className="material-symbols-outlined">
                check_circle
              </span>

              {teacherNotice}
            </div>
          )}

          {/* Thông báo lỗi */}
          {teachersError && (
            <div
              className="kd-subjects__error"
              role="alert"
            >
              <p>{teachersError}</p>

              {teachersLoadFailed && (
                <button
                  type="button"
                  disabled={isBusy || isTeachersLoading}
                  onClick={() =>
                    setTeacherReloadKey(
                      (current) => current + 1
                    )
                  }
                >
                  Thử tải lại
                </button>
              )}
            </div>
          )}

          {/* Danh sách giảng viên và form phân công */}
          {!isTeachersLoading && !teachersLoadFailed && (
            <>
              {/* [A] GIẢNG VIÊN ĐANG PHỤ TRÁCH */}
              <div className="kd-subjects__teacher-section">
                <h4>Giảng viên đang phụ trách</h4>

                {assignedTeachers.length === 0 ? (
                  <p className="kd-subjects__teacher-muted">
                    Môn học chưa được phân công giảng viên.
                  </p>
                ) : (
                  <div className="kd-subjects__teacher-list">
                    {assignedTeachers.map((teacher) => (
                      <div
                        key={teacher.user_id}
                        className="kd-subjects__teacher-item"
                      >
                        {/* Biểu tượng */}
                        <span className="material-symbols-outlined">
                          person
                        </span>

                        {/* Thông tin giảng viên */}
                        <div>
                          <strong>
                            {teacher.full_name}
                          </strong>

                          <small>
                            {teacher.email}
                          </small>
                        </div>

                        <span className="kd-subjects__teacher-tag">
                          Đang phụ trách
                        </span>

                        {/* [B] NÚT GỠ PHÂN CÔNG */}
                        <button
                          type="button"
                          className="kd-subjects__remove"
                          onClick={() =>
                            void handleRemoveTeacher(teacher)
                          }
                          disabled={
                            isBusy ||
                            isTeachersLoading
                          }
                          aria-label={
                            `Gỡ ${teacher.full_name} ` +
                            "khỏi môn học"
                          }
                        >
                          <span className="material-symbols-outlined">
                            person_remove
                          </span>

                          {removingTeacherId === teacher.user_id
                            ? "Đang gỡ..."
                            : "Gỡ"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* [C] PHÂN CÔNG GIẢNG VIÊN MỚI */}
              <form
                className="kd-subjects__teacher-form"
                onSubmit={handleAssignTeacher}
              >
                <label htmlFor="assign-teacher">
                  Phân công thêm giảng viên
                </label>

                <div className="kd-subjects__teacher-actions">
                  <select
                    id="assign-teacher"
                    value={selectedTeacherId}
                    onChange={(event) =>
                      setSelectedTeacherId(
                        event.target.value
                      )
                    }
                    disabled={
                      isBusy ||
                      unassignedTeachers.length === 0
                    }
                    required
                  >
                    <option value="">
                      {unassignedTeachers.length === 0
                        ? "Không còn giảng viên để phân công"
                        : "Chọn giảng viên..."}
                    </option>

                    {unassignedTeachers.map((teacher) => (
                      <option
                        key={teacher.user_id}
                        value={teacher.user_id}
                      >
                        {teacher.full_name} - {teacher.email}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="kd-subjects__save"
                    disabled={
                      isBusy ||
                      !selectedTeacherId ||
                      unassignedTeachers.length === 0
                    }
                  >
                    <span className="material-symbols-outlined">
                      person_add
                    </span>

                    {isAssigning
                      ? "Đang phân công..."
                      : "Phân công"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}

      {/* ============================================= */}
      {/* [05.5] THỐNG KÊ MÔN HỌC */}
      {/* ============================================= */}

      <div className="kd-subjects__stats">
        <div className="kd-subjects__stat">
          <span>Tổng số môn</span>
          <strong>{statistics.total}</strong>
        </div>

        <div className="kd-subjects__stat">
          <span>Đang hoạt động</span>
          <strong>{statistics.active}</strong>
        </div>

        <div className="kd-subjects__stat">
          <span>Ngừng hoạt động</span>
          <strong>{statistics.inactive}</strong>
        </div>
      </div>

      {/* ============================================= */}
      {/* [05.6] TÌM KIẾM VÀ LỌC */}
      {/* ============================================= */}

      <div className="kd-subjects__toolbar">
        <div className="kd-subjects__search">
          <span className="material-symbols-outlined">
            search
          </span>

          <input
            type="search"
            value={keyword}
            onChange={(event) =>
              setKeyword(event.target.value)
            }
            placeholder="Tìm theo mã hoặc tên môn học..."
            aria-label="Tìm kiếm môn học"
          />
        </div>

        <select
          className="kd-subjects__filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as StatusFilter
            )
          }
          aria-label="Lọc trạng thái môn học"
        >
          <option value="ALL">
            Tất cả trạng thái
          </option>

          <option value="ACTIVE">
            Đang hoạt động
          </option>

          <option value="INACTIVE">
            Ngừng hoạt động
          </option>
        </select>
      </div>

      {/* ============================================= */}
      {/* [05.7] TRẠNG THÁI DANH SÁCH MÔN HỌC */}
      {/* ============================================= */}

      {error && (
        <div
          className="kd-subjects__error"
          role="alert"
        >
          <p>{error}</p>

          <button
            type="button"
            onClick={refreshSubjects}
          >
            Thử lại
          </button>
        </div>
      )}

      {isLoading && (
        <div
          className="kd-subjects__empty"
          role="status"
        >
          Đang tải danh sách môn học...
        </div>
      )}

      {!isLoading &&
        !error &&
        filteredSubjects.length === 0 && (
          <div className="kd-subjects__empty">
            <span className="material-symbols-outlined">
              menu_book
            </span>

            <h3>Không tìm thấy môn học</h3>

            <p>
              {subjects.length === 0
                ? isTeacher
                  ? "Bạn chưa được phân công môn học nào."
                  : "Hệ thống chưa có môn học."
                : "Không có môn học phù hợp với bộ lọc."}
            </p>
          </div>
        )}

      {/* ============================================= */}
      {/* [05.8] DANH SÁCH THẺ MÔN HỌC */}
      {/* ============================================= */}

      {!isLoading && !error && (
        <div className="kd-subjects__grid">
          {filteredSubjects.map((subject) => (
            <article
              key={subject.subject_id}
              className="kd-subjects__card"
            >
              {/* Biểu tượng và trạng thái */}
              <div className="kd-subjects__card-top">
                <div className="kd-subjects__icon">
                  <span className="material-symbols-outlined">
                    menu_book
                  </span>
                </div>

                <span
                  className={
                    "kd-subjects__status " +
                    (subject.status === "ACTIVE"
                      ? "kd-subjects__status--active"
                      : "kd-subjects__status--inactive")
                  }
                >
                  {subject.status === "ACTIVE"
                    ? "Đang hoạt động"
                    : "Ngừng hoạt động"}
                </span>
              </div>

              {/* Thông tin môn học */}
              <span className="kd-subjects__code">
                {subject.subject_code}
              </span>

              <h3>
                {subject.subject_name}
              </h3>

              <p className="kd-subjects__summary">
                {subject.description?.trim() ||
                  "Chưa có mô tả cho môn học này."}
              </p>

              {/* Chức năng theo vai trò */}
              <div className="kd-subjects__card-footer">
                <span>
                  Mã ID: {subject.subject_id}
                </span>

                {isTeacher && (
                  <span className="kd-subjects__assigned">
                    Môn phụ trách
                  </span>
                )}

                {/* ADMIN: Phân công và chỉnh sửa */}
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      className="kd-subjects__edit"
                      onClick={() =>
                        openTeacherPanel(subject)
                      }
                      disabled={isBusy}
                    >
                      <span className="material-symbols-outlined">
                        group_add
                      </span>

                      Phân công
                    </button>

                    <button
                      type="button"
                      className="kd-subjects__edit"
                      onClick={() =>
                        openEditForm(subject)
                      }
                      disabled={isBusy}
                    >
                      <span className="material-symbols-outlined">
                        edit
                      </span>

                      Chỉnh sửa
                    </button>
                  </>
                )}
              
              </div>

              {/* [05.9] TÀI LIỆU THUỘC MÔN HỌC */}
              <SubjectDocumentsWidget
                token={token}
                subjectId={subject.subject_id}
                subjectName={subject.subject_name}
              />
            </article>

          ))}
        </div>
      )}
    </section>
  );
}
