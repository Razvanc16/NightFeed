import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { initErrorReporting } from "./utils/errorReporting";

initErrorReporting();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    {/* Statistici de vizite și viteză Vercel — fără cookie-uri */}
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);
