import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:5055";
  return {
    server: {
      host: "::",
      port: 5173,
      allowedHosts: ["mti-gym.merdekabattery.com"],
      hmr: { overlay: false },
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/gym-controller-access": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/gym-controller-settings": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/gym-access-committee": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/gym-access-committee-add": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/gym-access-committee-remove": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/employee-core": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
