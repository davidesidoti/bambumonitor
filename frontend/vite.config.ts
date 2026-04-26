import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const backend = env.VITE_BACKEND_URL ?? "http://127.0.0.1:1111";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: backend, changeOrigin: true },
        "/ws": { target: backend, ws: true, changeOrigin: true },
        "/stream": { target: backend, changeOrigin: true },
      },
    },
  };
});
