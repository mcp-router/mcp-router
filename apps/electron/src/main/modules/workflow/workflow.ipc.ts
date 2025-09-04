import { ipcMain } from "electron";
import { getWorkflowService } from "@/main/modules/workflow/workflow.service";
import type { WorkflowDefinition } from "@mcp_router/shared";

/**
 * ワークフロー関連のIPCハンドラーを登録
 */
export function setupWorkflowHandlers(): void {
  // ワークフロー一覧取得
  ipcMain.handle("workflow:list", async () => {
    try {
      return await getWorkflowService().getAllWorkflows();
    } catch (error) {
      console.error("Failed to list workflows:", error);
      throw error;
    }
  });

  // ワークフロー取得
  ipcMain.handle("workflow:get", async (_, id: string) => {
    try {
      return await getWorkflowService().getWorkflowById(id);
    } catch (error) {
      console.error("Failed to get workflow:", error);
      throw error;
    }
  });

  // ワークフロー作成
  ipcMain.handle(
    "workflow:create",
    async (
      _,
      workflow: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">,
    ) => {
      try {
        return await getWorkflowService().createWorkflow(workflow);
      } catch (error) {
        console.error("Failed to create workflow:", error);
        throw error;
      }
    },
  );

  // ワークフロー更新
  ipcMain.handle(
    "workflow:update",
    async (
      _,
      id: string,
      updates: Partial<Omit<WorkflowDefinition, "id" | "createdAt">>,
    ) => {
      try {
        return await getWorkflowService().updateWorkflow(id, updates);
      } catch (error) {
        console.error("Failed to update workflow:", error);
        throw error;
      }
    },
  );

  // ワークフロー削除
  ipcMain.handle("workflow:delete", async (_, id: string) => {
    try {
      return await getWorkflowService().deleteWorkflow(id);
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      throw error;
    }
  });

  // ワークフローをアクティブに設定
  ipcMain.handle("workflow:setActive", async (_, id: string) => {
    try {
      return await getWorkflowService().setActiveWorkflow(id);
    } catch (error) {
      console.error("Failed to set active workflow:", error);
      throw error;
    }
  });

  // ワークフローを無効化
  ipcMain.handle("workflow:disable", async (_, id: string) => {
    try {
      return await getWorkflowService().disableWorkflow(id);
    } catch (error) {
      console.error("Failed to disable workflow:", error);
      throw error;
    }
  });

  // ワークフロー実行
  ipcMain.handle("workflow:execute", async (_, id: string, context?: any) => {
    try {
      return await getWorkflowService().executeWorkflow(id, context);
    } catch (error) {
      console.error("Failed to execute workflow:", error);
      throw error;
    }
  });

  // 有効なワークフロー取得
  ipcMain.handle("workflow:listEnabled", async () => {
    try {
      return await getWorkflowService().getEnabledWorkflows();
    } catch (error) {
      console.error("Failed to list enabled workflows:", error);
      throw error;
    }
  });

  // タイプ別ワークフロー取得
  ipcMain.handle("workflow:listByType", async (_, workflowType: string) => {
    try {
      return await getWorkflowService().getWorkflowsByType(workflowType);
    } catch (error) {
      console.error("Failed to list workflows by type:", error);
      throw error;
    }
  });
}
