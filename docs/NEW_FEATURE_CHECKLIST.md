# 新機能追加チェックリスト

本ドキュメントは、MCP Routerに新機能（特にService/Repositoryを伴う機能）を追加する際に、見落としやすいポイントをまとめたものです。

## チェックリスト

### 1. Singletonパターンの登録（必須）

Service/Repositoryを追加した場合、ワークスペース切り替え時にインスタンスをリセットする必要があります。

**ファイル:** `apps/electron/src/main/modules/workspace/platform-api-manager.ts`

**`configureForWorkspace`メソッド内に追加:**

```typescript
// リポジトリをリセット（新しいデータベースを使用するように）
McpLoggerRepository.resetInstance();
// ... 他のリポジトリ
YourNewRepository.resetInstance();  // ← 追加

// サービスのシングルトンインスタンスもリセット
ServerService.resetInstance();
// ... 他のサービス
YourNewService.resetInstance();  // ← 追加
```

**確認ポイント:**
- [ ] Repositoryの`resetInstance()`を追加したか
- [ ] Serviceの`resetInstance()`を追加したか
- [ ] 必要なimport文を追加したか

---

### 2. 型定義の完全性（必須）

#### 2.1 エンティティ型定義

**ファイル:** `packages/shared/src/types/xxx-types.ts`（新規作成）

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

#### 2.2 API インターフェース

**ファイル:** `packages/shared/src/types/platform-api/domains/xxx-api.ts`（新規作成）

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

#### 2.3 PlatformAPIへの追加

**ファイル:** `packages/shared/src/types/platform-api/platform-api.ts`

```typescript
import { YourAPI } from "./domains/xxx-api";

export interface PlatformAPI {
  // ... 既存のAPI
  yourFeature: YourAPI;  // ← 追加
}
```

#### 2.4 エクスポートの追加

**ファイル:** `packages/shared/src/types/platform-api/index.ts`
```typescript
export * from "./domains/xxx-api";
```

**ファイル:** `packages/shared/src/types/index.ts`
```typescript
export { YourAPI } from "./platform-api";
export * from "./xxx-types";
```

#### 2.5 global.d.ts への型定義追加（重要）

**ファイル:** `apps/electron/src/global.d.ts`

```typescript
import type { YourEntity, CreateYourEntityInput, UpdateYourEntityInput } from "@mcp_router/shared";

declare global {
  interface Window {
    electronAPI: {
      // ... 既存の定義

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

**確認ポイント:**
- [ ] エンティティ型を定義したか
- [ ] APIインターフェースを定義したか
- [ ] PlatformAPIに追加したか
- [ ] すべてのエクスポートを追加したか
- [ ] **global.d.tsに型定義を追加したか**（見落としやすい）

---

### 3. IPC/Preload/PlatformAPI の3層実装（必須）

#### 3.1 IPCハンドラ

**ファイル:** `apps/electron/src/main/modules/xxx/xxx.ipc.ts`（新規作成）

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
  // ... 他のハンドラ
}
```

#### 3.2 IPC登録

**ファイル:** `apps/electron/src/main/infrastructure/ipc.ts`

```typescript
import { setupYourHandlers } from "../modules/xxx/xxx.ipc";

export function setupIpcHandlers(deps: { ... }): void {
  // ... 既存のハンドラ
  setupYourHandlers();  // ← 追加
}
```

#### 3.3 Preload

**ファイル:** `apps/electron/src/preload.ts`

```typescript
import type { CreateYourEntityInput, UpdateYourEntityInput } from "@mcp_router/shared";

contextBridge.exposeInMainWorld("electronAPI", {
  // ... 既存のAPI

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

**ファイル:** `apps/electron/src/renderer/platform-api/electron-platform-api.ts`

```typescript
import type { YourAPI } from "@mcp_router/shared";

class ElectronPlatformAPI implements PlatformAPI {
  yourFeature: YourAPI;

  constructor() {
    // ... 既存の初期化

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

**ファイル:** `apps/electron/src/renderer/platform-api/remote-platform-api.ts`

```typescript
export class RemotePlatformAPI implements PlatformAPI {
  // ... 既存のgetter

  get yourFeature() {
    return this.localPlatformAPI.yourFeature;
  }
}
```

**確認ポイント:**
- [ ] IPCハンドラを作成したか
- [ ] `ipc.ts`に登録したか
- [ ] `preload.ts`に追加したか
- [ ] `electron-platform-api.ts`に実装したか
- [ ] `remote-platform-api.ts`にgetterを追加したか

---

### 4. 初期化処理（該当する場合）

起動時に実行する必要がある処理がある場合、`main.ts`または関連する初期化関数で呼び出します。

**ファイル:** `apps/electron/src/main.ts`

```typescript
async function initMCPServices(): Promise<void> {
  // ... 既存の初期化

  // Your feature initialization
  getYourService().initialize();  // ← 追加（必要な場合）
}
```

**確認ポイント:**
- [ ] 起動時初期化が必要な処理を特定したか
- [ ] 適切な初期化関数内で呼び出したか
- [ ] ADRドキュメントに記載した初期化処理が実装されているか

---

### 5. 翻訳ファイル（UI機能の場合）

すべての言語ファイルに翻訳キーを追加します。

**ファイル:**
- `apps/electron/src/locales/en.json`
- `apps/electron/src/locales/ja.json`
- `apps/electron/src/locales/zh.json`

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

**確認ポイント:**
- [ ] en.json に追加したか
- [ ] ja.json に追加したか
- [ ] zh.json に追加したか
- [ ] 未使用になった翻訳キーを削除したか

---

### 6. UI統合（UI機能の場合）

#### 6.1 ルート追加

**ファイル:** `apps/electron/src/renderer/components/App.tsx`

```tsx
import YourFeatureManager from "./your-feature/YourFeatureManager";

<Route path="/your-feature" element={<YourFeatureManager />} />
```

#### 6.2 サイドバーメニュー追加

**ファイル:** `apps/electron/src/renderer/components/Sidebar.tsx`

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

**確認ポイント:**
- [ ] App.tsxにルートを追加したか
- [ ] Sidebar.tsxにメニューを追加したか
- [ ] リモートワークスペースで非表示にする必要があるか確認したか

---

### 7. ドキュメント（推奨）

#### 7.1 ADRドキュメント

**ファイル:** `docs/adr/your-feature/YOUR_FEATURE_DESIGN.md`

設計決定、アーキテクチャ、主要な実装詳細を記載します。

**確認ポイント:**
- [ ] 設計ドキュメントを作成したか
- [ ] 実装が設計ドキュメントと一致しているか

---

## クイックリファレンス

### 新機能追加時に変更が必要なファイル一覧

| カテゴリ | ファイル | 追加内容 |
|---------|---------|----------|
| 型定義 | `packages/shared/src/types/xxx-types.ts` | エンティティ型 |
| 型定義 | `packages/shared/src/types/platform-api/domains/xxx-api.ts` | APIインターフェース |
| 型定義 | `packages/shared/src/types/platform-api/platform-api.ts` | PlatformAPIへの追加 |
| 型定義 | `packages/shared/src/types/platform-api/index.ts` | エクスポート |
| 型定義 | `packages/shared/src/types/index.ts` | エクスポート |
| 型定義 | `apps/electron/src/global.d.ts` | Window.electronAPI型 |
| Backend | `apps/electron/src/main/modules/xxx/xxx.service.ts` | サービス |
| Backend | `apps/electron/src/main/modules/xxx/xxx.repository.ts` | リポジトリ |
| Backend | `apps/electron/src/main/modules/xxx/xxx.ipc.ts` | IPCハンドラ |
| Backend | `apps/electron/src/main/infrastructure/ipc.ts` | IPC登録 |
| Backend | `apps/electron/src/main/modules/workspace/platform-api-manager.ts` | resetInstance登録 |
| Bridge | `apps/electron/src/preload.ts` | IPC公開 |
| Frontend | `apps/electron/src/renderer/platform-api/electron-platform-api.ts` | API実装 |
| Frontend | `apps/electron/src/renderer/platform-api/remote-platform-api.ts` | getter追加 |
| Frontend | `apps/electron/src/renderer/components/xxx/XxxManager.tsx` | UIコンポーネント |
| Frontend | `apps/electron/src/renderer/components/App.tsx` | ルート追加 |
| Frontend | `apps/electron/src/renderer/components/Sidebar.tsx` | メニュー追加 |
| i18n | `apps/electron/src/locales/en.json` | 英語翻訳 |
| i18n | `apps/electron/src/locales/ja.json` | 日本語翻訳 |
| i18n | `apps/electron/src/locales/zh.json` | 中国語翻訳 |
| Docs | `docs/adr/xxx/XXX_DESIGN.md` | 設計ドキュメント |

---

## 関連ドキュメント

- [Platform API アーキテクチャ](./adr/PLATFORM_API.md)
- [データベース設計パターン](./adr/database/DATABASE_DESIGN_PATTERNS.md)
- [型定義ガイドライン](./TYPE_DEFINITION_GUIDELINES.md)
