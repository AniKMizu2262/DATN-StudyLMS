
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { apiRequest } from "../services/api";

import "./SourcePreview.css";

// ======================================================
// KDOCUMENT - CITATION VIEWER + PDF VIEWER
// XEM CHUNK GỐC VÀ MỞ PDF TẠI TRANG TRÍCH DẪN
// ======================================================

// [01] Thông tin trích dẫn từ RAG
interface Citation {
  source_number: number;
  document_id: number;
  chunk_id: number;
  page_number: number | null;
}

// [02] Nội dung chunk từ backend
interface SourceData {
  document_id: number;
  chunk_id: number;
  page_number: number | null;
  content: string;
}

// [03] Response API nguồn
interface SourceResponse {
  success: boolean;
  message?: string;
  data?: SourceData;
}

// [04] Props component
interface SourcePreviewProps {
  citation: Citation;
  token: string;
}

// ======================================================
// COMPONENT
// ======================================================

export default function SourcePreview({
  citation,
  token,
}: SourcePreviewProps) {
  // ----------------------------------------------------
  // [05] STATE XEM NGUỒN
  // ----------------------------------------------------

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [source, setSource] = useState<SourceData | null>(
    null
  );

  const [error, setError] = useState("");

  // ----------------------------------------------------
  // [06] STATE XEM PDF
  // ----------------------------------------------------

  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const [pdfUrl, setPdfUrl] = useState<string | null>(
    null
  );

  const [pdfError, setPdfError] = useState("");

  // Quản lý request để có thể hủy khi đóng.
  const pdfRequestRef = useRef<AbortController | null>(
    null
  );

  // Trang PDF mà nguồn đang tham chiếu.
  const pageCandidate =
    source?.page_number ?? citation.page_number;

  const targetPage =
    pageCandidate != null &&
    Number.isSafeInteger(pageCandidate) &&
    pageCandidate > 0
      ? pageCandidate
      : 1;

  // ----------------------------------------------------
  // [07] DỌN REQUEST KHI COMPONENT UNMOUNT
  // ----------------------------------------------------

  useEffect(() => {
    return () => {
      pdfRequestRef.current?.abort();
    };
  }, []);

  // ----------------------------------------------------
  // [08] GIẢI PHÓNG BLOB URL KHI ĐÓNG PDF
  // ----------------------------------------------------

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // ----------------------------------------------------
  // [09] MỞ / ĐÓNG NỘI DUNG CHUNK
  // ----------------------------------------------------

  const handleToggle = async () => {
    if (isLoading) return;

    // Đóng nguồn và PDF nếu đang mở.
    if (isOpen) {
      pdfRequestRef.current?.abort();
      pdfRequestRef.current = null;

      setIsPdfLoading(false);
      setIsPdfOpen(false);
      setPdfUrl(null);
      setPdfError("");
      setIsOpen(false);

      return;
    }

    setIsOpen(true);

    // Đã có dữ liệu thì không gọi lại API.
    if (source) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest<SourceResponse>(
        `/rag/sources/${citation.document_id}/${citation.chunk_id}`,
        {
          method: "GET",
          token,
        }
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.message ||
            "Không thể tải nội dung nguồn."
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

  // ----------------------------------------------------
  // [10] MỞ / ĐÓNG PDF
  // ----------------------------------------------------

  const handlePdfToggle = async () => {
    if (isPdfLoading) return;

    // Đang mở PDF thì đóng và giải phóng Blob.
    if (isPdfOpen) {
      setIsPdfOpen(false);
      setPdfUrl(null);
      setPdfError("");

      return;
    }

    // Không mở PDF khi chưa lấy được nguồn.
    if (!source) return;

    setIsPdfLoading(true);
    setPdfError("");

    const controller = new AbortController();

    pdfRequestRef.current = controller;

    try {
      // ----------------------------------------------
      // [11] LẤY PDF BẰNG JWT
      // ----------------------------------------------

      const response = await fetch(
        `/api/documents/${citation.document_id}/download`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        }
      );

      // ----------------------------------------------
      // [12] XỬ LÝ LỖI HTTP
      // ----------------------------------------------

      if (!response.ok) {
        let errorMessage =
          `Không thể mở PDF (HTTP ${response.status}).`;

        try {
          const errorData = (await response.json()) as {
            message?: string;
            error?: string;
          };

          errorMessage =
            errorData.message ||
            errorData.error ||
            errorMessage;
        } catch {
          // Backend không trả JSON lỗi.
        }

        throw new Error(errorMessage);
      }

      // ----------------------------------------------
      // [13] ĐỌC FILE PDF
      // ----------------------------------------------

      const pdfBlob = await response.blob();

      if (pdfBlob.size === 0) {
        throw new Error(
          "File PDF trả về không có nội dung."
        );
      }

      // Ngăn hiển thị HTML hoặc JSON như PDF.
      if (
        pdfBlob.type &&
        !pdfBlob.type.includes("pdf") &&
        pdfBlob.type !== "application/octet-stream"
      ) {
        throw new Error(
          "Backend không trả về định dạng PDF."
        );
      }

      // Request đã hủy thì không tạo Blob URL.
      if (controller.signal.aborted) return;

      // ----------------------------------------------
      // [14] TẠO BLOB URL ĐỂ HIỂN THỊ PDF
      // ----------------------------------------------

      const objectUrl = URL.createObjectURL(pdfBlob);

      if (controller.signal.aborted) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setPdfUrl(objectUrl);
      setIsPdfOpen(true);
    } catch (err) {
      // Request bị hủy khi đóng nguồn.
      if (controller.signal.aborted) return;

      setPdfError(
        err instanceof Error
          ? err.message
          : "Không thể tải file PDF."
      );
    } finally {
      if (pdfRequestRef.current === controller) {
        pdfRequestRef.current = null;
        setIsPdfLoading(false);
      }
    }
  };

  // ----------------------------------------------------
  // [15] URL PDF VỚI TRANG TRÍCH DẪN
  // ----------------------------------------------------

  const pdfPageUrl = pdfUrl
    ? `${pdfUrl}#page=${targetPage}`
    : null;

  // ====================================================
  // [16] GIAO DIỆN
  // ====================================================

  return (
    <div className="kd-source-preview">
      {/* ============================================= */}
      {/* NÚT MỞ / ĐÓNG NGUỒN */}
      {/* ============================================= */}

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

      {/* ============================================= */}
      {/* NỘI DUNG NGUỒN */}
      {/* ============================================= */}

      {isOpen && (
        <div className="kd-source-preview__body">
          {/* Trạng thái đang tải nguồn */}

          {isLoading && (
            <p className="kd-source-preview__loading">
              Đang lấy nội dung gốc từ tài liệu...
            </p>
          )}

          {/* Lỗi tải nguồn */}

          {error && (
            <p
              className="kd-source-preview__error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* ======================================= */}
          {/* NỘI DUNG CHUNK GỐC */}
          {/* ======================================= */}

          {source && (
            <>
              <div className="kd-source-preview__heading">
                <span>
                  Đoạn văn bản gốc
                </span>

                <span>
                  Chunk #{source.chunk_id}
                </span>
              </div>

              
{/* Giữ xuống dòng, khoảng cách và cấu trúc văn bản gốc */}
<div
  className="kd-source-preview__content"
  style={{
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    tabSize: 4,
  }}
>
  {source.content}
</div>

              <p className="kd-source-preview__note">
                Nội dung trích xuất từ PDF để đối
                chiếu với câu trả lời AI.
              </p>

              {/* =================================== */}
              {/* THANH CÔNG CỤ PDF */}
              {/* =================================== */}

              <div className="kd-source-preview__toolbar">
                <button
                  type="button"
                  className="kd-source-preview__pdf-button"
                  onClick={() => void handlePdfToggle()}
                  disabled={isPdfLoading}
                  aria-expanded={isPdfOpen}
                >
                  {isPdfLoading
                    ? "Đang tải PDF..."
                    : isPdfOpen
                      ? "Đóng PDF ▲"
                      : `Mở PDF tại trang ${targetPage} ↗`}
                </button>

                {/* Mở Blob PDF ở tab riêng */}
                {isPdfOpen && pdfPageUrl && (
                  <a
                    className="kd-source-preview__pdf-link"
                    href={pdfPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Xem trong tab mới ↗
                  </a>
                )}
              </div>

              {/* =================================== */}
              {/* LỖI PDF */}
              {/* =================================== */}

              {pdfError && (
                <p
                  className="kd-source-preview__error"
                  role="alert"
                >
                  {pdfError}
                </p>
              )}

              {/* =================================== */}
              {/* KHUNG XEM PDF */}
              {/* =================================== */}

              {isPdfOpen && pdfPageUrl && (
                <div className="kd-source-preview__pdf-section">
                  <div className="kd-source-preview__pdf-header">
                    <span>
                      PDF · Tài liệu {citation.document_id}
                    </span>

                    <span>
                      Trang {targetPage}
                    </span>
                  </div>

                  <iframe
                    className="kd-source-preview__pdf-frame"
                    src={pdfPageUrl}
                    title={`PDF tài liệu ${citation.document_id}, trang ${targetPage}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />

                  <p className="kd-source-preview__pdf-note">
                    Đang hiển thị file PDF gốc.
                    Khả năng chuyển tới đúng trang
                    phụ thuộc trình xem PDF của
                    trình duyệt.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
