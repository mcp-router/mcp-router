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
│   ├── platform-api/      # Platform abstraction layer for multi-platform support
│   ├── shared/            # Shared types, locales, and utilities
│   ├── ui/                # Shared UI components (Radix UI + Tailwind)
│   ├── tailwind-config/   # Shared Tailwind CSS configuration
│   └── api/               # API package (placeholder for future use)
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

The codebase uses a **Platform API abstraction** pattern to enable code sharing between Electron and Web platforms:

```typescript
// Platform API Interface (simplified)
interface PlatformAPI {
  // Server management
  server: {
    list(): Promise<Server[]>
    add(config: ServerConfig): Promise<Server>
    update(id: string, updates: Partial<Server>): Promise<void>
    remove(id: string): Promise<void>
  }
  // Agent management
  agent: {
    list(): Promise<Agent[]>
    create(agent: AgentCreateInput): Promise<Agent>
    update(id: string, updates: Partial<Agent>): Promise<void>
  }
  // Authentication
  auth: {
    getCurrentUser(): Promise<User | null>
    signIn(email: string, password: string): Promise<User>
    signOut(): Promise<void>
  }
  // Settings
  settings: {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
  }
}
```

### Electron Application Structure

Located in `apps/electron/`:

#### Main Process (`src/main/`)
- **Entry Point** (`main.ts`): Electron main process, IPC handlers, system integration
- **MCP Server Manager** (`mcp-server-manager.ts`): Core service managing MCP server lifecycle
- **Database Layer** (`src/lib/database/`): SQLite-based persistence with repository pattern
- **Services**: Agent, Log, Settings, Token management services

#### Renderer Process (`src/`)
- **React Application** (`app.tsx`): Main React app with HashRouter
- **State Management** (`src/stores/`): Zustand stores for client state
- **Components** (`src/components/`): React components organized by feature
- **Platform API Client** (`src/lib/platform-api/`): Electron implementation of Platform API

### Shared Packages

#### `@mcp-router/platform-api`
- Abstract interfaces for platform-specific implementations
- Enables 80%+ code reuse between Electron and Web

#### `@mcp-router/shared`
- Common types and interfaces
- Internationalization (i18n) resources
- Shared utilities

#### `@mcp-router/ui`
- Reusable React components built with Radix UI
- Tailwind CSS styling
- Component primitives for consistent UI

## IPC Communication (Electron)

The Electron app uses extensive IPC handlers organized by domain:

### Server Management
- `mcp:list-servers` - Get all configured servers
- `mcp:add-server` - Add new MCP server
- `mcp:update-server` - Update server configuration
- `mcp:remove-server` - Remove server
- `mcp:start-server` - Start MCP server instance
- `mcp:stop-server` - Stop running server

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

## Migration Status

The project is actively migrating to support both Electron and Web platforms:

### Completed
- ✅ Turborepo monorepo structure
- ✅ Package consolidation into Electron app
- ✅ Platform API abstraction layer
- ✅ Shared UI component library
- ✅ Shared configurations (Tailwind, TypeScript)

### In Progress
- 🚧 Web application setup (Next.js)
- 🚧 Web Platform API implementation
- 🚧 Database abstraction for multi-platform support

### Planned
- 📋 PostgreSQL support for web version
- 📋 API routes for web server management
- 📋 Real-time features (WebSocket/SSE)
- 📋 Authentication system for web

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