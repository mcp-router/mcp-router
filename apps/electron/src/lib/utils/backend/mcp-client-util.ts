import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getUserShellEnv } from "../../get-env";
import { logError, logInfo } from "./error-handler";

/**
 * Helper function to prefix each line with a given string
 */
function prefixLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

/**
 * Result type for MCP server connection
 */
export type MCPConnectionResult =
  | { status: "success"; client: Client }
  | { status: "error"; error: string };

/**
 * Server configuration interface for MCP servers
 */
export interface IMCPServerConfig {
  id: string;
  name: string;
  serverType: "local" | "remote" | "remote-streamable";
  command?: string;
  args?: string[];
  remoteUrl?: string;
  bearerToken?: string;
  env?: Record<string, string>;
  inputParams?: Record<string, { default: string; description: string }>;
}

/**
 * Creates an MCP client and connects to the specified server
 * @param server Server configuration
 * @param clientName Name for the client
 * @returns Result object with status and either client or error message
 */
export async function connectToMCPServer(
  server: IMCPServerConfig,
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
      const headers: HeadersInit = {
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

      // Use stdio transport for local servers
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args || [],
        env: {
          ...server.env,
          ...userEnvs,
        },
        stderr: "pipe",
      });

      let stderrOutput = "";

      try {
        logInfo("connecting to the MCP server...");

        const connectionPromise = client.connect(transport);

        transport?.stderr?.on("data", (chunk) => {
          stderrOutput += chunk.toString();
        });

        await connectionPromise;

        logInfo("connected to the MCP server");
      } catch (error) {
        logError("could not connect to the MCP server", error);
        if (stderrOutput) {
          logError("Stderr output:", stderrOutput);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Return stderr output directly if available, otherwise use the error message
        if (stderrOutput) {
          throw new Error(stderrOutput);
        } else {
          throw error;
        }
      }
    } else {
      throw new Error(`Unknown server type: ${server.serverType}`);
    }

    return { status: "success", client };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Failed to connect to MCP server: ${errorMessage}`, error);
    return { status: "error", error: errorMessage };
  }
}

/**
 * Function to substitute parameters in arguments
 * @param args The arguments array
 * @param env Environment variables
 * @param inputParams Input parameters definition
 * @returns Arguments with parameter values substituted
 */
export function substituteArgsParameters(
  args: string[],
  env: Record<string, string> = {},
  inputParams: Record<string, { default: string; description: string }> = {},
): string[] {
  return args.map((arg) => {
    let result = arg;

    // Replace parameter placeholders - support both {PARAM} and ${PARAM} formats
    Object.entries(inputParams).forEach(([paramName, paramDef]) => {
      const paramValue = env[paramName] || paramDef.default || "";
      // Replace ${PARAM} format
      result = result.replace(
        new RegExp(`\\$\\{${paramName}\\}`, "g"),
        paramValue,
      );
      // Replace {PARAM} format
      result = result.replace(
        new RegExp(`\\{${paramName}\\}`, "g"),
        paramValue,
      );
    });

    // Replace environment variable placeholders - support both {PARAM} and ${PARAM} formats
    Object.entries(env).forEach(([envName, envValue]) => {
      // Replace ${PARAM} format
      result = result.replace(new RegExp(`\\$\\{${envName}\\}`, "g"), envValue);
      // Replace {PARAM} format
      result = result.replace(new RegExp(`\\{${envName}\\}`, "g"), envValue);
    });

    return result;
  });
}

/**
 * Fetch tools from an MCP server
 * @param client Connected MCP client
 * @returns Array of tools or empty array if failed
 */
export async function fetchServerTools(client: Client): Promise<any[]> {
  try {
    const response = await client.listTools();

    if (response && Array.isArray(response.tools)) {
      return response.tools;
    }

    return [];
  } catch (error) {
    logError("Error fetching tools from server", error);
    return [];
  }
}

/**
 * Fetch resources from an MCP server
 * @param client Connected MCP client
 * @returns Array of resources or empty array if failed
 */
export async function fetchServerResources(client: Client): Promise<any[]> {
  try {
    const response = await client.listResources({});

    if (response && Array.isArray(response.resources)) {
      return response.resources;
    }

    return [];
  } catch (error) {
    logError("Error fetching resources from server", error);
    return [];
  }
}

/**
 * Read a resource from an MCP server
 * @param client Connected MCP client
 * @param uri Resource URI
 * @returns Resource content or null if failed
 */
export async function readServerResource(
  client: Client,
  uri: string,
): Promise<any> {
  try {
    return await client.readResource({ uri });
  } catch (error) {
    logError(`Error reading resource ${uri} from server`, error);
    throw error;
  }
}
