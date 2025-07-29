import { ipcMain } from "electron";
import { logService } from "@/main/application/mcp-core/log/log-service";

export function setupLogHandlers(): void {
  ipcMain.handle(
    "requestLogs:get",
    async (
      _,
      options?: {
        clientId?: string;
        serverId?: string;
        requestType?: string;
        startDate?: Date;
        endDate?: Date;
        responseStatus?: "success" | "error";
        cursor?: string;
        limit?: number;
      },
    ) => {
      try {
        const result = await logService.getRequestLogs(options || {});
        return result;
      } catch (error) {
        console.error("[RequestLogs] Error retrieving request logs:", error);
        return { logs: [], total: 0 };
      }
    },
  );
}
