# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Router is a **Turborepo monorepo** that manages Model Context Protocol (MCP) servers. The project is currently transitioning from a pure Electron desktop application to a multi-platform solution supporting both desktop (Electron) and web (Next.js) deployments.

## Repository Structure

```
mcp-router/
├── apps/
│   └── electron/          # Electron desktop application
├── packages/
│   ├── shared/            # Shared types, locales, and utilities
│   ├── ui/                # Shared UI components (Radix UI + Tailwind)
│   └── tailwind-config/   # Shared Tailwind CSS configuration
├── docs/                  # Documentation assets
└── public/                # Public assets (icons, images)
```

## Development Commands

### Monorepo Management
- **Install dependencies**: `pnpm install` - Install all dependencies across the monorepo
- **Build all packages**: `pnpm build` - Build all packages in dependency order
- **Development mode**: `pnpm dev` - Start all packages in development mode
- **Clean all**: `pnpm clean` - Clean all build outputs

### Electron App Commands (from root or apps/electron)
- **Start development**: `pnpm dev` - Starts Electron app with hot reload
- **Start production**: `pnpm start` - Starts built Electron app
- **Lint code**: `pnpm lint` - Runs ESLint on TypeScript/TSX files
- **Type check**: `pnpm typecheck` - Runs TypeScript type checking
- **Package app**: `pnpm package` - Creates production package
- **Build for distribution**: `pnpm make` - Creates distributable packages

### Package Commands
- **Build package**: `pnpm build` - Build specific package
- **Watch mode**: `pnpm dev` - Run package in watch mode

## Technology Stack

### Core Technologies
- **Monorepo Tool**: Turborepo with pnpm workspaces
- **Desktop Framework**: Electron 36.x
- **Frontend Framework**: React 19
- **State Management**: Zustand
- **UI Components**: Radix UI primitives + Tailwind CSS
- **Database (Electron)**: SQLite via better-sqlite3
- **MCP Integration**: @modelcontextprotocol/sdk
- **Build Tools**: Webpack + Electron Forge

### Development Requirements
- **Node.js**: v20.0.0 or higher
- **pnpm**: v8.0.0 or higher (required package manager)
- **TypeScript**: 5.8.3
- **ESLint**: 9.x with flat config

## Architecture Overview

### Platform API Architecture

The codebase uses a **Platform API abstraction** pattern to enable code sharing between Electron and Web platforms. The Platform API is implemented within the Electron app at `apps/electron/src/lib/platform-api/`:

```typescript
// Platform API Interface (located in apps/electron/src/lib/platform-api/types/platform-api.ts)
interface PlatformAPI {
  auth: AuthAPI;         // Authentication management
  servers: ServerAPI;    // MCP server management
  agents: AgentAPI;      // Agent management (includes chat)
  apps: AppAPI;          // Application management (includes tokens)
  packages: PackageAPI;  // Package management (includes system utils)
  settings: SettingsAPI; // Settings management
  logs: LogAPI;          // Log management
  workspaces: WorkspaceAPI; // Workspace management
}
```

The Electron implementation (`apps/electron/src/frontend/lib/electron-platform-api.ts`) bridges between the React frontend and Electron's main process via IPC.

### Electron Application Structure

Located in `apps/electron/`:

#### Main Process (`src/main/`)
- **Entry Point** (`main.ts`): Electron main process, IPC handlers, system integration
- **MCP Server Manager** (`mcp-server-manager.ts`): Core service managing MCP server lifecycle
- **Platform API Manager** (`platform-api-manager.ts`): Manages workspace switching and API routing
- **Database Layer** (`src/lib/database/`): SQLite-based persistence with repository pattern
- **Services**: Agent, Log, Settings, Token, Workspace management services
- **Remote API Client** (`services/remote-api-client.ts`): HTTP client for remote workspace operations

#### Renderer Process (`src/`)
- **React Application** (`app.tsx`): Main React app with HashRouter
- **State Management** (`src/stores/`): Zustand stores for client state
- **Components** (`src/components/`): React components organized by feature
- **Platform API Client** (`src/lib/platform-api/`): Electron implementation of Platform API

### Shared Packages

#### `@mcp-router/shared`
- Common types and interfaces
- Internationalization (i18n) resources
- Shared utilities

#### `@mcp-router/ui`
- Reusable React components built with Radix UI
- Tailwind CSS styling
- Component primitives for consistent UI

#### `@mcp-router/tailwind-config`
- Shared Tailwind CSS configuration
- Common theme and design tokens

## IPC Communication (Electron)

The Electron app uses extensive IPC handlers organized by domain:

### Server Management
- `mcp:list` - Get all configured servers
- `mcp:add` - Add new MCP server
- `mcp:update-config` - Update server configuration
- `mcp:remove` - Remove server
- `mcp:start` - Start MCP server instance
- `mcp:stop` - Stop running server

### Agent Operations
- `agent:list` - List all agents
- `agent:create` - Create new agent
- `agent:update` - Update agent configuration
- `agent:delete` - Delete agent
- `agent:execute-tool` - Execute agent tool

### Authentication
- `auth:get-current-user` - Get current user
- `auth:sign-in` - Sign in user
- `auth:sign-out` - Sign out user

### Settings & Configuration
- `settings:get` - Get setting value
- `settings:set` - Set setting value
- `token:list` - List API tokens
- `token:add` - Add new token

## Database Schema (Electron)

SQLite database with the following main tables:
- `servers` - MCP server configurations
- `agents` - Agent definitions
- `logs` - Request/response logs
- `settings` - Application settings
- `tokens` - API tokens for server access

Migration system located in `src/lib/database/database-migration.ts`

## Workspace Management

MCP Router supports multiple workspaces for organizing MCP servers:

### Workspace Types
- **Local Workspace**: Uses SQLite database stored locally
- **Remote Workspace**: Connects to remote API for server management

### Workspace Features
- Each workspace has its own isolated database
- Workspace switching updates all services and UI
- Remote workspaces support team collaboration
- Credentials are securely stored and encrypted

### Remote Workspace API
When a workspace is configured as remote, server operations are routed through a Remote API client:
- All CRUD operations go through HTTP REST endpoints
- Authentication via Bearer tokens
- Automatic retry with exponential backoff
- 30-second timeout for all requests

## Development Principles

### SOLID Principles
- **Single Responsibility**: Each module has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes must be substitutable for base types
- **Interface Segregation**: Many specific interfaces over general-purpose ones
- **Dependency Inversion**: Depend on abstractions, not concretions

### Core Principles
- **DRY**: Eliminate duplication, centralize knowledge
- **KISS**: Keep design and code simple
- **YAGNI**: Don't implement based on speculation
- **Separation of Concerns**: Clear separation between UI, logic, and data
- **Composition over Inheritance**: Prefer object composition

### Code Quality
- **Clean Code**: Prioritize readability
- **Boy Scout Rule**: Leave code better than you found it
- **Test-Driven Development**: Write tests first when possible
- **Continuous Integration**: Integrate small changes frequently

## Important Development Notes

1. **Platform-Specific Code**: When implementing features, always consider both Electron and Web platforms. Use the Platform API abstraction.

2. **State Management**: Use Zustand stores consistently. Avoid direct IPC calls in components - use store actions instead.

3. **UI Components**: Prefer using components from `@mcp-router/ui` package. Create new shared components when needed.

4. **Type Safety**: Always use TypeScript types from `@mcp-router/shared`. Never use `any` type.

5. **Error Handling**: Implement proper error boundaries and user-friendly error messages.

6. **Performance**: Consider performance implications, especially for operations that might handle many MCP servers.

7. **Security**: Never expose sensitive information. Use proper IPC validation in Electron.

## Testing Strategy

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test IPC communication and service interactions
- **E2E Tests**: Test complete user workflows (Electron app)
- **Type Coverage**: Maintain 100% TypeScript coverage

## Contributing Guidelines

1. **Commits**: Use conventional commit format (feat:, fix:, chore:, etc.)
2. **Branches**: Create feature branches from `main` or development branches
3. **Pull Requests**: Include clear descriptions and link to related issues
4. **Code Review**: All changes require review before merging
5. **Documentation**: Update relevant docs when changing functionality