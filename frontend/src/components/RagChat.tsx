
import { useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import "./RagChat.css";

// ======================================================
// KDOCUMENT - GIAO DIỆN HỎI ĐÁP AI
// DAY 14 - KẾT NỐI REACT VỚI API RAG
// ======================================================

// [01] Kiểu dữ liệu trích dẫn nguồn
interface RagCitation {
    source_number: number;
    document_id: number;
    chunk_id: number;
    page_number: number;
    score: number;
}

// [02] Phản hồi từ Express
interface RagResponse {
    success: boolean;
    data: {
        document_id: number;
        answer: string;
        model: string | null;
        citations: RagCitation[];
    };
}

// [03] Một lượt hỏi đáp trên giao diện
interface ChatMessage {
    documentId: number;
    question: string;
    answer: string;
    model: string | null;
    citations: RagCitation[];
}

interface RagChatProps {
    token: string;
}

// ======================================================
// [A] COMPONENT CHAT
// ======================================================

function RagChat({ token }: RagChatProps) {
    const [documentId, setDocumentId] = useState("9");
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // ==================================================
    // [B] GỬI CÂU HỎI ĐẾN BACKEND
    // ==================================================

    const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return;

        setError("");

        const id = Number(documentId);
        const questionText = question.trim();

        // Kiểm tra đầu vào trước khi gửi API
        if (
            !/^[1-9]\d*$/.test(documentId) ||
            !Number.isSafeInteger(id)
        ) {
            setError("Mã tài liệu không hợp lệ.");
            return;
        }

        if (!questionText || questionText.length > 1000) {
            setError("Câu hỏi phải có từ 1 đến 1000 ký tự.");
            return;
        }

        setLoading(true);

        try {
            // [01] Gọi API RAG bằng JWT
            const response = await apiRequest<RagResponse>(
                "/rag/ask",
                {
                    method: "POST",
                    token,
                    body: JSON.stringify({
                        document_id: id,
                        question: questionText
                    })
                }
            );

            // [02] Kiểm tra dữ liệu trả về
            if (
                !response.success ||
                !response.data ||
                typeof response.data.answer !== "string" ||
                !Array.isArray(response.data.citations)
            ) {
                throw new Error("Phản hồi từ Kdocument AI không hợp lệ.");
            }

            // [03] Thêm lượt hỏi đáp vào giao diện
            setMessages((previous) => [
                ...previous,
                {
                    documentId: response.data.document_id,
                    question: questionText,
                    answer: response.data.answer,
                    model: response.data.model,
                    citations: response.data.citations
                }
            ]);

            // [04] Xóa ô nhập câu hỏi
            setQuestion("");

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Không thể gửi câu hỏi đến Kdocument AI."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==================================================
    // [C] HIỂN THỊ GIAO DIỆN
    // ==================================================

    return (
        <section className="rag-chat">
            <div className="rag-header">
                <div>
                    <span className="rag-kicker">
                        TRỢ LÝ HỌC TẬP
                    </span>
                    <h2>Kdocument AI</h2>
                    <p>
                        Đặt câu hỏi theo tài liệu và xem nguồn
                        tham khảo từ hệ thống.
                    </p>
                </div>
                <span className="rag-tag">RAG</span>
            </div>

            {/* [01] Danh sách các lượt hỏi đáp */}
            <div className="rag-history" aria-live="polite">
                {messages.length === 0 && (
                    <div className="rag-empty">
                        <div className="rag-empty-icon">✦</div>
                        <h3>Bắt đầu đặt câu hỏi</h3>
                        <p>
                            Nhập mã tài liệu và nội dung muốn hỏi.
                            Kdocument sẽ tìm nguồn liên quan
                            trước khi tạo câu trả lời.
                        </p>
                    </div>
                )}

                {messages.map((message, index) => (
                    <article className="rag-conversation" key={index}>
                        <div className="rag-question">
                            <span className="rag-speaker">
                                Bạn · Tài liệu {message.documentId}
                            </span>
                            <p>{message.question}</p>
                        </div>

                        <div className="rag-answer">
                            <span className="rag-speaker">
                                ✦ Kdocument AI
                            </span>

                            <div className="rag-answer-text">
                                {message.answer}
                            </div>

                            {message.citations.length > 0 && (
                                <div className="rag-sources">
                                    <strong>Nguồn tham khảo</strong>

                                    {message.citations.map((citation) => (
                                        <div
                                            className="rag-source"
                                            key={`${citation.document_id}-${citation.chunk_id}`}
                                        >
                                            <span>
                                                [NGUỒN {citation.source_number}]
                                                {" "}Tài liệu {citation.document_id}
                                                {" "}· Trang {citation.page_number}
                                            </span>

                                            <small
                                                title="Độ tương đồng cosine, không phải xác suất đúng"
                                            >
                                                {citation.score.toFixed(4)}
                                            </small>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {message.model && (
                                <p className="rag-model">
                                    Model: {message.model}
                                </p>
                            )}
                        </div>
                    </article>
                ))}

                {loading && (
                    <div className="rag-loading" role="status">
                        Kdocument AI đang tìm tài liệu và tạo câu trả lời...
                    </div>
                )}
            </div>

            {/* [02] Form hỏi đáp */}
            <form className="rag-form" onSubmit={handleAsk}>
                <div className="rag-document-field">
                    <label htmlFor="rag-document-id">
                        Mã tài liệu
                    </label>

                    <input
                        id="rag-document-id"
                        type="number"
                        min="1"
                        step="1"
                        value={documentId}
                        onChange={(event) =>
                            setDocumentId(event.target.value)
                        }
                        required
                    />
                </div>

                <label htmlFor="rag-question">
                    Câu hỏi của bạn
                </label>

                <textarea
                    id="rag-question"
                    rows={3}
                    maxLength={1000}
                    placeholder="Ví dụ: Làm thế nào để truy cập tài liệu từ điện thoại?"
                    value={question}
                    onChange={(event) =>
                        setQuestion(event.target.value)
                    }
                    disabled={loading}
                    required
                />

                {error && (
                    <div className="rag-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="rag-form-footer">
                    <span>{question.length}/1000 ký tự</span>

                    <button
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "Đang xử lý..." : "Gửi câu hỏi"}
                    </button>
                </div>
            </form>

            <p className="rag-footnote">
                Quyền truy cập tài liệu được kiểm tra trên backend.
                Tài liệu số 9 hiện chỉ dùng để kiểm thử.
            </p>
        </section>
    );
}

export default RagChat;
