
import { useState } from "react";
import { apiRequest } from "../services/api";
import "./SourcePreview.css";

// ======================================================
// KDOCUMENT - DAY 16
// CITATION VIEWER - XEM NGUỒN TRÍCH DẪN
// ======================================================

interface Citation {
  source_number: number;
  document_id: number;
  chunk_id: number;
  page_number: number | null;
}

interface SourceData {
  document_id: number;
  chunk_id: number;
  page_number: number | null;
  content: string;
}

interface SourceResponse {
  success: boolean;
  message?: string;
  data?: SourceData;
}

interface SourcePreviewProps {
  citation: Citation;
  token: string;
}

export default function SourcePreview({
  citation,
  token,
}: SourcePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<SourceData | null>(null);
  const [error, setError] = useState("");

  // [01] Mở hoặc đóng nội dung trích dẫn
  const handleToggle = async () => {
    if (isLoading) return;

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);

    // Đã tải rồi thì dùng dữ liệu cũ
    if (source) return;

    setIsLoading(true);
    setError("");

    try {
      // [02] Gọi API nguồn có xác thực JWT
      const response = await apiRequest<SourceResponse>(
        `/rag/sources/${citation.document_id}/${citation.chunk_id}`,
        {
          method: "GET",
          token,
        }
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.message || "Không thể tải nội dung nguồn."
        );
      }

      setSource(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tải nội dung nguồn."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="kd-source-preview">
      {/* [03] Dòng nguồn có thể bấm */}
      <button
        type="button"
        className="kd-source-preview__trigger"
        onClick={() => void handleToggle()}
        aria-expanded={isOpen}
        disabled={isLoading}
      >
        <span className="kd-source-preview__label">
          [NGUỒN {citation.source_number}]
        </span>

        <span className="kd-source-preview__meta">
          Tài liệu {citation.document_id}
          {citation.page_number != null
            ? ` · Trang ${citation.page_number}`
            : ""}
        </span>

        <span className="kd-source-preview__action">
          {isLoading
            ? "Đang tải..."
            : isOpen
              ? "Thu gọn ▲"
              : "Xem nguồn ▼"}
        </span>
      </button>

      {/* [04] Nội dung khi mở nguồn */}
      {isOpen && (
        <div className="kd-source-preview__body">
          {isLoading && (
            <p className="kd-source-preview__loading">
              Đang lấy nội dung gốc từ tài liệu...
            </p>
          )}

          {error && (
            <p className="kd-source-preview__error" role="alert">
              {error}
            </p>
          )}

          {source && (
            <>
              <div className="kd-source-preview__heading">
                <span>Đoạn văn bản gốc</span>

                <span>
                  Chunk #{source.chunk_id}
                </span>
              </div>

              <p className="kd-source-preview__content">
                {source.content}
              </p>

              <p className="kd-source-preview__note">
                Nội dung trích xuất từ PDF để đối chiếu
                với câu trả lời AI.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
