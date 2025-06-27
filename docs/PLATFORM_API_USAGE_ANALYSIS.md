# Platform API 使用状況分析

Platform APIのメソッドのうち、実際に使用されているものと未使用のものを詳細に分析しました。

## サマリー

- **総メソッド数**: 64個  
- **使用中**: 64個 (100%)
- **未使用**: 0個 (0%)

## カテゴリー別使用状況

### ✅ 完全に使用されているカテゴリー (100%)

#### 1. Authentication (5/5)
- ✅ `login` - auth-store.ts で使用
- ✅ `logout` - auth-store.ts で使用
- ✅ `getAuthStatus` - auth-store.ts で多数使用
- ✅ `handleAuthToken` - auth.ts で使用
- ✅ `onAuthStatusChanged` - App.tsx で使用

#### 2. MCP Server Management (8/8)
- ✅ `listMcpServers` - server-store.ts で使用
- ✅ `startMcpServer` - server-store.ts で使用
- ✅ `stopMcpServer` - server-store.ts で使用
- ✅ `addMcpServer` - server-store.ts で使用
- ✅ `removeMcpServer` - server-store.ts で使用
- ✅ `updateMcpServerConfig` - server-store.ts で使用
- ✅ `fetchMcpServersFromIndex` - DiscoverServerList.tsx で使用
- ✅ `fetchMcpServerVersionDetails` - ServerDetails.tsx で使用

#### 3. Settings (3/3)
- ✅ `getSettings` - Settings.tsx, auth-store.ts で使用
- ✅ `saveSettings` - Settings.tsx で使用
- ✅ `incrementPackageManagerOverlayCount` - PackageManagerOverlay.tsx で使用

#### 4. Chat Stream Communication (8/8)
- ✅ `sendChatStreamStart` - BackgroundComponent.tsx で使用
- ✅ `sendChatStreamChunk` - BackgroundComponent.tsx で使用
- ✅ `sendChatStreamEnd` - BackgroundComponent.tsx で使用
- ✅ `sendChatStreamError` - BackgroundComponent.tsx で使用
- ✅ `onChatStreamStart` - AgentChat.tsx, AgentChatPlayground.tsx で使用
- ✅ `onChatStreamChunk` - AgentChat.tsx, AgentChatPlayground.tsx で使用
- ✅ `onChatStreamEnd` - AgentChat.tsx, AgentChatPlayground.tsx で使用
- ✅ `onChatStreamError` - AgentChat.tsx, AgentChatPlayground.tsx で使用

#### 5. Command Utilities (1/1)
- ✅ `checkCommandExists` - ServerDetailsLocal.tsx で使用

#### 6. Background Chat (4/4)
- ✅ `startBackgroundChat` - agent-store.ts で使用
- ✅ `stopBackgroundChat` - agent-store.ts で使用
- ✅ `onBackgroundChatStart` - background.tsx で使用（バックグラウンドウィンドウでチャット開始イベントを受信）
- ✅ `onBackgroundChatStop` - BackgroundComponent.tsx で使用（チャット停止イベントを受信）

#### 7. Logging (1/1)
- ✅ `getRequestLogs` - useRequestLogs.ts で使用

#### 8. Agent Management (7/7)
- ✅ `listAgents` - agent-store.ts で使用
- ✅ `getAgent` - agent-store.ts で使用
- ✅ `createAgent` - agent-store.ts で使用
- ✅ `updateAgent` - agent-store.ts で使用
- ✅ `deleteAgent` - agent-store.ts で使用
- ✅ `shareAgent` - agent-store.ts で使用
- ✅ `importAgent` - DeployedAgents.tsx で使用

#### 9. Agent Deployment (4/4)
- ✅ `deployAgent` - agent-store.ts で使用
- ✅ `getDeployedAgents` - agent-store.ts で使用
- ✅ `updateDeployedAgent` - agent-store.ts で使用
- ✅ `deleteDeployedAgent` - agent-store.ts で使用

#### 10. MCP Apps (5/5)
- ✅ `listMcpApps` - McpApps.tsx で使用
- ✅ `addMcpAppConfig` - McpApps.tsx で使用
- ✅ `deleteMcpApp` - McpApps.tsx で使用
- ✅ `updateAppServerAccess` - McpApps.tsx で使用
- ✅ `unifyAppConfig` - McpApps.tsx で使用

#### 11. Package Management (2/2)
- ✅ `resolvePackageVersionsInArgs` - server-store.ts で使用
- ✅ `checkMcpServerPackageUpdates` - ServerUpdateCheck.tsx で使用

#### 12. Agent Tools (2/2)
- ✅ `getAgentMCPServerTools` - agent-store.ts で使用
- ✅ `executeAgentTool` - agent-store.ts で使用

#### 13. Session Management (5/5)
- ✅ `fetchSessionMessages` - agent-store.ts で使用
- ✅ `getSessions` - agent-store.ts で使用
- ✅ `createSession` - agent-store.ts で使用
- ✅ `updateSessionMessages` - agent-store.ts で使用
- ✅ `deleteSession` - agent-store.ts で使用

#### 14. Token Management (1/1)
- ✅ `updateTokenScopes` - McpApps.tsx で使用

#### 15. Feedback (1/1)
- ✅ `submitFeedback` - Feedback.tsx で使用

#### 16. Updates (3/3)
- ✅ `checkForUpdates` - UpdateNotification.tsx で使用
- ✅ `installUpdate` - UpdateNotification.tsx で使用
- ✅ `onUpdateAvailable` - UpdateNotification.tsx で使用

#### 17. Protocol Handling (1/1)
- ✅ `onProtocolUrl` - App.tsx で使用

#### 18. Package Manager Utilities (3/3)
- ✅ `checkPackageManagers` - PackageManagerOverlay.tsx で使用
- ✅ `installPackageManagers` - PackageManagerOverlay.tsx で使用
- ✅ `restartApp` - PackageManagerOverlay.tsx で使用

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

## 推奨事項

1. **さらなる改善の余地**:
   - 将来的にログ統計が必要になった場合は、個別メソッドではなく統一的な統計APIを設計
   - エージェント管理APIは現在のセットで必要十分

2. **保持すべきメソッド**:
   - 使用頻度は低いが重要な機能（アップデート、パッケージマネージャー、プロトコルハンドリング）
   - すべてのチャットストリーミングAPI（リアルタイム通信に必須）

削除したメソッドにより、Platform APIを91個から64個に削減し、すべてのメソッドが実際に使用されている、より効率的で管理しやすいAPIになりました。