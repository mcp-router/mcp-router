# MCP Servers: Projects Feature — Design (Current Implementation)

## Goals
- Replace the delete icon in the server list with a settings icon that opens a modal.
- Provide in the modal:
  - Server deletion
  - Project assignment UI (organize servers by “Project”)
- Introduce a workspace‑scoped “Project” concept for filtering and organization.
- Restructure the server list to be project‑first, grouping servers under each Project (including an “Unassigned” group).

## Scope and Assumptions
- Each server belongs to at most one project (single assignment) to keep DB/API/UI simple.
- Projects are stored in the workspace‑local DB. Remote workspaces may not support projects initially; the UI should degrade gracefully (hide/disable project UI).
- Existing servers are migrated with `projectId = NULL` and appear under “Unassigned”.

(There is no concrete plan for future expansion at this time.)

## Data Model

### Entities
- Project
  - id: string (uuid)
  - name: string (required; unique, case‑insensitive)
  - createdAt: number (unix ms)
  - updatedAt: number (unix ms)
  - optimization: ProjectOptimization ("bm25" | "cloud" | null)
    - Context Optimization (Tool Catalog) の設定
    - null: 無効、"bm25": BM25検索有効、"cloud": クラウド検索有効
    - 新規プロジェクト作成時のデフォルト: "bm25"

- MCPServer (existing)
  - Add: `projectId?: string | null` (single assignment)

### Relationship (server assignment)
- Represented by the `project_id` column on the `servers` table.
- Constraint: A server belongs to at most one project (Project→Servers is 1→N).

### SQLite Schema (workspace DB)
- `projects` table (created by `ProjectRepository`)
  - `id TEXT PRIMARY KEY`
  - `name TEXT NOT NULL`
  - `created_at INTEGER NOT NULL`
  - `updated_at INTEGER NOT NULL`
  - `optimization TEXT` (nullable; "bm25" | "cloud" | NULL)
  - Unique index: `idx_projects_name_unique` (`name COLLATE NOCASE`)

- `servers` columns
  - `project_id TEXT` (nullable)
  - Index: `idx_servers_project_id`

### Migrations
- The main DB migration guarantees existence of `servers.project_id` and its index (ID: `20251101_projects_bootstrap`).
- Creation of the `projects` table is delegated to `ProjectRepository.initializeTable()`.
- No backfill: `NULL` means “Unassigned”.

## Shared Types (packages/shared)

- `packages/shared/src/types/project-types.ts`
  - `export interface Project { ... }`
  - `export const UNASSIGNED_PROJECT_ID = "__unassigned__" as const`
  - `export const PROJECT_HEADER = "x-mcpr-project" as const`
- `MCPServerConfig` / `MCPServer` includes `projectId?: string | null` (shared types).

## Remote API Types (packages/remote-api-types)

- Zod schema update
  - Add `projectId?: string | null` to server schemas.

## Electron Main (Platform API, IPC, Repository)

### Repository
- `ProjectRepository` (extends `BaseRepository<Project>`)
  - Creates the `projects` table and the unique index in `initializeTable()`.
  - Provides CRUD and `getAll({ orderBy: "name" })`.
- Add `project_id` mappings (row⇄entity) to `McpServerManagerRepository`.

### Service
- `ProjectService` provides project CRUD. Actual server assignment is done through the existing server update API (`updateServer`).
- Name constraints: non‑empty, no whitespace, unique (case‑insensitive).
- Deletion behavior (spec): deleting a project deletes all servers belonging to it. The UI warns via a confirmation dialog.

### IPC Channels
- `project:list`, `project:create`, `project:update`, `project:delete`

## Renderer (UI/UX)

### Store (Zustand)
- `apps/electron/src/renderer/stores/project-store.ts`
  - State: `projects`, `isLoading`, `error`, `collapsedByProjectId`, `selectedProjectId`
  - Actions: `list`, `create`, `update`, `delete`, `setCollapsed`, `setSelectedProjectId`
  - Persist collapse state and selected project in `localStorage`.
  - Grouping is derived in the UI from `servers` + `projects`. Assignment changes go through `servers.update(config)`.

### Project‑first list
- Section per project (ascending by `name`), with a dedicated “Unassigned” section placed first.
- Section headers are collapsible. While a project is selected in the sidebar, only that section is shown and header collapse is disabled.
- Apply project sections to both List and Grid views.

### Settings modal
- In `ServerSettingsModal`:
  - Select project (including Unassigned)
  - Open `ProjectSettingsModal` via “Manage Projects”
  - Delete server
- In `ProjectSettingsModal`:
  - Create / rename / delete projects
  - Warn that deleting a project will also delete its servers

### Sidebar filter
- Show “All”, “Unassigned”, and each project in the “Projects” group.
- When a project is selected, show only that project’s section (others hidden/collapsed).

### i18n
- Main keys (implemented):
  - `projects.sectionTitle`, `projects.all`, `projects.unassigned`, `projects.new`, `projects.create`, `projects.creating`, `projects.projectSettings`, `projects.projectSettingsDescription`
  - `serverSettings.title`, `serverSettings.project`, `serverSettings.manageProjects`, `serverSettings.delete`

## MCP Runtime Integration (Aggregator/HTTP)

### Tool names
- Tool names are kept original for listing and calls (no namespacing or renaming by server name).
- Tool list items include `sourceServer` to indicate origin server.
- Maintain a project‑scoped mapping of toolName → serverName internally (a `Map<string, Map<string,string>>`) to resolve the target server at call time.
- Respect server `toolPermissions`; disabled tools are filtered/refused for list and call.

### Project filtering
- List / read / call for tools, resources, resource templates, and prompts are scoped to servers matching the specified `projectId`.
- `UNASSIGNED_PROJECT_ID` (`"__unassigned__"`) or an omitted/empty value is treated as `null` internally and matches “Unassigned” servers.

### HTTP usage
- Routes: `/mcp` (JSON‑RPC) and `/mcp/sse` (SSE)
- Project header: `x-mcpr-project` (`PROJECT_HEADER`)
  - Value: project ID or `"__unassigned__"`
  - Omitted/empty: treated as “Unassigned” (note: this is not “All”)
  - Local workspaces validate the header against `ProjectRepository`; remote workspaces skip validation.
- Authentication: validate Authorization (`Bearer <token>`) and enforce per‑server access.
- The HTTP layer attaches `_meta.token` and `_meta.projectId` to requests for the aggregator handlers.

## Security & Privacy
- Projects are organizational metadata stored in the local DB; no sensitive data in project fields.
- HTTP usage requires an auth token; only permitted servers tied to the token are in scope.

## Rollout (Implemented)
- Guarantee `servers.project_id` and its index via migration
- Create the `projects` table via `ProjectRepository` (with unique index)
- `ProjectService` / IPC (list, create, update, delete)
- Project grouping in lists (List/Grid), persisted collapse state, sidebar project filter
- Settings modal and project management modal

## Notes
- On project deletion, servers belonging to the project are deleted (not reassigned to Unassigned). This is the finalized specification.
- When the HTTP project header is omitted, the scope is “Unassigned” by specification.

