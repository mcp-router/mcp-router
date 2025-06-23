# Store Migration: Electron to Shared Frontend Package

## Overview
This document outlines the completed migration of Zustand stores from the Electron app to the shared @mcp-router/frontend package to enable code reuse between Electron and Web versions.

## Migration Status - ✅ COMPLETED

### ✅ Phase 1: Platform-Independent Stores (Completed)
Successfully moved the following stores to `packages/frontend/src/stores/`:
- **theme-store.ts** - Theme management (light/dark/system)
- **ui-store.ts** - UI state (toasts, dialogs, loading states)
- **server-editing-store.ts** - Server configuration editing state

### ✅ Phase 2: Move Required Types (Completed)
Successfully moved the following types to `@mcp-router/shared`:
- `McpApp` and `McpAppsManagerResult` interfaces
- `PackageUpdateInfo` and `ServerPackageUpdates` interfaces
- Created new file: `packages/shared/src/types/mcp-app-types.ts`

### ✅ Phase 3: Create Platform API Interface (Completed)
Created platform-agnostic interface:
- **File**: `packages/frontend/src/lib/platform-api-interface.ts`
- **Interface**: `PlatformAPI` - Complete abstraction of all platform-specific operations
- Exported from `@mcp-router/frontend` for easy consumption

### ✅ Phase 4: Refactor Platform-Dependent Stores (Completed)
Successfully refactored all platform-dependent stores to use dependency injection:
- **server-store.ts** - MCP server state management
- **auth-store.ts** - Authentication state
- **agent-store.ts** - Agent configuration and chat sessions

Each store now exports:
- A factory function (e.g., `createServerStore(platformAPI)`)
- A selector creator function (e.g., `createServerSelectors(store)`)

## Architecture Decision

### Dependency Injection Pattern
For platform-dependent stores, we'll use a factory pattern:

```typescript
// Example: packages/frontend/src/stores/server-store.ts
export const createServerStore = (platformAPI: PlatformAPIInterface) => 
  create<ServerState>((set, get) => ({
    // Store implementation
  }));
```

### Usage in Electron App
```typescript
// apps/electron/src/frontend/stores/index.ts
import { createServerStore } from '@mcp-router/frontend';
import { platformAPI } from '../lib/platform-api';

export const useServerStore = createServerStore(platformAPI);
```

### Usage in Web App
```typescript
// apps/web/src/stores/index.ts
import { createServerStore } from '@mcp-router/frontend';
import { webPlatformAPI } from '../lib/web-platform-api';

export const useServerStore = createServerStore(webPlatformAPI);
```

## Additional Improvements

### Platform API Reorganization
After the initial migration, the platform API was also reorganized:

1. **Moved to packages/frontend**:
   - `WebPlatformAPI` class (placeholder implementation)
   - Platform detection utilities (`isElectron()`, `isWeb()`)
   - Factory function `createPlatformAPI()`
   - File: `packages/frontend/src/lib/platform-api-factory.ts`

2. **Kept in Electron app**:
   - `ElectronPlatformAPI` implementation (Electron-specific)
   - File: `apps/electron/src/frontend/lib/electron-platform-api.ts`

This organization provides:
- Better separation of platform-specific and platform-agnostic code
- Reusable utilities for platform detection
- A clear pattern for adding new platform implementations

## Benefits
1. **Code Reuse**: Shared business logic between Electron and Web
2. **Type Safety**: Consistent interfaces across platforms
3. **Maintainability**: Single source of truth for state management
4. **Platform Flexibility**: Easy to add new platforms (mobile, etc.)
5. **Clean Architecture**: Clear separation between platform-specific and shared code

## Usage Example

### In Electron App:
```typescript
import { createServerStore } from '@mcp-router/frontend';
import { electronPlatformAPI } from './lib/electron-platform-api';

export const useServerStore = createServerStore(electronPlatformAPI);
```

### In Web App (future):
```typescript
import { createServerStore, WebPlatformAPI } from '@mcp-router/frontend';

const webAPI = new WebPlatformAPI(); // Or custom implementation
export const useServerStore = createServerStore(webAPI);
```