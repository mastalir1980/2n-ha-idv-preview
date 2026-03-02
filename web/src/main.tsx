import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Minimal global reset
const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, sans-serif;
  }
  input:focus { border-color: #3b82f6 !important; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
