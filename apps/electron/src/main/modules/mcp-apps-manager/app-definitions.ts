import { ClientType } from "@mcp_router/shared";
import { AppPaths } from "./app-paths";

export type StandardAppId =
  | "codex"
  | "claude"
  | "cline"
  | "windsurf"
  | "cursor"
  | "vscode"
  | "antigravity"
  | "github-copilot"
  | "opencode"
  | "gemini"
  | "factory"
  | "continue"
  | "goose"
  | "roo"
  | "trae";

export type IconKey =
  | "openai"
  | "claude"
  | "cline"
  | "windsurf"
  | "cursor"
  | "vscode"
  | "antigravity"
  | "github"
  | "roocode"
  | "gemini"
  | "factory"
  | "continue"
  | "goose"
  | "trae";

export type AppConfigKind =
  | "standard-json"
  | "vscode-json"
  | "codex"
  | "antigravity"
  | "env-only";

export interface StandardAppDefinition {
  id: StandardAppId;
  name: string;
  clientType: ClientType;
  iconKey: IconKey;
  configKind: AppConfigKind;
  getConfigPath: (paths: AppPaths) => string;
}

const definitions: StandardAppDefinition[] = [
  {
    id: "antigravity",
    name: "Antigravity",
    clientType: "antigravity",
    iconKey: "antigravity",
    configKind: "antigravity",
    getConfigPath: (paths) => paths.antigravityConfig(),
  },
  {
    id: "codex",
    name: "Codex",
    clientType: "codex",
    iconKey: "openai",
    configKind: "codex",
    getConfigPath: (paths) => paths.codexConfig(),
  },
  {
    id: "claude",
    name: "Claude",
    clientType: "claude",
    iconKey: "claude",
    configKind: "standard-json",
    getConfigPath: (paths) => paths.claudeConfig(),
  },
  {
    id: "cline",
    name: "Cline",
    clientType: "cline",
    iconKey: "cline",
    configKind: "standard-json",
    getConfigPath: (paths) => paths.clineConfig(),
  },
  {
    id: "windsurf",
    name: "Windsurf",
    clientType: "windsurf",
    iconKey: "windsurf",
    configKind: "standard-json",
    getConfigPath: (paths) => paths.windsurfConfig(),
  },
  {
    id: "cursor",
    name: "Cursor",
    clientType: "cursor",
    iconKey: "cursor",
    configKind: "standard-json",
    getConfigPath: (paths) => paths.cursorConfig(),
  },
  {
    id: "vscode",
    name: "VSCode",
    clientType: "vscode",
    iconKey: "vscode",
    configKind: "vscode-json",
    getConfigPath: (paths) => paths.vscodeConfig(),
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    clientType: "vscode", // Use vscode logic for config if applicable
    iconKey: "github",
    configKind: "env-only",
    getConfigPath: () => "",
  },
  {
    id: "opencode",
    name: "OpenCode",
    clientType: "vscode",
    iconKey: "roocode",
    configKind: "standard-json",
    getConfigPath: () => "",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    clientType: "vscode",
    iconKey: "gemini",
    configKind: "standard-json",
    getConfigPath: () => "",
  },
  {
    id: "factory",
    name: "Factory",
    clientType: "vscode",
    iconKey: "factory",
    configKind: "standard-json",
    getConfigPath: () => "",
  },
  {
    id: "continue",
    name: "Continue",
    clientType: "vscode",
    iconKey: "continue",
    configKind: "standard-json",
    getConfigPath: () => "",
  },
  {
    id: "goose",
    name: "Goose",
    clientType: "vscode",
    iconKey: "goose",
    configKind: "standard-json",
    getConfigPath: () => "",
  },
  {
    id: "roo",
    name: "Roo Code",
    clientType: "vscode",
    iconKey: "roocode",
    configKind: "env-only",
    getConfigPath: () => "",
  },
  {
    id: "trae",
    name: "Trae",
    clientType: "vscode",
    iconKey: "trae",
    configKind: "env-only",
    getConfigPath: () => "",
  },
];

export const STANDARD_APP_DEFINITIONS: readonly StandardAppDefinition[] =
  Object.freeze(definitions);

export function findStandardAppDefinition(
  name: string,
): StandardAppDefinition | undefined {
  const normalized = name.toLowerCase();
  return definitions.find(
    (definition) =>
      definition.id === normalized ||
      definition.name.toLowerCase() === normalized,
  );
}

export function getStandardAppIds(): string[] {
  return definitions.map((definition) => definition.id);
}
