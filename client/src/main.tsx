console.log("[MAIN.TSX] Script starting...");

// Initialize mobile API fallback system FIRST (before any components load)
import "./lib/mobile-api-fallback";

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[MAIN.TSX] Service worker registered:', registration);
      })
      .catch((error) => {
        console.log('[MAIN.TSX] Service worker registration failed:', error);
      });
  });
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("[MAIN.TSX] About to render React app...");
const rootEl = document.getElementById("root");
console.log("[MAIN.TSX] Root element:", rootEl);

if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
    console.log("[MAIN.TSX] React app rendered successfully");
  } catch (error) {
    console.error("[MAIN.TSX] Error rendering app:", error);
  }
} else {
  console.error("[MAIN.TSX] Root element not found!");
}