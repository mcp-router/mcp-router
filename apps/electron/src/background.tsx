import React from "react";
import { createRoot } from "react-dom/client";
import { PlatformAPIProvider } from "@/renderer/platform-api";
import { electronPlatformAPI } from "@/renderer/platform-api/electron-platform-api";
import "@mcp_router/tailwind-config/base.css";

const BackgroundRoot: React.FC = () => (
  <div className="p-4 text-sm text-muted-foreground">
    Background services for agents have been disabled.
  </div>
);

// Create a root container for the background component
const container = document.getElementById("background-root");
if (container) {
  const root = createRoot(container);
  root.render(
    <PlatformAPIProvider platformAPI={electronPlatformAPI}>
      <BackgroundRoot />
    </PlatformAPIProvider>,
  );
} else {
  console.error("Background root element not found");
}
