import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/frontend/stores/workspace-store";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { usePlatformAPI } from "@mcp-router/platform-api";

export function TitleBar() {
  const { loadCurrentWorkspace, loadWorkspaces } = useWorkspaceStore();
  const platformAPI = usePlatformAPI();
  const [platform, setPlatform] = useState<"darwin" | "win32" | "linux">(
    "darwin",
  );

  useEffect(() => {
    // 初期データの読み込み
    loadCurrentWorkspace();
    loadWorkspaces();
  }, [loadCurrentWorkspace, loadWorkspaces]);

  useEffect(() => {
    // プラットフォーム情報の取得
    platformAPI.getPlatform().then(setPlatform);
  }, [platformAPI]);

  return (
    <div
      className="h-[50px] fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* 左側のスペース（macOSのトラフィックライト用） */}
      <div className={platform === "darwin" ? "w-20" : "w-4"} />

      {/* 中央：アプリタイトル */}
      <div className="flex-1 text-center text-sm font-medium text-muted-foreground select-none">
        MCP Router
      </div>

      {/* 右側：ワークスペーススイッチャー */}
      <div
        className={platform === "win32" ? "pr-[140px]" : "pr-4"}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <WorkspaceSwitcher />
      </div>
    </div>
  );
}
