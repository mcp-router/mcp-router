import { app } from "electron";
import * as path from "path";
import { MCPServerConfig, MCPInputParam } from "@mcp_router/shared";
import { v4 as uuidv4 } from "uuid";
import type { McpbManifest } from "./mcpb-processor";

/**
 * Convert MCPB manifest to MCPServerConfig
 */
export function convertMcpbManifestToMCPServerConfig(
  manifest: McpbManifest,
  extractedPath: string,
): MCPServerConfig {
  checkPlatformCompatibility(manifest);

  const serverId = generateServerId(manifest);
  const mcpConfig = resolvePlatformSpecificConfig(manifest);

  const expandedCommand = expandVariables(
    mcpConfig.command,
    extractedPath,
  ) as string;
  const expandedArgs = expandVariables(
    mcpConfig.args || [],
    extractedPath,
  ) as string[];
  const expandedEnv = expandVariables(
    mcpConfig.env || {},
    extractedPath,
  ) as Record<string, string>;

  const inputParams = convertUserConfig(extractedPath, manifest.user_config);

  const config: MCPServerConfig = {
    id: serverId,
    name: manifest.display_name || manifest.name,
    description: manifest.description,
    version: manifest.version,
    serverType: "local",
    command: expandedCommand,
    args: expandedArgs,
    env: expandedEnv,
    disabled: false,
    autoStart: false,
    verificationStatus: "unverified",
  };

  if (inputParams && Object.keys(inputParams).length > 0) {
    config.inputParams = inputParams;
  }

  if (manifest.user_config) {
    const requiredFields = Object.entries(manifest.user_config)
      .filter(([_, cfg]) => cfg.required)
      .map(([key]) => key);

    if (requiredFields.length > 0) {
      config.required = requiredFields;
    }
  }

  return config;
}

function generateServerId(manifest: McpbManifest): string {
  const safeName = manifest.name.replace(/[^a-zA-Z0-9-_]/g, "-");
  return `mcpb-${safeName}-${uuidv4()}`;
}

function checkPlatformCompatibility(manifest: McpbManifest): void {
  const currentPlatform = process.platform;
  const supportedPlatforms = manifest.compatibility?.platforms;

  if (
    supportedPlatforms &&
    !supportedPlatforms.includes(
      currentPlatform as "darwin" | "win32" | "linux",
    )
  ) {
    throw new Error(
      `This extension does not support ${currentPlatform}. ` +
        `Supported platforms: ${supportedPlatforms.join(", ")}`,
    );
  }
}

function resolvePlatformSpecificConfig(manifest: McpbManifest): {
  command: string;
  args?: string[];
  env?: Record<string, string>;
} {
  const serverType = manifest.server.type;
  const mcpConfig = manifest.server.mcp_config;
  const currentPlatform = process.platform;
  const overrides = mcpConfig.platform_overrides?.[currentPlatform];

  let command = overrides?.command || mcpConfig.command;
  let args = overrides?.args || mcpConfig.args;

  // For 'uv' server type, prepend uv run if command isn't already a uv invocation
  if (serverType === "uv" && command && !command.startsWith("uv")) {
    args = ["run", command, ...(args || [])];
    command = "uv";
  }

  return {
    command,
    args,
    env: { ...mcpConfig.env, ...overrides?.env },
  };
}

function convertUserConfig(
  extractedPath: string,
  userConfig?: Record<
    string,
    {
      type: string;
      title?: string;
      description?: string;
      sensitive?: boolean;
      required?: boolean;
      default?: string;
      min?: number;
      max?: number;
    }
  >,
): Record<string, MCPInputParam> | undefined {
  if (!userConfig) return undefined;

  const inputParams: Record<string, MCPInputParam> = {};

  for (const [key, config] of Object.entries(userConfig)) {
    inputParams[key] = {
      type: config.type as MCPInputParam["type"],
      title: config.title,
      description: config.description,
      sensitive: config.sensitive,
      required: config.required,
      default: config.default
        ? (expandVariables(config.default, extractedPath) as
            | string
            | number
            | boolean
            | undefined)
        : undefined,
      min: config.min,
      max: config.max,
    };
  }

  return inputParams;
}

function expandVariables(value: unknown, extractedPath: string): unknown {
  if (typeof value === "string") {
    return expandPathVariables(value, extractedPath);
  } else if (Array.isArray(value)) {
    return value.map((v) => expandVariables(v, extractedPath));
  } else if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = expandVariables(v, extractedPath);
    }
    return result;
  }
  return value;
}

function expandPathVariables(value: string, extractedPath: string): string {
  const replacements: Record<string, string> = {
    "${__dirname}": extractedPath,
    "${HOME}": app.getPath("home"),
    "${DESKTOP}": app.getPath("desktop"),
    "${DOCUMENTS}": app.getPath("documents"),
    "${DOWNLOADS}": app.getPath("downloads"),
    "${pathSeparator}": path.sep,
    "${/}": path.sep,
  };

  let expanded = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expanded = expanded.replace(new RegExp(escapedKey, "g"), replacement);
  }

  return expanded;
}
