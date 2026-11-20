
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
// KDOCUMENT - DAY 17
// RAG CHAT + CITATION VIEWER + CHAT HISTORY
// ======================================================

// [01] KIỂU DỮ LIỆU TRÍCH DẪN
interface Citation {
  source_number: number;
  document_id: number;
  chunk_id: number;
  page_number: number | null;
  score?: number;
}

// [02] PHẢN HỒI API HỎI ĐÁP
interface RagResponse {
  success: boolean;
  message?: string;
  data?: {
    session_id: number;
    document_id: number;
    answer: string;
    model: string | null;
    citations: Citation[];
  };
}

// [03] PHIÊN HỘI THOẠI
interface ChatSession {
  session_id: number;
  subject_id: number | null;
  title: string;
  created_at: string;
  updated_at: string;
}

// [04] TIN NHẮN LƯU TRONG MYSQL
interface HistoryMessage {
  message_id: number;
  sender_type: "USER" | "ASSISTANT";
  content: string;
  document_id: number | null;
  model: string | null;
  citations: Citation[];
  restricted: boolean;
  created_at: string;
}

// [05] PHẢN HỒI DANH SÁCH PHIÊN
interface SessionListResponse {
  success: boolean;
  message?: string;
  data?: ChatSession[];
}

// [06] PHẢN HỒI CHI TIẾT PHIÊN
interface SessionDetailsResponse {
  success: boolean;
  message?: string;
  data?: {
    session: ChatSession;
    messages: HistoryMessage[];
  };
}

// [07] MỘT LƯỢT HỎI ĐÁP TRÊN GIAO DIỆN
interface ChatTurn {
  id: number;
  documentId: number | null;
  question: string;
  answer?: string;
  model?: string | null;
  citations?: Citation[];
  error?: string;
}

// [08] PROPS
interface RagChatProps {
  token: string;
}

// ======================================================
// [09] CHUYỂN NHÃN NGUỒN THÀNH MARKDOWN LINK
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
// [10] KHÔI PHỤC CÁC LƯỢT CHAT TỪ MYSQL
// Ghép USER và ASSISTANT thành một ChatTurn.
// ======================================================

const restoreChatTurns = (
  messages: HistoryMessage[]
): ChatTurn[] => {
  const restored: ChatTurn[] = [];
  let nextId = 1;

  for (const message of messages) {
    if (message.sender_type === "USER") {
      restored.push({
        id: nextId++,
        documentId: message.document_id,
        question: message.content,
      });

      continue;
    }

    if (message.sender_type !== "ASSISTANT") {
      continue;
    }

    const lastTurn = restored[restored.length - 1];

    const citations =
      !message.restricted &&
      Array.isArray(message.citations)
        ? message.citations
        : [];

    if (lastTurn && lastTurn.answer === undefined) {
      lastTurn.answer = message.content;
      lastTurn.model = message.model;
      lastTurn.citations = citations;
    } else {
      // Dự phòng nếu dữ liệu cũ thiếu tin USER.
      restored.push({
        id: nextId++,
        documentId: message.document_id,
        question: "Câu hỏi không có trong lịch sử.",
        answer: message.content,
        model: message.model,
        citations,
      });
    }
  }

  return restored;
};

// ======================================================
// COMPONENT CHÍNH
// ======================================================

export default function RagChat({ token }: RagChatProps) {
  // ----------------------------------------------------
  // [11] STATE GIAO DIỆN CHAT
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
  // [12] STATE LỊCH SỬ HỘI THOẠI
  // ----------------------------------------------------

  const [sessions, setSessions] = useState<ChatSession[]>(
    []
  );

  const [activeSessionId, setActiveSessionId] = useState<
    number | null
  >(null);

  const [isHistoryLoading, setIsHistoryLoading] =
    useState(true);

  const [isSessionLoading, setIsSessionLoading] =
    useState(false);

  const [historyError, setHistoryError] = useState("");

  // ----------------------------------------------------
  // [13] REFS
  // ----------------------------------------------------

  const messagesRef = useRef<HTMLDivElement>(null);
  const nextTurnId = useRef(1);
  const requestInProgress = useRef(false);

  // Hủy request đọc phiên cũ khi đổi phiên.
  const sessionRequestRef =
    useRef<AbortController | null>(null);

  // Ngăn response của tài khoản cũ cập nhật UI.
  const generationRef = useRef(0);

  const pendingTurnId = isSending
    ? turns[turns.length - 1]?.id
    : undefined;

  const isNavigationDisabled =
    isSending || isHistoryLoading || isSessionLoading;

  // ----------------------------------------------------
  // [14] TỰ CUỘN KHI CÓ TIN NHẮN MỚI
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
  // [15] TẢI DANH SÁCH PHIÊN VÀ PHIÊN GẦN NHẤT
  // Chạy khi mở trang hoặc token thay đổi.
  // ----------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++generationRef.current;

    const initializeHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryError("");
      setSessions([]);
      setTurns([]);
      setActiveSessionId(null);
      setQuestion("");
      setCopiedId(null);

      nextTurnId.current = 1;

      // Hủy request đọc phiên còn tồn tại.
      sessionRequestRef.current?.abort();
      sessionRequestRef.current = null;

      try {
        // [15.1] Lấy danh sách phiên.
        const response =
          await apiRequest<SessionListResponse>(
            "/chat/sessions",
            {
              method: "GET",
              token,
              signal: controller.signal,
            }
          );

        if (
          controller.signal.aborted ||
          generation !== generationRef.current
        ) {
          return;
        }

        if (!response.success || !response.data) {
          throw new Error(
            response.message ||
              "Không thể tải lịch sử hội thoại."
          );
        }

        const sessionList = response.data;
        setSessions(sessionList);

        // [15.2] Không có phiên thì hiện chat trống.
        if (sessionList.length === 0) {
          return;
        }

        // [15.3] Mở phiên mới hoạt động gần nhất.
        const latestSession = sessionList[0];

        const detail =
          await apiRequest<SessionDetailsResponse>(
            `/chat/sessions/${latestSession.session_id}`,
            {
              method: "GET",
              token,
              signal: controller.signal,
            }
          );

        if (
          controller.signal.aborted ||
          generation !== generationRef.current
        ) {
          return;
        }

        if (!detail.success || !detail.data) {
          throw new Error(
            detail.message ||
              "Không thể tải phiên hội thoại."
          );
        }

        const restored = restoreChatTurns(
          detail.data.messages
        );

        nextTurnId.current = restored.length + 1;

        setTurns(restored);
        setActiveSessionId(latestSession.session_id);

        // Khôi phục mã tài liệu từ lượt hỏi gần nhất.
        const lastDocumentId = [...restored]
          .reverse()
          .find(
            (turn) =>
              turn.documentId !== null &&
              turn.documentId > 0
          )?.documentId;

        if (lastDocumentId) {
          setDocumentId(String(lastDocumentId));
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (generation !== generationRef.current) {
          return;
        }

        setHistoryError(
          error instanceof Error
            ? error.message
            : "Không thể tải lịch sử hội thoại."
        );
      } finally {
        if (
          !controller.signal.aborted &&
          generation === generationRef.current
        ) {
          setIsHistoryLoading(false);
        }
      }
    };

    void initializeHistory();

    return () => {
      generationRef.current++;
      controller.abort();
    };
  }, [token]);

  // ----------------------------------------------------
  // [16] LÀM MỚI DANH SÁCH PHIÊN
  // ----------------------------------------------------

  const refreshSessions = async () => {
    const response =
      await apiRequest<SessionListResponse>(
        "/chat/sessions",
        {
          method: "GET",
          token,
        }
      );

    if (!response.success || !response.data) {
      throw new Error(
        response.message ||
          "Không thể cập nhật danh sách hội thoại."
      );
    }

    setSessions(response.data);
  };

  // ----------------------------------------------------
  // [17] CHỌN MỘT PHIÊN HỘI THOẠI
  // ----------------------------------------------------

  const openSession = async (sessionId: number) => {
    if (isNavigationDisabled) return;

    if (activeSessionId === sessionId) return;

    sessionRequestRef.current?.abort();

    const controller = new AbortController();
    sessionRequestRef.current = controller;

    const generation = generationRef.current;

    setIsSessionLoading(true);
    setHistoryError("");
    setActiveSessionId(sessionId);
    setTurns([]);
    setQuestion("");

    try {
      const response =
        await apiRequest<SessionDetailsResponse>(
          `/chat/sessions/${sessionId}`,
          {
            method: "GET",
            token,
            signal: controller.signal,
          }
        );

      if (
        controller.signal.aborted ||
        generation !== generationRef.current
      ) {
        return;
      }

      if (!response.success || !response.data) {
        throw new Error(
          response.message ||
            "Không thể mở cuộc hội thoại."
        );
      }

      const restored = restoreChatTurns(
        response.data.messages
      );

      nextTurnId.current = restored.length + 1;

      setTurns(restored);

      const lastDocumentId = [...restored]
        .reverse()
        .find(
          (turn) =>
            turn.documentId !== null &&
            turn.documentId > 0
        )?.documentId;

      if (lastDocumentId) {
        setDocumentId(String(lastDocumentId));
      }
    } catch (error) {
      if (controller.signal.aborted) return;

      setHistoryError(
        error instanceof Error
          ? error.message
          : "Không thể mở cuộc hội thoại."
      );
    } finally {
      if (sessionRequestRef.current === controller) {
        sessionRequestRef.current = null;
        setIsSessionLoading(false);
      }
    }
  };

  // ----------------------------------------------------
  // [18] BẮT ĐẦU CUỘC HỘI THOẠI MỚI
  // Phiên MySQL sẽ được tạo khi RAG trả lời thành công.
  // ----------------------------------------------------

  const startNewChat = () => {
    if (isNavigationDisabled) return;

    sessionRequestRef.current?.abort();
    sessionRequestRef.current = null;

    setActiveSessionId(null);
    setTurns([]);
    setQuestion("");
    setFormError("");
    setHistoryError("");
    setCopiedId(null);

    nextTurnId.current = 1;
  };

  // ----------------------------------------------------
  // [19] NHẢY ĐẾN NGUỒN TRÍCH DẪN
  // ----------------------------------------------------

  const jumpToCitation = (anchorId: string) => {
    const target = document.getElementById(anchorId);

    if (!target) return;

    const trigger =
      target.querySelector<HTMLButtonElement>(
        ".kd-source-preview__trigger"
      );

    // Mở chunk nếu nguồn đang thu gọn.
    if (
      trigger &&
      trigger.getAttribute("aria-expanded") === "false" &&
      !trigger.disabled
    ) {
      trigger.click();
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Kích hoạt lại hiệu ứng viền tím.
    target.classList.remove(
      "kd-chat__source-highlight"
    );

    void target.offsetWidth;

    target.classList.add(
      "kd-chat__source-highlight"
    );
  };

  // ----------------------------------------------------
  // [20] GỬI CÂU HỎI VÀ LƯU VÀO ĐÚNG PHIÊN
  // ----------------------------------------------------

  const sendQuestion = async () => {
    if (requestInProgress.current) return;

    if (isHistoryLoading || isSessionLoading) return;

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
      setFormError("Vui lòng nhập câu hỏi.");
      return;
    }

    if (cleanQuestion.length > 1000) {
      setFormError(
        "Câu hỏi không được vượt quá 1000 ký tự."
      );
      return;
    }

    const turnId = nextTurnId.current++;
    const generation = generationRef.current;

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
      // [20.1] Gửi session_id nếu đang hỏi tiếp.
      const requestBody = {
        document_id: parsedDocumentId,
        question: cleanQuestion,
        ...(activeSessionId !== null
          ? { session_id: activeSessionId }
          : {}),
      };

      const response = await apiRequest<RagResponse>(
        "/rag/ask",
        {
          method: "POST",
          token,
          body: JSON.stringify(requestBody),
        }
      );

      if (generation !== generationRef.current) {
        return;
      }

      const result = response.data;

      if (
        !response.success ||
        !result ||
        !Number.isSafeInteger(result.session_id) ||
        result.session_id <= 0
      ) {
        throw new Error(
          response.message ||
            "Không nhận được kết quả lưu hội thoại."
        );
      }

      // [20.2] Gắn câu trả lời vào lượt hiện tại.
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

      // [20.3] Ghi nhận phiên MySQL vừa tạo/cập nhật.
      setActiveSessionId(result.session_id);

      // [20.4] Tải lại danh sách sidebar.
      // Nếu tải danh sách lỗi vẫn giữ câu trả lời.
      try {
        await refreshSessions();
      } catch {
        if (generation === generationRef.current) {
          setHistoryError(
            "Đã lưu câu trả lời nhưng chưa cập nhật " +
              "được danh sách hội thoại."
          );
        }
      }
    } catch (error) {
      if (generation !== generationRef.current) {
        return;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Không thể gửi câu hỏi.";

      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === turnId
            ? { ...turn, error: errorMessage }
            : turn
        )
      );
    } finally {
      requestInProgress.current = false;

      if (generation === generationRef.current) {
        setIsSending(false);
      }
    }
  };

  // ----------------------------------------------------
  // [21] FORM VÀ BÀN PHÍM
  // ----------------------------------------------------

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    void sendQuestion();
  };

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
  // [22] SAO CHÉP CÂU TRẢ LỜI
  // ----------------------------------------------------

  const copyAnswer = async (turn: ChatTurn) => {
    if (!turn.answer) return;

    try {
      await navigator.clipboard.writeText(turn.answer);
      setCopiedId(turn.id);
    } catch {
      setFormError("Không thể sao chép câu trả lời.");
    }
  };

  // ----------------------------------------------------
  // [23] ĐIỀN LẠI CÂU HỎI BỊ LỖI
  // ----------------------------------------------------

  const prepareRetry = (turn: ChatTurn) => {
    if (turn.documentId !== null) {
      setDocumentId(String(turn.documentId));
    }

    setQuestion(turn.question);
    setFormError("");
  };

  // ====================================================
  // [24] GIAO DIỆN
  // ====================================================

  return (
    <section className="kd-chat" aria-label="Kdocument AI">
      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}

      <header className="kd-chat__header">
        <div className="kd-chat__brand">
          <div className="kd-chat__brand-icon">✦</div>

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

        <span className="kd-chat__badge">RAG</span>
      </header>

      {/* ============================================= */}
      {/* BỐ CỤC: LỊCH SỬ + HỘI THOẠI */}
      {/* ============================================= */}

      <div className="kd-chat__workspace">
        {/* ----------------------------------------- */}
        {/* SIDEBAR LỊCH SỬ */}
        {/* ----------------------------------------- */}

        <aside
          className="kd-chat__history"
          aria-label="Lịch sử hội thoại AI"
        >
          <div className="kd-chat__history-header">
            <h3>Lịch sử hội thoại</h3>

            <button
              type="button"
              className="kd-chat__new-chat"
              onClick={startNewChat}
              disabled={isNavigationDisabled}
            >
              + Chat mới
            </button>
          </div>

          {historyError && (
            <p
              className="kd-chat__history-error"
              role="alert"
            >
              {historyError}
            </p>
          )}

          {isHistoryLoading && (
            <p className="kd-chat__history-muted">
              Đang tải lịch sử...
            </p>
          )}

          {!isHistoryLoading &&
            sessions.length === 0 && (
              <p className="kd-chat__history-muted">
                Chưa có cuộc trò chuyện nào.
              </p>
            )}

          <div className="kd-chat__history-list">
            {sessions.map((session) => (
              <button
                key={session.session_id}
                type="button"
                className={
                  "kd-chat__history-item" +
                  (activeSessionId === session.session_id
                    ? " kd-chat__history-item--active"
                    : "")
                }
                onClick={() =>
                  void openSession(session.session_id)
                }
                disabled={isNavigationDisabled}
                aria-current={
                  activeSessionId === session.session_id
                    ? "true"
                    : undefined
                }
              >
                <span className="kd-chat__history-title">
                  {session.title}
                </span>

                <span className="kd-chat__history-id">
                  Phiên #{session.session_id}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ----------------------------------------- */}
        {/* KHUNG HỘI THOẠI CHÍNH */}
        {/* ----------------------------------------- */}

        <div className="kd-chat__conversation">
          <div
            className="kd-chat__messages"
            ref={messagesRef}
          >
            {isSessionLoading && (
              <div className="kd-chat__empty">
                <p>Đang mở cuộc hội thoại...</p>
              </div>
            )}

            {!isSessionLoading &&
              turns.length === 0 && (
                <div className="kd-chat__empty">
                  <div className="kd-chat__empty-icon">
                    ✦
                  </div>

                  <h3>Bạn muốn tìm hiểu điều gì?</h3>

                  <p>
                    Chọn tài liệu và đặt câu hỏi.
                    Kdocument AI sẽ lưu hội thoại
                    để bạn có thể xem lại.
                  </p>
                </div>
              )}

            {!isSessionLoading &&
              turns.map((turn) => (
                <div
                  className="kd-chat__turn"
                  key={turn.id}
                >
                  {/* TIN NHẮN NGƯỜI DÙNG */}

                  <div className="kd-chat__user-row">
                    <div className="kd-chat__user-message">
                      <span className="kd-chat__message-label">
                        Bạn
                        {turn.documentId !== null
                          ? ` · Tài liệu ${turn.documentId}`
                          : ""}
                      </span>

                      <p>{turn.question}</p>
                    </div>
                  </div>

                  {/* CÂU TRẢ LỜI AI */}

                  {turn.answer !== undefined && (
                    <article className="kd-chat__assistant-message">
                      <div className="kd-chat__assistant-name">
                        <span className="kd-chat__sparkle">
                          ✦
                        </span>
                        Kdocument AI
                      </div>

                      {/* MARKDOWN + NGUỒN TƯƠNG TÁC */}

                      <div className="kd-chat__markdown">
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => {
                              const match = href?.match(
                                /^#kd-source-(\d+)-(\d+)$/
                              );

                              if (match) {
                                const linkedTurnId =
                                  Number(match[1]);

                                const sourceNumber =
                                  Number(match[2]);

                                const valid =
                                  linkedTurnId ===
                                    turn.id &&
                                  (
                                    turn.citations ?? []
                                  ).some(
                                    (citation) =>
                                      citation.source_number ===
                                      sourceNumber
                                  );

                                if (valid) {
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

                      {/* DANH SÁCH TRÍCH DẪN */}

                      {turn.citations &&
                        turn.citations.length > 0 && (
                          <div className="kd-chat__sources">
                            <h4>Nguồn tham khảo</h4>

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

                      {/* MODEL + SAO CHÉP */}

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

                  {/* AI ĐANG TRẢ LỜI */}

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

                  {/* LỖI GỬI CÂU HỎI */}

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

          {/* ======================================= */}
          {/* FORM NHẬP CÂU HỎI */}
          {/* ======================================= */}

          <form
            className="kd-chat__composer"
            onSubmit={handleSubmit}
          >
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
                disabled={
                  isSending ||
                  isHistoryLoading ||
                  isSessionLoading
                }
              />

              <span className="kd-chat__document-hint">
                Tạm dùng mã ID để kiểm thử
              </span>
            </div>

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
              disabled={isNavigationDisabled}
            />

            {formError && (
              <p
                className="kd-chat__form-error"
                role="alert"
              >
                {formError}
              </p>
            )}

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
                  isNavigationDisabled ||
                  !question.trim()
                }
              >
                {isSending
                  ? "Đang gửi..."
                  : "Gửi câu hỏi"}

                <span aria-hidden="true">➤</span>
              </button>
            </div>

            <p className="kd-chat__disclaimer">
              Lịch sử được lưu theo tài khoản.
              Quyền truy cập tài liệu được kiểm tra
              trên backend.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
