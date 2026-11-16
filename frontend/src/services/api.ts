
// ======================================================
// KDOCUMENT - DỊCH VỤ GỌI API
// DAY 14 - REACT + EXPRESS
// ======================================================

type ApiOptions = RequestInit & {
    token?: string;
};

// [01] HÀM GỌI API DÙNG CHUNG
export const apiRequest = async <T>(
    endpoint: string,
    options: ApiOptions = {}
): Promise<T> => {

    const { token, ...requestOptions } = options;

    // [02] Chuẩn bị headers
    const headers = new Headers(requestOptions.headers);

    if (
        requestOptions.body != null &&
        !(requestOptions.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    // [03] Thêm JWT nếu đã đăng nhập
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // [04] Gửi request
    const response = await fetch(
        `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`,
        {
            ...requestOptions,
            headers
        }
    );

    // [05] Đọc phản hồi từ backend
    const responseText = await response.text();

    let data: unknown = null;

    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        throw new Error(
            `Backend trả về dữ liệu không hợp lệ (HTTP ${response.status})`
        );
    }

    // [06] Xử lý lỗi
    if (!response.ok) {
        const errorData = data as {
            message?: string;
            error?: string;
        } | null;

        throw new Error(
            errorData?.message ||
            errorData?.error ||
            `Yêu cầu thất bại (HTTP ${response.status})`
        );
    }

    return data as T;
};
