import { app } from "electron";
import * as path from "path";
import { MCPServerConfig, MCPInputParam } from "@mcp_router/shared";
import { DxtManifest } from "@anthropic-ai/dxt";
import { v4 as uuidv4 } from "uuid";

/**
 * Convert DXT manifest to MCPServerConfig
 */
export function convertDxtManifestToMCPServerConfig(
  manifest: DxtManifest,
  dxtPath: string,
): MCPServerConfig {
  // Check platform compatibility first
  checkPlatformCompatibility(manifest);

  // Generate unique server ID
  const serverId = generateServerId(manifest);

  // Get platform-specific config
  const mcpConfig = resolvePlatformSpecificConfig(manifest);

  // Expand variables in the config
  const expandedCommand = expandVariables(mcpConfig.command, dxtPath);
  const expandedArgs = expandVariables(mcpConfig.args || [], dxtPath);
  const expandedEnv = expandVariables(mcpConfig.env || {}, dxtPath);

  // Convert user_config to inputParams
  const inputParams = convertUserConfig(dxtPath, manifest.user_config);

  // Create the MCPServerConfig
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

  // Add inputParams if exists
  if (inputParams && Object.keys(inputParams).length > 0) {
    config.inputParams = inputParams;
  }

  // Add required fields if user_config has required items
  if (manifest.user_config) {
    const requiredFields = Object.entries(manifest.user_config)
      .filter(([_, config]) => config.required)
      .map(([key]) => key);

    if (requiredFields.length > 0) {
      config.required = requiredFields;
    }
  }

  return config;
}

/**
 * Generate a unique server ID based on manifest
 */
function generateServerId(manifest: DxtManifest): string {
  // Use name and UUID to create a unique ID
  const safeName = manifest.name.replace(/[^a-zA-Z0-9-_]/g, "-");
  return `dxt-${safeName}-${uuidv4()}`;
}

/**
 * Check if the current platform is supported by the extension
 */
function checkPlatformCompatibility(manifest: DxtManifest): void {
  const currentPlatform = process.platform;
  const supportedPlatforms = manifest.compatibility?.platforms;

  if (
    supportedPlatforms &&
    !supportedPlatforms.includes(currentPlatform as any)
  ) {
    throw new Error(
      `This extension does not support ${currentPlatform}. ` +
        `Supported platforms: ${supportedPlatforms.join(", ")}`,
    );
  }
}

/**
 * Resolve platform-specific configuration
 */
function resolvePlatformSpecificConfig(manifest: DxtManifest): {
  command: string;
  args?: string[];
  env?: Record<string, string>;
} {
  const baseConfig = manifest.server.mcp_config;
  const currentPlatform = process.platform;
  const overrides = baseConfig.platform_overrides?.[currentPlatform];

  // Merge base config with platform-specific overrides
  return {
    command: overrides?.command || baseConfig.command,
    args: overrides?.args || baseConfig.args,
    env: { ...baseConfig.env, ...overrides?.env },
  };
}

/**
 * Convert DXT user_config to MCPServerConfig inputParams
 */
function convertUserConfig(
  dxtPath: string,
  userConfig?: Record<string, any>,
): Record<string, MCPInputParam> | undefined {
  if (!userConfig) return undefined;

  const inputParams: Record<string, MCPInputParam> = {};

  for (const [key, config] of Object.entries(userConfig)) {
    inputParams[key] = {
      type: config.type,
      title: config.title,
      description: config.description,
      sensitive: config.sensitive,
      required: config.required,
      default: config.default
        ? expandVariables(config.default, dxtPath)
        : undefined,
      min: config.min,
      max: config.max,
    };
  }

  return inputParams;
}

/**
 * Expand variables in values (string, array, or object)
 */
function expandVariables(value: any, dxtPath: string): any {
  if (typeof value === "string") {
    return expandPathVariables(value, dxtPath);
  } else if (Array.isArray(value)) {
    return value.map((v) => expandVariables(v, dxtPath));
  } else if (value && typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = expandVariables(v, dxtPath);
    }
    return result;
  }
  return value;
}

/**
 * Expand path variables in a string
 */
function expandPathVariables(value: string, dxtPath: string): string {
  const replacements: Record<string, string> = {
    "${__dirname}": dxtPath,
    "${HOME}": app.getPath("home"),
    "${DESKTOP}": app.getPath("desktop"),
    "${DOCUMENTS}": app.getPath("documents"),
    "${DOWNLOADS}": app.getPath("downloads"),
    "${pathSeparator}": path.sep,
    "${/}": path.sep,
  };

  let expanded = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    // Escape special regex characters in the key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expanded = expanded.replace(new RegExp(escapedKey, "g"), replacement);
  }

  // Handle Windows binary extension
  if (process.platform === "win32" && !expanded.includes(".")) {
    // Check if this looks like a binary command (no extension)
    const isLikelyBinary = !expanded.includes("/") && !expanded.includes("\\");
    if (isLikelyBinary) {
      expanded += ".exe";
    }
  }

  return expanded;
}
