import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/renderer/stores/workspace-store";
import { WorkspaceSwitcher } from "./workspace/WorkspaceSwitcher";
import { usePlatformAPI } from "@/renderer/platform-api";
import { SidebarTrigger } from "@mcp_router/ui";

export function TitleBar() {
  const { loadWorkspaces } = useWorkspaceStore();
  const platformAPI = usePlatformAPI();
  const [platform, setPlatform] = useState<"darwin" | "win32" | "linux">(
    "darwin",
  );

  useEffect(() => {
    // Only load workspace list (current workspace is loaded in App.tsx)
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    // Get platform info
    platformAPI.packages.system.getPlatform().then(setPlatform);
  }, [platformAPI]);

  return (
    <div
      className="h-[var(--titlebar-height)] fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-background/80 backdrop-blur-md border-b border-border/40"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left space (for macOS traffic lights + SidebarTrigger) */}
      <div className="flex items-center">
        <div className={platform === "darwin" ? "w-20" : "w-4"} />
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="ml-2"
        >
          <SidebarTrigger className="h-8 w-8 rounded-full hover:bg-primary/10 transition-colors" />
        </div>
      </div>

      {/* Center: App title */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 select-none pointer-events-none">
        MCP Router
      </div>

      {/* Right: Workspace switcher */}
      <div
        className={platform === "win32" ? "pr-[140px]" : "pr-4"}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <WorkspaceSwitcher />
      </div>
    </div>
  );
}
