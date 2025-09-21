import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🚀 main.tsx loading...");
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("❌ Root element not found!");
  document.body.innerHTML = "<h1>Error: Root element not found</h1>";
} else {
  console.log("✅ Root element found, rendering app...");
  try {
    createRoot(rootElement).render(<App />);
    console.log("✅ App rendered successfully");
  } catch (error) {
    console.error("❌ Error rendering app:", error);
    document.body.innerHTML = `<h1>Error rendering app: ${error}</h1>`;
  }
}