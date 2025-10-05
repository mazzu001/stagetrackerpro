console.log("[MAIN.TSX] Script starting...");

// Initialize mobile API fallback system FIRST (before any components load)
import "./lib/mobile-api-fallback";

// Force unregister any service workers first
if ('serviceWorker' in navigator) {
  console.log("[MAIN.TSX] Unregistering service workers...");
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('[MAIN.TSX] Unregistered service worker:', registration);
    }
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