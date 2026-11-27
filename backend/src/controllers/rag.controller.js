"use strict";

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

// =============================================================
// KDOCUMENT | DAY20 - RAG CONTROLLER + KIỂM TRA NGÔN NGỮ
//
// Giữ nguyên các service, prompt, định dạng nguồn và JSON response.
// Chặn ký tự Hán không có trong tài liệu/câu hỏi khi hỏi tiếng Việt.
// Một câu hỏi chỉ được gọi LLM tối đa 2 lần (bao gồm retry nguồn).
// =============================================================

const MAX_CITATION_ATTEMPTS = 2;
const MAX_QUESTION_LENGTH = 1000;

// Chấp nhận số nguyên dương hoặc chuỗi chữ số thập phân.
// Không chấp nhận "1e3", "0x10", khoảng trắng hay số thập phân.
const parsePositiveId = (value) => {
    if (typeof value === "number") {
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }

    if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) ? parsed : null;
    }

    return null;
};

// Đánh dấu câu hỏi tiếng Việt khi có ký tự tiếng Việt có dấu.
// Không ép các câu hỏi tiếng Anh phải trả lời bằng tiếng Việt.
const isVietnameseQuestion = (question) => /[À-ỹ]/u.test(question);

// Một số model miễn phí thỉnh thoảng trộn chữ Hán vào câu Việt,
// ví dụ "nội dung涵蓋 Python basics".
//
// Chỉ chặn ký tự Hán KHÔNG xuất hiện trong tài liệu/câu hỏi:
// nếu PDF thật sự có chữ Hán thì vẫn được trích nguyên văn.
// Đây là kiểm tra sơ bộ, không phải bộ phát hiện ngôn ngữ hoàn chỉnh.
const containsUnexpectedHan = (answer, question, context) => {
    if (!isVietnameseQuestion(question)) return false;

    const hanChars = answer.match(/\p{Script=Han}/gu) || [];

    return hanChars.some(
        (character) =>
            !question.includes(character) &&
            !context.includes(character)
    );
};

// =============================================================
// API HỎI ĐÁP RAG
// Đường dẫn cụ thể do rag.routes.js định nghĩa.
// =============================================================

const askRag = async (req, res) => {
    const { document_id, question, session_id } = req.body || {};
    const documentId = parsePositiveId(document_id);

    if (
        documentId === null ||
        typeof question !== "string" ||
        !question.trim() ||
        question.length > MAX_QUESTION_LENGTH
    ) {
        return res.status(400).json({
            success: false,
            message: "Mã tài liệu hoặc câu hỏi không hợp lệ"
        });
    }

    // userId luôn lấy từ JWT, không lấy từ client body.
    const userId = parsePositiveId(req.user?.userId);

    if (userId === null) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập"
        });
    }

    let sessionId = null;

    if (session_id !== undefined && session_id !== null) {
        sessionId = parsePositiveId(session_id);

        if (sessionId === null) {
            return res.status(400).json({
                success: false,
                message: "Mã phiên hội thoại không hợp lệ"
            });
        }
    }

    const cleanQuestion = question.trim();

    try {
        // =====================================================
        // [01] KIỂM TRA QUYỀN SỞ HỮU PHIÊN CHAT
        // =====================================================

        // Không cho người dùng truy cập phiên của tài khoản khác.
        if (sessionId !== null) {
            const owned = await isOwnedSession(sessionId, userId);

            if (!owned) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy phiên hội thoại hợp lệ"
                });
            }
        }

        // =====================================================
        // [02] KIỂM TRA QUYỀN TRUY CẬP TÀI LIỆU
        // =====================================================

        // Không đọc chunks trước khi kiểm tra phân quyền.
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

        // Việc gọi AI có thể lâu.
        // Quyền truy cập có thể thay đổi trong thời gian đó.
        const hasCurrentAccess = async () => Boolean(
            await checkDocumentRagAccess(documentId, req.user)
        );

        // =====================================================
        // [03] HÀM LƯU LỊCH SỬ VÀ TRẢ KẾT QUẢ
        // =====================================================

        const saveAndRespond = async ({
            answer,
            model,
            citations
        }) => {
            // Kiểm tra lại quyền truy cập tài liệu.
            if (!(await hasCurrentAccess())) {
                return res.status(403).json({
                    success: false,
                    message: "Quyền truy cập tài liệu đã thay đổi"
                });
            }

            // Kiểm tra lại phiên chat.
            // Tránh trường hợp phiên bị xóa trong lúc AI xử lý.
            if (sessionId !== null) {
                const owned = await isOwnedSession(
                    sessionId,
                    userId
                );

                if (!owned) {
                    return res.status(404).json({
                        success: false,
                        message: "Không tìm thấy phiên hội thoại hợp lệ"
                    });
                }
            }

            // Chỉ lưu câu trả lời sau khi đã qua kiểm tra.
            const savedSessionId = await saveRagTurn({
                userId,
                sessionId,
                documentId,
                question: cleanQuestion,
                answer,
                model,
                citations
            });

            // Giữ nguyên JSON response để không ảnh hưởng FE.
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

        // =====================================================
        // [04] TRUY XUẤT NGỮ CẢNH RAG
        // =====================================================

        // Giữ nguyên topK, similarity score và cách lấy nguồn.
        const rag = await buildRagContext(
            documentId,
            cleanQuestion
        );

        // Nếu không có nội dung phù hợp, không gọi LLM.
        if (!rag.hasContext) {
            return await saveAndRespond({
                answer:
                    "Không tìm thấy thông tin phù hợp " +
                    "trong tài liệu để trả lời.",
                model: null,
                citations: []
            });
        }

        // =====================================================
        // [05] KIỂM TRA NGỮ CẢNH VÀ CITATIONS
        // =====================================================

        if (
            !Array.isArray(rag.citations) ||
            rag.citations.length === 0 ||
            typeof rag.context !== "string" ||
            !rag.context.trim()
        ) {
            console.error(
                "[RAG] Ngữ cảnh hoặc trích dẫn không hợp lệ"
            );

            return res.status(502).json({
                success: false,
                message:
                    "Không thể chuẩn bị nguồn tài liệu cho câu trả lời"
            });
        }

        const allowedSources = rag.citations
            .map(
                (citation) =>
                    `[NGUỒN ${citation.source_number}]`
            )
            .join(", ");

        // =====================================================
        // [06] CHUẨN BỊ CƠ CHẾ RETRY
        // =====================================================

        // Một lượt retry được dùng chung cho:
        // - Trích dẫn sai.
        // - Ngôn ngữ không hợp lệ.
        //
        // Không tăng số lượng request LLM tối đa.
        let retryReason = null;

        for (
            let attempt = 1;
            attempt <= MAX_CITATION_ATTEMPTS;
            attempt++
        ) {
            // Kiểm tra quyền trước mỗi lần gửi context sang AI.
            if (!(await hasCurrentAccess())) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Quyền truy cập tài liệu đã thay đổi"
                });
            }

            // =================================================
            // [07] THÔNG BÁO CHO LƯỢT THỬ LẠI
            // =================================================

            // Nếu AI dùng sai ngôn ngữ:
            // nhắc viết lại bằng tiếng Việt.
            //
            // Nếu AI dẫn sai nguồn:
            // nhắc dùng đúng mã nguồn.
            //
            // Lượt đầu tiên không có phần này.
            const retryInstruction = retryReason === "language"
                ? [
                    "Câu trả lời trước có ký tự Hán không có trong tài liệu.",
                    "Viết lại hoàn toàn bằng tiếng Việt tự nhiên.",
                    "Giữ nguyên ý đúng và các mã trích dẫn hợp lệ.",
                    "Không chèn chữ Trung Quốc hoặc Nhật Bản."
                ]
                : [
                    "Câu trả lời trước chưa đạt kiểm tra trích dẫn.",
                    "Hãy tuân thủ chính xác định dạng nguồn.",
                    "Không bỏ qua trích dẫn."
                ];

            // =================================================
            // [08] PROMPT GỬI CHO LLM
            // =================================================

            // Giữ nguyên nội dung yêu cầu Day19 ở lượt đầu.
            // Chỉ bổ sung chỉ dẫn retry khi phát hiện lỗi.
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
                        ...retryInstruction
                    ]
                    : [])
            ].join("\n");

            console.log(
                `[RAG] Kiểm tra câu trả lời ${attempt}/${MAX_CITATION_ATTEMPTS}`
            );

            // =================================================
            // [09] GỌI DỊCH VỤ OPENROUTER
            // =================================================

            let answerResult;

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

            // =================================================
            // [10] KIỂM TRA NGUỒN TRÍCH DẪN
            // =================================================

            let citationCheck;

            try {
                citationCheck = validateAnswerCitations(
                    answerResult.answer,
                    rag.citations
                );

            } catch (error) {
                console.warn(
                    `[RAG] Trích dẫn không đạt (lượt ${attempt}): ${error.message}`
                );

                retryReason = "citation";

                if (attempt < MAX_CITATION_ATTEMPTS) {
                    continue;
                }

                return res.status(502).json({
                    success: false,
                    message:
                        "AI chưa tạo được câu trả lời " +
                        "có trích dẫn hợp lệ."
                });
            }

            // =================================================
            // [11] KIỂM TRA NGÔN NGỮ ĐẦU RA
            // =================================================

            // Đây là lớp bảo vệ mới của Day20.
            //
            // Ví dụ phát hiện:
            // "nội dung涵蓋 Python basics [NGUỒN 1]"
            //
            // Nếu ký tự Hán không nằm trong câu hỏi hoặc
            // ngữ cảnh PDF thì không cho lưu/trả câu trả lời.
            //
            // Không tự ý xóa hoặc thay thế chữ Hán vì
            // thao tác đó có thể làm sai ý nghĩa nội dung.
            if (containsUnexpectedHan(
                answerResult.answer,
                cleanQuestion,
                rag.context
            )) {
                console.warn(
                    `[RAG] Ngôn ngữ không đạt: ` +
                    `xuất hiện chữ Hán ngoài tài liệu ` +
                    `(lượt ${attempt})`
                );

                retryReason = "language";

                if (attempt < MAX_CITATION_ATTEMPTS) {
                    // Cho AI một cơ hội viết lại.
                    continue;
                }

                // Không đưa câu trả lời sai ngôn ngữ lên FE.
                return res.status(502).json({
                    success: false,
                    message:
                        "AI chưa tạo được câu trả lời " +
                        "đúng ngôn ngữ. Vui lòng thử lại sau."
                });
            }

            // =================================================
            // [12] KẾT QUẢ ĐÃ VƯỢT QUA KIỂM TRA
            // =================================================

            console.log(
                `[RAG] Câu trả lời đạt kiểm tra nguồn ` +
                `và ngôn ngữ ở lượt ${attempt}`
            );

            // Chỉ đến đây mới lưu lịch sử và trả lời.
            return await saveAndRespond({
                answer: answerResult.answer,
                model: answerResult.model,
                citations: citationCheck.usedCitations
            });
        }

        // Nhánh dự phòng, thông thường không chạy tới đây.
        return res.status(502).json({
            success: false,
            message: "AI chưa tạo được câu trả lời hợp lệ."
        });

    } catch (error) {
        // =====================================================
        // [13] XỬ LÝ LỖI TỔNG QUÁT
        // =====================================================

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

// =============================================================
// EXPORT CONTROLLER
// =============================================================

module.exports = {
    askRag
};