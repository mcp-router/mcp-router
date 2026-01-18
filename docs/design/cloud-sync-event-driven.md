# Cloud Sync イベント駆動同期設計（未実装）

## 概要

現在のCloud Syncはポーリング方式（10分間隔）で実装されているが、将来的にリアルタイム性が求められる場合、イベント駆動方式に切り替えることができる。

## 現在の実装（ポーリング方式）

```
[ユーザー操作] → [ローカル変更] → ... → [10分後にポーリング] → [同期実行]
```

- シンプルで実装が容易
- サーバー負荷が予測可能
- リアルタイム性は低い

## イベント駆動方式の設計

### アーキテクチャ

```
[ユーザー操作] → [ローカル変更] → [イベント発火] → [デバウンス(2秒)] → [同期実行]
```

### 必要なコンポーネント

#### 1. イベント型定義

```typescript
// workspace.service.ts
export type WorkspaceChangeEvent = {
  type: "create" | "update" | "delete";
  workspaceId: string;
};

// server-service.ts
export type ServerChangeEvent = {
  type: "add" | "update" | "delete";
  serverId: string;
};
```

#### 2. イベント発火（Service層）

```typescript
// workspace.service.ts
export class WorkspaceService {
  private eventEmitter: EventEmitter = new EventEmitter();

  async create(...) {
    // ... 作成処理
    this.eventEmitter.emit("workspace:changed", { type: "create", workspaceId });
  }

  async update(...) {
    // ... 更新処理
    this.eventEmitter.emit("workspace:changed", { type: "update", workspaceId });
  }

  async delete(...) {
    // ... 削除処理
    this.eventEmitter.emit("workspace:changed", { type: "delete", workspaceId });
  }

  onWorkspaceChanged(callback: (event: WorkspaceChangeEvent) => void): () => void {
    this.eventEmitter.on("workspace:changed", callback);
    return () => this.eventEmitter.off("workspace:changed", callback);
  }
}
```

#### 3. イベント購読（CloudSyncService）

```typescript
// cloud-sync.service.ts
export class CloudSyncService {
  private pendingSyncTimer: NodeJS.Timeout | null = null;

  public initialize(getServerManager: () => MCPServerManager): void {
    this.serverManagerProvider = getServerManager;

    // イベント購読
    getWorkspaceService().onWorkspaceChanged(() => {
      this.scheduleSync();
    });
    getServerService().onServerChanged(() => {
      this.scheduleSync();
    });
  }

  private scheduleSync(): void {
    // デバウンス: 2秒以内の連続変更は1回の同期にまとめる
    if (this.pendingSyncTimer) {
      return;
    }
    this.pendingSyncTimer = setTimeout(() => {
      this.pendingSyncTimer = null;
      void this.syncNow();
    }, 2000);
  }
}
```

### 考慮事項

#### Dirty Suppression（同期中の変更抑制）

リモートからのPull適用中にイベントが発火すると、無限ループの原因になる。

```typescript
private dirtySuppressionCount = 0;

private async applyWorkspaceBundle(json: string): Promise<void> {
  this.dirtySuppressionCount++;
  try {
    // ... 適用処理（イベントは発火するが無視される）
  } finally {
    this.dirtySuppressionCount--;
  }
}

private scheduleSync(): void {
  if (this.dirtySuppressionCount > 0) {
    return; // 抑制中は無視
  }
  // ...
}
```

#### Dirty During Sync（同期中の変更追跡）

同期実行中にユーザーが変更した場合、その変更を失わないようにする。

```typescript
private dirtyDuringSync = false;

private async syncNow(): Promise<void> {
  this.dirtyDuringSync = false;
  // ... 同期処理
  if (this.dirtyDuringSync) {
    // 同期中に変更があったので再スケジュール
    this.scheduleSync();
  }
}

private scheduleSync(): void {
  if (this.syncInProgress) {
    this.dirtyDuringSync = true;
    return;
  }
  // ...
}
```

### ポーリングとの併用

イベント駆動だけでは他デバイスからの変更を検知できないため、ポーリングとの併用が推奨される。

```typescript
// イベント駆動: ローカル変更 → 即時同期（2秒デバウンス）
// ポーリング: 他デバイス変更 → 10分間隔で検知
```

## 実装判断基準

以下の条件を満たす場合にイベント駆動方式を実装する：

1. ユーザーから「変更が即座に同期されない」というフィードバックがある
2. 複数デバイスでの同時編集が一般的なユースケースになる
3. サーバー側でWebSocket/SSEによるプッシュ通知が実装される

## 参考

- 削除されたコード: git commit (このPR以前のコミット参照)
- 関連設計: `docs/design/mcp-server-cloud-e2e.md`
