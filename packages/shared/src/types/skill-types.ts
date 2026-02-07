/**
 * Agent Skills type definitions
 * Skills are collections of instructions, scripts, and resources
 * that extend AI agent capabilities.
 */

/**
 * Skill entity
 */
export interface Skill {
  id: string;
  name: string; // Directory name (unique key)
  projectId: string | null; // Optional project association
  enabled: boolean; // Whether symlinks are active
  createdAt: number;
  updatedAt: number;
}

/**
 * Skill with content (for API responses)
 */
export interface SkillWithContent extends Skill {
  content: string | null; // SKILL.md content
}

/**
 * Input for creating a skill
 */
export interface CreateSkillInput {
  name: string;
  projectId?: string | null;
}

/**
 * Input for updating a skill
 */
export interface UpdateSkillInput {
  name?: string;
  projectId?: string | null;
  enabled?: boolean;
  content?: string;
}

/**
 * Agent path entity
 * Represents a symlink target directory for skills
 */
export interface AgentPath {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for creating an agent path
 */
export interface CreateAgentPathInput {
  name: string;
  path: string;
}

/**
 * Discovered skill from scanning client app directories
 * Represents a skill found in a client's skills directory
 */
export interface DiscoveredSkill {
  skillName: string; // Name of the skill (directory name)
  skillPath: string; // Full path to the skill directory
  sourceClientId: string; // ID of the client app (e.g., "claude-desktop", "cursor")
  sourceClientName: string; // Display name of the client (e.g., "Claude Desktop", "Cursor")
  hasSkillMd: boolean; // Whether the skill has a SKILL.md file
  isSymlink: boolean; // Whether this is a symlink to another location
  symlinkTarget?: string; // If symlink, where it points to
}

// ============================================================================
// Unified Skills Router Types
// ============================================================================

/**
 * Source type indicating where a skill originated
 */
export type SkillSource = "local" | "discovered";

/**
 * Per-client skill installation state
 */
export type ClientSkillStateType = "enabled" | "disabled" | "not-installed";

/**
 * Symlink status for a skill installation
 * - active: Symlink exists and points to valid target
 * - broken: Symlink exists but target is missing or invalid
 * - pending: Symlink target path exists but symlink not yet created
 * - none: No symlink or target exists
 */
export type SymlinkStatus = "active" | "broken" | "pending" | "none";

/**
 * Error codes for skill operations
 */
export type SkillOperationErrorCode =
  | "SYMLINK_FAILED"
  | "SKILL_NOT_FOUND"
  | "CLIENT_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "ALREADY_EXISTS"
  | "INVALID_PATH"
  | "SYNC_FAILED";

/**
 * Error structure for skill operations
 */
export interface SkillOperationError {
  code: SkillOperationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Database entity for tracking per-client skill state
 */
export interface ClientSkillState {
  id: string;
  skillId: string;
  clientId: string;
  state: ClientSkillStateType;
  isManaged: boolean; // Whether router manages this symlink
  source: SkillSource; // Consistent naming with UnifiedSkill
  discoveredPath?: string; // Original path if discovered
  symlinkStatus: SymlinkStatus;
  lastSyncAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for creating a client skill state record
 */
export interface CreateClientSkillStateInput {
  skillId: string;
  clientId: string;
  state: ClientSkillStateType;
  isManaged?: boolean;
  source?: SkillSource;
  discoveredPath?: string;
}

/**
 * Input for updating a client skill state record
 */
export interface UpdateClientSkillStateInput {
  state?: ClientSkillStateType;
  isManaged?: boolean;
  symlinkStatus?: SymlinkStatus;
  lastSyncAt?: number;
}

/**
 * Summary of skill state for a specific client (for API responses)
 */
export interface ClientSkillSummary {
  clientId: string;
  clientName: string;
  clientIcon?: string;
  installed: boolean;
  state: ClientSkillStateType;
  isManaged: boolean;
  symlinkStatus: SymlinkStatus;
}

/**
 * Unified skill combining skill data with per-client states
 */
export interface UnifiedSkill {
  id: string;
  name: string;
  content: string | null;

  // Source tracking
  source: SkillSource;
  originClientId?: string; // If discovered, which client it came from
  sourcePath?: string; // Path to skill directory (for discovered skills)

  // Per-client states
  clientStates: ClientSkillSummary[];

  // Global settings
  globalSync: boolean; // If true, syncs to all clients by default
  projectId: string | null;

  // Metadata
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for enabling/disabling a skill for a specific client
 */
export interface SetClientSkillStateInput {
  skillId: string;
  clientId: string;
  state: ClientSkillStateType;
}

/**
 * Input for adopting a discovered skill into router management
 */
export interface AdoptSkillInput {
  skillName: string;
  sourceClientId: string;
  globalSync?: boolean; // Sync to all clients by default?
  projectId?: string | null; // Associate with a project?
  enableForClients?: string[]; // Specific clients to enable for
}

/**
 * Input for updating a unified skill
 */
export interface UpdateUnifiedSkillInput {
  name?: string;
  content?: string;
  globalSync?: boolean;
  projectId?: string | null;
}

/**
 * Result of a skill sync operation
 */
export interface SkillSyncResult {
  synced: Array<{ clientId: string; skillId: string }>;
  skipped: Array<{ clientId: string; skillId: string; reason: string }>;
  errors: Array<{ clientId: string; skillId: string; error: string }>;
}

/**
 * Result of verifying and repairing skill symlinks
 */
export interface SkillVerifyResult {
  healthy: number;
  repaired: number;
  failed: Array<{ clientId: string; skillName: string; error: string }>;
}
