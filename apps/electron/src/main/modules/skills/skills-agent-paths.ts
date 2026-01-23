import os from "os";
import path from "path";

const HOME = os.homedir();

/**
 * Agent type (internal implementation)
 */
type AgentType = "claude-code" | "codex" | "copilot" | "cline" | "opencode";

/**
 * Agent skill directory paths by platform
 */
function getAgentSkillBasePath(agentType: AgentType): string {
  switch (agentType) {
    case "claude-code":
      return path.join(HOME, ".claude", "skills");
    case "codex":
      return path.join(HOME, ".codex", "skills");
    case "copilot":
      return path.join(HOME, ".copilot", "skills");
    case "cline":
      return path.join(HOME, ".cline", "skills");
    case "opencode":
      return path.join(HOME, ".config", "opencode", "skill");
  }
}

/**
 * All supported agent types
 */
export const SUPPORTED_AGENTS: AgentType[] = [
  "claude-code",
  "codex",
  "copilot",
  "cline",
  "opencode",
];

/**
 * Get symlink target path for a skill
 */
export function getSymlinkTargetPath(
  agentType: AgentType,
  skillName: string,
): string {
  return path.join(getAgentSkillBasePath(agentType), skillName);
}
