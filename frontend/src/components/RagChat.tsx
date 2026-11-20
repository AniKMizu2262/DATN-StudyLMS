
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
import "./RagChat.css";

// ======================================================
// KDOCUMENT - DAY 16
// Giao diện hội thoại AI
// Chỉ xử lý hiển thị và gọi API, không xử lý logic RAG.
// ======================================================

interface Citation {
  source_number: number;
  document_id: number;
  chunk_id: number;
  page_number: number | null;
  score: number;
}

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

interface ChatTurn {
  id: number;
  documentId: number;
  question: string;
  answer?: string;
  model?: string | null;
  citations?: Citation[];
  error?: string;
}

interface RagChatProps {
  token: string;
}

export default function RagChat({ token }: RagChatProps) {
  // [01] State giao diện
  const [documentId, setDocumentId] = useState("9");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // [02] Refs quản lý cuộn và tránh gửi trùng
  const messagesRef = useRef<HTMLDivElement>(null);
  const nextTurnId = useRef(1);
  const requestInProgress = useRef(false);

  const pendingTurnId = isSending
    ? turns[turns.length - 1]?.id
    : undefined;

  // [03] Tự cuộn xuống khi có tin nhắn hoặc trạng thái mới
  useEffect(() => {
    const element = messagesRef.current;

    if (element) {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [turns, isSending]);

  // [04] Gửi câu hỏi đến API RAG đang có
  const sendQuestion = async () => {
    if (requestInProgress.current) return;

    const cleanQuestion = question.trim();
    const parsedDocumentId = Number(documentId);

    if (
      !Number.isSafeInteger(parsedDocumentId) ||
      parsedDocumentId <= 0
    ) {
      setFormError("Vui lòng nhập mã tài liệu hợp lệ.");
      return;
    }

    if (!cleanQuestion) {
      setFormError("Vui lòng nhập câu hỏi trước khi gửi.");
      return;
    }

    if (cleanQuestion.length > 1000) {
      setFormError("Câu hỏi không được vượt quá 1000 ký tự.");
      return;
    }

    // Hiển thị câu hỏi ngay, không đợi API trả kết quả.
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

      if (!response.success || !response.data) {
        throw new Error(
          response.message || "Không nhận được câu trả lời."
        );
      }

      // Cập nhật câu trả lời vào đúng lượt hỏi.
      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                answer: response.data!.answer,
                model: response.data!.model,
                citations: response.data!.citations,
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
            ? { ...turn, error: errorMessage }
            : turn
        )
      );
    } finally {
      requestInProgress.current = false;
      setIsSending(false);
    }
  };

  // [05] Gửi bằng form
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion();
  };

  // [06] Enter gửi, Shift + Enter xuống dòng
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

  // [07] Sao chép câu trả lời
  const copyAnswer = async (turn: ChatTurn) => {
    if (!turn.answer) return;

    try {
      await navigator.clipboard.writeText(turn.answer);
      setCopiedId(turn.id);
    } catch {
      setFormError("Không thể sao chép câu trả lời.");
    }
  };

  // [08] Điền lại câu hỏi đã lỗi để gửi lại thủ công
  const prepareRetry = (turn: ChatTurn) => {
    setDocumentId(String(turn.documentId));
    setQuestion(turn.question);
    setFormError("");
  };

  return (
    <section className="kd-chat" aria-label="Kdocument AI">
      {/* Phần giới thiệu */}
      <header className="kd-chat__header">
        <div className="kd-chat__brand">
          <div className="kd-chat__brand-icon">✦</div>

          <div>
            <p className="kd-chat__eyebrow">TRỢ LÝ HỌC TẬP</p>
            <h2>Kdocument AI</h2>
            <p className="kd-chat__subtitle">
              Hỏi đáp dựa trên tài liệu học tập có nguồn tham khảo.
            </p>
          </div>
        </div>

        <span className="kd-chat__badge">RAG</span>
      </header>

      {/* Lịch sử chat tạm thời trong bộ nhớ */}
      <div className="kd-chat__messages" ref={messagesRef}>
        {turns.length === 0 && (
          <div className="kd-chat__empty">
            <div className="kd-chat__empty-icon">✦</div>
            <h3>Bạn muốn tìm hiểu điều gì?</h3>
            <p>
              Chọn mã tài liệu, nhập câu hỏi và Kdocument AI
              sẽ tìm nội dung liên quan để trả lời.
            </p>
          </div>
        )}

        {turns.map((turn) => (
          <div className="kd-chat__turn" key={turn.id}>
            {/* Tin nhắn của người dùng */}
            <div className="kd-chat__user-row">
              <div className="kd-chat__user-message">
                <span className="kd-chat__message-label">
                  Bạn · Tài liệu {turn.documentId}
                </span>
                <p>{turn.question}</p>
              </div>
            </div>

            {/* Tin nhắn trả lời của AI */}
            {turn.answer !== undefined && (
              <article className="kd-chat__assistant-message">
                <div className="kd-chat__assistant-name">
                  <span className="kd-chat__sparkle">✦</span>
                  Kdocument AI
                </div>

                <div className="kd-chat__markdown">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {turn.answer}
                  </Markdown>
                </div>

                {/* Nguồn do backend trả về.
                    Chưa giả lập liên kết PDF khi API chưa có. */}
                {turn.citations &&
                  turn.citations.length > 0 && (
                    <div className="kd-chat__sources">
                      <h4>Nguồn tham khảo</h4>

                      <div className="kd-chat__source-list">
                        {turn.citations.map((source, index) => (
                          <div
                            className="kd-chat__source"
                            key={`${source.chunk_id}-${index}`}
                          >
                            <span className="kd-chat__source-title">
                              [NGUỒN {source.source_number}]
                            </span>

                            <span>
                              Tài liệu {source.document_id}
                              {source.page_number != null
                                ? ` · Trang ${source.page_number}`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="kd-chat__answer-footer">
                  <span className="kd-chat__model">
                    {turn.model ? `Model: ${turn.model}` : ""}
                  </span>

                  <button
                    type="button"
                    className="kd-chat__copy-button"
                    onClick={() => void copyAnswer(turn)}
                  >
                    {copiedId === turn.id
                      ? "✓ Đã sao chép"
                      : "Sao chép"}
                  </button>
                </div>
              </article>
            )}

            {/* Hiệu ứng khi API đang xử lý */}
            {pendingTurnId === turn.id &&
              turn.answer === undefined &&
              !turn.error && (
                <div
                  className="kd-chat__thinking"
                  role="status"
                  aria-live="polite"
                >
                  <span className="kd-chat__sparkle">✦</span>
                  <span>Đang tìm thông tin trong tài liệu</span>

                  <span className="kd-chat__thinking-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}

            {/* Hiển thị lỗi ngay trong đúng lượt chat */}
            {turn.error && (
              <div className="kd-chat__error-message" role="alert">
                <p>{turn.error}</p>

                <button
                  type="button"
                  onClick={() => prepareRetry(turn)}
                >
                  Điền lại câu hỏi
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Khung soạn tin nhắn */}
      <form className="kd-chat__composer" onSubmit={handleSubmit}>
        <div className="kd-chat__document-field">
          <label htmlFor="kd-document-id">Mã tài liệu</label>

          <input
            id="kd-document-id"
            type="number"
            min="1"
            step="1"
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            disabled={isSending}
          />

          <span className="kd-chat__document-hint">
            Tạm dùng mã ID để kiểm thử
          </span>
        </div>

        <label className="kd-chat__question-label" htmlFor="kd-question">
          Câu hỏi của bạn
        </label>

        <textarea
          id="kd-question"
          rows={3}
          maxLength={1000}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ví dụ: Làm thế nào để truy cập tài liệu từ điện thoại?"
          disabled={isSending}
        />

        {formError && (
          <p className="kd-chat__form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="kd-chat__composer-footer">
          <div className="kd-chat__keyboard-hint">
            <span>{question.length}/1000 ký tự</span>
            <span>Enter để gửi · Shift + Enter xuống dòng</span>
          </div>

          <button
            className="kd-chat__send-button"
            type="submit"
            disabled={isSending || !question.trim()}
          >
            {isSending ? "Đang gửi..." : "Gửi câu hỏi"}
            <span aria-hidden="true">➤</span>
          </button>
        </div>

        <p className="kd-chat__disclaimer">
          Quyền truy cập tài liệu được kiểm tra trên backend.
          Câu trả lời AI cần được đối chiếu với nguồn khi cần thiết.
        </p>
      </form>
    </section>
  );
}
