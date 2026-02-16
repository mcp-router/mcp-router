# New Feature Addition Checklist

This document summarizes points that are easy to overlook when adding new features (especially those involving Service/Repository) to MCP Router.

## Checklist

### 1. Singleton Pattern Registration (Required)

When adding a Service/Repository, you need to reset the instance when switching workspaces.

**File:** `apps/electron/src/main/modules/workspace/platform-api-manager.ts`

**Add to the `configureForWorkspace` method:**

```typescript
// Reset repositories (to use the new database)
McpLoggerRepository.resetInstance();
// ... other repositories
YourNewRepository.resetInstance();  // <- Add

// Also reset service singleton instances
ServerService.resetInstance();
// ... other services
YourNewService.resetInstance();  // <- Add
```

**Verification Points:**
- [ ] Added `resetInstance()` for Repository
- [ ] Added `resetInstance()` for Service
- [ ] Added necessary import statements

---

### 2. Type Definition Completeness (Required)

#### 2.1 Entity Type Definitions

**File:** `packages/shared/src/types/xxx-types.ts` (create new)

```typescript
export interface YourEntity {
  id: string;
  name: string;
  // ...
}

export interface CreateYourEntityInput {
  name: string;
}

export interface UpdateYourEntityInput {
  name?: string;
}
```

#### 2.2 API Interface

**File:** `packages/shared/src/types/platform-api/domains/xxx-api.ts` (create new)

```typescript
import type { YourEntity, CreateYourEntityInput, UpdateYourEntityInput } from "../../xxx-types";

export interface YourAPI {
  list: () => Promise<YourEntity[]>;
  get: (id: string) => Promise<YourEntity | null>;
  create: (input: CreateYourEntityInput) => Promise<YourEntity>;
  update: (id: string, updates: UpdateYourEntityInput) => Promise<YourEntity>;
  delete: (id: string) => Promise<void>;
}
```

#### 2.3 Adding to PlatformAPI

**File:** `packages/shared/src/types/platform-api/platform-api.ts`

```typescript
import { YourAPI } from "./domains/xxx-api";

export interface PlatformAPI {
  // ... existing APIs
  yourFeature: YourAPI;  // <- Add
}
```

#### 2.4 Adding Exports

**File:** `packages/shared/src/types/platform-api/index.ts`
```typescript
export * from "./domains/xxx-api";
```

**File:** `packages/shared/src/types/index.ts`
```typescript
export { YourAPI } from "./platform-api";
export * from "./xxx-types";
```

#### 2.5 Adding Type Definitions to global.d.ts (Important)

**File:** `apps/electron/src/global.d.ts`

```typescript
import type { YourEntity, CreateYourEntityInput, UpdateYourEntityInput } from "@mcp_router/shared";

declare global {
  interface Window {
    electronAPI: {
      // ... existing definitions

      // Your Feature Management
      listYourEntities: () => Promise<YourEntity[]>;
      getYourEntity: (id: string) => Promise<YourEntity | null>;
      createYourEntity: (input: CreateYourEntityInput) => Promise<YourEntity>;
      updateYourEntity: (id: string, updates: UpdateYourEntityInput) => Promise<YourEntity>;
      deleteYourEntity: (id: string) => Promise<void>;
    };
  }
}
```

**Verification Points:**
- [ ] Defined entity types
- [ ] Defined API interface
- [ ] Added to PlatformAPI
- [ ] Added all exports
- [ ] **Added type definitions to global.d.ts** (easy to overlook)

---

### 3. IPC/Preload/PlatformAPI 3-Layer Implementation (Required)

#### 3.1 IPC Handler

**File:** `apps/electron/src/main/modules/xxx/xxx.ipc.ts` (create new)

```typescript
import { ipcMain } from "electron";
import { getYourService } from "./xxx.service";

export function setupYourHandlers(): void {
  const service = getYourService();

  ipcMain.handle("xxx:list", async () => {
    return service.list();
  });

  ipcMain.handle("xxx:get", async (_evt, id: string) => {
    if (!id) throw new Error("Missing id");
    return service.get(id);
  });
  // ... other handlers
}
```

#### 3.2 IPC Registration

**File:** `apps/electron/src/main/infrastructure/ipc.ts`

```typescript
import { setupYourHandlers } from "../modules/xxx/xxx.ipc";

export function setupIpcHandlers(deps: { ... }): void {
  // ... existing handlers
  setupYourHandlers();  // <- Add
}
```

#### 3.3 Preload

**File:** `apps/electron/src/preload.ts`

```typescript
import type { CreateYourEntityInput, UpdateYourEntityInput } from "@mcp_router/shared";

contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing APIs

  // Your Feature Management
  listYourEntities: () => ipcRenderer.invoke("xxx:list"),
  getYourEntity: (id: string) => ipcRenderer.invoke("xxx:get", id),
  createYourEntity: (input: CreateYourEntityInput) => ipcRenderer.invoke("xxx:create", input),
  updateYourEntity: (id: string, updates: UpdateYourEntityInput) =>
    ipcRenderer.invoke("xxx:update", id, updates),
  deleteYourEntity: (id: string) => ipcRenderer.invoke("xxx:delete", id),
});
```

#### 3.4 Electron Platform API

**File:** `apps/electron/src/renderer/platform-api/electron-platform-api.ts`

```typescript
import type { YourAPI } from "@mcp_router/shared";

class ElectronPlatformAPI implements PlatformAPI {
  yourFeature: YourAPI;

  constructor() {
    // ... existing initialization

    // Initialize your feature domain
    this.yourFeature = {
      list: () => window.electronAPI.listYourEntities(),
      get: (id) => window.electronAPI.getYourEntity(id),
      create: (input) => window.electronAPI.createYourEntity(input),
      update: (id, updates) => window.electronAPI.updateYourEntity(id, updates),
      delete: (id) => window.electronAPI.deleteYourEntity(id),
    };
  }
}
```

#### 3.5 Remote Platform API

**File:** `apps/electron/src/renderer/platform-api/remote-platform-api.ts`

```typescript
export class RemotePlatformAPI implements PlatformAPI {
  // ... existing getters

  get yourFeature() {
    return this.localPlatformAPI.yourFeature;
  }
}
```

**Verification Points:**
- [ ] Created IPC handler
- [ ] Registered in `ipc.ts`
- [ ] Added to `preload.ts`
- [ ] Implemented in `electron-platform-api.ts`
- [ ] Added getter to `remote-platform-api.ts`

---

### 4. Initialization Processing (If Applicable)

If there is processing that needs to run at startup, call it in `main.ts` or the relevant initialization function.

**File:** `apps/electron/src/main.ts`

```typescript
async function initMCPServices(): Promise<void> {
  // ... existing initialization

  // Your feature initialization
  getYourService().initialize();  // <- Add (if needed)
}
```

**Verification Points:**
- [ ] Identified processes that require startup initialization
- [ ] Called within the appropriate initialization function
- [ ] Initialization processes described in ADR documentation are implemented

---

### 5. Translation Files (For UI Features)

Add translation keys to all language files.

**File:**
- `apps/electron/src/locales/en.json`

```json
{
  "yourFeature": {
    "title": "Your Feature",
    "empty": "No items yet",
    "loadError": "Failed to load items",
    "createSuccess": "Item created successfully",
    "createError": "Failed to create item",
    "deleteSuccess": "Item deleted successfully",
    "deleteError": "Failed to delete item"
  }
}
```

**Verification Points:**
- [ ] Added to en.json
- [ ] Removed unused translation keys

---

### 6. UI Integration (For UI Features)

#### 6.1 Route Addition

**File:** `apps/electron/src/renderer/components/App.tsx`

```tsx
import YourFeatureManager from "./your-feature/YourFeatureManager";

<Route path="/your-feature" element={<YourFeatureManager />} />
```

#### 6.2 Sidebar Menu Addition

**File:** `apps/electron/src/renderer/components/Sidebar.tsx`

```tsx
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    tooltip={t("yourFeature.title")}
    isActive={location.pathname === "/your-feature"}
  >
    <Link to="/your-feature" className="flex items-center gap-3 py-5 px-3 w-full">
      <IconYourFeature className="h-6 w-6" />
      <span className="text-base">{t("yourFeature.title")}</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

**Verification Points:**
- [ ] Added route to App.tsx
- [ ] Added menu to Sidebar.tsx
- [ ] Confirmed whether it needs to be hidden for remote workspaces

---

### 7. Documentation (Recommended)

#### 7.1 ADR Documentation

**File:** `docs/adr/your-feature/YOUR_FEATURE_DESIGN.md`

Document design decisions, architecture, and key implementation details.

**Verification Points:**
- [ ] Created design documentation
- [ ] Implementation matches design documentation

---

## Quick Reference

### List of Files to Modify When Adding New Features

| Category | File | Content to Add |
|---------|---------|----------|
| Types | `packages/shared/src/types/xxx-types.ts` | Entity types |
| Types | `packages/shared/src/types/platform-api/domains/xxx-api.ts` | API interface |
| Types | `packages/shared/src/types/platform-api/platform-api.ts` | Addition to PlatformAPI |
| Types | `packages/shared/src/types/platform-api/index.ts` | Export |
| Types | `packages/shared/src/types/index.ts` | Export |
| Types | `apps/electron/src/global.d.ts` | Window.electronAPI types |
| Backend | `apps/electron/src/main/modules/xxx/xxx.service.ts` | Service |
| Backend | `apps/electron/src/main/modules/xxx/xxx.repository.ts` | Repository |
| Backend | `apps/electron/src/main/modules/xxx/xxx.ipc.ts` | IPC handler |
| Backend | `apps/electron/src/main/infrastructure/ipc.ts` | IPC registration |
| Backend | `apps/electron/src/main/modules/workspace/platform-api-manager.ts` | resetInstance registration |
| Bridge | `apps/electron/src/preload.ts` | IPC exposure |
| Frontend | `apps/electron/src/renderer/platform-api/electron-platform-api.ts` | API implementation |
| Frontend | `apps/electron/src/renderer/platform-api/remote-platform-api.ts` | Getter addition |
| Frontend | `apps/electron/src/renderer/components/xxx/XxxManager.tsx` | UI component |
| Frontend | `apps/electron/src/renderer/components/App.tsx` | Route addition |
| Frontend | `apps/electron/src/renderer/components/Sidebar.tsx` | Menu addition |
| i18n | `apps/electron/src/locales/en.json` | English translation |
| Docs | `docs/adr/xxx/XXX_DESIGN.md` | Design documentation |

---

## Related Documentation

- [Platform API Architecture](./adr/PLATFORM_API.md)
- [Database Design Patterns](./adr/database/DATABASE_DESIGN_PATTERNS.md)
- [Type Definition Guidelines](./TYPE_DEFINITION_GUIDELINES.md)
