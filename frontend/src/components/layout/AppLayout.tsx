
import { useState, type ReactNode } from "react";
import "./AppLayout.css";

// ======================================================
// KDOCUMENT - DAY 15
// KHUNG GIAO DIỆN DÙNG CHUNG CHO 3 VAI TRÒ
// ======================================================

// [01] Các trang đã có thể điều hướng
export type AppPage = "dashboard" | "ai";

type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

interface LayoutUser {
    user_id: number;
    full_name: string;
    email: string;
    role: string;
}

interface AppLayoutProps {
    user: LayoutUser;
    activePage: AppPage;
    onNavigate: (page: AppPage) => void;
    onLogout: () => void;
    children: ReactNode;
}

interface MenuItem {
    label: string;
    icon: string;
    page?: AppPage;
}

// [02] Tên vai trò hiển thị
const ROLE_LABELS: Record<UserRole, string> = {
    STUDENT: "Sinh viên",
    TEACHER: "Giảng viên",
    ADMIN: "Quản trị viên"
};

// [03] Menu riêng của từng vai trò
// Mục chưa có page chỉ hiển thị, không điều hướng.
const ROLE_MENUS: Record<UserRole, MenuItem[]> = {
    STUDENT: [
        { label: "Tổng quan", icon: "space_dashboard", page: "dashboard" },
        { label: "Môn học", icon: "school" },
        { label: "Tài liệu", icon: "folder_open" },
        { label: "Trợ lý AI", icon: "auto_awesome", page: "ai" },
        { label: "Lịch sử hội thoại", icon: "history" },
        { label: "Cài đặt", icon: "settings" }
    ],

    TEACHER: [
        { label: "Tổng quan", icon: "space_dashboard", page: "dashboard" },
        { label: "Môn phụ trách", icon: "school" },
        { label: "Quản lý tài liệu", icon: "folder_open" },
        { label: "Kiểm duyệt", icon: "fact_check" },
        { label: "Trợ lý AI", icon: "auto_awesome", page: "ai" },
        { label: "Cài đặt", icon: "settings" }
    ],

    ADMIN: [
        { label: "Tổng quan", icon: "space_dashboard", page: "dashboard" },
        { label: "Người dùng", icon: "group" },
        { label: "Phân quyền", icon: "admin_panel_settings" },
        { label: "Môn học", icon: "school" },
        { label: "Tài liệu dùng chung", icon: "folder_shared" },
        { label: "Thống kê", icon: "bar_chart" },
        { label: "Cài đặt", icon: "settings" }
    ]
};

// [04] Kiểm tra vai trò trước khi dùng để dựng menu
const isUserRole = (value: string): value is UserRole => {
    return ["STUDENT", "TEACHER", "ADMIN"].includes(value);
};

// ======================================================
// COMPONENT KHUNG GIAO DIỆN
// ======================================================

function AppLayout({
    user,
    activePage,
    onNavigate,
    onLogout,
    children
}: AppLayoutProps) {

    // [05] Điều khiển sidebar trên điện thoại
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const role = isUserRole(user.role) ? user.role : null;
    const roleLabel = role
        ? ROLE_LABELS[role]
        : "Vai trò chưa xác định";

    const menuItems = role
        ? ROLE_MENUS[role]
        : [{ label: "Tổng quan", icon: "space_dashboard", page: "dashboard" as AppPage }];

    const pageTitle = activePage === "ai"
        ? "Trợ lý Kdocument AI"
        : "Tổng quan";

    const initial = user.full_name?.trim().charAt(0).toUpperCase() || "U";

    // [06] Điều hướng trong ứng dụng
    const handleNavigate = (page: AppPage) => {
        onNavigate(page);
        setMobileMenuOpen(false);
    };

    return (
        <div className="kd-shell">

            {/* [A] Lớp nền khi mở menu trên mobile */}
            {mobileMenuOpen && (
                <button
                    type="button"
                    className="kd-overlay"
                    aria-label="Đóng menu"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* [B] Sidebar */}
            <aside
                className={
                    `kd-sidebar ${mobileMenuOpen ? "kd-sidebar-open" : ""}`
                }
            >
                <div className="kd-logo">
                    <div className="kd-logo-icon">K</div>

                    <div>
                        <strong>Kdocument</strong>
                        <small>Learning Management</small>
                    </div>
                </div>

                <div className="kd-sidebar-label">
                    KHÔNG GIAN LÀM VIỆC
                </div>

                <nav className="kd-nav" aria-label="Điều hướng chính">
                    {menuItems.map((item) => {
                        const isActive = item.page === activePage;

                        if (!item.page) {
                            return (
                                <div
                                    key={item.label}
                                    className="kd-nav-item kd-nav-disabled"
                                    title="Chức năng sẽ được triển khai sau"
                                >
                                    <span className="material-symbols-outlined">
                                        {item.icon}
                                    </span>

                                    <span>{item.label}</span>

                                    <small className="kd-coming-soon">
                                        Sắp có
                                    </small>
                                </div>
                            );
                        }

                        return (
                            <button
                                key={item.label}
                                type="button"
                                className={
                                    `kd-nav-item ${isActive ? "kd-nav-active" : ""}`
                                }
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => handleNavigate(item.page!)}
                            >
                                <span className="material-symbols-outlined">
                                    {item.icon}
                                </span>

                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* [C] Thông tin người dùng ở cuối sidebar */}
                <div className="kd-sidebar-user">
                    <div className="kd-user-avatar">{initial}</div>

                    <div className="kd-user-information">
                        <strong>{user.full_name}</strong>
                        <small>{roleLabel}</small>
                    </div>
                </div>
            </aside>

            {/* [D] Khu vực chính */}
            <div className="kd-main-area">

                {/* Header */}
                <header className="kd-topbar">
                    <div className="kd-header-left">
                        <button
                            type="button"
                            className="kd-menu-toggle"
                            aria-label="Mở menu"
                            onClick={() =>
                                setMobileMenuOpen(!mobileMenuOpen)
                            }
                        >
                            <span className="material-symbols-outlined">
                                menu
                            </span>
                        </button>

                        <div>
                            <div className="kd-breadcrumb">
                                Kdocument / {roleLabel}
                            </div>

                            <h1>{pageTitle}</h1>
                        </div>
                    </div>

                    <div className="kd-header-right">
                        <div className="kd-header-account">
                            <div className="kd-user-avatar">{initial}</div>

                            <div>
                                <strong>{user.full_name}</strong>
                                <small>{roleLabel}</small>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="kd-logout"
                            onClick={onLogout}
                        >
                            <span className="material-symbols-outlined">
                                logout
                            </span>
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </header>

                {/* Nội dung thay đổi theo trang */}
                <main className="kd-content">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default AppLayout;
