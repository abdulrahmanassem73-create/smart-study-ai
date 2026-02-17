import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initAuthListener } from "@/lib/auth";
import { getActiveThemeClass } from "@/lib/user-settings";

// Simple global first-load loader (prevents blank flash)
const rootEl = document.getElementById("root")!;
rootEl.innerHTML = `
  <div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;">
    <div style="max-width:520px">
      <div style="font-family:Changa, system-ui; font-weight:800; font-size:28px;">Academic AI</div>
      <div style="font-family:Almarai, system-ui; opacity:.75; margin-top:8px;">جاري تجهيز المنصة...</div>
      <div style="height:10px; background: rgba(0,0,0,.08); border-radius:999px; overflow:hidden; margin-top:18px;">
        <div style="height:100%; width:40%; background: rgba(11,58,138,.85); border-radius:999px; animation: aass-loader 1.1s ease-in-out infinite alternate;"></div>
      </div>
    </div>
  </div>
  <style>
    @keyframes aass-loader { from { transform: translateX(-20%); } to { transform: translateX(120%);} }
  </style>
`;

// Keep cached user in sync with Supabase session (if configured)
initAuthListener();

// Apply theme class early (based on cached settings)
try {
  const cls = getActiveThemeClass();
  if (cls) document.documentElement.classList.add(cls);
} catch {
  // ignore
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
