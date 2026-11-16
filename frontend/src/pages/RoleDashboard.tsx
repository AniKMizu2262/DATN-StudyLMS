
import type { AppPage } from "../components/layout/AppLayout";
import "./RoleDashboard.css";

// ======================================================
// KDOCUMENT - DAY 15
// DASHBOARD THEO VAI TRÒ NGƯỜI DÙNG
// ======================================================

// [01] KHAI BÁO KIỂU DỮ LIỆU

type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

interface DashboardUser {
    full_name: string;
    role: string;
}

interface RoleDashboardProps {
    user: DashboardUser;
    onNavigate: (page: AppPage) => void;
}

interface DashboardFeature {
    title: string;
    description: string;
    icon: string;
    page?: AppPage;
}

interface DashboardConfig {
    title: string;
    description: string;
    features: DashboardFeature[];
}

// ======================================================
// [02] CẤU HÌNH THEO VAI TRÒ
// Không sử dụng số liệu giả từ Stitch
// ======================================================

const DASHBOARDS: Record<UserRole, DashboardConfig> = {
    STUDENT: {
        title: "Không gian học tập",
        description:
            "Khám phá tài liệu môn học và học tập cùng Kdocument AI.",
        features: [
            {
                title: "Trợ lý Kdocument AI",
                description:
                    "Hỏi đáp theo tài liệu và xem nguồn trích dẫn.",
                icon: "auto_awesome",
                page: "ai"
            },
            {
                title: "Thư viện tài liệu",
                description:
                    "Tìm kiếm và truy cập tài liệu được phép xem.",
                icon: "folder_open"
            },
            {
                title: "Lịch sử hội thoại",
                description:
                    "Xem lại những phiên hỏi đáp đã lưu.",
                icon: "history"
            }
        ]
    },

    TEACHER: {
        title: "Không gian giảng viên",
        description:
            "Quản lý môn học, học liệu và hỗ trợ sinh viên.",
        features: [
            {
                title: "Môn học phụ trách",
                description:
                    "Xem các môn học được phân công giảng dạy.",
                icon: "school"
            },
            {
                title: "Quản lý tài liệu",
                description:
                    "Tải lên, chỉnh sửa và kiểm duyệt học liệu.",
                icon: "fact_check"
            },
            {
                title: "Trợ lý Kdocument AI",
                description:
                    "Hỏi đáp theo tài liệu thuộc quyền truy cập.",
                icon: "auto_awesome",
                page: "ai"
            }
        ]
    },

    ADMIN: {
        title: "Trung tâm quản trị",
        description:
            "Quản lý người dùng, môn học và vận hành Kdocument.",
        features: [
            {
                title: "Quản lý người dùng",
                description:
                    "Quản lý tài khoản và trạng thái hoạt động.",
                icon: "group"
            },
            {
                title: "Phân công giảng viên",
                description:
                    "Gán nhiều giảng viên phụ trách một môn học.",
                icon: "admin_panel_settings"
            },
            {
                title: "Thống kê hệ thống",
                description:
                    "Theo dõi hoạt động và tình hình sử dụng.",
                icon: "bar_chart"
            }
        ]
    }
};

// [03] KIỂM TRA VAI TRÒ HỢP LỆ
const isUserRole = (role: string): role is UserRole => {
    return (
        role === "STUDENT" ||
        role === "TEACHER" ||
        role === "ADMIN"
    );
};

// ======================================================
// [04] COMPONENT DASHBOARD
// ======================================================

function RoleDashboard({
    user,
    onNavigate
}: RoleDashboardProps) {

    // Không hiển thị nhầm Dashboard nếu role không hợp lệ
    if (!isUserRole(user.role)) {
        return (
            <section className="kd-dashboard">
                <div className="kd-dashboard__hero">
                    <h2>Vai trò chưa được hỗ trợ</h2>
                    <p>
                        Không thể xác định giao diện phù hợp
                        với tài khoản hiện tại.
                    </p>
                </div>
            </section>
        );
    }

    const config = DASHBOARDS[user.role];

    return (
        <div className="kd-dashboard">

            {/* [A] LỜI CHÀO */}
            <section className="kd-dashboard__hero">
                <span className="kd-dashboard__eyebrow">
                    KDOCUMENT LEARNING MANAGEMENT SYSTEM
                </span>

                <h2>
                    Xin chào, {user.full_name}!
                </h2>

                <p>{config.description}</p>
            </section>

            {/* [B] TIÊU ĐỀ KHU VỰC */}
            <section className="kd-dashboard__section">
                <div className="kd-dashboard__heading">
                    <div>
                        <h2>{config.title}</h2>
                        <p>
                            Chức năng hiển thị theo vai trò tài khoản.
                        </p>
                    </div>
                </div>

                {/* [C] DANH SÁCH CHỨC NĂNG */}
                <div className="kd-dashboard__grid">
                    {config.features.map((feature) => (
                        <article
                            key={feature.title}
                            className="kd-dashboard__card"
                        >
                            <div className="kd-dashboard__icon">
                                <span className="material-symbols-outlined">
                                    {feature.icon}
                                </span>
                            </div>

                            <h3>{feature.title}</h3>
                            <p>{feature.description}</p>

                            {feature.page ? (
                                <button
                                    type="button"
                                    className="kd-dashboard__action"
                                    onClick={() =>
                                        onNavigate(feature.page!)
                                    }
                                >
                                    Mở chức năng
                                    <span className="material-symbols-outlined">
                                        arrow_forward
                                    </span>
                                </button>
                            ) : (
                                <span className="kd-dashboard__pending">
                                    Chưa kết nối giao diện/API
                                </span>
                            )}
                        </article>
                    ))}
                </div>
            </section>

            {/* [D] THÔNG BÁO TRẠNG THÁI */}
            <div className="kd-dashboard__notice">
                <span className="material-symbols-outlined">
                    info
                </span>

                <p>
                    Một số chức năng đang được phát triển.
                    Dữ liệu thống kê và danh sách sẽ được
                    kết nối từ backend, không sử dụng số liệu
                    minh họa của Stitch.
                </p>
            </div>
        </div>
    );
}

export default RoleDashboard;
