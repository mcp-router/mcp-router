/**
 * Client Detector
 *
 * Detects installed AI clients on the user's machine by checking
 * platform-specific paths for executables and app bundles.
 *
 * Uses the unified client-definitions for all client metadata.
 */

import fs from "fs";
import os from "os";
import path from "path";
import type { ClientDetectionResult } from "@mcp_router/shared";
import {
  STANDARD_CLIENTS,
  getClientDetectPaths,
  getClientMcpConfigPath,
  getClientSkillsPath,
} from "./client-definitions";

/**
 * Maximum recursion depth for glob resolution to prevent infinite loops
 */
const MAX_GLOB_DEPTH = 20;

/**
 * Expand ~ to home directory in path
 */
export function expandHomePath(pathString: string): string {
  const HOME = process.env.HOME || process.env.USERPROFILE || "";
  if (pathString.startsWith("~/")) {
    return path.join(HOME, pathString.slice(2));
  }
  if (pathString === "~") {
    return HOME;
  }
  return pathString;
}

/**
 * Check if a path exists (handles ~ expansion)
 */
function pathExists(pathString: string): boolean {
  const expandedPath = expandHomePath(pathString);
  try {
    return fs.existsSync(expandedPath);
  } catch {
    return false;
  }
}

/**
 * Match a string against a glob pattern (simple * wildcard support)
 */
function matchGlob(str: string, pattern: string): boolean {
  // Escape regex special characters except *
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // Replace * with .*
  const regex = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${regex}$`).test(str);
}

/**
 * Resolve a path containing glob patterns in directory components
 * Returns all matching paths (synchronously)
 *
 * Handles patterns like:
 * - ~/.nvm/versions/node/* /bin/claude (glob in middle directory)
 * - ~/.vscode/extensions/saoudrizwan.claude-dev-* (glob in filename)
 *
 * Security:
 * - Limits recursion depth to prevent infinite loops
 * - Limits total results to prevent memory exhaustion
 * - Paths must start within home directory for skills scanning
 *
 * @param pathPattern Path that may contain * wildcards in any component
 * @param maxResults Maximum number of results to return (default: 100)
 * @returns Array of resolved paths that match the pattern
 */
export function resolveGlobPath(
  pathPattern: string,
  maxResults: number = 100,
): string[] {
  const expandedPath = expandHomePath(pathPattern);
  const parts = expandedPath.split(path.sep);
  const results: string[] = [];

  function resolve(
    currentPath: string,
    remainingParts: string[],
    depth: number,
  ): void {
    // SECURITY: Limit recursion depth to prevent infinite loops
    if (depth > MAX_GLOB_DEPTH) {
      return;
    }

    // SECURITY: Limit total results to prevent memory exhaustion
    if (results.length >= maxResults) {
      return;
    }

    if (remainingParts.length === 0) {
      // Check if the final path exists
      try {
        if (fs.existsSync(currentPath)) {
          results.push(currentPath);
        }
      } catch {
        // Access error, skip
      }
      return;
    }

    const [nextPart, ...rest] = remainingParts;

    if (nextPart.includes("*")) {
      // This part contains a glob pattern - list directory and match
      try {
        if (
          fs.existsSync(currentPath) &&
          fs.statSync(currentPath).isDirectory()
        ) {
          const entries = fs.readdirSync(currentPath);
          for (const entry of entries) {
            // SECURITY: Skip hidden entries to avoid scanning sensitive directories
            if (entry.startsWith(".") && !nextPart.startsWith(".")) {
              continue;
            }
            if (matchGlob(entry, nextPart)) {
              resolve(path.join(currentPath, entry), rest, depth + 1);
            }
          }
        }
      } catch {
        // Directory doesn't exist or access error, skip
      }
    } else {
      // Regular path component - just append and continue
      resolve(path.join(currentPath, nextPart), rest, depth + 1);
    }
  }

  // Handle absolute vs relative paths
  if (expandedPath.startsWith(path.sep)) {
    // Absolute path - start from root
    resolve(
      path.sep,
      parts.filter((p) => p !== ""),
      0,
    );
  } else {
    // Relative path - start from first component
    const [first, ...rest] = parts;
    resolve(first, rest, 0);
  }

  return results;
}

/**
 * Check if a client application is installed by checking detection paths
 * Supports glob patterns in any path component:
 * - Filename patterns (e.g., "saoudrizwan.claude-dev-*")
 * - Directory patterns (e.g., "~/.nvm/versions/node/* /bin/claude")
 *
 * @param detectPaths Array of paths to check for the client executable/app
 * @returns true if at least one path exists
 */
function checkClientInstalled(detectPaths: string[]): boolean {
  for (const detectPath of detectPaths) {
    // Handle glob patterns anywhere in the path
    if (detectPath.includes("*")) {
      const matchingPaths = resolveGlobPath(detectPath);
      if (matchingPaths.length > 0) {
        return true;
      }
    } else {
      // Standard path check
      const expandedPath = expandHomePath(detectPath);
      try {
        if (fs.existsSync(expandedPath)) {
          return true;
        }
      } catch {
        // Path doesn't exist or access error, continue checking
      }
    }
  }
  return false;
}

/**
 * Check if MCP config file exists at the given path
 *
 * @param configPath Path to the MCP configuration file
 * @returns true if the config file exists
 */
function checkMcpConfigExists(configPath: string | undefined): boolean {
  if (!configPath) {
    return false;
  }
  return pathExists(configPath);
}

/**
 * Check if skills directory exists at the given path
 *
 * @param skillsPath Path to the skills directory
 * @returns true if the skills directory exists
 */
function checkSkillsPathExists(skillsPath: string | undefined): boolean {
  if (!skillsPath) {
    return false;
  }
  const expandedPath = expandHomePath(skillsPath);
  if (expandedPath.includes("*")) {
    return resolveGlobPath(expandedPath).length > 0;
  }
  return pathExists(skillsPath);
}

/**
 * Detect a specific client's installation status
 *
 * @param clientId The client identifier (e.g., "claude-desktop", "cursor")
 * @returns ClientDetectionResult with installation and configuration status
 */
export function detectClient(clientId: string): ClientDetectionResult {
  // Get detection paths for current platform
  const detectPaths = getClientDetectPaths(clientId);

  // Check if installed
  const installed =
    detectPaths.length > 0 ? checkClientInstalled(detectPaths) : false;

  // Get MCP config path for current platform
  const mcpConfigPath = getClientMcpConfigPath(clientId);
  const mcpConfigExists = checkMcpConfigExists(mcpConfigPath);

  // Get skills path for current platform
  const skillsPath = getClientSkillsPath(clientId);
  const skillsPathExists = checkSkillsPathExists(skillsPath);

  return {
    id: clientId,
    installed,
    mcpConfigExists,
    skillsPathExists,
  };
}

/**
 * Detect all standard clients' installation status
 *
 * @returns Array of ClientDetectionResult for all standard clients
 */
export function detectAllClients(): ClientDetectionResult[] {
  return STANDARD_CLIENTS.map((client) => detectClient(client.id));
}

/**
 * Get detection paths for a client (useful for debugging)
 *
 * @param clientId The client identifier
 * @returns Object with detect paths, config path, and skills path
 */
function getClientPaths(clientId: string): {
  detectPaths: string[];
  mcpConfigPath: string | undefined;
  skillsPath: string | undefined;
} {
  return {
    detectPaths: getClientDetectPaths(clientId),
    mcpConfigPath: getClientMcpConfigPath(clientId),
    skillsPath: getClientSkillsPath(clientId),
  };
}

/**
 * ClientDetector class for use in ClientAppService
 *
 * Provides both static and instance methods for detecting installed clients.
 */
class ClientDetector {
  /**
   * Detect all standard clients' installation status (static)
   */
  public static detectAll(): ClientDetectionResult[] {
    return detectAllClients();
  }

  /**
   * Detect a specific client's installation status (static)
   *
   * @param clientId The client identifier
   * @returns ClientDetectionResult or null if client ID is not recognized
   */
  public static detect(clientId: string): ClientDetectionResult | null {
    const client = STANDARD_CLIENTS.find((c) => c.id === clientId);
    if (!client) {
      return null;
    }
    return detectClient(clientId);
  }

  /**
   * Instance method for detecting all clients
   */
  public async detectAllAsync(): Promise<ClientDetectionResult[]> {
    return detectAllClients();
  }

  /**
   * Instance method for detecting a specific client
   */
  public async detectAsync(
    clientId: string,
  ): Promise<ClientDetectionResult | null> {
    return ClientDetector.detect(clientId);
  }
}
