
const {
    checkDocumentRagAccess
} = require("../services/ragAccess.service");

const {
    buildRagContext
} = require("../services/ragContext.service");

const {
    generateAnswer
} = require("../services/llm.service");

const {
    validateAnswerCitations
} = require("../services/ragCitation.service");

// ======================================================
// KDOCUMENT - RAG CONTROLLER DAY 13
// API hỏi đáp theo tài liệu có phân quyền
// ======================================================

const askRag = async (req, res) => {
    // [01] Kiểm tra dữ liệu đầu vào
    const { document_id, question } = req.body || {};
    const documentId = Number(document_id);

    if (
        !Number.isSafeInteger(documentId) ||
        documentId <= 0 ||
        typeof question !== "string" ||
        !question.trim() ||
        question.length > 1000
    ) {
        return res.status(400).json({
            success: false,
            message: "Mã tài liệu hoặc câu hỏi không hợp lệ"
        });
    }

    // [02] Chỉ sử dụng tài khoản từ JWT đã xác thực
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    try {
        // [03] Kiểm tra quyền trước khi đọc dữ liệu RAG
        const document = await checkDocumentRagAccess(
            documentId,
            req.user
        );

        if (!document) {
            return res.status(403).json({
                success: false,
                message: "Không có quyền hỏi đáp tài liệu này"
            });
        }

        // [04] Tìm nội dung liên quan
        const rag = await buildRagContext(
            documentId,
            question.trim()
        );

        // [05] Không có nguồn thì không gọi LLM
        if (!rag.hasContext) {
            return res.status(200).json({
                success: true,
                data: {
                    document_id: documentId,
                    answer:
                        "Không tìm thấy thông tin phù hợp " +
                        "trong tài liệu để trả lời.",
                    model: null,
                    citations: []
                }
            });
        }

        // [06] Kiểm tra lại quyền trước khi gửi nguồn ra ngoài
        const accessStillValid = await checkDocumentRagAccess(
            documentId,
            req.user
        );

        if (!accessStillValid) {
            return res.status(403).json({
                success: false,
                message: "Quyền truy cập tài liệu đã thay đổi"
            });
        }

        // [07] Gọi AI và kiểm tra trích dẫn
        let answerResult;
        let citationCheck;

        try {
            answerResult = await generateAnswer(
                question.trim(),
                rag.context
            );

            citationCheck = validateAnswerCitations(
                answerResult.answer,
                rag.citations
            );
        } catch (error) {
            console.error("[RAG] Lỗi LLM/trích dẫn:", error.message);

            return res.status(502).json({
                success: false,
                message:
                    "Trợ lý AI chưa thể tạo câu trả lời hợp lệ. " +
                    "Vui lòng thử lại sau."
            });
        }

        // [08] Trả về câu trả lời và nguồn hợp lệ
        return res.status(200).json({
            success: true,
            data: {
                document_id: documentId,
                answer: answerResult.answer,
                model: answerResult.model,
                citations: citationCheck.usedCitations
            }
        });

    } catch (error) {
        console.error("[RAG] Lỗi hệ thống:", error.message);

        return res.status(500).json({
            success: false,
            message: "Không thể xử lý yêu cầu hỏi đáp"
        });
    }
};

module.exports = {
    askRag
};
