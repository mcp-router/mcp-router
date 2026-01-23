import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import PageLayout from "./layout/PageLayout";
import { Sonner } from "@mcp_router/ui";
import DiscoverWrapper from "@/renderer/components/mcp/server/DiscoverWrapper";
import Home from "./Home";
import { useTranslation } from "react-i18next";
import SidebarComponent from "./Sidebar";
import { SidebarProvider } from "@mcp_router/ui";
import McpAppsManager from "@/renderer/components/mcp/apps/McpAppsManager";
import LogViewer from "@/renderer/components/mcp/log/LogViewer";
import Settings from "./setting/Settings";
import { useServerStore, useAuthStore, initializeStores } from "../stores";
import { usePlatformAPI } from "@/renderer/platform-api";
import { IconProgress } from "@tabler/icons-react";
import { postHogService } from "../services/posthog-service";
import WorkspaceManagement from "./workspace/WorkspaceManagement";
import WorkflowManager from "./workflow/WorkflowManager";
import SkillsManager from "./skills/SkillsManager";

// Main App component
const App: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const platformAPI = usePlatformAPI();

  // Zustand stores
  const { refreshServers } = useServerStore();

  const { checkAuthStatus, subscribeToAuthChanges } = useAuthStore();

  // Local state for loading and temporary UI states
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize stores
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize all stores
        await initializeStores();

        // Check authentication status
        await checkAuthStatus();

        // Initialize PostHog after getting settings
        const settings = await platformAPI.settings.get();
        postHogService.initialize({
          analyticsEnabled: settings.analyticsEnabled ?? true,
          userId: settings.userId,
        });
      } catch (error) {
        console.error("Failed to initialize app:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [checkAuthStatus, platformAPI]);

  // Subscribe to authentication changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges();

    // Also subscribe to auth changes for PostHog
    const authUnsubscribe = platformAPI.auth.onChange(async (status) => {
      const settings = await platformAPI.settings.get();
      postHogService.updateConfig({
        analyticsEnabled: settings.analyticsEnabled ?? true,
        userId: status.authenticated ? status.userId : undefined,
      });
    });

    return () => {
      unsubscribe();
      authUnsubscribe();
    };
  }, [subscribeToAuthChanges, platformAPI]);

  // Subscribe to protocol URL events
  useEffect(() => {
    const unsubscribe = platformAPI.packages.system.onProtocolUrl((url) => {
      handleProtocolUrl(url);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle protocol URL processing
  const handleProtocolUrl = useCallback(
    async (urlString: string) => {
      const url = new URL(urlString);
      try {
        if (url.hostname === "auth") {
          const token = url.searchParams.get("token");
          const state = url.searchParams.get("state");
          if (token && state) {
            await platformAPI.auth.handleToken(token, state);
            // Navigate to settings page
            navigate("/settings");
          }
        }
      } catch (error) {
        console.error("Failed to process protocol URL:", error);
      }
    },
    [navigate],
  );

  // Refresh servers on initial load only
  useEffect(() => {
    refreshServers();
  }, [refreshServers]);

  // Simple polling: refresh server list every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      // Ignore errors to keep polling resilient
      refreshServers().catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [refreshServers]);

  // Loading indicator component to reuse
  const LoadingIndicator = () => (
    <div className="flex h-full items-center justify-center bg-content-light">
      <div className="text-center">
        <IconProgress className="h-10 w-10 mx-auto animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t("common.loading")}</p>
      </div>
    </div>
  );

  // If still loading, show loading indicator
  if (isLoading) {
    return <LoadingIndicator />;
  }

  // Login is now optional - user can access app without authentication

  return (
    <SidebarProvider defaultOpen={true} className="h-full">
      <Sonner />

      <SidebarComponent />
      <main className="flex flex-col flex-1 w-full min-w-0 overflow-auto">
        <div className="flex flex-col flex-1 pt-8">
          {/*<SidebarTrigger />*/}

          <Routes>
            {/* Public routes - no authentication required */}
            <Route element={<PageLayout />}>
              <Route path="/" element={<Navigate to="/servers" replace />} />
              <Route path="/servers" element={<Home />} />
              <Route path="/servers/add" element={<DiscoverWrapper />} />
              <Route path="/clients" element={<McpAppsManager />} />
              <Route path="/logs" element={<LogViewer />} />
              <Route
                path="/hooks"
                element={<Navigate to="/workflows" replace />}
              />
              <Route path="/workflows" element={<WorkflowManager />} />
              <Route
                path="/workflows/:workflowId"
                element={<WorkflowManager />}
              />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/settings/workspaces"
                element={<WorkspaceManagement />}
              />
              <Route path="/skills" element={<SkillsManager />} />
            </Route>

            <Route path="*" element={<Navigate to="/servers" />} />
          </Routes>
        </div>
      </main>
    </SidebarProvider>
  );
};

export default App;
