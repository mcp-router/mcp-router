/**
 * Standard Client Definitions
 *
 * Defines all built-in AI clients with their MCP config paths and skills paths.
 * Each client may have platform-specific paths for darwin, win32, and linux.
 */

import type { StandardClientDefinition } from "@mcp_router/shared";
import os from "os";
import path from "path";

// =============================================================================
// Standard Client Definitions
// =============================================================================

const HOME = os.homedir();

/**
 * All standard AI client definitions
 */
export const STANDARD_CLIENTS: readonly StandardClientDefinition[] =
  Object.freeze([
    // -------------------------------------------------------------------------
    // Claude Desktop - Anthropic's desktop application
    // -------------------------------------------------------------------------
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      icon: "claude",
      mcpConfigPath: {
        darwin: path.join(
          HOME,
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json",
        ),
        win32: path.join(
          HOME,
          "AppData",
          "Roaming",
          "Claude",
          "claude_desktop_config.json",
        ),
        linux: path.join(
          HOME,
          ".config",
          "Claude",
          "claude_desktop_config.json",
        ),
      },
      skillsPath: {
        // Claude Desktop stores skills in local-agent-mode-sessions with UUID paths
        darwin: path.join(
          HOME,
          "Library",
          "Application Support",
          "Claude",
          "local-agent-mode-sessions",
          "skills-plugin",
          "*",
          "*",
          "skills",
        ),
        win32: path.join(
          HOME,
          "AppData",
          "Roaming",
          "Claude",
          "local-agent-mode-sessions",
          "skills-plugin",
          "*",
          "*",
          "skills",
        ),
        linux: path.join(
          HOME,
          ".config",
          "Claude",
          "local-agent-mode-sessions",
          "skills-plugin",
          "*",
          "*",
          "skills",
        ),
      },
      detectPaths: {
        darwin: ["/Applications/Claude.app"],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "Claude",
            "Claude.exe",
          ),
          "C:\\Program Files\\Claude\\Claude.exe",
        ],
        linux: ["/usr/bin/claude", "/usr/local/bin/claude"],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Claude Code - Anthropic's CLI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "claude-code",
      name: "Claude Code",
      icon: "claude",
      mcpConfigPath: {
        darwin: path.join(HOME, ".claude.json"),
        win32: path.join(HOME, ".claude.json"),
        linux: path.join(HOME, ".claude.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".claude", "skills"),
        win32: path.join(HOME, ".claude", "skills"),
        linux: path.join(HOME, ".claude", "skills"),
      },
      detectPaths: {
        darwin: [
          "/usr/local/bin/claude",
          path.join(HOME, ".local", "bin", "claude"),
          // NVM-installed claude (npm global)
          path.join(HOME, ".nvm", "versions", "node", "*", "bin", "claude"),
        ],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "claude",
            "claude.exe",
          ),
        ],
        linux: [
          "/usr/bin/claude",
          "/usr/local/bin/claude",
          path.join(HOME, ".local", "bin", "claude"),
          // NVM-installed claude (npm global)
          path.join(HOME, ".nvm", "versions", "node", "*", "bin", "claude"),
        ],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Cursor - AI-powered code editor
    // -------------------------------------------------------------------------
    {
      id: "cursor",
      name: "Cursor",
      icon: "cursor",
      mcpConfigPath: {
        darwin: path.join(HOME, ".cursor", "mcp.json"),
        win32: path.join(HOME, ".cursor", "mcp.json"),
        linux: path.join(HOME, ".cursor", "mcp.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".cursor", "skills"),
        win32: path.join(HOME, ".cursor", "skills"),
        linux: path.join(HOME, ".cursor", "skills"),
      },
      detectPaths: {
        darwin: ["/Applications/Cursor.app"],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "cursor",
            "Cursor.exe",
          ),
        ],
        linux: ["/usr/bin/cursor", "/usr/local/bin/cursor"],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Cline - VS Code extension for Claude
    // -------------------------------------------------------------------------
    {
      id: "cline",
      name: "Cline",
      icon: "cline",
      mcpConfigPath: {
        darwin: path.join(
          HOME,
          "Library",
          "Application Support",
          "Code",
          "User",
          "globalStorage",
          "saoudrizwan.claude-dev",
          "settings",
          "cline_mcp_settings.json",
        ),
        win32: path.join(
          HOME,
          "AppData",
          "Roaming",
          "Code",
          "User",
          "globalStorage",
          "saoudrizwan.claude-dev",
          "settings",
          "cline_mcp_settings.json",
        ),
        linux: path.join(
          HOME,
          ".config",
          "Code",
          "User",
          "globalStorage",
          "saoudrizwan.claude-dev",
          "settings",
          "cline_mcp_settings.json",
        ),
      },
      skillsPath: {
        darwin: path.join(HOME, ".cline", "skills"),
        win32: path.join(HOME, ".cline", "skills"),
        linux: path.join(HOME, ".cline", "skills"),
      },
      detectPaths: {
        // Cline is a VS Code extension, detected via extension or globalStorage directory
        darwin: [
          path.join(HOME, ".vscode", "extensions", "saoudrizwan.claude-dev-*"),
          path.join(
            HOME,
            "Library",
            "Application Support",
            "Code",
            "User",
            "globalStorage",
            "saoudrizwan.claude-dev",
          ),
        ],
        win32: [
          path.join(HOME, ".vscode", "extensions", "saoudrizwan.claude-dev-*"),
          path.join(
            HOME,
            "AppData",
            "Roaming",
            "Code",
            "User",
            "globalStorage",
            "saoudrizwan.claude-dev",
          ),
        ],
        linux: [
          path.join(HOME, ".vscode", "extensions", "saoudrizwan.claude-dev-*"),
          path.join(
            HOME,
            ".config",
            "Code",
            "User",
            "globalStorage",
            "saoudrizwan.claude-dev",
          ),
        ],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Windsurf - Codeium's AI-powered IDE
    // -------------------------------------------------------------------------
    {
      id: "windsurf",
      name: "Windsurf",
      icon: "windsurf",
      mcpConfigPath: {
        darwin: path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
        win32: path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
        linux: path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".codeium", "windsurf", "skills"),
        win32: path.join(HOME, ".codeium", "windsurf", "skills"),
        linux: path.join(HOME, ".codeium", "windsurf", "skills"),
      },
      detectPaths: {
        darwin: [
          "/Applications/Windsurf.app",
          // Fallback: check if config directory exists (for web/container installs)
          path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
        ],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "windsurf",
            "Windsurf.exe",
          ),
          path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
        ],
        linux: [
          "/usr/bin/windsurf",
          "/usr/local/bin/windsurf",
          path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
        ],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // VS Code - Microsoft's code editor with Copilot integration
    // -------------------------------------------------------------------------
    {
      id: "vscode",
      name: "VS Code",
      icon: "vscode",
      mcpConfigPath: {
        darwin: path.join(
          HOME,
          "Library",
          "Application Support",
          "Code",
          "User",
          "mcp.json",
        ),
        win32: path.join(
          HOME,
          "AppData",
          "Roaming",
          "Code",
          "User",
          "mcp.json",
        ),
        linux: path.join(HOME, ".config", "Code", "User", "mcp.json"),
      },
      skillsPath: {
        // VS Code/GitHub Copilot uses .github/skills for project skills
        // and .copilot/skills for global skills
        darwin: path.join(HOME, ".copilot", "skills"),
        win32: path.join(HOME, ".copilot", "skills"),
        linux: path.join(HOME, ".copilot", "skills"),
      },
      detectPaths: {
        darwin: ["/Applications/Visual Studio Code.app"],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "Microsoft VS Code",
            "Code.exe",
          ),
          "C:\\Program Files\\Microsoft VS Code\\Code.exe",
        ],
        linux: ["/usr/bin/code", "/usr/local/bin/code"],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Codex - OpenAI's CLI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "codex",
      name: "Codex",
      icon: "openai",
      mcpConfigPath: {
        darwin: path.join(HOME, ".codex", "config.toml"),
        win32: path.join(HOME, ".codex", "config.toml"),
        linux: path.join(HOME, ".codex", "config.toml"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".codex", "skills"),
        win32: path.join(HOME, ".codex", "skills"),
        linux: path.join(HOME, ".codex", "skills"),
      },
      detectPaths: {
        darwin: [
          "/usr/local/bin/codex",
          path.join(HOME, ".local", "bin", "codex"),
          // Homebrew-installed codex
          "/opt/homebrew/bin/codex",
          // NVM-installed codex (npm global)
          path.join(HOME, ".nvm", "versions", "node", "*", "bin", "codex"),
          // Check if config exists as detection fallback
          path.join(HOME, ".codex", "config.toml"),
        ],
        win32: [
          path.join(HOME, "AppData", "Local", "Programs", "codex", "codex.exe"),
          path.join(HOME, ".codex", "config.toml"),
        ],
        linux: [
          "/usr/bin/codex",
          "/usr/local/bin/codex",
          path.join(HOME, ".local", "bin", "codex"),
          // NVM-installed codex (npm global)
          path.join(HOME, ".nvm", "versions", "node", "*", "bin", "codex"),
          path.join(HOME, ".codex", "config.toml"),
        ],
      },
      configFormat: "toml",
    },

    // -------------------------------------------------------------------------
    // GitHub Copilot - GitHub's AI coding assistant (CLI)
    // -------------------------------------------------------------------------
    {
      id: "github-copilot",
      name: "GitHub Copilot",
      icon: "github",
      mcpConfigPath: {
        // Copilot CLI doesn't have a dedicated MCP config file
      },
      skillsPath: {
        darwin: path.join(HOME, ".copilot", "skills"),
        win32: path.join(HOME, ".copilot", "skills"),
        linux: path.join(HOME, ".copilot", "skills"),
      },
      detectPaths: {
        darwin: [
          "/usr/local/bin/gh",
          path.join(HOME, ".local", "bin", "gh"),
          // Homebrew-installed gh
          "/opt/homebrew/bin/gh",
        ],
        win32: [path.join(HOME, "AppData", "Local", "GitHub CLI", "gh.exe")],
        linux: ["/usr/bin/gh", "/usr/local/bin/gh"],
      },
      configFormat: "env-only",
    },

    // -------------------------------------------------------------------------
    // OpenCode - Open-source AI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "opencode",
      name: "OpenCode",
      icon: "terminal",
      mcpConfigPath: {
        darwin: path.join(HOME, ".config", "opencode", "opencode.json"),
        win32: path.join(HOME, ".config", "opencode", "opencode.json"),
        linux: path.join(HOME, ".config", "opencode", "opencode.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".config", "opencode", "skills"),
        win32: path.join(HOME, ".config", "opencode", "skills"),
        linux: path.join(HOME, ".config", "opencode", "skills"),
      },
      detectPaths: {
        darwin: [
          "/usr/local/bin/opencode",
          path.join(HOME, ".local", "bin", "opencode"),
          // Homebrew-installed opencode
          "/opt/homebrew/bin/opencode",
          // Go-installed opencode
          path.join(HOME, "go", "bin", "opencode"),
        ],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "opencode",
            "opencode.exe",
          ),
        ],
        linux: [
          "/usr/bin/opencode",
          "/usr/local/bin/opencode",
          path.join(HOME, ".local", "bin", "opencode"),
          // Go-installed opencode
          path.join(HOME, "go", "bin", "opencode"),
        ],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Gemini CLI - Google's AI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "gemini",
      name: "Gemini CLI",
      icon: "gemini",
      mcpConfigPath: {
        darwin: path.join(HOME, ".gemini", "settings.json"),
        win32: path.join(HOME, ".gemini", "settings.json"),
        linux: path.join(HOME, ".gemini", "settings.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".gemini", "skills"),
        win32: path.join(HOME, ".gemini", "skills"),
        linux: path.join(HOME, ".gemini", "skills"),
      },
      detectPaths: {
        darwin: [
          "/usr/local/bin/gemini",
          path.join(HOME, ".local", "bin", "gemini"),
          // NVM-installed gemini (npm global)
          path.join(HOME, ".nvm", "versions", "node", "*", "bin", "gemini"),
        ],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "gemini",
            "gemini.exe",
          ),
        ],
        linux: [
          "/usr/bin/gemini",
          "/usr/local/bin/gemini",
          path.join(HOME, ".local", "bin", "gemini"),
          // NVM-installed gemini (npm global)
          path.join(HOME, ".nvm", "versions", "node", "*", "bin", "gemini"),
        ],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Antigravity - Google's AI desktop app (powered by Gemini)
    // -------------------------------------------------------------------------
    {
      id: "antigravity",
      name: "Antigravity",
      icon: "antigravity",
      mcpConfigPath: {
        darwin: path.join(HOME, ".gemini", "antigravity", "mcp_config.json"),
        win32: path.join(HOME, ".gemini", "antigravity", "mcp_config.json"),
        linux: path.join(HOME, ".gemini", "antigravity", "mcp_config.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".gemini", "antigravity", "skills"),
        win32: path.join(HOME, ".gemini", "antigravity", "skills"),
        linux: path.join(HOME, ".gemini", "antigravity", "skills"),
      },
      detectPaths: {
        darwin: [
          "/Applications/Antigravity.app",
          path.join(HOME, ".antigravity"),
          path.join(HOME, ".gemini", "antigravity"),
        ],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "Antigravity",
            "Antigravity.exe",
          ),
        ],
        linux: [
          "/usr/bin/antigravity",
          path.join(HOME, ".antigravity"),
          path.join(HOME, ".gemini", "antigravity"),
        ],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Factory (Droid) - AI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "factory",
      name: "Factory",
      icon: "factory",
      mcpConfigPath: {
        darwin: path.join(HOME, ".factory", "mcp.json"),
        win32: path.join(HOME, ".factory", "mcp.json"),
        linux: path.join(HOME, ".factory", "mcp.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".factory", "skills"),
        win32: path.join(HOME, ".factory", "skills"),
        linux: path.join(HOME, ".factory", "skills"),
      },
      detectPaths: {
        darwin: [
          "/Applications/Factory.app",
          path.join(HOME, ".factory", "mcp.json"),
        ],
        win32: [
          path.join(
            HOME,
            "AppData",
            "Local",
            "Programs",
            "Factory",
            "Factory.exe",
          ),
          path.join(HOME, ".factory", "mcp.json"),
        ],
        linux: ["/usr/bin/factory", path.join(HOME, ".factory", "mcp.json")],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Continue - Open-source AI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "continue",
      name: "Continue",
      icon: "continue",
      mcpConfigPath: {
        darwin: path.join(HOME, ".continue", "config.json"),
        win32: path.join(HOME, ".continue", "config.json"),
        linux: path.join(HOME, ".continue", "config.json"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".continue", "skills"),
        win32: path.join(HOME, ".continue", "skills"),
        linux: path.join(HOME, ".continue", "skills"),
      },
      detectPaths: {
        // Continue is a VS Code extension
        darwin: [
          path.join(HOME, ".vscode", "extensions", "continue.continue-*"),
        ],
        win32: [
          path.join(HOME, ".vscode", "extensions", "continue.continue-*"),
        ],
        linux: [
          path.join(HOME, ".vscode", "extensions", "continue.continue-*"),
        ],
      },
      configFormat: "json",
    },

    // -------------------------------------------------------------------------
    // Goose - Block's AI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "goose",
      name: "Goose",
      icon: "goose",
      mcpConfigPath: {
        darwin: path.join(HOME, ".config", "goose", "config.yaml"),
        win32: path.join(HOME, ".config", "goose", "config.yaml"),
        linux: path.join(HOME, ".config", "goose", "config.yaml"),
      },
      skillsPath: {
        darwin: path.join(HOME, ".config", "goose", "skills"),
        win32: path.join(HOME, ".config", "goose", "skills"),
        linux: path.join(HOME, ".config", "goose", "skills"),
      },
      detectPaths: {
        darwin: [
          "/usr/local/bin/goose",
          path.join(HOME, ".local", "bin", "goose"),
        ],
        win32: [
          path.join(HOME, "AppData", "Local", "Programs", "goose", "goose.exe"),
        ],
        linux: [
          "/usr/bin/goose",
          "/usr/local/bin/goose",
          path.join(HOME, ".local", "bin", "goose"),
        ],
      },
      configFormat: "json", // Note: Goose actually uses YAML but we use json for compatibility
    },

    // -------------------------------------------------------------------------
    // Roo Code - AI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "roo",
      name: "Roo Code",
      icon: "roocode",
      mcpConfigPath: {
        // Roo Code uses environment-based configuration
      },
      skillsPath: {
        darwin: path.join(HOME, ".roo", "skills"),
        win32: path.join(HOME, ".roo", "skills"),
        linux: path.join(HOME, ".roo", "skills"),
      },
      detectPaths: {
        // Roo Code is a VS Code extension
        darwin: [
          path.join(
            HOME,
            ".vscode",
            "extensions",
            "rooveterinaryinc.roo-cline-*",
          ),
        ],
        win32: [
          path.join(
            HOME,
            ".vscode",
            "extensions",
            "rooveterinaryinc.roo-cline-*",
          ),
        ],
        linux: [
          path.join(
            HOME,
            ".vscode",
            "extensions",
            "rooveterinaryinc.roo-cline-*",
          ),
        ],
      },
      configFormat: "env-only",
    },

    // -------------------------------------------------------------------------
    // Trae - ByteDance's AI coding assistant
    // -------------------------------------------------------------------------
    {
      id: "trae",
      name: "Trae",
      icon: "trae",
      mcpConfigPath: {
        // Trae uses environment-based configuration
      },
      skillsPath: {
        darwin: path.join(HOME, ".trae", "skills"),
        win32: path.join(HOME, ".trae", "skills"),
        linux: path.join(HOME, ".trae", "skills"),
      },
      detectPaths: {
        darwin: ["/Applications/Trae.app"],
        win32: [
          path.join(HOME, "AppData", "Local", "Programs", "trae", "Trae.exe"),
        ],
        linux: ["/usr/bin/trae", "/usr/local/bin/trae"],
      },
      configFormat: "env-only",
    },
  ]);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a client definition by ID
 */
export function getClientById(
  id: string,
): StandardClientDefinition | undefined {
  return STANDARD_CLIENTS.find((client) => client.id === id);
}

/**
 * Get a client definition by name (case-insensitive)
 */
export function getClientByName(
  name: string,
): StandardClientDefinition | undefined {
  const normalized = name.toLowerCase();
  return STANDARD_CLIENTS.find(
    (client) =>
      client.id === normalized || client.name.toLowerCase() === normalized,
  );
}

/**
 * Get the MCP config path for a client on the current platform
 */
export function getClientMcpConfigPath(clientId: string): string | undefined {
  const client = getClientById(clientId);
  if (!client) return undefined;

  const platform = process.platform as "darwin" | "win32" | "linux";
  return client.mcpConfigPath[platform];
}

/**
 * Get the skills path for a client on the current platform
 */
export function getClientSkillsPath(clientId: string): string | undefined {
  const client = getClientById(clientId);
  if (!client) return undefined;

  const platform = process.platform as "darwin" | "win32" | "linux";
  return client.skillsPath[platform];
}

/**
 * Get detection paths for a client on the current platform
 */
export function getClientDetectPaths(clientId: string): string[] {
  const client = getClientById(clientId);
  if (!client || !client.detectPaths) return [];

  const platform = process.platform as "darwin" | "win32" | "linux";
  return client.detectPaths[platform] || [];
}

/**
 * Get all client IDs
 */
export function getStandardClientIds(): string[] {
  return STANDARD_CLIENTS.map((client) => client.id);
}

/**
 * Get all clients that have MCP config support
 */
export function getClientsWithMcpConfig(): StandardClientDefinition[] {
  const platform = process.platform as "darwin" | "win32" | "linux";
  return STANDARD_CLIENTS.filter((client) => client.mcpConfigPath[platform]);
}

/**
 * Get all clients that have skills support
 */
export function getClientsWithSkills(): StandardClientDefinition[] {
  const platform = process.platform as "darwin" | "win32" | "linux";
  return STANDARD_CLIENTS.filter((client) => client.skillsPath[platform]);
}
