import { ipcMain } from "electron";
import { MCPServerConfig, CreateServerInput } from "@mcp_router/shared";
import {
  fetchMcpServersFromIndex,
  fetchMcpServerVersionDetails,
} from "@/main/application/mcp-core/registry/mcp-fetcher";

export function setupMcpServerHandlers(): void {
  const getMCPServerManager = () => (global as any).getMCPServerManager();

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

      if (input.type === "dxt" && input.dxtFile) {
        // TODO: Parse DXT file to extract MCPServerConfig
        // For now, throw an error as DXT parsing logic needs to be implemented
        throw new Error("DXT file parsing not yet implemented");
      } else if (input.type === "config" && input.config) {
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

  ipcMain.handle(
    "mcp:fetch-from-index",
    async (
      _,
      page?: number,
      limit?: number,
      search?: string,
      isVerified?: boolean,
    ) => {
      return await fetchMcpServersFromIndex(page, limit, search, isVerified);
    },
  );

  ipcMain.handle(
    "mcp:fetch-server-version-details",
    async (_, displayId: string, version: string) => {
      return await fetchMcpServerVersionDetails(displayId, version);
    },
  );
}
