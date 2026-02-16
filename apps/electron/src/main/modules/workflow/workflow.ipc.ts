import { ipcMain } from "electron";
import { getWorkflowService } from "@/main/modules/workflow/workflow.service";
import { invalidateWorkflowCache } from "@/main/modules/mcp-server-runtime/request-handler-base";
import type { WorkflowDefinition } from "@mcp_router/shared";

/**
 * Register IPC handlers for Workflows
 */
export function setupWorkflowHandlers(): void {
  // Get workflow list
  ipcMain.handle("workflow:list", async () => {
    try {
      return await getWorkflowService().getAllWorkflows();
    } catch (error) {
      console.error("Failed to list workflows:", error);
      throw error;
    }
  });

  // Get workflow
  ipcMain.handle("workflow:get", async (_, id: string) => {
    try {
      return await getWorkflowService().getWorkflowById(id);
    } catch (error) {
      console.error("Failed to get workflow:", error);
      throw error;
    }
  });

  // Create workflow
  ipcMain.handle(
    "workflow:create",
    async (
      _,
      workflow: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">,
    ) => {
      try {
        const result = await getWorkflowService().createWorkflow(workflow);
        invalidateWorkflowCache();
        return result;
      } catch (error) {
        console.error("Failed to create workflow:", error);
        throw error;
      }
    },
  );

  // Update workflow
  ipcMain.handle(
    "workflow:update",
    async (
      _,
      id: string,
      updates: Partial<Omit<WorkflowDefinition, "id" | "createdAt">>,
    ) => {
      try {
        const result = await getWorkflowService().updateWorkflow(id, updates);
        invalidateWorkflowCache();
        return result;
      } catch (error) {
        console.error("Failed to update workflow:", error);
        throw error;
      }
    },
  );

  // Delete workflow
  ipcMain.handle("workflow:delete", async (_, id: string) => {
    try {
      const result = await getWorkflowService().deleteWorkflow(id);
      invalidateWorkflowCache();
      return result;
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      throw error;
    }
  });

  // Set workflow as active
  ipcMain.handle("workflow:setActive", async (_, id: string) => {
    try {
      const result = await getWorkflowService().setActiveWorkflow(id);
      invalidateWorkflowCache();
      return result;
    } catch (error) {
      console.error("Failed to set active workflow:", error);
      throw error;
    }
  });

  // Disable workflow
  ipcMain.handle("workflow:disable", async (_, id: string) => {
    try {
      const result = await getWorkflowService().disableWorkflow(id);
      invalidateWorkflowCache();
      return result;
    } catch (error) {
      console.error("Failed to disable workflow:", error);
      throw error;
    }
  });

  // Execute workflow
  ipcMain.handle("workflow:execute", async (_, id: string, context?: any) => {
    try {
      return await getWorkflowService().executeWorkflow(id, context);
    } catch (error) {
      console.error("Failed to execute workflow:", error);
      throw error;
    }
  });

  // Get enabled workflows
  ipcMain.handle("workflow:listEnabled", async () => {
    try {
      return await getWorkflowService().getEnabledWorkflows();
    } catch (error) {
      console.error("Failed to list enabled workflows:", error);
      throw error;
    }
  });

  // Get workflows by type
  ipcMain.handle("workflow:listByType", async (_, workflowType: string) => {
    try {
      return await getWorkflowService().getWorkflowsByType(workflowType);
    } catch (error) {
      console.error("Failed to list workflows by type:", error);
      throw error;
    }
  });
}
