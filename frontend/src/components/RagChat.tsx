
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
// KDOCUMENT - DAY 16
// GIAO DIỆN HỘI THOẠI AI + CITATION VIEWER
// ======================================================

// [01] Thông tin nguồn trích dẫn
interface Citation {
  source_number: number;
  document_id: number;
  chunk_id: number;
  page_number: number | null;
  score: number;
}

// [02] Dữ liệu phản hồi từ RAG API
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

// [03] Một lượt hỏi đáp trong giao diện
interface ChatTurn {
  id: number;
  documentId: number;
  question: string;
  answer?: string;
  model?: string | null;
  citations?: Citation[];
  error?: string;
}

// [04] Props của RagChat
interface RagChatProps {
  token: string;
}

// ======================================================
// COMPONENT CHÍNH
// ======================================================

export default function RagChat({ token }: RagChatProps) {
  // ----------------------------------------------------
  // [05] QUẢN LÝ STATE
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
  // [06] REFS
  // ----------------------------------------------------

  const messagesRef = useRef<HTMLDivElement>(null);

  const nextTurnId = useRef(1);

  const requestInProgress = useRef(false);

  const pendingTurnId = isSending
    ? turns[turns.length - 1]?.id
    : undefined;

  // ----------------------------------------------------
  // [07] TỰ CUỘN XUỐNG KHI CÓ TIN NHẮN
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
  // [08] GỬI CÂU HỎI ĐẾN BACKEND RAG
  // ----------------------------------------------------

  const sendQuestion = async () => {
    // Không cho gửi nhiều request cùng lúc
    if (requestInProgress.current) return;

    const cleanQuestion = question.trim();
    const parsedDocumentId = Number(documentId);

    // Kiểm tra mã tài liệu
    if (
      !Number.isSafeInteger(parsedDocumentId) ||
      parsedDocumentId <= 0
    ) {
      setFormError("Vui lòng nhập mã tài liệu hợp lệ.");
      return;
    }

    // Kiểm tra câu hỏi rỗng
    if (!cleanQuestion) {
      setFormError(
        "Vui lòng nhập câu hỏi trước khi gửi."
      );
      return;
    }

    // Giới hạn độ dài câu hỏi
    if (cleanQuestion.length > 1000) {
      setFormError(
        "Câu hỏi không được vượt quá 1000 ký tự."
      );
      return;
    }

    // Tạo ID cho lượt hỏi đáp
    const turnId = nextTurnId.current++;

    // Hiển thị câu hỏi ngay lập tức
    setTurns((previous) => [
      ...previous,
      {
        id: turnId,
        documentId: parsedDocumentId,
        question: cleanQuestion,
      },
    ]);

    // Reset form
    setQuestion("");
    setFormError("");
    setIsSending(true);

    requestInProgress.current = true;

    try {
      // Gửi request tới API RAG
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

      // Kiểm tra phản hồi
      if (!response.success || !result) {
        throw new Error(
          response.message ||
            "Không nhận được câu trả lời."
        );
      }

      // Cập nhật câu trả lời vào đúng lượt chat
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

      // Hiển thị lỗi trong lượt chat tương ứng
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
  // [09] XỬ LÝ SUBMIT FORM
  // ----------------------------------------------------

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    void sendQuestion();
  };

  // ----------------------------------------------------
  // [10] ENTER ĐỂ GỬI
  // SHIFT + ENTER ĐỂ XUỐNG DÒNG
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
  // [11] SAO CHÉP CÂU TRẢ LỜI AI
  // ----------------------------------------------------

  const copyAnswer = async (turn: ChatTurn) => {
    if (!turn.answer) return;

    try {
      await navigator.clipboard.writeText(
        turn.answer
      );

      setCopiedId(turn.id);
    } catch {
      setFormError(
        "Không thể sao chép câu trả lời."
      );
    }
  };

  // ----------------------------------------------------
  // [12] ĐIỀN LẠI CÂU HỎI KHI GẶP LỖI
  // ----------------------------------------------------

  const prepareRetry = (turn: ChatTurn) => {
    setDocumentId(String(turn.documentId));
    setQuestion(turn.question);
    setFormError("");
  };

  // ====================================================
  // [13] GIAO DIỆN
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
        {/* Giao diện khi chưa có tin nhắn */}

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

        {/* Hiển thị từng lượt hội thoại */}

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
            {/* TIN NHẮN AI */}
            {/* ------------------------------------- */}

            {turn.answer !== undefined && (
              <article className="kd-chat__assistant-message">
                <div className="kd-chat__assistant-name">
                  <span className="kd-chat__sparkle">
                    ✦
                  </span>

                  Kdocument AI
                </div>

                {/* Hiển thị Markdown */}

                <div className="kd-chat__markdown">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                  >
                    {turn.answer}
                  </Markdown>
                </div>

                {/* --------------------------------- */}
                {/* CITATION VIEWER - DAY 16 */}
                {/* --------------------------------- */}

                {turn.citations &&
                  turn.citations.length > 0 && (
                    <div className="kd-chat__sources">
                      <h4>
                        Nguồn tham khảo
                      </h4>

                      <div className="kd-chat__source-list">
                        {turn.citations.map(
                          (source, index) => (
                            <SourcePreview
                              key={`${source.document_id}-${source.chunk_id}-${index}`}
                              citation={source}
                              token={token}
                            />
                          )
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
            {/* TRẠNG THÁI AI ĐANG XỬ LÝ */}
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
            {/* HIỂN THỊ LỖI */}
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
      {/* KHUNG SOẠN CÂU HỎI */}
      {/* ============================================= */}

      <form
        className="kd-chat__composer"
        onSubmit={handleSubmit}
      >
        {/* ----------------------------------------- */}
        {/* MÃ TÀI LIỆU */}
        {/* ----------------------------------------- */}

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

        {/* ----------------------------------------- */}
        {/* NHẬP CÂU HỎI */}
        {/* ----------------------------------------- */}

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

        {/* Lỗi nhập liệu */}

        {formError && (
          <p
            className="kd-chat__form-error"
            role="alert"
          >
            {formError}
          </p>
        )}

        {/* ----------------------------------------- */}
        {/* NÚT GỬI */}
        {/* ----------------------------------------- */}

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

        {/* ----------------------------------------- */}
        {/* LƯU Ý */}
        {/* ----------------------------------------- */}

        <p className="kd-chat__disclaimer">
          Quyền truy cập tài liệu được kiểm tra
          trên backend. Câu trả lời AI cần được
          đối chiếu với nguồn khi cần thiết.
        </p>
      </form>
    </section>
  );
}
