import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import type {
  ListServersInput,
  GetServerInput,
  AddServerInput,
  RemoveServerInput,
  ToggleServerInput,
  ListToolsInput,
  StartServerInput,
  StopServerInput,
  UpdateServerInput,
  UpdateSettingsInput,
  SwitchWorkspaceInput,
  ServerSummary,
  ToolSummary,
} from "./system-server.types";
import {
  ServerHealthMetrics,
  getHealthMetricsTracker,
} from "../mcp-server-runtime/health-metrics-tracker";
import { getTokenBudgetTracker } from "../mcp-server-runtime/token-budget-tracker";
import { AuditLogRepository } from "../mcp-logger/audit-log.repository";
import { ServerDiscoveryService } from "../mcp-server-manager/server-discovery.service";
import { processMcpbFile } from "../mcp-server-manager/mcpb-processor/mcpb-processor";
import { getSharedConfigManager } from "@/main/infrastructure/shared-config-manager";
import { getWorkspaceService } from "@/main/modules/workspace/workspace.service";
import { getEventBridge } from "@/main/modules/mcp-server-runtime/event-bridge";

/**
 * MCP Server that exposes router management as MCP tools.
 * Allows agents to list, inspect, add, remove, and toggle MCP servers
 * programmatically through the standard MCP tool-calling interface.
 */
export class SystemServer {
  private server: Server;
  private serverManager: MCPServerManager;

  constructor(serverManager: MCPServerManager) {
    this.serverManager = serverManager;

    this.server = new Server(
      { name: "mcp-router-system", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    this.registerHandlers();

    this.server.onerror = (error) => {
      console.error("[SystemServer Error]", error);
    };
  }

  /** Expose the underlying SDK Server for transport binding. */
  public getServer(): Server {
    return this.server;
  }

  /** Return the MCP tool definitions for the system tools. */
  public getToolDefinitions(): typeof SYSTEM_TOOLS {
    return SYSTEM_TOOLS;
  }

  /**
   * Dispatch a tool call by name, bypassing the MCP SDK transport layer.
   * This allows the aggregator to route `router_*` calls directly.
   */
  public async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: { type: "text"; text: string }[] }> {
    return this.validateAndDispatch(name, args);
  }

  // ---------------------------------------------------------------------------
  // Handler registration
  // ---------------------------------------------------------------------------

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: SYSTEM_TOOLS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = (request.params.arguments ?? {}) as Record<string, unknown>;
      return this.validateAndDispatch(toolName, args);
    });
  }

  // ---------------------------------------------------------------------------
  // Shared validation & dispatch
  // ---------------------------------------------------------------------------

  /**
   * Validate inputs and dispatch to the appropriate handler.
   * Used by both callTool() (aggregator path) and registerHandlers() (SDK path)
   * to ensure all code paths receive the same input validation.
   */
  private async validateAndDispatch(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: { type: "text"; text: string }[] }> {
    switch (toolName) {
      case "router_list_servers": {
        const VALID_STATUSES = ["running", "stopped", "error", "all"];
        if (args.status !== undefined) {
          if (
            typeof args.status !== "string" ||
            !VALID_STATUSES.includes(args.status)
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `status must be one of: ${VALID_STATUSES.join(", ")}`,
            );
          }
        }
        return this.handleListServers({
          status: args.status as ListServersInput["status"],
        });
      }
      case "router_get_server": {
        const server = args.server;
        if (typeof server !== "string" || server.trim().length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "server must be a non-empty string",
          );
        }
        return this.handleGetServer({ server });
      }
      case "router_add_server": {
        // name: required non-empty string, max 255 chars
        if (typeof args.name !== "string" || args.name.trim().length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "name must be a non-empty string",
          );
        }
        if (args.name.length > 255) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "name must be at most 255 characters",
          );
        }

        // serverType: required, must be one of the valid types
        const VALID_SERVER_TYPES = ["local", "remote", "remote-streamable"];
        if (
          typeof args.serverType !== "string" ||
          !VALID_SERVER_TYPES.includes(args.serverType)
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `serverType must be one of: ${VALID_SERVER_TYPES.join(", ")}`,
          );
        }

        // command: optional string (required for local validated downstream)
        if (args.command !== undefined && typeof args.command !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "command must be a string",
          );
        }

        // args: optional string array
        if (args.args !== undefined) {
          if (
            !Array.isArray(args.args) ||
            !args.args.every((a: unknown) => typeof a === "string")
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "args must be an array of strings",
            );
          }
        }

        // remoteUrl: optional string, basic URL validation
        if (args.remoteUrl !== undefined) {
          if (typeof args.remoteUrl !== "string") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "remoteUrl must be a string",
            );
          }
          try {
            new URL(args.remoteUrl);
          } catch {
            throw new McpError(
              ErrorCode.InvalidParams,
              "remoteUrl must be a valid URL",
            );
          }
        }

        // bearerToken: optional string
        if (
          args.bearerToken !== undefined &&
          typeof args.bearerToken !== "string"
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "bearerToken must be a string",
          );
        }

        // env: optional Record<string, string>
        if (args.env !== undefined) {
          this.validateEnvObject(args.env);
        }

        // description: optional string
        if (
          args.description !== undefined &&
          typeof args.description !== "string"
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "description must be a string",
          );
        }

        // autoStart: optional boolean
        if (
          args.autoStart !== undefined &&
          typeof args.autoStart !== "boolean"
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "autoStart must be a boolean",
          );
        }

        return this.handleAddServer({
          name: args.name as string,
          serverType: args.serverType as AddServerInput["serverType"],
          command: args.command as string | undefined,
          args: args.args as string[] | undefined,
          remoteUrl: args.remoteUrl as string | undefined,
          bearerToken: args.bearerToken as string | undefined,
          env: args.env as Record<string, string> | undefined,
          description: args.description as string | undefined,
          autoStart: args.autoStart as boolean | undefined,
        });
      }
      case "router_remove_server": {
        const server = args.server;
        if (typeof server !== "string" || server.trim().length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "server must be a non-empty string",
          );
        }
        return this.handleRemoveServer({ server });
      }
      case "router_toggle_server": {
        const server = args.server;
        if (typeof server !== "string" || server.trim().length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "server must be a non-empty string",
          );
        }
        if (typeof args.enabled !== "boolean") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "enabled must be a boolean",
          );
        }
        return this.handleToggleServer({ server, enabled: args.enabled });
      }
      case "router_list_tools": {
        if (args.server !== undefined) {
          if (
            typeof args.server !== "string" ||
            args.server.trim().length === 0
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "server must be a non-empty string",
            );
          }
        }
        return this.handleListTools({
          server: args.server as string | undefined,
        });
      }
      case "router_start_server": {
        const server = args.server;
        if (typeof server !== "string" || server.trim().length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "server must be a non-empty string",
          );
        }
        return this.handleStartServer({ server });
      }
      case "router_stop_server": {
        const server = args.server;
        if (typeof server !== "string" || server.trim().length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "server must be a non-empty string",
          );
        }
        return this.handleStopServer({ server });
      }
      case "router_update_server": {
        const server = args.server;
        if (typeof server !== "string" || server.trim().length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "server must be a non-empty string",
          );
        }
        if (args.name !== undefined) {
          if (typeof args.name !== "string" || args.name.trim().length === 0) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "name must be a non-empty string",
            );
          }
          if (args.name.length > 255) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "name must be at most 255 characters",
            );
          }
        }
        if (args.command !== undefined && typeof args.command !== "string") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "command must be a string",
          );
        }
        if (args.args !== undefined) {
          if (
            !Array.isArray(args.args) ||
            !args.args.every((a: unknown) => typeof a === "string")
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "args must be an array of strings",
            );
          }
        }
        if (args.env !== undefined) {
          this.validateEnvObject(args.env);
        }
        if (
          args.autoStart !== undefined &&
          typeof args.autoStart !== "boolean"
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "autoStart must be a boolean",
          );
        }
        if (args.disabled !== undefined && typeof args.disabled !== "boolean") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "disabled must be a boolean",
          );
        }
        return this.handleUpdateServer({
          server,
          name: args.name as string | undefined,
          command: args.command as string | undefined,
          args: args.args as string[] | undefined,
          env: args.env as Record<string, string> | undefined,
          autoStart: args.autoStart as boolean | undefined,
          disabled: args.disabled as boolean | undefined,
        });
      }
      case "router_get_settings": {
        return this.handleGetSettings();
      }
      case "router_update_settings": {
        const VALID_SETTING_KEYS = [
          "toolCatalogEnabled",
          "prefixToolNames",
          "loadExternalMCPConfigs",
          "autoUpdateEnabled",
          "showWindowOnStartup",
          {
            name: "router_health_metrics",
            description:
              "Get health metrics (uptime, latency, success rate) for all tracked servers.",
            inputSchema: {
              type: "object" as const,
              properties: {},
            },
          },
          {
            name: "router_token_usage",
            description:
              "Get token budget tracking data including per-server tool stats and catalog savings.",
            inputSchema: {
              type: "object" as const,
              properties: {},
            },
          },
          {
            name: "router_audit_log",
            description: "Query security and compliance audit logs.",
            inputSchema: {
              type: "object" as const,
              properties: {
                action: {
                  type: "string",
                  description:
                    "Filter by action (e.g. 'TOOL_CALL', 'SERVER_START')",
                },
                actor: {
                  type: "string",
                  description: "Filter by actor ID",
                },
              },
            },
          },
          {
            name: "router_discover_servers",
            description:
              "Scan local IDE configurations (VSCode, Cursor, Claude Desktop) for unmanaged MCP servers.",
            inputSchema: {
              type: "object" as const,
              properties: {},
            },
          },
          {
            name: "router_install_mcpb",
            description:
              "Install an MCP server from a local .mcpb bundle file.",
            inputSchema: {
              type: "object" as const,
              properties: {
                filePath: {
                  type: "string",
                  description: "Absolute path to the .mcpb file to install",
                },
              },
              required: ["filePath"],
            },
          },
        ];
        // Validate that only known keys are provided and all are booleans
        for (const [key, value] of Object.entries(args)) {
          if (!VALID_SETTING_KEYS.includes(key)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Unknown setting: ${key}. Valid settings: ${VALID_SETTING_KEYS.join(", ")}`,
            );
          }
          if (typeof value !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              `${key} must be a boolean`,
            );
          }
        }
        return this.handleUpdateSettings(args as UpdateSettingsInput);
      }
      case "router_list_workspaces": {
        return this.handleListWorkspaces();
      }
      case "router_switch_workspace": {
        const workspaceId = args.workspaceId;
        if (
          typeof workspaceId !== "string" ||
          workspaceId.trim().length === 0
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "workspaceId must be a non-empty string",
          );
        }
        return this.handleSwitchWorkspace({ workspaceId });
      }
      case "router_health_metrics": {
        return this.handleHealthMetrics();
      }
      case "router_token_usage": {
        return this.handleTokenUsage();
      }
      case "router_audit_log": {
        return this.handleAuditLog(args as any);
      }
      case "router_discover_servers": {
        return this.handleDiscoverServers();
      }
      case "router_install_mcpb": {
        if (
          typeof args.filePath !== "string" ||
          args.filePath.trim().length === 0
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "filePath must be a non-empty string",
          );
        }
        return this.handleInstallMcpb(args.filePath);
      }
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${toolName}`,
        );
    }
  }

  // ---------------------------------------------------------------------------
  // Tool implementations
  // ---------------------------------------------------------------------------

  private async handleListServers(input: ListServersInput) {
    const servers = this.serverManager.getServers();
    const statusFilter = input.status ?? "all";

    const results: ServerSummary[] = servers
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        serverType: s.serverType,
        disabled: s.disabled ?? false,
        autoStart: s.autoStart ?? false,
        errorMessage: s.errorMessage,
        description: s.description,
        projectId: s.projectId,
      }));

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(results, null, 2) },
      ],
    };
  }

  private async handleGetServer(input: GetServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    // Return full config (strip runtime-only fields like logs)
    const detail = {
      id: server.id,
      name: server.name,
      status: server.status,
      serverType: server.serverType,
      command: server.command,
      args: server.args,
      remoteUrl: server.remoteUrl,
      env: server.env
        ? Object.fromEntries(
            Object.entries(server.env).map(([k]) => [k, "***REDACTED***"]),
          )
        : undefined,
      disabled: server.disabled ?? false,
      autoStart: server.autoStart ?? false,
      description: server.description,
      errorMessage: server.errorMessage,
      projectId: server.projectId,
      toolPermissions: server.toolPermissions,
      tools: server.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        enabled: t.enabled,
      })),
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(detail, null, 2) },
      ],
    };
  }

  private async handleAddServer(input: AddServerInput) {
    // Validate required fields by server type
    if (input.serverType === "local" && !input.command) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "command is required for local servers",
      );
    }
    if (
      (input.serverType === "remote" ||
        input.serverType === "remote-streamable") &&
      !input.remoteUrl
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "remoteUrl is required for remote servers",
      );
    }

    const newServer = this.serverManager.addServer({
      id: "", // repository generates the ID
      name: input.name,
      serverType: input.serverType,
      command: input.command,
      args: input.args,
      remoteUrl: input.remoteUrl,
      bearerToken: input.bearerToken,
      env: input.env ?? {},
      description: input.description,
      autoStart: input.autoStart ?? false,
    });

    getEventBridge().emit("servers_updated", {
      action: "add",
      serverId: newServer.id,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: newServer.id,
              name: newServer.name,
              status: newServer.status,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleRemoveServer(input: RemoveServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    const removed = this.serverManager.removeServer(server.id);

    getEventBridge().emit("servers_updated", {
      action: "remove",
      serverId: server.id,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ removed, id: server.id, name: server.name }),
        },
      ],
    };
  }

  private async handleToggleServer(input: ToggleServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    const updated = this.serverManager.updateServer(server.id, {
      disabled: !input.enabled,
    });

    getEventBridge().emit("servers_updated", {
      action: "toggle",
      serverId: server.id,
      enabled: input.enabled,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: server.id,
            name: server.name,
            disabled: updated?.disabled ?? !input.enabled,
          }),
        },
      ],
    };
  }

  private async handleListTools(input: ListToolsInput) {
    const results: ToolSummary[] = [];

    if (input.server) {
      // List tools for a specific server
      const server = this.resolveServer(input.server);
      if (!server) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Server not found: ${input.server}`,
        );
      }

      try {
        const tools = await this.serverManager.listServerTools(server.id);
        for (const tool of tools) {
          results.push({
            name: tool.name,
            description: tool.description,
            enabled: tool.enabled ?? true,
            serverName: server.name,
            serverId: server.id,
          });
        }
      } catch {
        // Server not running — return empty list with a note
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Server "${server.name}" must be running to list tools`,
                serverId: server.id,
                status: server.status,
              }),
            },
          ],
        };
      }
    } else {
      // List tools across all running servers
      const servers = this.serverManager.getServers();
      for (const server of servers) {
        if (server.status !== "running") continue;
        try {
          const tools = await this.serverManager.listServerTools(server.id);
          for (const tool of tools) {
            results.push({
              name: tool.name,
              description: tool.description,
              enabled: tool.enabled ?? true,
              serverName: server.name,
              serverId: server.id,
            });
          }
        } catch {
          // Skip servers that fail
        }
      }
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(results, null, 2) },
      ],
    };
  }

  private async handleStartServer(input: StartServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    try {
      await this.serverManager.startServer(server.id);
      const updated = this.serverManager
        .getServers()
        .find((s) => s.id === server.id);

      getEventBridge().emit("servers_updated", {
        action: "start",
        serverId: server.id,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              id: server.id,
              name: server.name,
              status: updated?.status ?? "running",
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to start server "${server.name}": ${message}`,
      );
    }
  }

  private async handleStopServer(input: StopServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    const stopped = this.serverManager.stopServer(server.id);

    getEventBridge().emit("servers_updated", {
      action: "stop",
      serverId: server.id,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: server.id,
            name: server.name,
            stopped,
            status: stopped ? "stopped" : server.status,
          }),
        },
      ],
    };
  }

  private async handleUpdateServer(input: UpdateServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    const { server: _serverIdOrName, ...updateFields } = input;
    const updated = this.serverManager.updateServer(server.id, updateFields);
    if (!updated) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update server "${server.name}"`,
      );
    }

    getEventBridge().emit("config_changed", {
      serverId: server.id,
      config: updateFields,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: updated.id,
            name: updated.name,
            status: updated.status,
            autoStart: updated.autoStart,
            disabled: updated.disabled,
          }),
        },
      ],
    };
  }

  private async handleGetSettings() {
    const settings = getSharedConfigManager().getSettings();
    // Only expose agent-relevant settings (not auth tokens, user IDs, etc.)
    const safeSettings = {
      toolCatalogEnabled: settings.toolCatalogEnabled,
      prefixToolNames: settings.prefixToolNames,
      loadExternalMCPConfigs: settings.loadExternalMCPConfigs,
      autoUpdateEnabled: settings.autoUpdateEnabled,
      showWindowOnStartup: settings.showWindowOnStartup,
      theme: settings.theme,
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(safeSettings, null, 2) },
      ],
    };
  }

  private async handleUpdateSettings(input: UpdateSettingsInput) {
    const configManager = getSharedConfigManager();
    const currentSettings = configManager.getSettings();
    const updatedSettings = { ...currentSettings, ...input };
    configManager.saveSettings(updatedSettings);

    getEventBridge().emit("config_changed", {
      action: "settings_updated",
      settings: input,
    });

    // Return the updated safe subset
    const saved = configManager.getSettings();
    const safeSettings = {
      toolCatalogEnabled: saved.toolCatalogEnabled,
      prefixToolNames: saved.prefixToolNames,
      loadExternalMCPConfigs: saved.loadExternalMCPConfigs,
      autoUpdateEnabled: saved.autoUpdateEnabled,
      showWindowOnStartup: saved.showWindowOnStartup,
      theme: saved.theme,
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(safeSettings, null, 2) },
      ],
    };
  }

  private async handleListWorkspaces() {
    const workspaceService = getWorkspaceService();
    const workspaces = await workspaceService.list();
    const results = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      type: ws.type,
      isActive: ws.isActive,
      createdAt: ws.createdAt.toISOString(),
      lastUsedAt: ws.lastUsedAt.toISOString(),
    }));

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(results, null, 2) },
      ],
    };
  }

  private async handleSwitchWorkspace(input: SwitchWorkspaceInput) {
    const workspaceService = getWorkspaceService();
    const target = await workspaceService.findById(input.workspaceId);
    if (!target) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Workspace not found: ${input.workspaceId}`,
      );
    }

    await workspaceService.switchWorkspace(input.workspaceId);

    getEventBridge().emit("config_changed", {
      action: "workspace_switched",
      workspaceId: target.id,
      workspaceName: target.name,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            switched: true,
            workspaceId: target.id,
            workspaceName: target.name,
          }),
        },
      ],
    };
  }

  private async handleHealthMetrics() {
    const tracker = getHealthMetricsTracker();
    const metrics = tracker.getAllMetrics();
    const aggregate = tracker.getAggregateHealth();

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ aggregate, servers: metrics }, null, 2),
        },
      ],
    };
  }

  private async handleTokenUsage() {
    const tracker = getTokenBudgetTracker();
    const serversMap = tracker.getServerStats();
    const catalogSavings = tracker.getToolCatalogSavings();

    // Get per-tool stats for each server
    const serverDetails = Array.from(serversMap.entries()).map(
      ([serverName, stats]) => ({
        serverName,
        ...stats,
        toolStats: tracker.getToolStats(serverName),
      }),
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              globalStats: { catalogSavings },
              servers: serverDetails,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleAuditLog(args: { action?: string; actor?: string }) {
    const repo = AuditLogRepository.getInstance();
    const logs = repo.getEntries(args);
    const count = repo.getEntryCount(args);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ count, logs }, null, 2),
        },
      ],
    };
  }

  private async handleDiscoverServers() {
    const discoveryService = ServerDiscoveryService.getInstance();

    // Trigger a new scan
    // We scan standard directories: ~, workspace, etc.
    const os = require("os");
    const path = require("path");

    // Scan home directory for global IDE configs
    await discoveryService.scanProjectDirectory(os.homedir());

    const discovered = discoveryService.getDiscoveredServers();

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { discoveredCount: discovered.length, servers: discovered },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleInstallMcpb(filePath: string) {
    try {
      const fs = require("fs");
      const buffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(buffer);

      const result = await processMcpbFile(uint8Array);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                serverId: result.id,
                name: result.name,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to install MCPB: ${message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate that a value is a Record<string, string>.
   */
  private validateEnvObject(env: unknown): void {
    if (typeof env !== "object" || env === null || Array.isArray(env)) {
      throw new McpError(ErrorCode.InvalidParams, "env must be an object");
    }
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      if (typeof key !== "string" || typeof value !== "string") {
        throw new McpError(
          ErrorCode.InvalidParams,
          "env must be a Record<string, string> (all keys and values must be strings)",
        );
      }
    }
  }

  /**
   * Resolve a server by ID or name.
   */
  private resolveServer(idOrName: string) {
    const servers = this.serverManager.getServers();
    return (
      servers.find((s) => s.id === idOrName) ??
      servers.find((s) => s.name === idOrName)
    );
  }

  /**
   * Clean up resources.
   */
  public async shutdown(): Promise<void> {
    await this.server.close();
  }
}

// ---------------------------------------------------------------------------
// Tool definitions (MCP schema)
// ---------------------------------------------------------------------------

const SYSTEM_TOOLS = [
  {
    name: "router_list_servers",
    description:
      "List all MCP servers registered in the router with their status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["running", "stopped", "error", "all"],
          description: "Filter by server status. Defaults to 'all'.",
        },
      },
    },
  },
  {
    name: "router_get_server",
    description:
      "Get detailed information about a specific MCP server, including its configuration and tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
      },
      required: ["server"],
    },
  },
  {
    name: "router_add_server",
    description:
      "Add a new MCP server to the router. Supports local (stdio), remote (SSE), and remote-streamable (HTTP) server types.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Display name for the server.",
        },
        serverType: {
          type: "string",
          enum: ["local", "remote", "remote-streamable"],
          description: "Server connection type.",
        },
        command: {
          type: "string",
          description:
            "Command to run (required for local servers, e.g. 'npx', 'node').",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Arguments for the command (local servers only).",
        },
        remoteUrl: {
          type: "string",
          description:
            "URL for remote or remote-streamable servers (e.g. 'http://localhost:3000/mcp').",
        },
        bearerToken: {
          type: "string",
          description: "Bearer token for authenticated remote servers.",
        },
        env: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Environment variables for the server process.",
        },
        description: {
          type: "string",
          description: "Human-readable description of the server.",
        },
        autoStart: {
          type: "boolean",
          description: "Whether to auto-start the server on app launch.",
        },
      },
      required: ["name", "serverType"],
    },
  },
  {
    name: "router_remove_server",
    description:
      "Remove an MCP server from the router. Stops it first if running.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
      },
      required: ["server"],
    },
  },
  {
    name: "router_toggle_server",
    description:
      "Enable or disable an MCP server. Disabled servers won't auto-start and are excluded from aggregation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
        enabled: {
          type: "boolean",
          description: "true to enable, false to disable.",
        },
      },
      required: ["server", "enabled"],
    },
  },
  {
    name: "router_list_tools",
    description:
      "List all available MCP tools. Optionally filter by a specific server.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description:
            "Server ID or name. If omitted, lists tools from all running servers.",
        },
      },
    },
  },
  // --- P0: Server lifecycle tools ---
  {
    name: "router_start_server",
    description:
      "Start an MCP server by name or ID. The server must not be disabled.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
      },
      required: ["server"],
    },
  },
  {
    name: "router_stop_server",
    description: "Stop a running MCP server by name or ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
      },
      required: ["server"],
    },
  },
  {
    name: "router_update_server",
    description:
      "Update an MCP server's configuration. Only the provided fields are changed; omitted fields remain unchanged.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name to update.",
        },
        name: {
          type: "string",
          description: "New display name for the server.",
        },
        command: {
          type: "string",
          description: "New command for local servers.",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "New arguments for the command (local servers only).",
        },
        env: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "New environment variables for the server process.",
        },
        autoStart: {
          type: "boolean",
          description: "Whether to auto-start the server on app launch.",
        },
        disabled: {
          type: "boolean",
          description: "Whether the server is disabled.",
        },
      },
      required: ["server"],
    },
  },
  // --- P1: Settings tools ---
  {
    name: "router_get_settings",
    description:
      "Return current router settings (toolCatalogEnabled, prefixToolNames, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "router_update_settings",
    description:
      "Update router settings. Only the provided fields are changed; omitted fields remain unchanged.",
    inputSchema: {
      type: "object" as const,
      properties: {
        toolCatalogEnabled: {
          type: "boolean",
          description:
            "Enable tool catalog mode (meta-tools instead of individual tools).",
        },
        prefixToolNames: {
          type: "boolean",
          description:
            "Prefix tool names with server name (e.g., 'krisp__search_meetings').",
        },
        loadExternalMCPConfigs: {
          type: "boolean",
          description: "Load MCP configs from external applications.",
        },
        autoUpdateEnabled: {
          type: "boolean",
          description: "Enable auto-updates.",
        },
        showWindowOnStartup: {
          type: "boolean",
          description: "Show the app window on OS startup.",
        },
      },
    },
  },
  // --- P1: Workspace tools ---
  {
    name: "router_list_workspaces",
    description:
      "List all available workspaces with their ID, name, type, and active status.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "router_switch_workspace",
    description:
      "Switch to a different workspace by ID. This changes the active workspace for the router.",
    inputSchema: {
      type: "object" as const,
      properties: {
        workspaceId: {
          type: "string",
          description: "ID of the workspace to switch to.",
        },
      },
      required: ["workspaceId"],
    },
  },
];
