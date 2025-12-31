import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    allowedHosts: ["mti-gym.merdekabattery.com"],
    hmr: { overlay: false },
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5055",
        changeOrigin: true,
        secure: false,
      },
      "/gym-controller-access": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5055",
        changeOrigin: true,
        secure: false,
      },
      "/gym-controller-settings": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5055",
        changeOrigin: true,
        secure: false,
      },
      "/gym-access-committee": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5055",
        changeOrigin: true,
        secure: false,
      },
      "/gym-access-committee-add": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5055",
        changeOrigin: true,
        secure: false,
      },
      "/gym-access-committee-remove": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5055",
        changeOrigin: true,
        secure: false,
      },
      "/employee-core": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:5055",
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
}));
