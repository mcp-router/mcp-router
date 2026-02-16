# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development (runs electron app with shared packages)
pnpm dev

# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Lint and fix
pnpm lint:fix

# Find unused code
pnpm knip

# Run E2E tests (requires packaging first)
pnpm test:e2e

# Package electron app for current architecture
pnpm --filter @mcp_router/electron package
```

## Architecture Overview

### Monorepo Structure (Turborepo + pnpm)

```
apps/
├── electron/          # Main desktop application (Electron + React)
└── cli/               # CLI tool (@mcp_router/cli) for connecting to MCP Router

packages/
├── shared/            # Shared types, utilities, and PlatformAPI interfaces
├── remote-api-types/  # Zod schemas for remote API
├── ui/                # Shared UI components (shadcn/ui based)
└── tailwind-config/   # Shared Tailwind configuration
```

### Electron App Layer Architecture

The Electron app follows Clean Architecture with these layers:

**Main Process** (`apps/electron/src/main/`):
- `modules/` - Feature modules (self-contained business logic)
  - Each module has: `*.service.ts`, `*.repository.ts`, `*.ipc.ts`, `*.types.ts`
  - Key modules: `mcp-server-manager`, `mcp-server-runtime`, `workspace`, `projects`, `skills`, `workflow`
- `infrastructure/` - Database (SQLite via better-sqlite3), IPC foundation
- `utils/` - Shared utilities (logger, environment)
- `ui/` - Menu and tray management

**Renderer Process** (`apps/electron/src/renderer/`):
- `components/` - React components organized by feature
- `stores/` - Zustand state management
- `platform-api/` - Abstraction layer for main process communication

**IPC Communication Flow**:
```
Renderer → platform-api → preload.ts → IPC handlers → Service → Repository → SQLite
```

### Database Architecture

- **Main database** (`mcprouter.db`): Workspace info and global settings
- **Workspace databases** (`workspace-{id}.db`): Per-workspace data
- Repositories use singleton pattern with `getInstance()` and `resetInstance()` for workspace switching
- Tables defined inline in each repository class

### Type System

Types are centralized in `packages/shared/src/types/`:
- Domain types, API interfaces, UI props, store state
- Import types from `@mcp_router/shared/types`
- Component Props interfaces are allowed in `.tsx` files

### Adding New Features

See `docs/NEW_FEATURE_CHECKLIST.md` for the complete checklist. Key files to modify:
1. Types in `packages/shared/src/types/`
2. Service/Repository in `apps/electron/src/main/modules/`
3. IPC handler and registration in `infrastructure/ipc.ts`
4. Preload exposure in `preload.ts`
5. Platform API implementation
6. Register singleton reset in `platform-api-manager.ts`
7. Translations in `locales/en.json`

### Key Patterns

- **Singleton repositories**: Always implement `getInstance()` and `resetInstance()`
- **IPC naming**: Use `feature:action` format (e.g., `workspace:list`)
- **Module structure**: Keep business logic in services, data access in repositories
- **State management**: Zustand stores in renderer, SQLite persistence in main

## Quality Checks (optional, run as needed)

- `pnpm typecheck` — verify type safety
- `pnpm knip` — find unused code
- `pnpm lint:fix` — auto-fix lint issues (many pre-existing warnings, results can be ignored)
- Check `/docs` and `/docs/adr` if changes may have made documentation outdated
