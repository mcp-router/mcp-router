import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getUserShellEnv } from "@/main/utils/env-utils";
import { logError, logInfo } from "@/main/utils/logger";
import {
  MCPServerConfig,
  MCPConnectionResult,
  MCPInputParam,
} from "@mcp_router/shared";

/**
 * MCPクライアント接続機能を提供するクラス
 */
export class MCPClient {
  /**
   * Creates an MCP client and connects to the specified server
   */
  public async connectToMCPServer(
    server: MCPServerConfig,
    clientName = "mcp-client",
  ): Promise<MCPConnectionResult> {
    try {
      // Create MCP client
      const client = new Client(
        {
          name: clientName,
          version: "1.0.0",
        },
        {
          capabilities: {
            prompts: {},
            resources: {},
            tools: {},
          },
        },
      );

      // Choose transport based on server type
      if (server.serverType === "remote-streamable") {
        // Check if remoteUrl is provided for remote servers
        if (!server.remoteUrl) {
          throw new Error(
            "Server configuration error: remoteUrl must be provided for remote servers",
          );
        }

        // Use StreamableHTTP transport for remote-streamable servers
        const transport = new StreamableHTTPClientTransport(
          new URL(server.remoteUrl),
          {
            sessionId: undefined,
            requestInit: {
              headers: {
                authorization: server.bearerToken
                  ? `Bearer ${server.bearerToken}`
                  : "",
              },
            },
          },
        );
        await client.connect(transport);
      } else if (server.serverType === "remote") {
        // Check if remoteUrl is provided for remote servers
        if (!server.remoteUrl) {
          throw new Error(
            "Server configuration error: remoteUrl must be provided for remote servers",
          );
        }

        // Use SSE transport for remote servers
        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        };

        if (server.bearerToken) {
          headers["authorization"] = `Bearer ${server.bearerToken}`;
        }

        const transport = new SSEClientTransport(new URL(server.remoteUrl), {
          eventSourceInit: {
            fetch: (url, init) => fetch(url, { ...init, headers }),
          },
          requestInit: {
            headers,
          },
        });
        await client.connect(transport);
      } else if (server.serverType === "local") {
        // Local server - check if command is provided
        if (!server.command) {
          throw new Error(
            "Server configuration error: command must be provided for local servers",
          );
        }

        // Get environment variables from user shell
        const userEnvs = await getUserShellEnv();

        // Filter out undefined values from userEnvs
        const cleanUserEnvs = Object.entries(userEnvs).reduce(
          (acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, string>,
        );

        // Merge environment variables
        const mergedEnv = {
          ...cleanUserEnvs,
          ...server.env,
        };

        // Use Stdio transport for local servers
        const transport = new StdioClientTransport({
          command: server.command,
          args: server.args,
          env: mergedEnv,
        });
        await client.connect(transport);
      } else {
        throw new Error(
          `Unsupported server type: ${(server as any).serverType}`,
        );
      }

      logInfo(`Successfully connected to MCP server: ${server.name}`);
      return {
        status: "success",
        client,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError(`Failed to connect to MCP server: ${errorMessage}`);
      return {
        status: "error",
        error: errorMessage,
      };
    }
  }

  /**
   * Fetches available tools from MCP server
   */
  public async fetchServerTools(client: Client): Promise<any[]> {
    try {
      const response = await client.listTools();
      return response.tools;
    } catch (error) {
      logError(`Failed to fetch tools: ${error}`);
      return [];
    }
  }

  /**
   * Fetches available resources from MCP server
   */
  public async fetchServerResources(client: Client): Promise<any[]> {
    try {
      const response = await client.listResources();
      return response.resources;
    } catch (error) {
      logError(`Failed to fetch resources: ${error}`);
      return [];
    }
  }

  /**
   * Reads a specific resource from MCP server
   */
  public async readServerResource(
    client: Client,
    resourceUri: string,
  ): Promise<any> {
    try {
      const response = await client.readResource({ uri: resourceUri });
      return response.contents;
    } catch (error) {
      logError(`Failed to read resource: ${error}`);
      return null;
    }
  }

  /**
   * Substitutes parameter values with actual arguments
   */
  public substituteArgsParameters(
    argsTemplate: string[],
    env: Record<string, string>,
    inputParams: Record<string, MCPInputParam>,
  ): string[] {
    return argsTemplate.map((arg) => {
      // Check if arg is a placeholder like "${paramName}" or "${user_config.paramName}"
      const match = arg.match(/^\$\{(.+)\}$/);
      if (match) {
        const fullParamName = match[1];

        // Handle user_config.paramName format
        if (fullParamName.startsWith("user_config.")) {
          const paramName = fullParamName.substring("user_config.".length);
          if (inputParams[paramName]) {
            const param = inputParams[paramName];
            if (param.default !== undefined) {
              return String(param.default);
            }
          }
        }

        // First check env variables
        if (env[fullParamName]) {
          return env[fullParamName];
        }

        // Then check input params
        if (inputParams[fullParamName]) {
          const param = inputParams[fullParamName];
          if (param.default !== undefined) {
            return String(param.default);
          }
        }
      }
      return arg;
    });
  }
}
