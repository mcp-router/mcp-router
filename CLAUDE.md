# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development**: `npm run dev` - Starts Electron app with logging enabled
- **Start production**: `npm start` - Starts Electron app without extra logging
- **Lint code**: `npm run lint` - Runs ESLint on TypeScript/TSX files
- **Package app**: `npm run package` - Creates production package
- **Build for distribution**: `npm run make` - Creates distributable packages

## Architecture Overview

MCP Router is an Electron application that manages Model Context Protocol (MCP) servers with a clear separation between main and renderer processes.

## Main Process (Electron Backend)

### Core Services
- **Main Process** (`src/main.ts`): Electron main process handling app lifecycle, IPC, and system integration
- **MCP Server Manager** (`src/main/mcp-server-manager.ts`): Core service managing MCP server instances and aggregation
- **Database Layer** (`src/lib/database/`): SQLite-based persistence using better-sqlite3

### Key Services Architecture
- **MCPServerManager**: Central orchestrator for MCP server lifecycle, connection management, and request aggregation
- **Agent Services**: Development and deployed agent management with sharing capabilities
- **Log Service**: Request/response logging and analytics for MCP operations
- **Settings Service**: Application configuration persistence
- **Token Service**: API token management for MCP server access

### IPC Communication API
Extensive IPC handlers in `src/main.ts` organized by domain:
- `mcp:*` - MCP server operations (start, stop, add, remove, config updates)
- `agent:*` - Agent CRUD operations and tool execution
- `auth:*` - Authentication flow management
- `settings:*` - Application settings persistence

### Database Schema
SQLite database with repositories for:
- Servers, agents, logs, settings, tokens
- Migration system in `src/lib/database/database-migration.ts`

### Main Process Development Notes
- IPC communication follows async/await pattern with `ipcMain.handle()`
- MCP servers can be local (subprocess) or remote (HTTP/SSE)
- Agent system supports both development and deployed states
- Extensive logging system for debugging MCP operations
- Supports multiple package managers (npm, pnpm, yarn, bun) with auto-detection

## Frontend (Renderer Process)

### UI Architecture
- **Renderer Process** (`src/app.tsx`): React-based UI rendered in Electron's BrowserWindow
- Uses HashRouter for React routing in Electron context

### State Management
Uses Zustand for client-side state management with stores in `src/lib/stores/`:
- `server-store.ts`: MCP server states and operations
- `auth-store.ts`: Authentication and user session state
- `agent-store.ts`: Agent configuration and chat sessions
- `ui-store.ts`: UI state, themes, dialogs, and toasts

### Component Organization
- `src/components/mcp/` - MCP server management UI
- `src/components/agent/` - Agent configuration and chat interfaces
- `src/components/ui/` - Reusable UI components (based on shadcn/ui)
- `src/components/layout/` - Layout components and page structures

## Technology Stack

- **Framework**: Electron 35.x with React 19
- **State Management**: Zustand
- **UI Components**: Radix UI + Tailwind CSS (custom design system)
- **Database**: better-sqlite3 with custom repository pattern
- **Build**: Webpack + Electron Forge
- **MCP Integration**: @modelcontextprotocol/sdk for server communication

## Development Principles

This codebase follows these key software development principles:

### SOLID Principles
- **Single Responsibility Principle**: Each class/module should have one reason to change
- **Open/Closed Principle**: Open for extension, closed for modification
- **Liskov Substitution Principle**: Subtypes must be substitutable for their base types
- **Interface Segregation Principle**: Many client-specific interfaces are better than one general-purpose interface
- **Dependency Inversion Principle**: Depend upon abstractions, not concretions

### Core Principles
- **DRY (Don't Repeat Yourself)**: Eliminate duplication, centralize knowledge in one place to reduce maintenance costs
- **KISS (Keep It Simple, Stupid)**: Keep design and code as simple as possible. Complexity breeds bugs and technical debt
- **YAGNI (You Aren't Gonna Need It)**: Don't implement features based on speculation. Focus on current requirements
- **Separation of Concerns**: Clearly separate UI, business logic, and data access into distinct layers/modules
- **Law of Demeter**: Objects should only communicate with their immediate neighbors, avoiding deep method chains
- **Principle of Least Astonishment**: APIs and behaviors should be predictable and intuitive to users
- **Composition over Inheritance**: Prefer object composition over class inheritance for flexibility

### Development Practices
- **Continuous Integration/Continuous Delivery**: Integrate small changes frequently for early bug detection and rapid releases
- **Test-Driven Development (TDD)**: Write failing tests first, make them pass, then refactor in short iterations
- **Clean Code**: Prioritize readability through clear naming, minimal comments, short functions, and minimal dependencies
- **Boy Scout Rule**: Always leave code better than you found it. Make small improvements with each commit