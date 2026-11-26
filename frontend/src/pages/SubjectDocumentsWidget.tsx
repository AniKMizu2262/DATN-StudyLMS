
import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "./SubjectDocumentsWidget.css";

// ======================================================
// KDOCUMENT - TÀI LIỆU THEO MÔN HỌC
//
// [01] Định nghĩa dữ liệu
// [02] Tải tài liệu
// [03] Hiển thị danh sách
// ======================================================

interface DocumentItem {
  document_id: number;
  subject_id: number;
  title: string;
  file_type: string | null;
  visibility: string;
  status: string;
  review_status: string;
}

interface DocumentResponse {
  success: boolean;
  message?: string;
  data?: DocumentItem[];
}

interface Props {
  token: string;
  subjectId: number;
  subjectName: string;
}

export default function SubjectDocumentsWidget({
  token,
  subjectId,
  subjectName,
}: Props) {
  // [01] State.
  const [isOpen, setIsOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // [02] Chỉ gọi API khi người dùng mở danh sách.
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    const loadDocuments = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<DocumentResponse>(
          `/subjects/${subjectId}/documents`,
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
              "Không thể tải tài liệu."
          );
        }

        setDocuments(response.data);
      } catch (err) {
        if (controller.signal.aborted) return;

        setDocuments([]);

        setError(
          err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi tải tài liệu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadDocuments();

    return () => controller.abort();
  }, [isOpen, subjectId, token, reloadKey]);

  // [03] Hiển thị danh sách tài liệu.
  return (
    <div className="kd-subject-documents">
      <button
        type="button"
        className="kd-subject-documents__toggle"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined">
          {isOpen ? "expand_less" : "folder_open"}
        </span>

        {isOpen ? "Ẩn tài liệu" : "Xem tài liệu"}
      </button>

      {isOpen && (
        <div className="kd-subject-documents__panel">
          <div className="kd-subject-documents__header">
            <strong>Tài liệu môn học</strong>

            <span title={subjectName}>
              {subjectName}
            </span>
          </div>

          {isLoading && (
            <p className="kd-subject-documents__message">
              Đang tải tài liệu...
            </p>
          )}

          {error && (
            <div
              className="kd-subject-documents__message"
              role="alert"
            >
              <p>{error}</p>

              <button
                type="button"
                onClick={() =>
                  setReloadKey((current) => current + 1)
                }
              >
                Thử lại
              </button>
            </div>
          )}

          {!isLoading && !error && documents.length === 0 && (
            <div className="kd-subject-documents__empty">
              <span className="material-symbols-outlined">
                folder_off
              </span>

              <p>Chưa có tài liệu để hiển thị.</p>
            </div>
          )}

          {!isLoading && !error && documents.length > 0 && (
            <div className="kd-subject-documents__list">
              {documents.map((document) => (
                <div
                  key={document.document_id}
                  className="kd-subject-documents__item"
                >
                  <span className="material-symbols-outlined">
                    picture_as_pdf
                  </span>

                  <div className="kd-subject-documents__info">
                    <strong>{document.title}</strong>

                    <small>
                      ID: {document.document_id}
                    </small>

                    <div className="kd-subject-documents__tags">
                      <span>
                        {document.visibility === "PUBLIC"
                          ? "Công khai"
                          : document.visibility === "COURSE"
                            ? "Theo môn học"
                            : document.visibility}
                      </span>

                      <span>{document.status}</span>

                      <span>
                        {document.review_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
