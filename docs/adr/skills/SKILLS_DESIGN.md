# Agent Skills Management Design

## Overview

Agent Skills is an open standard for teaching AI agents specialized knowledge and workflows. MCP Router centrally manages Skills and automatically creates symbolic links to each AI agent's personal directory.

## Architecture

### Module Structure

```
apps/electron/src/main/modules/skills/
├── agent-path.repository.ts          # Agent path DB operations
├── client-skill-state.repository.ts  # Per-client skill state DB operations
├── skills-agent-paths.ts             # Agent path utilities
├── skills-file-manager.ts            # File system operations
├── skills.repository.ts              # Skill DB operations
├── skills.service.ts                 # Business logic
├── skills.ipc.ts                     # IPC handlers (basic CRUD)
├── unified-skills.ipc.ts             # IPC handlers (unified per-client state)
├── unified-skills.service.ts         # Unified skills service (per-client state management)
└── __tests__/                        # Unit tests
    ├── skills.repository.test.ts
    ├── skills-file-manager.test.ts
    └── unified-skills.service.test.ts
```

### Type Definitions

```
packages/shared/src/types/
├── skill-types.ts                      # Domain types
└── platform-api/domains/skills-api.ts  # API types
```

## Data Model

### Skill Entity

```typescript
interface Skill {
  id: string;
  name: string;              // Directory name (unique), path can be derived from name
  projectId: string | null;  // Optional project association
  enabled: boolean;          // Skill enabled/disabled state
  createdAt: number;
  updatedAt: number;
}

// For API responses (includes content)
interface SkillWithContent extends Skill {
  content: string | null;    // SKILL.md content
}
```

> **Note:** The skill folder path can be derived from `name` (`{userData}/skills/{name}`), so it is not stored in the DB.

## API Design

Consolidated into CRUD + actions, with a nested `agentPaths` sub-API for managing agent integrations and a `unified` sub-API for per-client skill state management.

```typescript
interface SkillsAPI {
  // CRUD operations (optimized for lazy loading)
  list: () => Promise<Skill[]>;                            // Returns skills WITHOUT content
  get: (id: string) => Promise<Skill | null>;              // Get single skill metadata
  getContent: (id: string) => Promise<string | null>;      // Lazy load SKILL.md content
  getWithContent: (id: string) => Promise<SkillWithContent | null>; // Get skill with content
  create: (input: CreateSkillInput) => Promise<Skill>;
  update: (id: string, updates: UpdateSkillInput) => Promise<Skill>;
  delete: (id: string) => Promise<void>;

  // Actions
  openFolder: (id?: string) => Promise<void>;  // Omit id to open entire skills directory
  import: () => Promise<Skill>;                 // Folder selection dialog -> import

  // Agent Paths sub-API
  agentPaths: {
    list: () => Promise<AgentPath[]>;           // List all agent paths
    create: (input: CreateAgentPathInput) => Promise<AgentPath>;  // Add custom agent path
    delete: (id: string) => Promise<void>;      // Remove agent path
    selectFolder: () => Promise<string | null>; // Open folder selection dialog, return selected path
  };

  // Unified Skills sub-API (per-client state management)
  unified: UnifiedSkillsAPI;
}

// Unified Skills API for per-client skill state management
interface UnifiedSkillsAPI {
  list: () => Promise<UnifiedSkill[]>;                              // List skills with client states
  get: (id: string) => Promise<UnifiedSkill | null>;                // Get single skill with states
  update: (id: string, updates: UpdateUnifiedSkillInput) => Promise<UnifiedSkill>;
  enableForClient: (skillId: string, clientId: string) => Promise<void>;   // Enable skill for client
  disableForClient: (skillId: string, clientId: string) => Promise<void>;  // Disable skill for client
  removeFromClient: (skillId: string, clientId: string) => Promise<void>;  // Remove skill from client
  setClientState: (input: SetClientSkillStateInput) => Promise<ClientSkillState>;
  adopt: (input: AdoptSkillInput) => Promise<UnifiedSkill>;         // Adopt discovered skill
  sync: (skillId?: string) => Promise<SkillSyncResult>;             // Sync skills to clients
  verify: () => Promise<SkillVerifyResult>;                         // Verify and repair symlinks
}

// enabled/content can also be updated via update
interface UpdateSkillInput {
  name?: string;
  projectId?: string | null;
  enabled?: boolean;
  content?: string;
}

interface CreateAgentPathInput {
  name: string;
  path: string;
}
```

### IPC Channels

The unified skills API exposes the following IPC channels:

| Channel | Description |
|---------|-------------|
| `skill:list-unified` | List all skills with per-client states |
| `skill:get-unified` | Get a single skill with per-client states |
| `skill:update-unified` | Update unified skill properties |
| `skill:enable-for-client` | Enable a skill for a specific client |
| `skill:disable-for-client` | Disable a skill for a specific client |
| `skill:remove-from-client` | Remove a skill from a specific client |
| `skill:adopt` | Adopt a discovered skill into router management |
| `skill:sync-to-all` | Sync a skill to all enabled clients |
| `skill:verify-and-repair` | Verify and repair all skill symlinks |

## Supported Agents

MCP Router supports agent paths aligned with the [Vercel skills.sh](https://github.com/vercel-labs/skills) ecosystem. The following agents are registered by default in the `agent_paths` table. Users can add or remove custom agent paths through the UI.

| Agent | CLI Flag | Skills Directory |
|-------|----------|-----------------|
| Claude Code | `claude-code` | `~/.claude/skills` |
| Cursor | `cursor` | `~/.cursor/skills` |
| Cline | `cline` | `~/.cline/skills` |
| Windsurf | `windsurf` | `~/.codeium/windsurf/skills` |
| VS Code / GitHub Copilot | `github-copilot` | `~/.copilot/skills` |
| OpenAI Codex | `codex` | `~/.codex/skills` |
| OpenCode | `opencode` | `~/.config/opencode/skills` |
| Gemini CLI | `gemini-cli` | `~/.gemini/skills` |
| Continue | `continue` | `~/.continue/skills` |
| Goose | `goose` | `~/.config/goose/skills` |
| Roo Code | `roo` | `~/.roo/skills` |
| Trae | `trae` | `~/.trae/skills` |

> **Note:** Paths are compatible with Vercel's `npx skills` CLI tool. See [vercel-labs/skills](https://github.com/vercel-labs/skills) for the complete list of 38+ supported agents.

### Custom Agent Paths

Users can add custom agent paths from the "Integrations" page. Added paths are saved in the `agent_paths` table, and symbolic links are created when skills are enabled.

## Key Design Decisions

### 1. Automatic Symlink Creation

When a skill is created, symbolic links are automatically created for all agents. This allows users to manage skills in one place and share the same skill across multiple agents.

### 2. Filesystem-based Symlink Management

Symlink state is managed with the filesystem as the source of truth. Instead of tracking symlinks in the DB, we maintain simplicity by syncing with the filesystem at startup.

### 3. Skill Enable/Disable Toggle

Each skill can be toggled On/Off. When disabled, symbolic links are removed from all agents; when enabled, they are recreated. The UI provides a simple switch for toggling.

### 4. Optional Project Association

Skills can optionally be associated with a project. Managed via `projectId: string | null`.

### 5. SKILL.md Template Generation

A SKILL.md template is automatically generated when a skill is created.

### 6. Symlink Verification & Repair

At app startup, symlink state is verified and broken links are automatically repaired (recreated).

### 7. Folder Import

External folders can be imported via a folder selection dialog. When imported, they are copied to the skills directory and symbolic links are automatically created.

## Storage Location

Skills are stored in:
- macOS: `~/Library/Application Support/MCP Router/skills/`
- Windows: `%APPDATA%/MCP Router/skills/`
- Linux: `~/.config/MCP Router/skills/`

## Database Schema

### skills table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| name | TEXT | Unique skill name (path derived from `{userData}/skills/{name}`) |
| project_id | TEXT | Optional project ID |
| enabled | INTEGER | 1=enabled, 0=disabled |
| created_at | INTEGER | Timestamp |
| updated_at | INTEGER | Timestamp |

### agent_paths table

Manages agent paths used as symlink destinations.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| name | TEXT | Unique agent name (e.g., "claude-code") |
| path | TEXT | Skills directory path (e.g., "~/.claude/skills") |
| created_at | INTEGER | Timestamp |
| updated_at | INTEGER | Timestamp |

Standard agents are automatically registered on first launch based on client-definitions.ts.

### client_skill_states table

Tracks per-client skill installation and enablement states.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| skill_id | TEXT | Foreign key to skills.id |
| client_id | TEXT | Client app identifier |
| state | TEXT | State: "enabled", "disabled", or "not-installed" |
| is_managed | INTEGER | 1=router manages symlink, 0=external |
| source_type | TEXT | Source: "local" or "discovered" |
| discovered_path | TEXT | Original path if discovered from client |
| symlink_status | TEXT | Status: "active", "broken", or "none" |
| last_sync_at | INTEGER | Last sync timestamp (nullable) |
| created_at | INTEGER | Timestamp |
| updated_at | INTEGER | Timestamp |

**Constraints:**
- `UNIQUE(skill_id, client_id)` - One state record per skill-client pair

**Indexes:**
- `idx_client_skill_states_skill_id` - For finding states by skill
- `idx_client_skill_states_client_id` - For finding states by client
- `idx_client_skill_states_state` - For filtering by state

## Performance Optimizations

The skills system includes several performance optimizations:

### 1. Lazy Content Loading

`list()` returns skills without SKILL.md content. Content is loaded on-demand via `getContent(id)` when a skill is selected in the UI. This significantly reduces I/O and memory usage when listing many skills.

### 2. Discovery Caching with TTL

Discovered skills from client apps are cached with a 30-second TTL. This avoids repeated filesystem scans when switching tabs or refreshing the UI.

### 3. Parallel Client Scanning

When discovering skills from clients, all clients are scanned in parallel using `Promise.all`. Within each client, directory entries are also processed in parallel.

### 4. MCP Config Deduplication

When building client app information, MCP config files are read once and both `mcpConfigured` and `hasOtherMcpServers` are extracted in a single operation, with caching.

### 5. Batch Symlink Operations

Agent paths are cached during symlink operations to avoid repeated database queries. Batch methods are available for creating/removing symlinks for multiple skills.

## Security Considerations

The skills system implements comprehensive security controls to prevent filesystem attacks:

### Path Traversal Protection

- Skill names are validated to only contain `[a-zA-Z0-9_-]` characters
- Path containment checks ensure all operations stay within the skills directory
- Recursive deletion validates paths before executing `rm -rf`

### Symlink Attack Prevention

- Agent paths must be within the user's home directory
- Agent paths must be in allowed directories (`.claude`, `.cursor`, `.config`, etc.)
- Forbidden system directories (`/etc`, `/usr`, `/bin`, etc.) are blocked
- Only symlinks (not regular files) can be removed by symlink removal operations
- Copy operations skip symlinks to prevent symlink following attacks

### Resource Exhaustion Protection

- Recursive copy operations have a maximum depth limit (50)
- Glob pattern resolution has depth (20) and result (100) limits
- Discovery scanning is restricted to home directory paths

### Security Utility Module

All path security functions are centralized in `apps/electron/src/main/utils/path-security.ts`:

- `isPathContained()` - Path containment validation
- `isPathAllowed()` - Forbidden path blocking
- `validateSkillSymlinkTarget()` - Symlink target validation
- `validateSkillName()` - Skill name sanitization
- `validateAgentPath()` - Agent path validation
- `validateCopyOperation()` - Copy operation boundary checking

## Error Handling

### Structured Error Classes

The skills system uses structured error classes with error codes and recoverability flags:

```typescript
// Base error class
abstract class SkillsError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
}

// Filesystem errors
class PermissionDeniedError extends SkillsError { code = 'PERMISSION_DENIED'; recoverable = false; }
class DiskFullError extends SkillsError { code = 'DISK_FULL'; recoverable = false; }
class PathNotFoundError extends SkillsError { code = 'PATH_NOT_FOUND'; recoverable = false; }

// Symlink errors
class BrokenSymlinkError extends SkillsError { code = 'BROKEN_SYMLINK'; recoverable = true; }
class TargetExistsError extends SkillsError { code = 'TARGET_EXISTS'; recoverable = false; }

// Validation errors
class SkillNotFoundError extends SkillsError { code = 'SKILL_NOT_FOUND'; recoverable = false; }
class SkillAlreadyExistsError extends SkillsError { code = 'SKILL_ALREADY_EXISTS'; recoverable = false; }
```

### Error Mapping

Node.js filesystem errors are mapped to structured errors inline within the skills service:

- `EACCES` → `PermissionDeniedError`
- `ENOENT` → `PathNotFoundError`
- `ENOSPC` → `DiskFullError`
- `EEXIST` → `TargetExistsError`

### UI Error Handling

Frontend error utilities in `skills-error-utils.ts` provide:

- `getSkillsErrorMessage()` - User-friendly i18n messages
- `showSkillsError()` - Toast notification with retry for recoverable errors
- `handleSkillsError()` - Combined logging and notification

## State Management

### Zustand Store

Skills state is managed directly in the renderer components using the Platform API. There is no dedicated Zustand store for skills; instead, components call the `unified` sub-API methods directly and manage local state as needed.

## Testing

### Unit Tests

Located in `apps/electron/src/main/modules/skills/__tests__/`:

- `skills.repository.test.ts` - Repository CRUD, findByName case-insensitivity
- `skills-file-manager.test.ts` - Symlink creation/verification, path security
- `unified-skills.service.test.ts` - Service methods, error handling

Path security tests in `apps/electron/src/main/utils/__tests__/path-security.test.ts`:

- Path containment checks
- Skill name validation
- Symlink target validation

### E2E Tests

Located in `apps/electron/e2e/specs/skills.spec.ts`:

- Skills list display
- New skill dialog
- Search filtering
- Skill detail sheet

## Future Considerations

1. **Remote Workspace Support**: Currently only local workspaces are supported
2. **Skill Export**: Skill export/backup functionality (import is already implemented)
3. **Skill Templates**: Pre-defined skill templates
4. **Cloud Sync**: Skill synchronization via cloud
5. **Dedicated Store**: Consider adding a Zustand store for skills state management
