# MCP Servers: Project Grouping — Design

## Goals
- Replace the delete icon on the MCP server list with a settings icon that opens a modal.
- In the modal, provide both:
  - Delete action for the server
  - Project assignment UI to group servers by “Project”
- Introduce a “Project” concept scoped to a Workspace for filtering and organization.
- Restructure the MCP Servers page to be Project-first: servers are displayed grouped under each Project section (including an “Unassigned” group).

## Scope & Assumptions (Phase 1)
- Each server belongs to at most one Project (single assignment). This keeps DB, API, and UI simple for an initial release.
- Projects are stored per Workspace (local DB). Remote workspaces may not support projects initially; the UI should degrade gracefully (project UI hidden/disabled for remote workspaces until remote API is ready).
- Backward compatible migration: existing servers start with `projectId = NULL` and appear under “All” or “Unassigned”.

Phase 2 (future): allow many-to-many (server can be in multiple projects) via a join table, advanced filtering, color customization.

## Data Model

### Entities
- Project
  - id: string (uuid)
  - name: string (required)
  - color?: string (optional, hex)
  - createdAt: number (unix ms)
  - updatedAt: number (unix ms)

- MCPServer (existing)
  - Add: `projectId?: string | null` (single assignment in Phase 1)

### Relationship (Server assignment)
- Implemented via a direct column on `servers` (`project_id`).
- Constraints: a server belongs to at most one project (1→N relationship Project→Servers).

### SQLite Schema (Workspace DB)
- Table: `projects`
  - `id TEXT PRIMARY KEY`
  - `name TEXT NOT NULL`
  - `color TEXT` (nullable)
  - `created_at INTEGER NOT NULL`
  - `updated_at INTEGER NOT NULL`
  - Indexes: `idx_projects_name` (optional), `idx_projects_order` (optional)

- Column on `servers`
  - `project_id TEXT` (nullable)
  - Index: `idx_servers_project_id`
  - (Optional FK) `project_id` → `projects.id` (on delete: set NULL)

### Migration
- Add `projects` table if not exists.
- Add `project_id` column to `servers` if not exists.
- Add indexes listed above if not exists.
- No data backfill; existing servers are Unassigned (not present in mapping table).

## Shared Types (packages/shared)

### New type file (proposed): `packages/shared/src/types/project-types.ts`
```ts
export interface Project {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}
```

### Extend MCP types
- `MCPServerConfig` and `MCPServer` now include `projectId?: string | null`.

## Remote API Types (packages/remote-api-types)

### Zod schema updates
- Extend MCP server schemas to include `projectId?: string | null`.

### New router (local-first; remote can come later)
- `projects`:
  - `list: () => Promise<Project[]>`
  - `create: (input: { name: string; color?: string }) => Promise<Project>`
  - `update: (id: string, updates: Partial<Pick<Project, "name" | "color">>) => Promise<Project>`
  - `delete: (id: string) => Promise<void>`
  
Note: Server assignment uses the existing Servers API (`servers.update` with `projectId`).

## Electron Main (Platform API, IPC, Repository)

### Repository
- New: `ProjectRepository` (extends `BaseRepository<Project>`)
  - `initializeTable()` creates `projects` table & indexes.
  - CRUD + simple `list(orderBy: 'name')`.
// No mapping repository in this design; assignment lives on `servers.project_id`.

### Server repository change
- Add `project_id` column handling for mapRowToEntity/mapEntityToRow.

### Service
- New: `ProjectService` provides CRUD for projects only; server assignment is handled by the existing ServerService (`updateServer`).

- Preload (`apps/electron/src/preload.ts`) add channels:
  - `project:list`, `project:create`, `project:update`, `project:delete`
  
Note: Assign/unassign servers via existing `updateMcpServerConfig` (servers.update) with `{ projectId }`.
- Main handlers delegate to `ProjectService`.

## Renderer (UI/UX)

### Store (Zustand)
- New: `project-store.ts`
  - state: `projects: Project[]`, loading/error
  - actions: `list()`, `create()`, `update()`, `delete()`
  - selectors: `useProjectById(id)`
  - UI state: `collapsedByProjectId: Record<string, boolean>` （ローカル保存）
  
グルーピングは `servers` + `projects` を用いてUI側（Home）で導出。サーバの割当は `server-store.updateServerConfig(id, { projectId })` を使用。

### Server List Changes (Project-first layout)
- Replace current delete icon with settings icon (e.g., `Settings` from `lucide-react`) in `ServerCardCompact.tsx`.
- Clicking settings opens a `ServerSettingsModal` (new component).
- Home servers view becomes hierarchical:
  - Section per Project (ordered by `name`), including a top "Unassigned" section (projectId = NULL).
  - Each section header shows Project name and server count; supports collapse/expand.
  - Search filters across projects; empty sections auto-collapse when filtered (optional).
  - Grid/List toggle remains, applied within each Project section.
  - Optional: quick inline action on section header to create server under that Project (future).

### ServerSettingsModal (new)
- Contents:
  - Header: server name, status badge
  - Section: Project assignment
    - Select: current project (Unassigned option)
    - Inline “+ New Project” action (name input → create → auto-assign)
  - Section: Quick actions
    - Button: “Open Advanced Settings” (opens existing Advanced Sheet)
  - Danger zone:
    - Button: Delete server (uses existing confirmation dialog or inline confirm)

### Filtering by Project
- Sidebar: add a “Projects” group below MCP Apps
  - “All” (default) + list of projects (by `name`)
  - Selecting a project filters the server page to only that section (others collapse/hidden).
  - Selecting “All” restores grouped view with all sections.

### i18n
- New keys (examples):
  - `projects.title`, `projects.new`, `projects.create`, `projects.unassigned`, `projects.collapseAll`, `projects.expandAll`
  - `serverSettings.title`, `serverSettings.project`, `serverSettings.openAdvanced`, `serverSettings.delete`

## UX Notes
- Modal: Use `@mcp_router/ui` Dialog components for consistent styling.
- Keep interactions idempotent and predictable; reflect assignment immediately in store and refresh server list.
- Remote workspace: hide/disable Project UI with tooltip explaining unavailability (until remote API supports it).

## Security & Privacy
- Projects are purely organizational metadata kept in the local workspace DB.
- No sensitive information in Project fields.

## Rollout Plan
- Phase 1 (this change):
  - DB migrations (projects table + servers.project_id)
  - Repos/Service/IPC for local（projects: list/create/update/delete のみ）
  - サーバ割当は既存 servers.update（`projectId`）で処理
  - Renderer storeとモーダル + アイコン差し替え
  - サイドバーのプロジェクトフィルタ + 折りたたみ状態のローカル保存
  - 後方互換（Unassignedは最上段固定）

- Phase 2:
  - Many-to-many via `server_projects` join table
  - Batch assignment, drag-and-drop grouping, colors/icons
  - Remote workspace Projects API

## Open Questions
- Should we allow multiple projects per server in the UI from day one?
  - Proposed: no (keep single select for simplicity), revisit in Phase 2
- Should deleting a Project reassign servers to Unassigned or block deletion?
  - Proposed: allow deletion and set affected `servers.project_id = NULL`
