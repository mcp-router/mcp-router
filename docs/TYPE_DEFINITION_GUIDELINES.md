# TypeScript Type Definition Guidelines

## Overview

This document outlines the guidelines for TypeScript type definitions in the MCP Router project. We enforce centralized type management to improve maintainability, reduce duplication, and ensure consistency across the codebase.

## Type Definition Locations

### ✅ Allowed Locations

Types must only be defined in the following directories:

1. **`packages/shared/src/types/`** - Primary location for all shared types
   - Domain types (MCP, User, Workspace, etc.)
   - API types (request/response)
   - Common UI prop patterns
   - Store state types

2. **`packages/remote-api-types/src/`** - Remote API schema definitions
   - Zod schemas
   - Generated types from schemas

3. **`apps/electron/src/main/infrastructure/database/`** - Database-specific types
   - Table schemas
   - Database entity types

4. **`apps/electron/src/renderer/stores/`** - Store state types
   - Frontend store state interfaces
   - Store-specific types

6. **Type definition files (`*.d.ts`)** - Global type declarations

### ❌ Prohibited Locations

Types should NOT be defined in:
- Component files (except for component Props interfaces)
- Service files
- Utility files
- Test files (except for test-specific types)

## Organization Structure

```
packages/shared/src/types/
├── index.ts                # Main export file
├── auth.ts                 # Authentication types
├── workspace.ts            # Workspace types
├── mcp-types.ts            # MCP server, tool, resource types
├── mcp-app-types.ts        # MCP app types
├── skill-types.ts          # Skills types
├── client-app-types.ts     # Client app types
├── workflow-types.ts        # Workflow and hook types
├── settings-types.ts       # Settings types
├── token-types.ts          # Token and access control types
├── log-types.ts            # Log types
├── project-types.ts        # Project types
├── tool-catalog-types.ts   # Tool catalog and search types
├── activity-types.ts       # Activity types
├── elicitation-types.ts    # Elicitation types
├── cloud-sync.ts           # Cloud sync types
├── shared-config.ts        # Shared config types
├── user-types.ts           # User types
├── pagination.ts           # Pagination types
├── utils.ts                # Utility types
├── cli.ts                  # CLI types
├── database/               # Database-specific types
├── platform-api/           # Platform API interfaces
└── ui/                     # UI component patterns
```

## Type Definition Rules

### 1. Component Props

Component props interfaces are allowed in `.tsx` files but must follow this pattern:

```typescript
// ✅ Allowed
interface MyComponentProps {
  title: string;
  onClose: () => void;
}

// ❌ Not allowed - use shared UI types for common patterns
interface MyComponentProps extends DialogProps {
  customField: string;
}
```

### 2. Import from Shared Package

Always import types from the shared package:

```typescript
// ✅ Good
import { MCPServer } from '@mcp_router/shared/types';

// ❌ Bad - local type definition
interface MCPServer {
  // ...
}
```

### 3. Extend Shared Types

When you need custom types, extend from shared types:

```typescript
// ✅ Good
import { MCPServer } from '@mcp_router/shared/types';

interface ExtendedMCPServer extends MCPServer {
  customField: string;
}
```

### 4. Database Types

Keep database types with the schema but map to domain types:

```typescript
// In database schema
export interface DBUser {
  id: number;
  email: string;
  created_at: Date;
}

// In mapper
import { User } from '@mcp_router/shared/types';

export function mapDBUserToUser(dbUser: DBUser): User {
  // mapping logic
}
```

## ESLint Enforcement

The project uses a custom ESLint rule (`custom/no-scattered-types`) to enforce these guidelines. The rule will:

- ❌ Error on type definitions outside allowed locations
- ✅ Allow component Props interfaces in `.tsx` files
- ✅ Allow types in test files
- ✅ Allow types in `.d.ts` files

## Migration Guide

When migrating existing types:

1. Identify the type category (domain, API, UI, etc.)
2. Move the type to the appropriate location in `packages/shared/src/types/`
3. Update all imports to use the shared package
4. Remove the original type definition
5. Run `pnpm lint` to verify compliance

Note: The ESLint rule will automatically catch any types defined outside of allowed locations, ensuring compliance.

## Examples

### Before (Scattered)
```typescript
// apps/electron/src/services/mcp-service.ts
interface MCPServerConfig {
  id: string;
  name: string;
}

// apps/web/src/components/ServerList.tsx
interface MCPServerConfig {
  id: string;
  name: string;
  status?: string;
}
```

### After (Centralized)
```typescript
// packages/shared/src/types/domains/mcp.ts
export interface MCPServerConfig {
  id: string;
  name: string;
  status?: string;
}

// apps/electron/src/services/mcp-service.ts
import { MCPServerConfig } from '@mcp_router/shared/types';

// apps/web/src/components/ServerList.tsx
import { MCPServerConfig } from '@mcp_router/shared/types';
```

## Benefits

1. **Single Source of Truth**: No more duplicate type definitions
2. **Better IntelliSense**: IDEs can better understand and suggest types
3. **Easier Refactoring**: Change types in one place
4. **Type Safety**: Consistent types across frontend and backend
5. **Reduced Bundle Size**: No duplicate type definitions in build output
