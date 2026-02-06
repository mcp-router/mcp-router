import { setupAuthHandlers } from "../modules/auth/auth.ipc";
import { setupMcpServerHandlers } from "../modules/mcp-server-manager/mcp-server-manager.ipc";
import { setupLogHandlers } from "../modules/mcp-logger/mcp-logger.ipc";
import { setupSettingsHandlers } from "../modules/settings/settings.ipc";
import { setupSystemHandlers } from "../modules/system/system-handler";
import { setupPackageHandlers } from "../modules/system/package-handlers";
import { setupWorkspaceHandlers } from "../modules/workspace/workspace.ipc";
import { setupWorkflowHandlers } from "../modules/workflow/workflow.ipc";
import { setupHookHandlers } from "../modules/workflow/hook.ipc";
import { setupProjectHandlers } from "../modules/projects/projects.ipc";
import { setupCloudSyncHandlers } from "../modules/cloud-sync/cloud-sync.ipc";
import { setupSkillHandlers } from "../modules/skills/skills.ipc";
import {
  setupUnifiedSkillsHandlers,
  setUnifiedSkillsService,
} from "../modules/skills/unified-skills.ipc";
import { getUnifiedSkillsService } from "../modules/skills/unified-skills.service";
import { setupMarketplaceHandlers } from "../modules/marketplace/marketplace.ipc";
import { setupClientAppHandlers } from "../modules/client-apps/client-app.ipc";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";

/**
 * Set up IPC communication handlers.
 * Called during application initialization.
 */
export function setupIpcHandlers(deps: {
  getServerManager: () => MCPServerManager;
}): void {
  // Authentication
  setupAuthHandlers();

  // MCP servers
  setupMcpServerHandlers(deps.getServerManager);

  // Logs
  setupLogHandlers();

  // Settings
  setupSettingsHandlers();

  // System (utilities, feedback, updates)
  setupSystemHandlers();

  // Packages (version resolution and manager management)
  setupPackageHandlers();

  // Workspaces
  setupWorkspaceHandlers();

  // Workflows
  setupWorkflowHandlers();

  // Hook Modules
  setupHookHandlers();

  // Projects
  setupProjectHandlers({ getServerManager: deps.getServerManager });

  // Cloud Sync
  setupCloudSyncHandlers();

  // Skills
  setupSkillHandlers();

  // Unified Skills
  setUnifiedSkillsService(getUnifiedSkillsService());
  setupUnifiedSkillsHandlers();

  // Marketplace
  setupMarketplaceHandlers();

  // Client Apps
  setupClientAppHandlers();
}
