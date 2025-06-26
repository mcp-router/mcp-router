import React, { useEffect } from "react";
import { useWorkspaceStore } from "@/frontend/stores/workspace-store";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export function TitleBar() {
  const { currentWorkspace, loadCurrentWorkspace, loadWorkspaces } =
    useWorkspaceStore();

  useEffect(() => {
    // 初期データの読み込み
    loadCurrentWorkspace();
    loadWorkspaces();
  }, [loadCurrentWorkspace, loadWorkspaces]);

  return (
    <div
      className="h-8 fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* 左側のスペース（macOSのトラフィックライト用） */}
      <div className="w-20" />

      {/* 中央：アプリタイトル（オプション） */}
      <div className="flex-1 text-center text-sm text-muted-foreground select-none">
        {/* MCP Router */}
      </div>

      {/* 右側：ワークスペーススイッチャー */}
      <div className="pr-4" style={{ WebkitAppRegion: "no-drag" } as any}>
        <WorkspaceSwitcher />
      </div>
    </div>
  );
}
