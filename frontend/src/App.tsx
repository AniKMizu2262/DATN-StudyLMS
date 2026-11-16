
import { useState, type FormEvent } from "react";
import { apiRequest } from "./services/api";
import RagChat from "./components/RagChat";
import "./App.css";

// ======================================================
// KDOCUMENT - GIAO DIỆN ĐĂNG NHẬP
// DAY 14 - REACT + TYPESCRIPT
// ======================================================

// [01] Kiểu dữ liệu người dùng từ backend
interface User {
    user_id: number;
    full_name: string;
    email: string;
    role: string;
}

// [02] Cấu trúc phản hồi API đăng nhập
interface LoginResponse {
    success: boolean;
    message: string;
    data: {
        token: string;
        user: User;
    };
}

// [03] Thông tin phiên đăng nhập
interface AuthSession {
    token: string;
    user: User;
}

const SESSION_KEY = "kdocument_session";

const ROLE_NAMES: Record<string, string> = {
    ADMIN: "Quản trị viên",
    TEACHER: "Giảng viên",
    STUDENT: "Sinh viên"
};

// [04] Khôi phục phiên đăng nhập khi tải lại trang
const loadSession = (): AuthSession | null => {
    try {
        const saved = sessionStorage.getItem(SESSION_KEY);

        if (!saved) return null;

        const session = JSON.parse(saved) as AuthSession;

        if (
            typeof session?.token !== "string" ||
            !session.token ||
            !session.user?.email
        ) {
            return null;
        }

        return session;
    } catch {
        return null;
    }
};

// ======================================================
// [A] COMPONENT CHÍNH
// ======================================================

function App() {
    const [session, setSession] = useState<AuthSession | null>(
        loadSession
    );

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // ==================================================
    // [B] ĐĂNG NHẬP QUA EXPRESS API
    // ==================================================

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return;

        setError("");
        setLoading(true);

        try {
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

            if (
                !response.success ||
                !response.data?.token ||
                !response.data?.user
            ) {
                throw new Error("Dữ liệu đăng nhập không hợp lệ");
            }

            const newSession: AuthSession = {
                token: response.data.token,
                user: response.data.user
            };

            // Lưu phiên thử nghiệm trong tab trình duyệt
            sessionStorage.setItem(
                SESSION_KEY,
                JSON.stringify(newSession)
            );

            setSession(newSession);
            setPassword("");

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Không thể đăng nhập. Vui lòng thử lại."
            );
        } finally {
            setLoading(false);
        }
    };

    // ==================================================
    // [C] ĐĂNG XUẤT
    // ==================================================

    const handleLogout = () => {
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
        setEmail("");
        setPassword("");
        setError("");
    };

    // ==================================================
    // [D] GIAO DIỆN SAU KHI ĐĂNG NHẬP
    // ==================================================

    if (session) {
        const { user } = session;

        return (
            <div className="dashboard-page">
                <header className="dashboard-header">
                    <div className="brand">
                        <span className="brand-mark">K</span>
                        <span>Kdocument</span>
                    </div>

                    <button
                        type="button"
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        Đăng xuất
                    </button>
                </header>

                <main className="dashboard-main">
                    <div className="welcome-icon">✓</div>

                    <span className="eyebrow">
                        KDOCUMENT LEARNING PLATFORM
                    </span>

                    <h1>Chào mừng trở lại!</h1>

                    <p className="welcome-description">
                        Đăng nhập thành công. Tài khoản của bạn
                        đã kết nối với hệ thống Kdocument.
                    </p>

                    <section className="profile-card">
                        <div className="profile-avatar">
                            {user.full_name.charAt(0).toUpperCase()}
                        </div>

                        <div className="profile-details">
                            <h2>{user.full_name}</h2>
                            <p>{user.email}</p>
                            <span className="role-label">
                                {ROLE_NAMES[user.role] || user.role}
                            </span>
                        </div>
                    </section>

                    <RagChat token={session.token} />
                </main>
            </div>
        );
    }

    // ==================================================
    // [E] GIAO DIỆN ĐĂNG NHẬP
    // ==================================================

    return (
        <main className="login-page">
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

            <section className="login-panel">
                <div className="login-form-wrapper">
                    <div className="mobile-brand">
                        <span className="brand-mark">K</span>
                        <strong>Kdocument</strong>
                    </div>

                    <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>

                    <h2>Đăng nhập</h2>

                    <p className="form-description">
                        Sử dụng tài khoản Kdocument để tiếp tục.
                    </p>

                    <form onSubmit={handleLogin}>
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
                                        setShowPassword(!showPassword)
                                    }
                                >
                                    {showPassword ? "Ẩn" : "Hiện"}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div
                                className="form-error"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

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
