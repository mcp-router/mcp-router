import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/frontend/components/App";
import { HashRouter } from "react-router-dom";
import { initializePlatformAPIShim, PlatformAPIProvider } from "@mcp-router/platform-api";
import { electronPlatformAPI } from "@/frontend/lib/electron-platform-api";

// Initialize the platform API shim for backward compatibility
initializePlatformAPIShim(electronPlatformAPI);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <HashRouter>
      <PlatformAPIProvider platformAPI={electronPlatformAPI}>
        <App />
      </PlatformAPIProvider>
    </HashRouter>
  </React.StrictMode>,
);
