# ADR: Electron App Directory Structure and Layer Separation

## Status
Accepted

## Context
The Electron application's directory structure had become complex, with mixed responsibilities and unclear dependencies that were degrading maintainability. Specifically, the following issues existed:

- Frontend and backend code were mixed together
- Business logic was scattered across the codebase
- Potential for circular dependencies
- Difficulty in testing

## Decision
We implement clear layer separation based on Clean Architecture principles.

### New Directory Structure

```
apps/electron/src/
├── main/                    # Main process
│   ├── modules/            # Module layer (business logic)
│   │   ├── auth/           # Authentication
│   │   ├── client-apps/    # Unified client app management (MCP + Skills)
│   │   ├── cloud-sync/     # Cloud synchronization
│   │   ├── marketplace/    # Marketplace
│   │   ├── mcp-logger/     # MCP log management
│   │   ├── mcp-server-manager/ # MCP server management
│   │   │   └── dxt-processor/ # DXT data processing
│   │   ├── mcp-server-runtime/ # MCP server runtime
│   │   │   └── http/       # HTTP server
│   │   ├── projects/       # Projects management
│   │   ├── settings/       # Settings management
│   │   ├── skills/         # Skills management
│   │   ├── system/         # System management
│   │   ├── tool-catalog/   # Tool catalog management
│   │   ├── workflow/       # Workflow and hook management
│   │   └── workspace/      # Workspace management
│   ├── infrastructure/     # Infrastructure layer
│   │   ├── database/       # Database access
│   │   └── ipc.ts          # IPC communication
│   ├── ui/                 # UI-related
│   │   ├── menu.ts         # Menu
│   │   └── tray.ts         # Tray
│   └── utils/              # Main process utilities
├── renderer/               # Renderer process
│   ├── components/         # UI components
│   │   ├── auth/           # Authentication UI
│   │   ├── common/         # Common components
│   │   ├── layout/         # Layout
│   │   ├── marketplace/    # Marketplace UI
│   │   │   ├── mcp-servers/ # MCP Server marketplace components
│   │   │   ├── shared/     # Shared marketplace components
│   │   │   └── skills/     # Skills marketplace components
│   │   ├── mcp/            # MCP-related UI
│   │   ├── setting/        # Settings UI
│   │   ├── skills/         # Local skills management UI
│   │   ├── workflow/       # Workflow and hook management UI
│   │   └── workspace/      # Workspace UI
│   ├── platform-api/       # Platform API
│   ├── services/           # Renderer services
│   ├── stores/             # State management (Zustand)
│   └── utils/              # Renderer utilities
```

### Layer Responsibilities

#### 1. Module Layer (`main/modules/`)
- **Responsibility**: Business logic, business rules, and application features
- **Dependencies**: Depends on the infrastructure layer
- **Contents**:
  - Feature modules (auth, workspace, etc.)
  - Service classes
  - Repository interfaces
  - Business rule implementations

#### 2. Infrastructure Layer (`main/infrastructure/`)
- **Responsibility**: Database and IPC communication foundation
- **Dependencies**: Only external libraries
- **Contents**:
  - Database foundation
    - SQLiteManager
    - BaseRepository
    - Migration management
  - IPC communication foundation

#### 3. UI Layer (`main/ui/`)
- **Responsibility**: Main process-side UI control
- **Dependencies**: Electron framework
- **Contents**:
  - Menu management
  - Tray icon management

#### 4. Renderer Layer (`renderer/`)
- **Responsibility**: User interface
- **Dependencies**: Communicates with main process via IPC
- **Contents**:
  - React components
    - Hook management UI
    - MCP Apps UI
    - Server management UI
  - State management (Zustand)
    - server-store
    - auth-store
    - theme-store
    - workspace-store
    - ui-store
    - server-editing-store
    - view-preferences-store
    - project-store
    - hook-store
    - workflow-store
  - Platform API abstraction
  - UI logic

### Import Rules

1. **Infrastructure layer** does not depend on other application code
2. **Module layer** may depend on the infrastructure layer
3. **UI layer** depends on the Electron framework
4. **Renderer layer** does not directly import main process code (uses IPC)

### Path Aliases

TypeScript path aliases are used to make imports clear:

```typescript
// Module layer
import { ServerService } from "@/main/modules/mcp-server-manager/server-service";
import { getWorkspaceService } from "@/main/modules/workspace/workspace.service";

// Infrastructure layer
import { BaseRepository } from "@/main/infrastructure/database/base-repository";

// Renderer layer
import { ServerList } from "@/renderer/components/mcp/ServerList";

// Shared
import { ServerConfig } from "@/shared/types";
```

## Consequences

### Advantages
1. **Clear separation of responsibilities**: Each layer's role is well-defined
2. **Organized dependencies**: Dependency direction is unified and unidirectional
3. **Improved testability**: Each layer can be tested independently
4. **Improved maintainability**: Impact of changes is limited
5. **Extensibility**: Minimizes impact when adding new features

### Disadvantages
1. **Initial complexity**: Increased number of files and directories
2. **Learning curve**: New developers need to understand the architecture
3. **Boilerplate**: Code needed for inter-layer communication

## Alternatives Considered

### 1. Feature-based Directory Structure
```
src/
├── features/
│   ├── server/
│   ├── workspace/
│   └── auth/
```
- **Reason for rejection**: Responsibilities between layers become unclear

### 2. Maintaining a Flat Structure
- **Reason for rejection**: Current problems would not be resolved

## Update History
- **February 2026**: Added client-apps module and marketplace UI components
  - Added `client-apps/` module for unified client app management (combines MCP config + Skills paths)
  - Removed `mcp-apps-manager/` module (fully replaced by client-apps)
  - Added `marketplace/` directory with `mcp-servers/`, `shared/`, and `skills/` subdirectories
  - Added `shared/` subdirectory for shared marketplace components (MarketplaceSearch, etc.)
  - Added `skills/` directory for local skills management UI
- **September 2025**: Reflected migration to module layer
  - Changed domain layer to modules layer
  - Deprecated application layer and integrated its functionality into modules layer
  - Reflected new module structure (client-apps, mcp-server-manager, etc.)
  - Added workflow (including hook management), system, and mcp-logger modules
- **August 2025**: Updated to match actual directory structure
  - Added MCP Hook System-related directories
  - Added details of MCP application features
  - Reflected schema management unification
  - Documented newly added services and components

## References
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Electron Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [DATABASE_ARCHITECTURE.md](./database/DATABASE_ARCHITECTURE.md) - Database Architecture
- [DATABASE_SCHEMA_MANAGEMENT.md](./database/DATABASE_SCHEMA_MANAGEMENT.md) - Schema Management Strategy
