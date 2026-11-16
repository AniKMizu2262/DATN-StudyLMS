
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
// KDOCUMENT - DAY 15
// API HỎI ĐÁP RAG CÓ KIỂM SOÁT TRÍCH DẪN
// ======================================================

// [A] CẤU HÌNH
// Tối đa 2 lần sinh câu trả lời khi thiếu trích dẫn
const MAX_CITATION_ATTEMPTS = 2;

// [B] CONTROLLER HỎI ĐÁP
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

    // [02] Kiểm tra người dùng đã đăng nhập
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    const cleanQuestion = question.trim();

    try {
        // ==================================================
        // [C] KIỂM TRA PHÂN QUYỀN
        // ==================================================

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

        // ==================================================
        // [D] TRUY XUẤT NGỮ CẢNH RAG
        // ==================================================

        const rag = await buildRagContext(
            documentId,
            cleanQuestion
        );

        // Không có nguồn phù hợp thì không gọi LLM
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

        // Các mã nguồn hợp lệ được backend xác định
        const allowedSources = rag.citations
            .map((citation) =>
                `[NGUỒN ${citation.source_number}]`
            )
            .join(", ");

        // ==================================================
        // [E] GỌI LLM VÀ KIỂM TRA TRÍCH DẪN
        // ==================================================

        for (
            let attempt = 1;
            attempt <= MAX_CITATION_ATTEMPTS;
            attempt++
        ) {

            // [03] Kiểm tra lại quyền trước khi gửi tài liệu
            const currentAccess = await checkDocumentRagAccess(
                documentId,
                req.user
            );

            if (!currentAccess) {
                return res.status(403).json({
                    success: false,
                    message: "Quyền truy cập tài liệu đã thay đổi"
                });
            }

            // [04] Lượt thứ hai yêu cầu trích dẫn rõ ràng hơn
            const llmQuestion = attempt === 1
                ? cleanQuestion
                : [
                    cleanQuestion,
                    "",
                    "YÊU CẦU ĐỊNH DẠNG BẮT BUỘC:",
                    "Câu trả lời trước chưa có trích dẫn hợp lệ.",
                    "Hãy tạo lại câu trả lời dựa trên tài liệu.",
                    "Mỗi thông tin lấy từ tài liệu phải được",
                    "dẫn bằng ký hiệu nguồn tương ứng.",
                    `Các nguồn được phép: ${allowedSources}.`,
                    "Ví dụ định dạng: [NGUỒN 1].",
                    "Không tạo nguồn không tồn tại.",
                    "Không tự suy diễn thông tin ngoài tài liệu.",
                    "Nếu tài liệu không đủ thông tin,",
                    "hãy nói rõ giới hạn của tài liệu."
                ].join("\n");

            console.log(
                `[RAG] Kiểm tra câu trả lời ${attempt}/${MAX_CITATION_ATTEMPTS}`
            );

            let answerResult;

            // [05] Sinh câu trả lời
            try {
                answerResult = await generateAnswer(
                    llmQuestion,
                    rag.context
                );
            } catch (error) {
                console.error(
                    "[RAG] Lỗi dịch vụ LLM:",
                    error.message
                );

                return res.status(502).json({
                    success: false,
                    message:
                        "Trợ lý AI tạm thời không thể tạo câu trả lời. " +
                        "Vui lòng thử lại sau."
                });
            }

            // [06] Kiểm tra mã nguồn do LLM sử dụng
            let citationCheck;

            try {
                citationCheck = validateAnswerCitations(
                    answerResult.answer,
                    rag.citations
                );

            } catch (error) {
                console.warn(
                    `[RAG] Trích dẫn không hợp lệ ở lượt ${attempt}:`,
                    error.message
                );

                // Thử sinh lại một lần nếu còn lượt
                if (attempt < MAX_CITATION_ATTEMPTS) {
                    console.log(
                        "[RAG] Đang yêu cầu AI tạo lại trích dẫn..."
                    );
                    continue;
                }

                // Không tự gắn nguồn giả để vượt kiểm tra
                return res.status(502).json({
                    success: false,
                    message:
                        "AI chưa tạo được câu trả lời có trích dẫn " +
                        "hợp lệ. Vui lòng thử lại sau."
                });
            }

            // [07] Kiểm tra lại quyền trước khi trả kết quả
            const finalAccess = await checkDocumentRagAccess(
                documentId,
                req.user
            );

            if (!finalAccess) {
                return res.status(403).json({
                    success: false,
                    message: "Quyền truy cập tài liệu đã thay đổi"
                });
            }

            // [08] Trả câu trả lời hợp lệ
            console.log(
                `[RAG] Câu trả lời đạt kiểm tra trích dẫn ở lượt ${attempt}`
            );

            return res.status(200).json({
                success: true,
                data: {
                    document_id: documentId,
                    answer: answerResult.answer,
                    model: answerResult.model,
                    citations: citationCheck.usedCitations
                }
            });
        }

    } catch (error) {
        console.error(
            "[RAG] Lỗi hệ thống:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Không thể xử lý yêu cầu hỏi đáp"
        });
    }
};

module.exports = {
    askRag
};
