
import { useState, type ReactNode } from "react";
import "./AppLayout.css";

// ======================================================
// KDOCUMENT - DAY 18
// KHUNG GIAO DIỆN CHUNG CHO 3 VAI TRÒ
//
// Chức năng:
// - Hiển thị menu theo quyền người dùng
// - Điều hướng Dashboard / AI / Môn học
// - Quản lý sidebar trên thiết bị di động
// - Hiển thị thông tin tài khoản và đăng xuất
// ======================================================

// ======================================================
// [01] ĐỊNH NGHĨA KIỂU DỮ LIỆU
// ======================================================

// [01.1] Những trang đã hỗ trợ điều hướng.
export type AppPage =
  | "dashboard"
  | "ai"
  | "subjects";

// [01.2] Các vai trò trong hệ thống.
type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

// [01.3] Thông tin người dùng đang đăng nhập.
interface LayoutUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
}

// [01.4] Thuộc tính của component AppLayout.
interface AppLayoutProps {
  user: LayoutUser;
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
  children: ReactNode;
}

// [01.5] Cấu trúc của một mục menu.
interface MenuItem {
  label: string;
  icon: string;
  page?: AppPage;
}

// ======================================================
// [02] TÊN HIỂN THỊ THEO VAI TRÒ
// ======================================================

const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Sinh viên",
  TEACHER: "Giảng viên",
  ADMIN: "Quản trị viên",
};

// ======================================================
// [03] CẤU HÌNH MENU THEO TỪNG VAI TRÒ
//
// Những mục có page sẽ điều hướng được.
// Những mục chưa có page hiển thị "Sắp có".
// ======================================================

const ROLE_MENUS: Record<UserRole, MenuItem[]> = {
  // ----------------------------------------------------
  // [03.1] MENU SINH VIÊN
  // ----------------------------------------------------

  STUDENT: [
    {
      label: "Tổng quan",
      icon: "space_dashboard",
      page: "dashboard",
    },
    {
      label: "Môn học",
      icon: "school",
      page: "subjects",
    },
    {
      label: "Tài liệu",
      icon: "folder_open",
    },
    {
      label: "Trợ lý AI",
      icon: "auto_awesome",
      page: "ai",
    },
    {
      label: "Lịch sử hội thoại",
      icon: "history",
    },
    {
      label: "Cài đặt",
      icon: "settings",
    },
  ],

  // ----------------------------------------------------
  // [03.2] MENU GIẢNG VIÊN
  // ----------------------------------------------------

  TEACHER: [
    {
      label: "Tổng quan",
      icon: "space_dashboard",
      page: "dashboard",
    },
    {
      label: "Môn phụ trách",
      icon: "school",
      page: "subjects",
    },
    {
      label: "Quản lý tài liệu",
      icon: "folder_open",
    },
    {
      label: "Kiểm duyệt",
      icon: "fact_check",
    },
    {
      label: "Trợ lý AI",
      icon: "auto_awesome",
      page: "ai",
    },
    {
      label: "Cài đặt",
      icon: "settings",
    },
  ],

  // ----------------------------------------------------
  // [03.3] MENU QUẢN TRỊ VIÊN
  // ----------------------------------------------------

  ADMIN: [
    {
      label: "Tổng quan",
      icon: "space_dashboard",
      page: "dashboard",
    },
    {
      label: "Người dùng",
      icon: "group",
    },
    {
      label: "Phân quyền",
      icon: "admin_panel_settings",
    },
    {
      label: "Môn học",
      icon: "school",
      page: "subjects",
    },
    {
      label: "Tài liệu dùng chung",
      icon: "folder_shared",
    },
    {
      label: "Thống kê",
      icon: "bar_chart",
    },
    {
      label: "Cài đặt",
      icon: "settings",
    },
  ],
};

// ======================================================
// [04] HÀM HỖ TRỢ
// ======================================================

// [04.1] Kiểm tra vai trò người dùng hợp lệ.
const isUserRole = (value: string): value is UserRole => {
  return (
    value === "STUDENT" ||
    value === "TEACHER" ||
    value === "ADMIN"
  );
};

// [04.2] Xác định tiêu đề của trang đang mở.
const getPageTitle = (
  page: AppPage,
  role: UserRole | null
): string => {
  switch (page) {
    case "dashboard":
      return "Tổng quan";

    case "ai":
      return "Trợ lý Kdocument AI";

    case "subjects":
      return role === "TEACHER"
        ? "Môn học phụ trách"
        : "Danh sách môn học";

    default:
      return "Kdocument LMS";
  }
};

// ======================================================
// [05] COMPONENT APP LAYOUT
// ======================================================

function AppLayout({
  user,
  activePage,
  onNavigate,
  onLogout,
  children,
}: AppLayoutProps) {
  // ----------------------------------------------------
  // [05.1] QUẢN LÝ SIDEBAR TRÊN MOBILE
  // ----------------------------------------------------

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  // ----------------------------------------------------
  // [05.2] XÁC ĐỊNH VAI TRÒ NGƯỜI DÙNG
  // ----------------------------------------------------

  const role = isUserRole(user.role)
    ? user.role
    : null;

  const roleLabel = role
    ? ROLE_LABELS[role]
    : "Vai trò chưa xác định";

  // ----------------------------------------------------
  // [05.3] LẤY MENU PHÙ HỢP VỚI VAI TRÒ
  // ----------------------------------------------------

  const menuItems: MenuItem[] = role
    ? ROLE_MENUS[role]
    : [
        {
          label: "Tổng quan",
          icon: "space_dashboard",
          page: "dashboard",
        },
      ];

  // ----------------------------------------------------
  // [05.4] TIÊU ĐỀ TRANG VÀ AVATAR
  // ----------------------------------------------------

  const pageTitle = getPageTitle(activePage, role);

  const initial =
    user.full_name?.trim().charAt(0).toUpperCase() ||
    "U";

  // ----------------------------------------------------
  // [05.5] XỬ LÝ ĐIỀU HƯỚNG
  // ----------------------------------------------------

  const handleNavigate = (page: AppPage) => {
    onNavigate(page);

    // Đóng sidebar sau khi chọn trang trên mobile.
    setMobileMenuOpen(false);
  };

  // ====================================================
  // [06] GIAO DIỆN CHÍNH
  // ====================================================

  return (
    <div className="kd-shell">
      {/* ============================================= */}
      {/* [06.1] LỚP PHỦ NỀN TRÊN MOBILE */}
      {/* ============================================= */}

      {mobileMenuOpen && (
        <button
          type="button"
          className="kd-overlay"
          aria-label="Đóng menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ============================================= */}
      {/* [06.2] SIDEBAR */}
      {/* ============================================= */}

      <aside
        className={
          `kd-sidebar ${
            mobileMenuOpen ? "kd-sidebar-open" : ""
          }`
        }
      >
        {/* ------------------------------------------- */}
        {/* LOGO KDOCUMENT */}
        {/* ------------------------------------------- */}

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

        {/* ------------------------------------------- */}
        {/* MENU ĐIỀU HƯỚNG THEO VAI TRÒ */}
        {/* ------------------------------------------- */}

        <nav
          className="kd-nav"
          aria-label="Điều hướng chính"
        >
          {menuItems.map((item) => {
            const page = item.page;
            const isActive =
              page !== undefined &&
              page === activePage;

            // [06.2.1] Chức năng chưa triển khai.
            if (!page) {
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

            // [06.2.2] Chức năng đã điều hướng được.
            return (
              <button
                key={item.label}
                type="button"
                className={
                  `kd-nav-item ${
                    isActive ? "kd-nav-active" : ""
                  }`
                }
                aria-current={
                  isActive ? "page" : undefined
                }
                onClick={() => handleNavigate(page)}
              >
                <span className="material-symbols-outlined">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ------------------------------------------- */}
        {/* THÔNG TIN TÀI KHOẢN CUỐI SIDEBAR */}
        {/* ------------------------------------------- */}

        <div className="kd-sidebar-user">
          <div className="kd-user-avatar">
            {initial}
          </div>

          <div className="kd-user-information">
            <strong>{user.full_name}</strong>
            <small>{roleLabel}</small>
          </div>
        </div>
      </aside>

      {/* ============================================= */}
      {/* [06.3] KHU VỰC NỘI DUNG CHÍNH */}
      {/* ============================================= */}

      <div className="kd-main-area">
        {/* ------------------------------------------- */}
        {/* HEADER TRANG */}
        {/* ------------------------------------------- */}

        <header className="kd-topbar">
          <div className="kd-header-left">
            {/* Nút mở/đóng menu trên mobile. */}

            <button
              type="button"
              className="kd-menu-toggle"
              aria-label="Mở menu"
              aria-expanded={mobileMenuOpen}
              onClick={() =>
                setMobileMenuOpen(!mobileMenuOpen)
              }
            >
              <span className="material-symbols-outlined">
                menu
              </span>
            </button>

            {/* Breadcrumb và tiêu đề. */}

            <div>
              <div className="kd-breadcrumb">
                Kdocument / {roleLabel}
              </div>

              <h1>{pageTitle}</h1>
            </div>
          </div>

          {/* ----------------------------------------- */}
          {/* TÀI KHOẢN VÀ NÚT ĐĂNG XUẤT */}
          {/* ----------------------------------------- */}

          <div className="kd-header-right">
            <div className="kd-header-account">
              <div className="kd-user-avatar">
                {initial}
              </div>

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

        {/* ------------------------------------------- */}
        {/* NỘI DUNG ĐƯỢC RENDER THEO activePage */}
        {/* ------------------------------------------- */}

        <main className="kd-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
