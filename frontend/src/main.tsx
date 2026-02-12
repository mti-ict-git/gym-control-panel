import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const apiBase = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_BACKEND_URL;
if (apiBase && apiBase.trim().length > 0) {
  const base = apiBase.replace(/\/+$/, "");
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return originalFetch(`${base}${input}`, init);
    }
    return originalFetch(input as RequestInfo | URL, init);
  };
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
