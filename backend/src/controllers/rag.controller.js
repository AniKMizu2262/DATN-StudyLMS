
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

const {
    isOwnedSession,
    saveRagTurn
} = require("../services/chatHistory.service");

// ======================================================
// KDOCUMENT - DAY 17
// RAG CÓ TRÍCH DẪN VÀ LƯU LỊCH SỬ
// ======================================================

const MAX_CITATION_ATTEMPTS = 2;

// [01] API HỎI ĐÁP
const askRag = async (req, res) => {
    const {
        document_id,
        question,
        session_id
    } = req.body || {};

    const documentId = Number(document_id);

    // --------------------------------------------------
    // [02] KIỂM TRA CÂU HỎI VÀ TÀI LIỆU
    // --------------------------------------------------

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

    // --------------------------------------------------
    // [03] KIỂM TRA ĐĂNG NHẬP
    // --------------------------------------------------

    const userId = Number(req.user?.userId);

    if (
        !Number.isSafeInteger(userId) ||
        userId <= 0
    ) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    // --------------------------------------------------
    // [04] XỬ LÝ MÃ PHIÊN HỘI THOẠI
    // --------------------------------------------------

    let sessionId = null;

    if (session_id !== undefined && session_id !== null) {
        sessionId = Number(session_id);

        if (
            !Number.isSafeInteger(sessionId) ||
            sessionId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Mã phiên hội thoại không hợp lệ"
            });
        }
    }

    const cleanQuestion = question.trim();

    try {
        // --------------------------------------------------
        // [05] KIỂM TRA PHIÊN THUỘC NGƯỜI DÙNG
        // --------------------------------------------------

        if (sessionId !== null) {
            const isOwner = await isOwnedSession(
                sessionId,
                userId
            );

            if (!isOwner) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Không tìm thấy phiên hội thoại hợp lệ"
                });
            }
        }

        // --------------------------------------------------
        // [06] KIỂM TRA QUYỀN TÀI LIỆU
        // --------------------------------------------------

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

        // --------------------------------------------------
        // [07] HÀM LƯU VÀ TRẢ CÂU TRẢ LỜI
        // --------------------------------------------------

        const saveAndRespond = async ({
            answer,
            model,
            citations
        }) => {
            const savedSessionId = await saveRagTurn({
                userId,
                sessionId,
                documentId,
                question: cleanQuestion,
                answer,
                model,
                citations
            });

            return res.status(200).json({
                success: true,
                data: {
                    session_id: savedSessionId,
                    document_id: documentId,
                    answer,
                    model,
                    citations
                }
            });
        };

        // --------------------------------------------------
        // [08] TRUY XUẤT NGỮ CẢNH RAG
        // --------------------------------------------------

        const rag = await buildRagContext(
            documentId,
            cleanQuestion
        );

        // Không có nguồn phù hợp thì không gọi LLM.
        if (!rag.hasContext) {
            // Kiểm tra lại quyền trước khi lưu.
            const currentAccess =
                await checkDocumentRagAccess(
                    documentId,
                    req.user
                );

            if (!currentAccess) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Quyền truy cập tài liệu đã thay đổi"
                });
            }

            return await saveAndRespond({
                answer:
                    "Không tìm thấy thông tin phù hợp " +
                    "trong tài liệu để trả lời.",
                model: null,
                citations: []
            });
        }

        // --------------------------------------------------
        // [09] DANH SÁCH NGUỒN HỢP LỆ
        // --------------------------------------------------

        const allowedSources = rag.citations
            .map(
                (citation) =>
                    `[NGUỒN ${citation.source_number}]`
            )
            .join(", ");

        // --------------------------------------------------
        // [10] GỌI LLM VÀ KIỂM TRA TRÍCH DẪN
        // --------------------------------------------------

        for (
            let attempt = 1;
            attempt <= MAX_CITATION_ATTEMPTS;
            attempt++
        ) {
            // Kiểm tra quyền trước mỗi lần sinh câu trả lời.
            const currentAccess =
                await checkDocumentRagAccess(
                    documentId,
                    req.user
                );
            if (!currentAccess) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Quyền truy cập tài liệu đã thay đổi"
                });
            }

            // Lần thứ hai yêu cầu trích dẫn chặt chẽ hơn.
            
// ======================================================
// [04] TỐI ƯU CÂU HỎI GỬI ĐẾN LLM
//
// Áp dụng định dạng trích dẫn ngay từ lượt đầu.
// Ưu tiên diễn đạt tiếng Việt tự nhiên.
// ======================================================

            const llmQuestion = [
                "CÂU HỎI CỦA NGƯỜI DÙNG:",
                cleanQuestion,

                "",
                "YÊU CẦU TRẢ LỜI:",

                "1. Trả lời bằng tiếng Việt tự nhiên,",
                "mạch lạc, dễ hiểu và phù hợp với sinh viên.",

                "2. Diễn giải các tiêu đề tiếng Anh sang",
                "tiếng Việt, giữ thuật ngữ chuyên môn khi cần.",

                "3. Ưu tiên câu văn hoàn chỉnh,",
                "không sao chép máy móc danh sách từ slide.",

                "4. Chỉ sử dụng những thông tin có trong",
                "ngữ cảnh tài liệu được cung cấp.",

                "5. Nếu tài liệu chỉ liệt kê các chủ đề,",
                "hãy tóm tắt những chủ đề được đề cập,",
                "không tự tạo thêm nội dung chi tiết.",

                "6. Không thêm câu kết luận về thiếu thông tin",
                "nếu ngữ cảnh đã đủ để trả lời câu hỏi.",

                "7. Mỗi ý sử dụng thông tin từ tài liệu",
                "phải có ký hiệu nguồn ngay sau ý đó.",

                `Các nguồn hợp lệ: ${allowedSources}.`,

                "Định dạng trích dẫn: [NGUỒN 1].",
                "Chỉ sử dụng mã nguồn thực sự có trong danh sách.",
                "Không tự tạo nguồn hoặc số trang.",

                ...(attempt > 1
                    ? [
                        "",
                        "LƯU Ý QUAN TRỌNG:",
                        "Câu trả lời trước chưa đạt kiểm tra trích dẫn.",
                        "Hãy tuân thủ chính xác định dạng nguồn.",
                        "Không bỏ qua trích dẫn."
                    ]
                    : [])
            ].join("\n");


            console.log(
                `[RAG] Kiểm tra câu trả lời ${attempt}/${MAX_CITATION_ATTEMPTS}`
            );

            let answerResult;

            // ----------------------------------------------
            // [11] SINH CÂU TRẢ LỜI
            // ----------------------------------------------

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
                        "Trợ lý AI tạm thời không thể tạo " +
                        "câu trả lời. Vui lòng thử lại sau."
                });
            }

            // ----------------------------------------------
            // [12] KIỂM TRA TRÍCH DẪN
            // ----------------------------------------------

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

                if (attempt < MAX_CITATION_ATTEMPTS) {
                    console.log(
                        "[RAG] Đang yêu cầu AI tạo lại trích dẫn..."
                    );
                    continue;
                }

                return res.status(502).json({
                    success: false,
                    message:
                        "AI chưa tạo được câu trả lời " +
                        "có trích dẫn hợp lệ."
                });
            }

            // ----------------------------------------------
            // [13] KIỂM TRA QUYỀN TRƯỚC KHI TRẢ KẾT QUẢ
            // ----------------------------------------------

            const finalAccess =
                await checkDocumentRagAccess(
                    documentId,
                    req.user
                );

            if (!finalAccess) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Quyền truy cập tài liệu đã thay đổi"
                });
            }

            console.log(
                `[RAG] Câu trả lời đạt kiểm tra trích dẫn ở lượt ${attempt}`
            );

            // ----------------------------------------------
            // [14] LƯU VÀ TRẢ CÂU TRẢ LỜI
            // ----------------------------------------------

            return await saveAndRespond({
                answer: answerResult.answer,
                model: answerResult.model,
                citations: citationCheck.usedCitations
            });
        }
    } catch (error) {
        console.error(
            "[RAG] Lỗi xử lý hoặc lưu lịch sử:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Không thể xử lý yêu cầu hỏi đáp " +
                "hoặc lưu lịch sử hội thoại"
        });
    }
};

// ======================================================
// [15] EXPORT
// ======================================================

module.exports = {
    askRag
};
