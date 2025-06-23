# Platform API Migration Guide

This guide explains the platform API architecture after moving it to the centralized `@mcp-router/platform-api` package.

## Overview

The platform API has been moved to a dedicated package at `packages/platform-api` to prepare for moving components from `apps/electron/src/frontend/components` to `packages/frontend/src/components`. This provides a clean separation of concerns and makes the platform API truly independent.

## Architecture

### New Structure

1. **Platform API Interface** (`packages/platform-api/src/platform-api-interface.ts`)
   - Defines the `PlatformAPI` interface that all platform implementations must follow

2. **Platform API Context** (`packages/platform-api/src/platform-api-context.tsx`)
   - Provides React context for platform API access
   - Offers `usePlatformAPI` hook for components

3. **Platform API Factory** (`packages/platform-api/src/platform-api-factory.ts`)
   - Factory functions for creating platform-specific API instances
   - Platform detection utilities (isElectron, isWeb)

4. **Electron Implementation** (`apps/electron/src/frontend/lib/electron-platform-api.ts`)
   - Electron-specific implementation of the PlatformAPI interface
   - Remains in the electron app directory

### Initialization

The platform API is initialized in `apps/electron/src/App.tsx`:

```typescript
import { PlatformAPIProvider } from "@mcp-router/platform-api";
import { electronPlatformAPI } from "@/frontend/lib/electron-platform-api";

// Wrap the app with the provider
<PlatformAPIProvider platformAPI={electronPlatformAPI}>
  <App />
</PlatformAPIProvider>
```

## Usage

### For Components

Components should use the platform API through the React context hook:

```typescript
import { usePlatformAPI } from "@mcp-router/platform-api";

function MyComponent() {
  const platformAPI = usePlatformAPI();
  
  // Use platformAPI methods
  const handleLogin = async () => {
    await platformAPI.login();
  };
}
```

### For Stores

Stores use factory functions that accept platform API as a parameter:

```typescript
// In apps/electron/src/frontend/stores/index.ts
import { electronPlatformAPI } from "../lib/electron-platform-api";

export const useServerStore = createServerStore(electronPlatformAPI);
export const useAuthStore = createAuthStore(electronPlatformAPI);
export const useAgentStore = createAgentStore(electronPlatformAPI);
```

## Benefits

1. **Portability**: Components can be moved to packages without modification
2. **Testability**: Easy to provide mock platform APIs for testing
3. **Multi-platform**: Supports different platform implementations (Electron, Web, etc.)
4. **Type Safety**: Strong TypeScript typing throughout

## Component Migration Checklist

When moving a component from `apps/electron/src/frontend/components` to `packages/frontend/src/components`:

- [ ] Ensure the component uses `usePlatformAPI` hook from `@mcp-router/platform-api`
- [ ] Update any relative imports to use package imports
- [ ] Update store imports to use `@mcp-router/frontend`
- [ ] Test the component still works correctly in the Electron app

## Architecture Benefits

- **Clean separation**: Platform API is completely independent from UI components
- **Type safety**: Strong TypeScript types throughout
- **Testability**: Easy to mock platform API for testing
- **Multi-platform ready**: Support for different platform implementations (Electron, Web, etc.)