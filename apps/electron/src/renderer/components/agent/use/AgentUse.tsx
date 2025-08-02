import React, { useState, useEffect } from "react";
import {
  useNavigate,
  useParams,
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DeployedAgent } from "@mcp_router/shared";
import { Button } from "@mcp_router/ui";
import { toast } from "sonner";
import { useAgentStore, useWorkspaceStore } from "../../../stores";
import { Settings, Trash2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mcp_router/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@mcp_router/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@mcp_router/ui";
import { usePlatformAPI } from "@/renderer/platform-api";

/**
 * AgentUse Component
 * A parent component that renders the common header for both AgentChat and AgentSettings,
 * and then passes the appropriate child component based on the current route.
 */
const AgentUse: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  // Zustand store
  const {
    deployedAgents,
    setCurrentDeployedAgent,
    removeDeployedAgent,
    refreshAgents,
  } = useAgentStore();
  const { currentWorkspace } = useWorkspaceStore();

  const [agent, setAgent] = useState<DeployedAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine if we're on the chat or settings page
  const isSettingsPage = location.pathname.endsWith("/settings");

  // Redirect to chat subroute on initial display
  useEffect(() => {
    // If ID exists and path ends with /agents/use/:id, redirect to chat subroute
    if (id && location.pathname === `/agents/use/${id}`) {
      navigate(`/agents/use/${id}/chat`);
    }
  }, [id, location.pathname, navigate]);

  // Fetch agent data from store or refresh if needed
  useEffect(() => {
    const loadAgent = async () => {
      if (!id) return;

      try {
        setIsLoading(true);

        // First try to find agent in store
        let agentData = deployedAgents.find((agent) => agent.id === id);

        // If not found in store, refresh agents and try again
        if (!agentData) {
          await refreshAgents();
          // Re-check with updated store data
          const updatedStore = useAgentStore.getState();
          agentData = updatedStore.deployedAgents.find(
            (agent) => agent.id === id,
          );
        }

        if (!agentData) {
          // Don't show error toast, just redirect silently
          navigate("/agents/use");
          return;
        }

        setAgent(agentData);
        setCurrentDeployedAgent(agentData);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch agent:", error);
        toast.error(t("agents.errors.fetchFailed"));
        navigate("/agents/use");
      }
    };

    loadAgent();
  }, [
    id,
    deployedAgents,
    navigate,
    refreshAgents,
    setCurrentDeployedAgent,
    t,
    currentWorkspace?.id,
  ]);

  // Handler for navigating to settings
  const navigateToSettings = () => {
    navigate(`/agents/use/${id}/settings`);
  };

  // Handler for deleting an agent
  const handleDeleteAgent = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      await platformAPI.agents.deleteDeployed(id);
      toast.success(t("agents.success.deleted"));

      // Navigate away first before removing from store
      navigate("/agents/use");

      // Remove from store after navigation to avoid re-render issues
      setTimeout(() => {
        removeDeployedAgent(id);
      }, 100);
    } catch (error) {
      console.error("Failed to delete agent:", error);
      toast.error(t("agents.errors.deleteFailed"));
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading || !agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <RefreshCw className="h-10 w-10 animate-spin" />
          <p className="mt-4">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container h-full flex flex-col">
      {/* Common header with breadcrumb navigation */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/agents/use">{t("agents.title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {isSettingsPage ? (
              <BreadcrumbLink asChild>
                <Link to={`/agents/use/${agent.id}/chat`}>{agent.name}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{agent.name}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {isSettingsPage && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t("common.settings")}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Common header with title and action buttons */}
      <div className="flex justify-between items-start mb-3">
        <div className="max-w-[70%]">
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="text-muted-foreground break-words">
            {agent.description}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          {!isSettingsPage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={navigateToSettings} className="gap-2">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("common.settings")}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("common.delete")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Outlet
        context={{ agent }}
        key={`${agent.id}-${isSettingsPage ? "settings" : "chat"}`}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-destructive">
              {t("agents.confirmDelete", { name: agent.name })}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t("agents.deleteWarning")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDeleteAgent}
              disabled={isDeleting}
              className="sm:w-32"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t("agents.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {t("common.delete")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentUse;
