
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { apiRequest } from "../services/api";
import SourcePreview from "./SourcePreview";

import "./RagChat.css";

// ======================================================
// KDOCUMENT - RAG CHAT
// HỘI THOẠI AI + TRÍCH DẪN TƯƠNG TÁC
// ======================================================

// [01] THÔNG TIN NGUỒN TRÍCH DẪN
interface Citation {
  source_number: number;
  document_id: number;
  chunk_id: number;
  page_number: number | null;
  score: number;
}

// [02] DỮ LIỆU API RAG
interface RagResponse {
  success: boolean;
  message?: string;
  data?: {
    document_id: number;
    answer: string;
    model: string | null;
    citations: Citation[];
  };
}

// [03] MỘT LƯỢT HỘI THOẠI
interface ChatTurn {
  id: number;
  documentId: number;
  question: string;
  answer?: string;
  model?: string | null;
  citations?: Citation[];
  error?: string;
}

// [04] PROPS COMPONENT
interface RagChatProps {
  token: string;
}

// ======================================================
// [05] CHUYỂN NHÃN TRÍCH DẪN THÀNH MARKDOWN LINK
// Chỉ chuyển nguồn có thật trong dữ liệu backend.
// Không xử lý lại nhãn đã có liên kết Markdown.
// ======================================================

const linkifyCitations = (
  answer: string,
  citations: Citation[],
  turnId: number
): string => {
  const validSources = new Set(
    citations.map((citation) => citation.source_number)
  );

  return answer.replace(
    /\[NGUỒN\s+(\d+)\](?!\()/gi,
    (original, value: string) => {
      const sourceNumber = Number(value);

      if (!validSources.has(sourceNumber)) {
        return original;
      }

      const anchorId =
        `kd-source-${turnId}-${sourceNumber}`;

      return `[NGUỒN ${sourceNumber}](#${anchorId})`;
    }
  );
};

// ======================================================
// COMPONENT CHÍNH
// ======================================================

export default function RagChat({ token }: RagChatProps) {
  // ----------------------------------------------------
  // [06] QUẢN LÝ STATE
  // ----------------------------------------------------

  const [documentId, setDocumentId] = useState("9");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState("");

  const [copiedId, setCopiedId] = useState<number | null>(
    null
  );

  // ----------------------------------------------------
  // [07] REFS
  // ----------------------------------------------------

  const messagesRef = useRef<HTMLDivElement>(null);
  const nextTurnId = useRef(1);
  const requestInProgress = useRef(false);

  const pendingTurnId = isSending
    ? turns[turns.length - 1]?.id
    : undefined;

  // ----------------------------------------------------
  // [08] TỰ CUỘN KHI CÓ TIN NHẮN MỚI
  // ----------------------------------------------------

  useEffect(() => {
    const element = messagesRef.current;

    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, isSending]);

  // ----------------------------------------------------
  // [09] ĐIỀU HƯỚNG ĐẾN NGUỒN TRÍCH DẪN
  // ----------------------------------------------------

  const jumpToCitation = (anchorId: string) => {
    // [09.1] Tìm đúng khung nguồn theo ID.
    const target = document.getElementById(anchorId);

    if (!target) {
      console.warn(
        "[Kdocument] Không tìm thấy nguồn:",
        anchorId
      );
      return;
    }

    // [09.2] Tìm nút mở SourcePreview.
    const trigger =
      target.querySelector<HTMLButtonElement>(
        ".kd-source-preview__trigger"
      );

    // [09.3] Chỉ mở khi nguồn đang thu gọn.
    if (
      trigger &&
      trigger.getAttribute("aria-expanded") === "false" &&
      !trigger.disabled
    ) {
      trigger.click();
    }

    // [09.4] Cuộn tới đúng nguồn tương ứng.
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // [09.5] Xóa hiệu ứng cũ để có thể chạy lại.
    target.classList.remove(
      "kd-chat__source-highlight"
    );

    // [09.6] Khởi động lại CSS animation.
    void target.offsetWidth;

    // [09.7] Làm nổi bật nguồn vừa được chọn.
    target.classList.add(
      "kd-chat__source-highlight"
    );
  };

  // ----------------------------------------------------
  // [10] GỬI CÂU HỎI ĐẾN API RAG
  // ----------------------------------------------------

  const sendQuestion = async () => {
    // Tránh gửi hai request cùng lúc.
    if (requestInProgress.current) return;

    const cleanQuestion = question.trim();
    const parsedDocumentId = Number(documentId);

    // Kiểm tra mã tài liệu.
    if (
      !Number.isSafeInteger(parsedDocumentId) ||
      parsedDocumentId <= 0
    ) {
      setFormError("Vui lòng nhập mã tài liệu hợp lệ.");
      return;
    }

    // Kiểm tra câu hỏi.
    if (!cleanQuestion) {
      setFormError(
        "Vui lòng nhập câu hỏi trước khi gửi."
      );
      return;
    }

    if (cleanQuestion.length > 1000) {
      setFormError(
        "Câu hỏi không được vượt quá 1000 ký tự."
      );
      return;
    }

    // Tạo lượt chat và hiển thị câu hỏi ngay.
    const turnId = nextTurnId.current++;

    setTurns((previous) => [
      ...previous,
      {
        id: turnId,
        documentId: parsedDocumentId,
        question: cleanQuestion,
      },
    ]);

    setQuestion("");
    setFormError("");
    setIsSending(true);

    requestInProgress.current = true;

    try {
      // Gọi API RAG đang có.
      const response = await apiRequest<RagResponse>(
        "/rag/ask",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            document_id: parsedDocumentId,
            question: cleanQuestion,
          }),
        }
      );

      const result = response.data;

      if (!response.success || !result) {
        throw new Error(
          response.message ||
            "Không nhận được câu trả lời."
        );
      }

      // Gắn câu trả lời vào đúng lượt hỏi.
      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                answer: result.answer,
                model: result.model,
                citations: result.citations ?? [],
              }
            : turn
        )
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Không thể gửi câu hỏi. Vui lòng thử lại.";

      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                error: errorMessage,
              }
            : turn
        )
      );
    } finally {
      requestInProgress.current = false;
      setIsSending(false);
    }
  };

  // ----------------------------------------------------
  // [11] XỬ LÝ SUBMIT
  // ----------------------------------------------------

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    void sendQuestion();
  };

  // ----------------------------------------------------
  // [12] ENTER GỬI - SHIFT + ENTER XUỐNG DÒNG
  // ----------------------------------------------------

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendQuestion();
    }
  };

  // ----------------------------------------------------
  // [13] SAO CHÉP CÂU TRẢ LỜI
  // ----------------------------------------------------

  const copyAnswer = async (turn: ChatTurn) => {
    if (!turn.answer) return;

    try {
      await navigator.clipboard.writeText(turn.answer);
      setCopiedId(turn.id);
    } catch {
      setFormError(
        "Không thể sao chép câu trả lời."
      );
    }
  };

  // ----------------------------------------------------
  // [14] ĐIỀN LẠI CÂU HỎI KHI GẶP LỖI
  // ----------------------------------------------------

  const prepareRetry = (turn: ChatTurn) => {
    setDocumentId(String(turn.documentId));
    setQuestion(turn.question);
    setFormError("");
  };

  // ====================================================
  // [15] GIAO DIỆN
  // ====================================================

  return (
    <section
      className="kd-chat"
      aria-label="Kdocument AI"
    >
      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}

      <header className="kd-chat__header">
        <div className="kd-chat__brand">
          <div className="kd-chat__brand-icon">
            ✦
          </div>

          <div>
            <p className="kd-chat__eyebrow">
              TRỢ LÝ HỌC TẬP
            </p>

            <h2>Kdocument AI</h2>

            <p className="kd-chat__subtitle">
              Hỏi đáp dựa trên tài liệu học tập
              có nguồn tham khảo.
            </p>
          </div>
        </div>

        <span className="kd-chat__badge">
          RAG
        </span>
      </header>

      {/* ============================================= */}
      {/* DANH SÁCH HỘI THOẠI */}
      {/* ============================================= */}

      <div
        className="kd-chat__messages"
        ref={messagesRef}
      >
        {/* Chưa có tin nhắn */}

        {turns.length === 0 && (
          <div className="kd-chat__empty">
            <div className="kd-chat__empty-icon">
              ✦
            </div>

            <h3>
              Bạn muốn tìm hiểu điều gì?
            </h3>

            <p>
              Chọn mã tài liệu, nhập câu hỏi và
              Kdocument AI sẽ tìm nội dung liên quan
              để trả lời.
            </p>
          </div>
        )}

        {/* Danh sách các lượt hỏi đáp */}

        {turns.map((turn) => (
          <div
            className="kd-chat__turn"
            key={turn.id}
          >
            {/* ------------------------------------- */}
            {/* TIN NHẮN NGƯỜI DÙNG */}
            {/* ------------------------------------- */}

            <div className="kd-chat__user-row">
              <div className="kd-chat__user-message">
                <span className="kd-chat__message-label">
                  Bạn · Tài liệu {turn.documentId}
                </span>

                <p>{turn.question}</p>
              </div>
            </div>

            {/* ------------------------------------- */}
            {/* TIN NHẮN TRẢ LỜI AI */}
            {/* ------------------------------------- */}

            {turn.answer !== undefined && (
              <article className="kd-chat__assistant-message">
                <div className="kd-chat__assistant-name">
                  <span className="kd-chat__sparkle">
                    ✦
                  </span>

                  Kdocument AI
                </div>

                {/* --------------------------------- */}
                {/* MARKDOWN + LIÊN KẾT TRÍCH DẪN */}
                {/* --------------------------------- */}

                <div className="kd-chat__markdown">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => {
                        // Nhận dạng link nguồn nội bộ.
                        const match = href?.match(
                          /^#kd-source-(\d+)-(\d+)$/
                        );

                        if (match) {
                          const linkedTurnId = Number(
                            match[1]
                          );

                          const sourceNumber = Number(
                            match[2]
                          );

                          // Link phải thuộc đúng lượt
                          // và đúng nguồn backend trả về.
                          const isValidCitation =
                            linkedTurnId === turn.id &&
                            (turn.citations ?? []).some(
                              (citation) =>
                                citation.source_number ===
                                sourceNumber
                            );

                          if (isValidCitation) {
                            // Lấy anchor đã kiểm tra.
                            const anchorId =
                              match[0].slice(1);

                            return (
                              <a
                                href={match[0]}
                                className="kd-chat__citation-link"
                                onClick={(event) => {
                                  event.preventDefault();

                                  jumpToCitation(
                                    anchorId
                                  );
                                }}
                              >
                                {children}
                              </a>
                            );
                          }
                        }

                        // Link Markdown thông thường.
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {linkifyCitations(
                      turn.answer,
                      turn.citations ?? [],
                      turn.id
                    )}
                  </Markdown>
                </div>

                {/* --------------------------------- */}
                {/* DANH SÁCH NGUỒN THAM KHẢO */}
                {/* --------------------------------- */}

                {turn.citations &&
                  turn.citations.length > 0 && (
                    <div className="kd-chat__sources">
                      <h4>
                        Nguồn tham khảo
                      </h4>

                      <div className="kd-chat__source-list">
                        {turn.citations.map(
                          (source) => {
                            const anchorId =
                              `kd-source-${turn.id}-${source.source_number}`;

                            return (
                              <div
                                id={anchorId}
                                key={`${source.document_id}-${source.chunk_id}-${source.source_number}`}
                              >
                                <SourcePreview
                                  citation={source}
                                  token={token}
                                />
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                {/* --------------------------------- */}
                {/* MODEL + SAO CHÉP */}
                {/* --------------------------------- */}

                <div className="kd-chat__answer-footer">
                  <span className="kd-chat__model">
                    {turn.model
                      ? `Model: ${turn.model}`
                      : ""}
                  </span>

                  <button
                    type="button"
                    className="kd-chat__copy-button"
                    onClick={() =>
                      void copyAnswer(turn)
                    }
                  >
                    {copiedId === turn.id
                      ? "✓ Đã sao chép"
                      : "Sao chép"}
                  </button>
                </div>
              </article>
            )}

            {/* ------------------------------------- */}
            {/* AI ĐANG XỬ LÝ */}
            {/* ------------------------------------- */}

            {pendingTurnId === turn.id &&
              turn.answer === undefined &&
              !turn.error && (
                <div
                  className="kd-chat__thinking"
                  role="status"
                  aria-live="polite"
                >
                  <span className="kd-chat__sparkle">
                    ✦
                  </span>

                  <span>
                    Đang tìm thông tin trong tài liệu
                  </span>

                  <span className="kd-chat__thinking-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}

            {/* ------------------------------------- */}
            {/* THÔNG BÁO LỖI */}
            {/* ------------------------------------- */}

            {turn.error && (
              <div
                className="kd-chat__error-message"
                role="alert"
              >
                <p>{turn.error}</p>

                <button
                  type="button"
                  onClick={() =>
                    prepareRetry(turn)
                  }
                >
                  Điền lại câu hỏi
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ============================================= */}
      {/* KHUNG NHẬP CÂU HỎI */}
      {/* ============================================= */}

      <form
        className="kd-chat__composer"
        onSubmit={handleSubmit}
      >
        {/* Mã tài liệu */}

        <div className="kd-chat__document-field">
          <label htmlFor="kd-document-id">
            Mã tài liệu
          </label>

          <input
            id="kd-document-id"
            type="number"
            min="1"
            step="1"
            value={documentId}
            onChange={(event) =>
              setDocumentId(event.target.value)
            }
            disabled={isSending}
          />

          <span className="kd-chat__document-hint">
            Tạm dùng mã ID để kiểm thử
          </span>
        </div>

        {/* Câu hỏi */}

        <label
          className="kd-chat__question-label"
          htmlFor="kd-question"
        >
          Câu hỏi của bạn
        </label>

        <textarea
          id="kd-question"
          rows={3}
          maxLength={1000}
          value={question}
          onChange={(event) =>
            setQuestion(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Ví dụ: Làm thế nào để truy cập tài liệu từ điện thoại?"
          disabled={isSending}
        />

        {/* Lỗi form */}

        {formError && (
          <p
            className="kd-chat__form-error"
            role="alert"
          >
            {formError}
          </p>
        )}

        {/* Nút gửi */}

        <div className="kd-chat__composer-footer">
          <div className="kd-chat__keyboard-hint">
            <span>
              {question.length}/1000 ký tự
            </span>

            <span>
              Enter để gửi · Shift + Enter xuống dòng
            </span>
          </div>

          <button
            className="kd-chat__send-button"
            type="submit"
            disabled={
              isSending ||
              !question.trim()
            }
          >
            {isSending
              ? "Đang gửi..."
              : "Gửi câu hỏi"}

            <span aria-hidden="true">
              ➤
            </span>
          </button>
        </div>

        {/* Lưu ý */}

        <p className="kd-chat__disclaimer">
          Quyền truy cập tài liệu được kiểm tra
          trên backend. Câu trả lời AI cần được
          đối chiếu với nguồn khi cần thiết.
        </p>
      </form>
    </section>
  );
}
