
import { useState, type FormEvent } from "react";

import { apiRequest } from "./services/api";

import AppLayout, {
    type AppPage
} from "./components/layout/AppLayout";

import RoleDashboard from "./pages/RoleDashboard";
import RagChat from "./components/RagChat";

import "./App.css";

// ======================================================
// KDOCUMENT - DAY 15
// ĐĂNG NHẬP, PHIÊN JWT VÀ ĐIỀU HƯỚNG THEO VAI TRÒ
// ======================================================

// [A] KHAI BÁO KIỂU DỮ LIỆU

interface User {
    user_id: number;
    full_name: string;
    email: string;
    role: string;
}

interface LoginResponse {
    success: boolean;
    message: string;
    data: {
        token: string;
        user: User;
    };
}

interface AuthSession {
    token: string;
    user: User;
}

const SESSION_KEY = "kdocument_session";

// ======================================================
// [B] ĐỌC PHIÊN ĐĂNG NHẬP
// ======================================================

// Phiên tạm phục vụ bản thử nghiệm frontend.
// Backend vẫn kiểm tra chữ ký và thời hạn JWT.
const loadSession = (): AuthSession | null => {
    try {
        const saved = sessionStorage.getItem(SESSION_KEY);

        if (!saved) {
            return null;
        }

        const parsed: unknown = JSON.parse(saved);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            !("token" in parsed) ||
            !("user" in parsed)
        ) {
            return null;
        }

        const session = parsed as AuthSession;

        if (
            typeof session.token !== "string" ||
            !session.token ||
            typeof session.user?.email !== "string" ||
            typeof session.user?.role !== "string"
        ) {
            return null;
        }

        return session;

    } catch {
        return null;
    }
};

// ======================================================
// [C] COMPONENT APP
// ======================================================

function App() {

    // [01] Trạng thái đăng nhập
    const [session, setSession] = useState<AuthSession | null>(
        loadSession
    );

    // [02] Điều hướng trong giao diện
    const [activePage, setActivePage] = useState<AppPage>(
        "dashboard"
    );

    // [03] Form đăng nhập
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // [04] Trạng thái xử lý
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // ==================================================
    // [D] XỬ LÝ ĐĂNG NHẬP
    // ==================================================

    const handleLogin = async (
        event: FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        if (loading) return;

        setLoading(true);
        setError("");

        try {
            // [01] Gửi email và mật khẩu đến Express
            const response = await apiRequest<LoginResponse>(
                "/auth/login",
                {
                    method: "POST",
                    body: JSON.stringify({
                        email: email.trim(),
                        password
                    })
                }
            );

            // [02] Kiểm tra dữ liệu trả về
            if (
                !response.success ||
                !response.data?.token ||
                !response.data?.user
            ) {
                throw new Error(
                    "Phản hồi đăng nhập không hợp lệ"
                );
            }

            // [03] Tạo phiên đăng nhập
            const newSession: AuthSession = {
                token: response.data.token,
                user: response.data.user
            };

            // [04] Lưu phiên trong tab hiện tại
            sessionStorage.setItem(
                SESSION_KEY,
                JSON.stringify(newSession)
            );

            setSession(newSession);

            // [05] Sau đăng nhập luôn vào Dashboard
            setActivePage("dashboard");
            setPassword("");
            setShowPassword(false);

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Đăng nhập thất bại. Vui lòng thử lại."
            );

        } finally {
            setLoading(false);
        }
    };

    // ==================================================
    // [E] XỬ LÝ ĐĂNG XUẤT
    // ==================================================

    const handleLogout = () => {
        sessionStorage.removeItem(SESSION_KEY);

        setSession(null);
        setActivePage("dashboard");

        setEmail("");
        setPassword("");
        setShowPassword(false);
        setError("");
    };

    // ==================================================
    // [F] ĐIỀU HƯỚNG THEO VAI TRÒ
    // ==================================================

    // Admin chưa có trang hỏi AI trong phạm vi Day 15.
    // Backend vẫn là nơi quyết định quyền truy cập.
    const canUseAi =
        session?.user.role === "STUDENT" ||
        session?.user.role === "TEACHER";

    const handleNavigate = (page: AppPage) => {
        if (page === "ai" && !canUseAi) {
            return;
        }

        setActivePage(page);
    };

    // ==================================================
    // [G] GIAO DIỆN KHI ĐÃ ĐĂNG NHẬP
    // ==================================================

    if (session) {
        const { user, token } = session;

        const currentPage: AppPage =
            activePage === "ai" && !canUseAi
                ? "dashboard"
                : activePage;

        return (
            <AppLayout
                user={user}
                activePage={currentPage}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
            >
                {currentPage === "ai" && canUseAi ? (
                    <RagChat token={token} />
                ) : (
                    <RoleDashboard
                        user={user}
                        onNavigate={handleNavigate}
                    />
                )}
            </AppLayout>
        );
    }

    // ==================================================
    // [H] GIAO DIỆN ĐĂNG NHẬP
    // ==================================================

    return (
        <main className="login-page">

            {/* Khu vực giới thiệu Kdocument */}
            <section className="login-intro">
                <div className="brand brand-light">
                    <span className="brand-mark">K</span>
                    <span>Kdocument</span>
                </div>

                <div className="intro-content">
                    <span className="intro-label">
                        LEARNING MANAGEMENT SYSTEM
                    </span>

                    <h1>
                        Học tập thông minh.
                        <br />
                        Kiến thức trong tầm tay.
                    </h1>

                    <p>
                        Quản lý tài liệu môn học, tìm kiếm kiến thức
                        và học tập hiệu quả với trợ lý AI.
                    </p>

                    <div className="intro-feature">
                        <span className="feature-symbol">✦</span>
                        <span>
                            Trợ lý AI hỏi đáp theo tài liệu
                            với trích dẫn nguồn rõ ràng.
                        </span>
                    </div>
                </div>

                <p className="intro-footer">
                    Kdocument · Hệ thống quản lý học tập
                </p>
            </section>

            {/* Form đăng nhập */}
            <section className="login-panel">
                <div className="login-form-wrapper">

                    <div className="mobile-brand">
                        <span className="brand-mark">K</span>
                        <strong>Kdocument</strong>
                    </div>

                    <span className="eyebrow">
                        CHÀO MỪNG TRỞ LẠI
                    </span>

                    <h2>Đăng nhập</h2>

                    <p className="form-description">
                        Sử dụng tài khoản Kdocument để tiếp tục.
                    </p>

                    <form onSubmit={handleLogin}>

                        {/* Email */}
                        <div className="form-field">
                            <label htmlFor="email">
                                Địa chỉ email
                            </label>

                            <input
                                id="email"
                                type="email"
                                placeholder="Nhập email của bạn"
                                autoComplete="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                required
                            />
                        </div>

                        {/* Mật khẩu */}
                        <div className="form-field">
                            <label htmlFor="password">
                                Mật khẩu
                            </label>

                            <div className="password-field">
                                <input
                                    id="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="Nhập mật khẩu"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    required
                                />

                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() =>
                                        setShowPassword((current) => !current)
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Ẩn mật khẩu"
                                            : "Hiện mật khẩu"
                                    }
                                >
                                    {showPassword ? "Ẩn" : "Hiện"}
                                </button>
                            </div>
                        </div>

                        {/* Thông báo lỗi */}
                        {error && (
                            <div
                                className="form-error"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        {/* Nút đăng nhập */}
                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Đang đăng nhập..."
                                : "Đăng nhập"}
                        </button>
                    </form>

                    <p className="login-note">
                        Chức năng đăng ký và xác minh email
                        bằng OTP sẽ được bổ sung sau.
                    </p>
                </div>
            </section>
        </main>
    );
}

export default App;
