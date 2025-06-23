# Platform API Migration Guide

This guide explains how to migrate components from using the local `platform-api` to the centralized platform API in the `@mcp-router/platform-api` package.

## Overview

The platform API has been moved to a dedicated package at `packages/platform-api` to prepare for moving components from `apps/electron/src/frontend/components` to `packages/frontend/src/components`. This provides a clean separation of concerns and makes the platform API truly independent.

## Architecture

### New Structure

1. **Platform API Interface** (`packages/platform-api/src/platform-api-interface.ts`)
   - Defines the `PlatformAPI` interface that all platform implementations must follow

2. **Platform API Context** (`packages/platform-api/src/platform-api-context.tsx`)
   - Provides React context for platform API access
   - Offers `usePlatformAPI` hook for components

3. **Platform API Shim** (`packages/platform-api/src/platform-api-shim.ts`)
   - Provides backward compatibility for existing imports
   - Allows gradual migration of components

4. **Electron Implementation** (`apps/electron/src/frontend/lib/electron-platform-api.ts`)
   - Electron-specific implementation of the PlatformAPI interface
   - Remains in the electron app directory

### Initialization

The platform API is initialized in `apps/electron/src/App.tsx`:

```typescript
import { initializePlatformAPIShim, PlatformAPIProvider } from "@mcp-router/platform-api";
import { electronPlatformAPI } from "@/frontend/lib/electron-platform-api";

// Initialize the shim for backward compatibility
initializePlatformAPIShim(electronPlatformAPI);

// Wrap the app with the provider
<PlatformAPIProvider platformAPI={electronPlatformAPI}>
  <App />
</PlatformAPIProvider>
```

## Migration Steps

### For New Components

1. Use the platform API from context:
   ```typescript
   import { usePlatformAPI } from "@mcp-router/platform-api";
   
   function MyComponent() {
     const platformAPI = usePlatformAPI();
     // Use platformAPI methods
   }
   ```

### For Existing Components (Gradual Migration)

Components can continue to work without changes due to the shim layer:

```typescript
// This still works (backward compatibility)
import { platformAPI } from "@/frontend/lib/platform-api";

// But prefer migrating to:
import { platformAPI } from "@mcp-router/platform-api";
// or
import { usePlatformAPI } from "@mcp-router/platform-api";
```

### For Stores

Stores are already using factory functions that accept platform API:

```typescript
// In apps/electron/src/frontend/stores/index.ts
import { getPlatformAPI } from "@mcp-router/platform-api";

export const useServerStore = createServerStore(getPlatformAPI());
```

## Benefits

1. **Portability**: Components can be moved to packages without modification
2. **Testability**: Easy to provide mock platform APIs for testing
3. **Multi-platform**: Supports different platform implementations (Electron, Web, etc.)
4. **Type Safety**: Strong TypeScript typing throughout

## Future Steps

1. Gradually migrate all components to use `import { platformAPI } from "@mcp-router/platform-api"`
2. Eventually remove the local `apps/electron/src/frontend/lib/platform-api.ts` re-export
3. Move components to `packages/frontend/src/components` as needed

## Component Migration Checklist

When moving a component to packages:

- [ ] Update imports from `@/frontend/lib/platform-api` to `@mcp-router/platform-api`
- [ ] Ensure the component uses platform API through props, context, or imports from packages
- [ ] Update any relative imports to use package imports
- [ ] Test the component still works correctly in the Electron app