import "@mcp_router/tailwind-config/base.css";
import "./renderer/utils/i18n"; // Import i18n initialization first
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/renderer/components/App";
import { HashRouter } from "react-router-dom";
import { TitleBar } from "@/renderer/components/TitleBar";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <HashRouter>
      <div className="h-screen flex flex-col">
        <TitleBar />
        <div className="flex-1 overflow-hidden">
          <div className="h-2" />
          <App />
        </div>
      </div>
    </HashRouter>
  </React.StrictMode>,
);
