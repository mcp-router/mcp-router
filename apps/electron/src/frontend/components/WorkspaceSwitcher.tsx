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
} from "@mcp-router/ui";
import { Check, ChevronDown, Plus, Settings, Monitor } from "lucide-react";
import { useWorkspaceStore } from "@/frontend/stores/workspace-store";
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
            className="h-8 px-3 hover:bg-accent/50"
          >
            <Avatar className="h-6 w-6 mr-2">
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
              {currentWorkspace?.name || t("workspace.selectWorkspace")}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {sortedWorkspaces.map((workspace) => {
            const Icon = getWorkspaceIcon();
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
            <span>{t("workspace.addNew")}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleManageWorkspaces}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>{t("workspace.manage")}</span>
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
