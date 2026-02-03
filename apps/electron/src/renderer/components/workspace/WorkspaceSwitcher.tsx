import React, { useState, useMemo } from "react";
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
} from "@mcp_router/ui";
import { Check, ChevronDown, Plus, Settings, Monitor } from "lucide-react";
import { useWorkspaceStore } from "@/renderer/stores/workspace-store";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspaceStore();
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);

  // Sort workspaces by name
  const sortedWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspaces]);

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (currentWorkspace?.id !== workspaceId) {
      await switchWorkspace(workspaceId);
      // Navigate to root after switching workspace
      navigate("/");
    }
  };

  const handleAddWorkspace = () => {
    setEditingWorkspace(null);
    setShowWorkspaceDialog(true);
  };

  const handleManageWorkspaces = () => {
    navigate("/settings/workspaces");
  };

  const getWorkspaceIcon = () => {
    return Monitor;
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
            className="h-9 px-4 rounded-full hover:bg-secondary/60 border border-border/20 transition-all flex items-center gap-2.5"
          >
            <Avatar className="h-6 w-6 border border-border/40">
              {currentWorkspace?.displayInfo?.avatarUrl ? (
                <AvatarImage src={currentWorkspace.displayInfo.avatarUrl} />
              ) : (
                <AvatarFallback className="text-[10px] font-bold bg-primary/5 text-primary">
                  {currentWorkspace
                    ? getWorkspaceInitials(currentWorkspace.name)
                    : "?"}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="text-sm font-semibold tracking-tight">
              {currentWorkspace?.name || t("workspace.selectWorkspace")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-40" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-64 rounded-xl border-border/40 shadow-lg p-1.5"
        >
          {sortedWorkspaces.map((workspace) => {
            const Icon = getWorkspaceIcon();
            const isActive = currentWorkspace?.id === workspace.id;

            return (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleWorkspaceSwitch(workspace.id)}
                className="cursor-pointer rounded-lg py-2 px-3 focus:bg-primary/5"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 flex items-center justify-center">
                      {isActive && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground/60" />
                    <span
                      className={`text-sm ${isActive ? "font-semibold text-primary" : "font-medium"}`}
                    >
                      {workspace.name}
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator className="my-1.5 bg-border/40" />

          <DropdownMenuItem
            onClick={handleAddWorkspace}
            className="cursor-pointer rounded-lg py-2 px-3 focus:bg-primary/5"
          >
            <Plus className="mr-2.5 h-4 w-4 text-muted-foreground/60" />
            <span className="text-sm font-medium">{t("workspace.addNew")}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleManageWorkspaces}
            className="cursor-pointer rounded-lg py-2 px-3 focus:bg-primary/5"
          >
            <Settings className="mr-2.5 h-4 w-4 text-muted-foreground/60" />
            <span className="text-sm font-medium">{t("workspace.manage")}</span>
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
