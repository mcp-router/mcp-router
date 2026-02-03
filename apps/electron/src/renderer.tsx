import "@mcp_router/tailwind-config/base.css";
import "./renderer/utils/i18n"; // Import i18n initialization first
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/renderer/components/App";
import { HashRouter } from "react-router-dom";
import { TitleBar } from "@/renderer/components/TitleBar";
import { SidebarProvider } from "@mcp_router/ui";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <HashRouter>
      <SidebarProvider
        defaultOpen={true}
        className="h-screen flex flex-col bg-background"
      >
        <TitleBar />
        <div className="flex-1 relative">
          <App />
        </div>
      </SidebarProvider>
    </HashRouter>
  </React.StrictMode>,
);
