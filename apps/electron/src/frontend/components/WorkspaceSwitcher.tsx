import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
} from "@mcp-router/ui";
import {
  Check,
  ChevronDown,
  Plus,
  Settings,
  Globe,
  Monitor,
} from "lucide-react";
import { useWorkspaceStore } from "@/frontend/stores/workspace-store";
import { WorkspaceDialog } from "./WorkspaceDialog";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspaceStore();
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (currentWorkspace?.id !== workspaceId) {
      await switchWorkspace(workspaceId);
    }
  };

  const handleAddWorkspace = () => {
    setEditingWorkspace(null);
    setShowWorkspaceDialog(true);
  };

  const handleManageWorkspaces = () => {
    // TODO: ワークスペース管理画面を開く
    console.log("Manage workspaces");
  };

  const getWorkspaceIcon = (type: string) => {
    return type === "local" ? Monitor : Globe;
  };

  const getWorkspaceInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 hover:bg-accent"
          >
            <Avatar className="h-5 w-5 mr-2">
              {currentWorkspace?.displayInfo?.avatarUrl ? (
                <AvatarImage src={currentWorkspace.displayInfo.avatarUrl} />
              ) : (
                <AvatarFallback className="text-xs">
                  {currentWorkspace
                    ? getWorkspaceInitials(currentWorkspace.name)
                    : "?"}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="text-sm">
              {currentWorkspace?.name || "ワークスペース選択"}
            </span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {workspaces.map((workspace) => {
            const Icon = getWorkspaceIcon(workspace.type);
            const isActive = currentWorkspace?.id === workspace.id;

            return (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleWorkspaceSwitch(workspace.id)}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    {isActive && <Check className="mr-2 h-4 w-4" />}
                    {!isActive && <div className="mr-2 w-4" />}
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm">{workspace.name}</span>
                      {workspace.type === "remote" &&
                        workspace.displayInfo?.teamName && (
                          <span className="text-xs text-muted-foreground">
                            {workspace.displayInfo.teamName}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleAddWorkspace}
            className="cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>新しいワークスペースを追加</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleManageWorkspaces}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>ワークスペースを管理</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showWorkspaceDialog && (
        <WorkspaceDialog
          workspace={editingWorkspace}
          onClose={() => {
            setShowWorkspaceDialog(false);
            setEditingWorkspace(null);
          }}
        />
      )}
    </>
  );
}
