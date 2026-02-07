import type {
  Skill,
  SkillWithContent,
  CreateSkillInput,
  UpdateSkillInput,
  AgentPath,
  CreateAgentPathInput,
  UnifiedSkill,
  UpdateUnifiedSkillInput,
  ClientSkillState,
  SetClientSkillStateInput,
  AdoptSkillInput,
  SkillSyncResult,
  SkillVerifyResult,
} from "../../skill-types";

/**
 * Skills management API
 */
export interface SkillsAPI {
  // CRUD operations (optimized for lazy loading)
  list: () => Promise<Skill[]>;
  get: (id: string) => Promise<Skill | null>;
  getContent: (id: string) => Promise<string | null>;
  getContentFromPath: (skillPath: string) => Promise<string | null>;
  getWithContent: (id: string) => Promise<SkillWithContent | null>;
  create: (input: CreateSkillInput) => Promise<Skill>;
  update: (id: string, updates: UpdateSkillInput) => Promise<Skill>;
  delete: (id: string) => Promise<void>;

  // Actions
  openFolder: (id?: string) => Promise<void>;
  import: () => Promise<Skill>;

  // Agent Path operations (symlink target directories)
  agentPaths: {
    list: () => Promise<AgentPath[]>;
    create: (input: CreateAgentPathInput) => Promise<AgentPath>;
    delete: (id: string) => Promise<void>;
    selectFolder: () => Promise<string>;
  };

  // Unified skills operations (per-client state management)
  unified: UnifiedSkillsAPI;
}

/**
 * Unified Skills API for per-client skill state management
 */
export interface UnifiedSkillsAPI {
  // List all skills with their per-client states
  list: () => Promise<UnifiedSkill[]>;

  // Get a single unified skill by ID
  get: (id: string) => Promise<UnifiedSkill | null>;

  // Update unified skill properties (name, content, globalSync, projectId)
  update: (
    id: string,
    updates: UpdateUnifiedSkillInput,
  ) => Promise<UnifiedSkill>;

  // Enable skill for a specific client
  enableForClient: (skillId: string, clientId: string) => Promise<void>;

  // Disable skill for a specific client
  disableForClient: (skillId: string, clientId: string) => Promise<void>;

  // Enable skill for all clients
  enableAll: (skillId: string) => Promise<SkillSyncResult>;

  // Disable skill for all clients
  disableAll: (skillId: string) => Promise<SkillSyncResult>;

  // Remove skill from a specific client
  removeFromClient: (skillId: string, clientId: string) => Promise<void>;

  // Set skill state for a specific client (enable/disable/not-installed)
  setClientState: (
    input: SetClientSkillStateInput,
  ) => Promise<ClientSkillState>;

  // Adopt a discovered skill into router management
  adopt: (input: AdoptSkillInput) => Promise<UnifiedSkill>;

  // Sync skills to clients (optionally for a specific skill)
  sync: (skillId?: string) => Promise<SkillSyncResult>;

  // Verify and repair skill symlinks
  verify: () => Promise<SkillVerifyResult>;
}
