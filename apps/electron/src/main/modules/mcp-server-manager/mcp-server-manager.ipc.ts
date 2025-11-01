import { ipcMain, dialog, BrowserWindow } from "electron";
import { MCPServerConfig, CreateServerInput } from "@mcp_router/shared";
import { processDxtFile } from "@/main/modules/mcp-server-manager/dxt-processor/dxt-processor";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";

export function setupMcpServerHandlers(
  getMCPServerManager: () => MCPServerManager,
): void {

  ipcMain.handle("mcp:list", () => {
    const mcpServerManager = getMCPServerManager();
    return mcpServerManager.getServers();
  });

  ipcMain.handle("mcp:start", async (_, id: string) => {
    const mcpServerManager = getMCPServerManager();
    const result = await mcpServerManager.startServer(id, "MCP Router UI");
    return result;
  });

  ipcMain.handle("mcp:stop", (_, id: string) => {
    const mcpServerManager = getMCPServerManager();
    const result = mcpServerManager.stopServer(id, "MCP Router UI");
    return result;
  });

  ipcMain.handle("mcp:add", async (_, input: CreateServerInput) => {
    const mcpServerManager = getMCPServerManager();
    let server = null;

    try {
      let serverConfig: MCPServerConfig;

      // Process based on input type
      if (input.type === "dxt" && input.dxtFile) {
        // Process DXT file
        serverConfig = await processDxtFile(input.dxtFile);
      } else if (input.type === "config" && input.config) {
        // Use config directly (validation will be done by addServer)
        serverConfig = input.config;
      } else {
        throw new Error("Invalid input: missing config or dxtFile");
      }

      // Add the server to the manager
      server = mcpServerManager.addServer(serverConfig);

      // For remote servers, test the connection
      if (serverConfig.serverType !== "local") {
        await mcpServerManager.startServer(server.id);
        mcpServerManager.stopServer(server.id);
      }

      return server;
    } catch (error: any) {
      if (server && server?.id && server?.serverType !== "local") {
        mcpServerManager.removeServer(server?.id);
      }
      throw error;
    }
  });

  ipcMain.handle("mcp:remove", (_, id: string) => {
    const mcpServerManager = getMCPServerManager();
    const result = mcpServerManager.removeServer(id);
    return result;
  });

  ipcMain.handle(
    "mcp:update-config",
    (_, id: string, config: Partial<MCPServerConfig>) => {
      const mcpServerManager = getMCPServerManager();
      const result = mcpServerManager.updateServer(id, config);
      return result;
    },
  );

  ipcMain.handle("mcp:list-tools", async (_, id: string) => {
    const mcpServerManager = getMCPServerManager();
    return await mcpServerManager.listServerTools(id);
  });

  ipcMain.handle(
    "mcp:update-tool-permissions",
    (_, id: string, permissions: Record<string, boolean>) => {
      const mcpServerManager = getMCPServerManager();
      return mcpServerManager.updateServerToolPermissions(id, permissions);
    },
  );

  // ファイル/ディレクトリ選択ダイアログ
  ipcMain.handle(
    "server:selectFile",
    async (
      _event,
      options?: {
        title?: string;
        mode?: "file" | "directory";
        filters?: { name: string; extensions: string[] }[];
      },
    ) => {
      const browserWindow = BrowserWindow.getFocusedWindow();
      if (!browserWindow) {
        return { success: false, error: "No focused window" };
      }

      try {
        const isDirectory = options?.mode === "directory";
        const result = await dialog.showOpenDialog(browserWindow, {
          title:
            options?.title ||
            (isDirectory ? "Select Directory" : "Select File"),
          properties: isDirectory ? ["openDirectory"] : ["openFile"],
          filters:
            !isDirectory && options?.filters
              ? options.filters
              : [{ name: "All Files", extensions: ["*"] }],
        });

        if (result.canceled) {
          return { success: false, canceled: true };
        }

        return { success: true, path: result.filePaths[0] };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );
}
