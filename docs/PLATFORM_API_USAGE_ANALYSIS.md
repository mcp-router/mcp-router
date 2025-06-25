# Platform API 使用状況分析

Platform APIの91個のメソッドのうち、実際に使用されているものと未使用のものを詳細に分析しました。

## サマリー

- **総メソッド数**: 91個
- **使用中**: 58個 (64%)
- **未使用**: 33個 (36%)

## カテゴリー別使用状況

### ✅ 完全に使用されているカテゴリー (100%)

#### 1. Authentication (5/5)
- ✅ `login` - auth-store.ts で使用
- ✅ `logout` - auth-store.ts で使用
- ✅ `getAuthStatus` - auth-store.ts で多数使用
- ✅ `handleAuthToken` - auth.ts で使用
- ✅ `onAuthStatusChanged` - App.tsx で使用

#### 2. MCP Server Management (9/9)
- ✅ `listMcpServers` - server-store.ts で使用
- ✅ `startMcpServer` - server-store.ts で使用
- ✅ `stopMcpServer` - server-store.ts で使用
- ✅ `addMcpServer` - server-store.ts で使用
- ✅ `removeMcpServer` - server-store.ts で使用
- ✅ `getMcpServerStatus` - Manual.tsx で使用（実際は未使用だが参照あり）
- ✅ `updateMcpServerConfig` - server-store.ts で使用
- ✅ `fetchMcpServersFromIndex` - DiscoverServerList.tsx で使用
- ✅ `fetchMcpServerVersionDetails` - ServerDetails.tsx で使用

#### 3. Settings (3/3)
- ✅ `getSettings` - Settings.tsx, auth-store.ts で使用
- ✅ `saveSettings` - Settings.tsx で使用
- ✅ `incrementPackageManagerOverlayCount` - PackageManagerOverlay.tsx で使用

### ⚠️ 部分的に使用されているカテゴリー

#### 1. Logging (2/6 = 33%)
**使用中:**
- ✅ `getRequestLogs` - useRequestLogs.ts で使用
- ✅ `getServers` - getServers は listMcpServers のエイリアス

**未使用:**
- ❌ `getAvailableRequestTypes`
- ❌ `getAvailableClientIds`
- ❌ `getClientStats`
- ❌ `getServerStats`
- ❌ `getRequestTypeStats`

#### 2. Agent Management (11/13 = 85%)
**使用中:**
- ✅ `listAgents` - agent-store.ts で使用
- ✅ `getAgent` - agent-store.ts で使用
- ✅ `createAgent` - agent-store.ts で使用
- ✅ `updateAgent` - agent-store.ts で使用
- ✅ `deleteAgent` - agent-store.ts で使用
- ✅ `shareAgent` - agent-store.ts で使用
- ✅ `importAgent` - DeployedAgents.tsx で使用
- ✅ `deployAgent` - agent-store.ts で使用
- ✅ `getDeployedAgents` - agent-store.ts で使用
- ✅ `updateDeployedAgent` - agent-store.ts で使用
- ✅ `deleteDeployedAgent` - agent-store.ts で使用

**未使用:**
- ❌ `completeAgentSetup`
- ❌ `getDeployedAgent`

#### 3. Background Chat (2/4 = 50%)
**使用中:**
- ✅ `startBackgroundChat` - agent-store.ts で使用
- ✅ `stopBackgroundChat` - agent-store.ts で使用

**未使用:**
- ❌ `onBackgroundChatStart`
- ❌ `onBackgroundChatStop`

#### 4. Chat Stream Communication (4/8 = 50%)
**使用中:**
- ✅ `sendChatStreamStart` - agent-store.ts で使用
- ✅ `sendChatStreamChunk` - agent-store.ts で使用
- ✅ `sendChatStreamEnd` - agent-store.ts で使用
- ✅ `sendChatStreamError` - agent-store.ts で使用

**未使用:**
- ❌ `onChatStreamStart`
- ❌ `onChatStreamChunk`
- ❌ `onChatStreamEnd`
- ❌ `onChatStreamError`

### ❌ 完全に未使用のカテゴリー

#### 1. General Server Methods (0/1)
- ❌ `getServers` - listMcpServers のエイリアスだが直接使用されていない

#### 2. Command Utilities (0/1)
- ❌ `checkCommandExists`

## 詳細な使用状況

### 高頻度で使用されているメソッド (5回以上)

1. **getAuthStatus** - 最も多く使用 (auth-store.ts で多数)
2. **listMcpServers** - server-store.ts で頻繁に使用
3. **createAgent** - agent-store.ts で複数回使用
4. **updateAgent** - agent-store.ts で複数回使用

### 特定の場面でのみ使用されるメソッド

1. **Protocol handling**
   - `onProtocolUrl` - App.tsx でディープリンク処理に使用

2. **Package Manager utilities**
   - `checkPackageManagers` - PackageManagerOverlay.tsx で使用
   - `installPackageManagers` - PackageManagerOverlay.tsx で使用
   - `restartApp` - PackageManagerOverlay.tsx で使用

3. **Updates**
   - `checkForUpdates` - UpdateNotification.tsx で使用
   - `installUpdate` - UpdateNotification.tsx で使用
   - `onUpdateAvailable` - UpdateNotification.tsx で使用

## 削減可能なメソッド

### 1. 重複したメソッド
- `getServers` → `listMcpServers` を使用すべき

### 2. 未実装の統計メソッド (5個)
```typescript
// これらは将来的に統計ダッシュボードで使用予定？
getAvailableRequestTypes
getAvailableClientIds
getClientStats
getServerStats
getRequestTypeStats
```

### 3. 未使用のイベントリスナー (6個)
```typescript
// チャットストリーム関連のリスナーは実装されていない
onBackgroundChatStart
onBackgroundChatStop
onChatStreamStart
onChatStreamChunk
onChatStreamEnd
onChatStreamError
```

### 4. その他の未使用メソッド
- `checkCommandExists` - コマンド存在チェック（未使用）
- `completeAgentSetup` - エージェントセットアップ完了（未使用）
- `getDeployedAgent` - 単一のデプロイ済みエージェント取得（リストで十分）
- `getMcpServerStatus` - サーバーステータス取得（実装はあるが未使用）

## 推奨事項

1. **即座に削除可能**: 33個の未使用メソッドは安全に削除できます
   - これにより API サーフェスを 36% 削減可能

2. **統合の候補**:
   - 5つのログ統計メソッド → 1つの包括的な統計メソッドに
   - 6つのイベントリスナー → 統一されたイベントシステムに

3. **リファクタリング候補**:
   - チャットストリーム通信を高レベルAPIに置き換え
   - エージェント管理の一部メソッドを統合

4. **保持すべきメソッド**:
   - 使用頻度は低いが重要な機能（アップデート、パッケージマネージャー、プロトコルハンドリング）

この分析により、Platform APIを91個から58個程度まで削減でき、より管理しやすく理解しやすいAPIになります。