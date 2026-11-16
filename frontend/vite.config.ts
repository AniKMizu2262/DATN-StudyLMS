
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ======================================================
// KDOCUMENT - CẤU HÌNH VITE
// DAY 14 - KẾT NỐI FRONTEND VỚI BACKEND
// ======================================================

export default defineConfig({
    plugins: [react()],

    server: {
        port: 5173,

        // Chuyển các request /api sang Express
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true
            }
        }
    }
});
