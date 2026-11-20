
 // ======================================================
 // KDOCUMENT - DỊCH VỤ GỌI API
 // DAY 14 - REACT + EXPRESS
 // ======================================================

type ApiOptions = RequestInit & {
  token?: string;
};

// ======================================================
// [01] HÀM GỌI API DÙNG CHUNG
// ======================================================

export const apiRequest = async <T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> => {
  const { token, ...requestOptions } = options;

  // ----------------------------------------------------
  // [02] CHUẨN BỊ HEADERS
  // ----------------------------------------------------

  const headers = new Headers(requestOptions.headers);

  if (
    requestOptions.body != null &&
    !(requestOptions.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  // ----------------------------------------------------
  // [03] THÊM JWT NẾU ĐÃ ĐĂNG NHẬP
  // ----------------------------------------------------

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // ----------------------------------------------------
  // [04] GỬI REQUEST ĐẾN BACKEND
  // ----------------------------------------------------

  const response = await fetch(
    `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`,
    {
      ...requestOptions,
      headers,
    }
  );

  // ----------------------------------------------------
  // [05] ĐỌC PHẢN HỒI TỪ BACKEND
  // ----------------------------------------------------

  const responseText = await response.text();

  // Không khởi tạo null vì sẽ luôn được gán trong try.
  let data: unknown;

  try {
    data = responseText
      ? JSON.parse(responseText)
      : null;
  } catch {
    throw new Error(
      `Backend trả về dữ liệu không hợp lệ (HTTP ${response.status})`
    );
  }

  // ----------------------------------------------------
  // [06] XỬ LÝ HTTP ERROR
  // ----------------------------------------------------

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

  // ----------------------------------------------------
  // [07] TRẢ DỮ LIỆU CHO COMPONENT
  // ----------------------------------------------------

  return data as T;
};
