
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
// KDOCUMENT - DAY 18
// RAG CHAT + CITATION VIEWER + CHAT MANAGEMENT
//
// Chức năng:
// - Hỏi đáp AI dựa trên tài liệu
// - Hiển thị và điều hướng nguồn trích dẫn
// - Lưu, tải và khôi phục lịch sử hội thoại
// - Tạo, đổi tên và xóa phiên hội thoại
// ======================================================

// ======================================================
// [01] ĐỊNH NGHĨA KIỂU DỮ LIỆU
// ======================================================

// [01.1] Thông tin nguồn trích dẫn do RAG trả về.
interface Citation {
  source_number: number;
  document_id: number;
  chunk_id: number;
  page_number: number | null;
  score?: number;
}

// [01.2] Phản hồi của API hỏi đáp.
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

// [01.3] Thông tin một phiên hội thoại.
interface ChatSession {
  session_id: number;
  subject_id: number | null;
  title: string;
  created_at: string;
  updated_at: string;
}

// [01.4] Tin nhắn được lưu trong MySQL.
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

// [01.5] Phản hồi lấy danh sách phiên.
interface SessionListResponse {
  success: boolean;
  message?: string;
  data?: ChatSession[];
}

// [01.6] Phản hồi lấy chi tiết phiên.
interface SessionDetailsResponse {
  success: boolean;
  message?: string;
  data?: {
    session: ChatSession;
    messages: HistoryMessage[];
  };
}

// [01.7] Phản hồi đổi tên hoặc xóa phiên.
interface ActionResponse {
  success: boolean;
  message?: string;
}

// [01.8] Một lượt hỏi đáp trên giao diện.
interface ChatTurn {
  id: number;
  documentId: number | null;
  question: string;
  answer?: string;
  model?: string | null;
  citations?: Citation[];
  error?: string;
}

// [01.9] Props truyền vào component.
interface RagChatProps {
  token: string;
}

// ======================================================
// [02] HÀM HỖ TRỢ XỬ LÝ TRÍCH DẪN
// ======================================================

// Chỉ tạo liên kết cho các nguồn thực sự có trong
// danh sách citations của câu trả lời.
const linkifyCitations = (
  answer: string,
  citations: Citation[],
  turnId: number
): string => {
  const validSources = new Set(
    citations.map((item) => item.source_number)
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
// [03] KHÔI PHỤC HỘI THOẠI TỪ MYSQL
// ======================================================

// Ghép tin nhắn USER và ASSISTANT thành các lượt
// hỏi đáp để hiển thị trên giao diện React.
const restoreChatTurns = (
  messages: HistoryMessage[]
): ChatTurn[] => {
  const restored: ChatTurn[] = [];
  let nextId = 1;

  for (const message of messages) {
    // [03.1] Tạo lượt chat khi gặp câu hỏi.
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

    // Không khôi phục nguồn khi quyền đã bị thu hồi.
    const citations =
      !message.restricted &&
      Array.isArray(message.citations)
        ? message.citations
        : [];

    // [03.2] Ghép câu trả lời vào câu hỏi gần nhất.
    if (lastTurn && lastTurn.answer === undefined) {
      lastTurn.answer = message.content;
      lastTurn.model = message.model;
      lastTurn.citations = citations;
    } else {
      // Dự phòng dữ liệu cũ thiếu tin nhắn USER.
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

// [03.3] Tìm mã tài liệu từ lượt chat gần nhất.
const findLatestDocumentId = (
  turns: ChatTurn[]
): number | null => {
  for (let i = turns.length - 1; i >= 0; i--) {
    const id = turns[i].documentId;

    if (id !== null && id > 0) {
      return id;
    }
  }

  return null;
};

// ======================================================
// [04] COMPONENT RAG CHAT
// ======================================================

export default function RagChat({
  token,
}: RagChatProps) {

  // ====================================================
  // [05] STATE HỘI THOẠI
  // ====================================================

  const [documentId, setDocumentId] = useState("9");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState("");

  const [copiedId, setCopiedId] =
    useState<number | null>(null);

  // ====================================================
  // [06] STATE LỊCH SỬ HỘI THOẠI
  // ====================================================

  const [sessions, setSessions] =
    useState<ChatSession[]>([]);

  const [activeSessionId, setActiveSessionId] =
    useState<number | null>(null);

  const [isHistoryLoading, setIsHistoryLoading] =
    useState(true);

  const [isSessionLoading, setIsSessionLoading] =
    useState(false);

  const [historyError, setHistoryError] =
    useState("");

  // ====================================================
  // [07] STATE QUẢN LÝ PHIÊN - DAY 18
  // ====================================================

  const [editingSessionId, setEditingSessionId] =
    useState<number | null>(null);

  const [editingTitle, setEditingTitle] =
    useState("");

  const [sessionActionId, setSessionActionId] =
    useState<number | null>(null);

  // ====================================================
  // [08] REFS VÀ TRẠNG THÁI DẪN XUẤT
  // ====================================================

  const messagesRef = useRef<HTMLDivElement>(null);

  // Mã định danh tạm của lượt chat trên frontend.
  const nextTurnId = useRef(1);

  // Chặn gửi nhiều câu hỏi cùng lúc.
  const requestInProgress = useRef(false);

  // Hủy yêu cầu đọc phiên cũ khi cần thiết.
  const sessionRequestRef =
    useRef<AbortController | null>(null);

  // Ngăn dữ liệu của token cũ cập nhật giao diện.
  const generationRef = useRef(0);

  const pendingTurnId = isSending
    ? turns[turns.length - 1]?.id
    : undefined;

  const isNavigationDisabled =
    isSending ||
    isHistoryLoading ||
    isSessionLoading ||
    sessionActionId !== null;

  // ====================================================
  // [09] TỰ ĐỘNG CUỘN ĐẾN TIN NHẮN MỚI
  // ====================================================

  useEffect(() => {
    const element = messagesRef.current;

    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, isSending]);

  // ====================================================
  // [10] KHỞI TẠO LỊCH SỬ HỘI THOẠI
  // ====================================================

  // Khi mở trang hoặc token thay đổi:
  // - Tải danh sách phiên từ backend.
  // - Tự mở phiên hoạt động gần nhất.
  // - Khôi phục câu hỏi, câu trả lời và citations.
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
      setEditingSessionId(null);
      setEditingTitle("");

      nextTurnId.current = 1;

      // Hủy request đọc phiên chưa hoàn thành.
      sessionRequestRef.current?.abort();
      sessionRequestRef.current = null;

      try {
        // [10.1] Lấy danh sách phiên hội thoại.
        const list =
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

        if (!list.success || !list.data) {
          throw new Error(
            list.message ||
              "Không thể tải lịch sử hội thoại."
          );
        }

        setSessions(list.data);

        // [10.2] Chưa có phiên thì hiển thị chat trống.
        if (list.data.length === 0) {
          return;
        }

        // [10.3] Tự mở phiên gần nhất.
        const latestId = list.data[0].session_id;

        const detail =
          await apiRequest<SessionDetailsResponse>(
            `/chat/sessions/${latestId}`,
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

        // [10.4] Khôi phục tin nhắn trên giao diện.
        const restored = restoreChatTurns(
          detail.data.messages
        );

        nextTurnId.current = restored.length + 1;

        setTurns(restored);
        setActiveSessionId(latestId);

        // [10.5] Khôi phục mã tài liệu gần nhất.
        const latestDocumentId =
          findLatestDocumentId(restored);

        if (latestDocumentId !== null) {
          setDocumentId(String(latestDocumentId));
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          generation !== generationRef.current
        ) {
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

    // Không giữ request khi component bị hủy.
    return () => {
      generationRef.current++;
      controller.abort();
    };
  }, [token]);

  // ====================================================
  // [11] LÀM MỚI DANH SÁCH PHIÊN
  // ====================================================

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

  // ====================================================
  // [12] MỞ PHIÊN HỘI THOẠI ĐƯỢC CHỌN
  // ====================================================

  const openSession = async (sessionId: number) => {
    if (
      isNavigationDisabled ||
      activeSessionId === sessionId
    ) {
      return;
    }

    sessionRequestRef.current?.abort();

    const controller = new AbortController();

    sessionRequestRef.current = controller;

    const generation = generationRef.current;

    setIsSessionLoading(true);
    setHistoryError("");

    try {
      // [12.1] Lấy tin nhắn thuộc phiên.
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

      // [12.2] Chuyển tin nhắn MySQL sang ChatTurn.
      const restored = restoreChatTurns(
        response.data.messages
      );

      nextTurnId.current = restored.length + 1;

      setTurns(restored);
      setActiveSessionId(sessionId);
      setQuestion("");
      setCopiedId(null);

      // [12.3] Khôi phục mã tài liệu.
      const latestDocumentId =
        findLatestDocumentId(restored);

      if (latestDocumentId !== null) {
        setDocumentId(String(latestDocumentId));
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        generation !== generationRef.current
      ) {
        return;
      }

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

  // ====================================================
  // [13] BẮT ĐẦU CUỘC HỘI THOẠI MỚI
  // ====================================================

  // Chỉ xóa state của giao diện.
  // Backend sẽ tự tạo phiên MySQL khi AI trả lời.
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
    setEditingSessionId(null);
    setEditingTitle("");

    nextTurnId.current = 1;
  };

  // ====================================================
  // [14] ĐỔI TÊN PHIÊN HỘI THOẠI - DAY 18
  // ====================================================

  // PATCH /api/chat/sessions/:id
  // Backend kiểm tra quyền sở hữu phiên qua JWT.
  const renameSession = async (sessionId: number) => {
    if (isNavigationDisabled) return;

    const title = editingTitle.trim();

    // [14.1] Kiểm tra tiêu đề trước khi gọi API.
    if (!title || title.length > 255) {
      setHistoryError(
        "Tên hội thoại phải có từ 1 đến 255 ký tự."
      );
      return;
    }

    setSessionActionId(sessionId);
    setHistoryError("");

    try {
      // [14.2] Gửi tiêu đề mới.
      const response =
        await apiRequest<ActionResponse>(
          `/chat/sessions/${sessionId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify({ title }),
          }
        );

      if (!response.success) {
        throw new Error(
          response.message ||
            "Không thể đổi tên hội thoại."
        );
      }

      // [14.3] Cập nhật sidebar sau khi API thành công.
      setSessions((previous) =>
        previous.map((session) =>
          session.session_id === sessionId
            ? { ...session, title }
            : session
        )
      );

      // [14.4] Đóng chế độ chỉnh sửa.
      setEditingSessionId(null);
      setEditingTitle("");
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Không thể đổi tên hội thoại."
      );
    } finally {
      setSessionActionId(null);
    }
  };

  // ====================================================
  // [15] XÓA PHIÊN HỘI THOẠI - DAY 18
  // ====================================================

  // DELETE /api/chat/sessions/:id
  // Xóa phiên thật trong MySQL sau khi xác nhận.
  const deleteSession = async (sessionId: number) => {
    if (isNavigationDisabled) return;

    // [15.1] Yêu cầu xác nhận trước khi xóa.
    const confirmed = window.confirm(
      `Xóa hội thoại #${sessionId}?\n\n` +
        "Các tin nhắn trong phiên cũng sẽ bị xóa."
    );

    if (!confirmed) return;

    setSessionActionId(sessionId);
    setHistoryError("");

    try {
      // [15.2] Gọi API xóa phiên.
      const response =
        await apiRequest<ActionResponse>(
          `/chat/sessions/${sessionId}`,
          {
            method: "DELETE",
            token,
          }
        );

      if (!response.success) {
        throw new Error(
          response.message ||
            "Không thể xóa hội thoại."
        );
      }

      // [15.3] Xóa phiên khỏi danh sách sidebar.
      setSessions((previous) =>
        previous.filter(
          (session) =>
            session.session_id !== sessionId
        )
      );

      // [15.4] Nếu đang xem phiên bị xóa,
      // đưa giao diện về trạng thái chat mới.
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setTurns([]);
        setQuestion("");
        setFormError("");
        setCopiedId(null);

        nextTurnId.current = 1;
      }

      // [15.5] Đóng form nếu đang đổi tên phiên đó.
      if (editingSessionId === sessionId) {
        setEditingSessionId(null);
        setEditingTitle("");
      }
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Không thể xóa hội thoại."
      );
    } finally {
      setSessionActionId(null);
    }
  };

  // ====================================================
  // [16] ĐIỀU HƯỚNG ĐẾN NGUỒN TRÍCH DẪN
  // ====================================================

  const jumpToCitation = (anchorId: string) => {
    // [16.1] Tìm đúng nguồn trong lượt chat.
    const target = document.getElementById(anchorId);

    if (!target) return;

    const trigger =
      target.querySelector<HTMLButtonElement>(
        ".kd-source-preview__trigger"
      );

    // [16.2] Tự mở SourcePreview nếu đang thu gọn.
    if (
      trigger &&
      trigger.getAttribute("aria-expanded") === "false" &&
      !trigger.disabled
    ) {
      trigger.click();
    }

    // [16.3] Cuộn đến khung nguồn tương ứng.
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // [16.4] Khởi động lại hiệu ứng viền tím.
    target.classList.remove(
      "kd-chat__source-highlight"
    );

    void target.offsetWidth;

    target.classList.add(
      "kd-chat__source-highlight"
    );
  };

  // ====================================================
  // [17] GỬI CÂU HỎI ĐẾN RAG API
  // ====================================================

  const sendQuestion = async () => {
    // [17.1] Chặn gửi trùng hoặc gửi lúc đang tải.
    if (
      requestInProgress.current ||
      isNavigationDisabled
    ) {
      return;
    }

    const cleanQuestion = question.trim();
    const parsedDocumentId = Number(documentId);

    // [17.2] Kiểm tra mã tài liệu.
    if (
      !Number.isSafeInteger(parsedDocumentId) ||
      parsedDocumentId <= 0
    ) {
      setFormError(
        "Vui lòng nhập mã tài liệu hợp lệ."
      );
      return;
    }

    // [17.3] Kiểm tra nội dung câu hỏi.
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

    requestInProgress.current = true;

    setIsSending(true);
    setFormError("");
    setQuestion("");

    // [17.4] Hiển thị câu hỏi trước khi AI trả lời.
    setTurns((previous) => [
      ...previous,
      {
        id: turnId,
        documentId: parsedDocumentId,
        question: cleanQuestion,
      },
    ]);

    try {
      // [17.5] Gửi session_id nếu hỏi tiếp phiên cũ.
      // Không có session_id thì backend tạo phiên mới.
      const body = {
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
          body: JSON.stringify(body),
        }
      );

      // Không nhận response của tài khoản đã thay đổi.
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

      // [17.6] Cập nhật câu trả lời và citations.
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

      // [17.7] Ghi nhận mã phiên vừa lưu.
      setActiveSessionId(result.session_id);

      // [17.8] Làm mới danh sách hội thoại.
      // Nếu lỗi sidebar, không làm mất câu trả lời.
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

      // [17.9] Gắn lỗi vào đúng lượt chat.
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

  // ====================================================
  // [18] XỬ LÝ FORM VÀ PHÍM TẮT
  // ====================================================

  // [18.1] Gửi câu hỏi từ form.
  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    void sendQuestion();
  };

  // [18.2] Enter gửi, Shift + Enter xuống dòng.
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

  // ====================================================
  // [19] SAO CHÉP VÀ THỬ LẠI CÂU HỎI
  // ====================================================

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

  const prepareRetry = (turn: ChatTurn) => {
    if (turn.documentId !== null) {
      setDocumentId(String(turn.documentId));
    }

    setQuestion(turn.question);
    setFormError("");
  };

  // ====================================================
  // [20] GIAO DIỆN CHÍNH
  // ====================================================

  return (
    <section
      className="kd-chat"
      aria-label="Kdocument AI"
    >
      {/* ============================================= */}
      {/* [20.1] HEADER TRỢ LÝ AI */}
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
      {/* [20.2] BỐ CỤC SIDEBAR + HỘI THOẠI */}
      {/* ============================================= */}

      <div className="kd-chat__workspace">
        {/* =========================================== */}
        {/* [21] SIDEBAR LỊCH SỬ HỘI THOẠI */}
        {/* =========================================== */}

        <aside
          className="kd-chat__history"
          aria-label="Lịch sử hội thoại AI"
        >
          {/* [21.1] Tiêu đề và nút chat mới */}

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

          {/* [21.2] Thông báo lỗi */}

          {historyError && (
            <p
              className="kd-chat__history-error"
              role="alert"
            >
              {historyError}
            </p>
          )}

          {/* [21.3] Trạng thái tải lịch sử */}

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

          {/* [21.4] Danh sách phiên hội thoại */}

          <div className="kd-chat__history-list">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className={
                  "kd-chat__history-row" +
                  (activeSessionId === session.session_id
                    ? " kd-chat__history-row--active"
                    : "")
                }
              >
                {editingSessionId === session.session_id ? (
                  /* [21.5] Chế độ chỉnh sửa tiêu đề */

                  <div className="kd-chat__history-editor">
                    <input
                      type="text"
                      maxLength={255}
                      value={editingTitle}
                      aria-label="Tên hội thoại mới"
                      onChange={(event) =>
                        setEditingTitle(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();

                          void renameSession(
                            session.session_id
                          );
                        }

                        if (event.key === "Escape") {
                          setEditingSessionId(null);
                          setEditingTitle("");
                        }
                      }}
                      disabled={isNavigationDisabled}
                    />

                    <div className="kd-chat__history-actions">
                      <button
                        type="button"
                        onClick={() =>
                          void renameSession(
                            session.session_id
                          )
                        }
                        disabled={isNavigationDisabled}
                      >
                        Lưu
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingSessionId(null);
                          setEditingTitle("");
                        }}
                        disabled={isNavigationDisabled}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  /* [21.6] Chế độ xem thông thường */

                  <>
                    {/* Chọn phiên để xem nội dung */}

                    <button
                      type="button"
                      className="kd-chat__history-select"
                      onClick={() =>
                        void openSession(
                          session.session_id
                        )
                      }
                      disabled={isNavigationDisabled}
                      aria-current={
                        activeSessionId ===
                        session.session_id
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

                    {/* Các thao tác quản lý phiên */}

                    <div className="kd-chat__history-actions">
                      <button
                        type="button"
                        disabled={isNavigationDisabled}
                        onClick={() => {
                          setEditingSessionId(
                            session.session_id
                          );
                          setEditingTitle(session.title);
                          setHistoryError("");
                        }}
                      >
                        Đổi tên
                      </button>

                      <button
                        type="button"
                        className="kd-chat__history-delete"
                        disabled={isNavigationDisabled}
                        onClick={() =>
                          void deleteSession(
                            session.session_id
                          )
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* =========================================== */}
        {/* [22] KHU VỰC HỘI THOẠI CHÍNH */}
        {/* =========================================== */}

        <div className="kd-chat__conversation">
          <div
            className="kd-chat__messages"
            ref={messagesRef}
          >
            {/* [22.1] Đang tải phiên */}

            {isSessionLoading && (
              <div className="kd-chat__empty">
                <p>Đang mở cuộc hội thoại...</p>
              </div>
            )}

            {/* [22.2] Chưa có lượt hỏi đáp */}

            {!isSessionLoading &&
              turns.length === 0 && (
                <div className="kd-chat__empty">
                  <div className="kd-chat__empty-icon">
                    ✦
                  </div>

                  <h3>
                    Bạn muốn tìm hiểu điều gì?
                  </h3>

                  <p>
                    Chọn tài liệu và đặt câu hỏi.
                    Kdocument AI sẽ lưu hội thoại
                    để bạn có thể xem lại.
                  </p>
                </div>
              )}

            {/* [22.3] Danh sách các lượt hỏi đáp */}

            {!isSessionLoading &&
              turns.map((turn) => (
                <div
                  className="kd-chat__turn"
                  key={turn.id}
                >
                  {/* ------------------------------- */}
                  {/* TIN NHẮN CỦA NGƯỜI DÙNG */}
                  {/* ------------------------------- */}

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

                  {/* ------------------------------- */}
                  {/* CÂU TRẢ LỜI CỦA TRỢ LÝ AI */}
                  {/* ------------------------------- */}

                  {turn.answer !== undefined && (
                    <article className="kd-chat__assistant-message">
                      <div className="kd-chat__assistant-name">
                        <span className="kd-chat__sparkle">
                          ✦
                        </span>

                        Kdocument AI
                      </div>

                      {/* Nội dung Markdown và link nguồn */}

                      <div className="kd-chat__markdown">
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => {
                              // Nhận diện liên kết nguồn nội bộ.
                              const match = href?.match(
                                /^#kd-source-(\d+)-(\d+)$/
                              );

                              if (match) {
                                const linkedTurnId =
                                  Number(match[1]);

                                const sourceNumber =
                                  Number(match[2]);

                                // Nguồn phải thuộc đúng lượt chat.
                                const valid =
                                  linkedTurnId === turn.id &&
                                  (turn.citations ?? []).some(
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
                                        jumpToCitation(anchorId);
                                      }}
                                    >
                                      {children}
                                    </a>
                                  );
                                }
                              }

                              // Các liên kết Markdown thông thường.
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

                      {/* --------------------------- */}
                      {/* DANH SÁCH NGUỒN THAM KHẢO */}
                      {/* --------------------------- */}

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
                                      key={
                                        `${source.document_id}-` +
                                        `${source.chunk_id}-` +
                                        `${source.source_number}`
                                      }
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

                      {/* --------------------------- */}
                      {/* MODEL VÀ SAO CHÉP CÂU TRẢ LỜI */}
                      {/* --------------------------- */}

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

                  {/* ------------------------------- */}
                  {/* TRẠNG THÁI AI ĐANG TRẢ LỜI */}
                  {/* ------------------------------- */}

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

                  {/* ------------------------------- */}
                  {/* LỖI KHI GỬI CÂU HỎI */}
                  {/* ------------------------------- */}

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
          {/* [23] FORM NHẬP CÂU HỎI */}
          {/* ======================================= */}

          <form
            className="kd-chat__composer"
            onSubmit={handleSubmit}
          >
            {/* [23.1] Mã tài liệu */}

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
                disabled={isNavigationDisabled}
              />

              <span className="kd-chat__document-hint">
                Tạm dùng mã ID để kiểm thử
              </span>
            </div>

            {/* [23.2] Nội dung câu hỏi */}

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

            {/* [23.3] Thông báo lỗi nhập liệu */}

            {formError && (
              <p
                className="kd-chat__form-error"
                role="alert"
              >
                {formError}
              </p>
            )}

            {/* [23.4] Nút gửi và hướng dẫn phím tắt */}

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

                <span aria-hidden="true">
                  ➤
                </span>
              </button>
            </div>

            {/* [23.5] Lưu ý bảo mật */}

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
