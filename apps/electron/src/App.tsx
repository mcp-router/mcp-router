import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/frontend/components/App";
import { HashRouter } from "react-router-dom";
import { PlatformAPIProvider } from "@/lib/platform-api";
import { electronPlatformAPI } from "@/frontend/lib/electron-platform-api";
import { TitleBar } from "@/frontend/components/TitleBar";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <HashRouter>
      <PlatformAPIProvider platformAPI={electronPlatformAPI}>
        <div className="h-screen flex flex-col">
          <TitleBar />
          <div className="flex-1 overflow-hidden">
            <div className="h-2" />
            <App />
          </div>
        </div>
      </PlatformAPIProvider>
    </HashRouter>
  </React.StrictMode>,
);
