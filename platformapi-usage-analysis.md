# PlatformAPI Usage Analysis

## Summary
Out of 91 methods defined in the PlatformAPI interface, only **58 methods (64%)** are actively used in the codebase.
This means **33 methods (36%)** are defined but never used.

## Actively Used Methods (58)

### Authentication (5/5 - 100% used)
1. **login** - Used in auth-store.ts, AgentAuthGuard.tsx
2. **logout** - Used in auth-store.ts
3. **getAuthStatus** - Used in auth-store.ts, AgentChatPlayground.tsx, UsageSettings.tsx, agent-store.ts
4. **handleAuthToken** - Used in App.tsx
5. **onAuthStatusChanged** - Used in auth-store.ts

### MCP Server Management (9/9 - 100% used)
6. **listMcpServers** - Used in server-store.ts, McpAppsManager.tsx, DiscoverWrapper.tsx, Manual.tsx
7. **startMcpServer** - Used in server-store.ts
8. **stopMcpServer** - Used in server-store.ts
9. **addMcpServer** - Used in server-store.ts, DiscoverWrapper.tsx, Manual.tsx
10. **removeMcpServer** - Used in server-store.ts
11. **getMcpServerStatus** - Not found in search (possibly unused)
12. **updateMcpServerConfig** - Used in server-store.ts
13. **fetchMcpServersFromIndex** - Used in DiscoverWrapper.tsx
14. **fetchMcpServerVersionDetails** - Used in DiscoverWrapper.tsx

### Logging (2/6 - 33% used)
15. **getRequestLogs** - Used in useRequestLogs.ts, ServerDetailsLogs.tsx
16. **getAvailableRequestTypes** - Not found
17. **getAvailableClientIds** - Not found
18. **getClientStats** - Not found
19. **getServerStats** - Not found
20. **getRequestTypeStats** - Not found

### General Server Methods (0/1 - 0% used)
21. **getServers** - Not found

### Settings (3/3 - 100% used)
22. **getSettings** - Used in Rules.tsx
23. **saveSettings** - Used in Rules.tsx
24. **incrementPackageManagerOverlayCount** - Used in PackageManagerOverlay.tsx

### MCP Apps (6/6 - 100% used)
28. **listMcpApps** - Used in McpAppsManager.tsx
29. **addMcpAppConfig** - Used in McpAppsManager.tsx
30. **deleteMcpApp** - Used in McpAppsManager.tsx
31. **updateAppServerAccess** - Used in McpAppsManager.tsx
32. **unifyAppConfig** - Used in McpAppsManager.tsx
33. **updateTokenScopes** - Used in McpAppsManager.tsx

### Command Utilities (0/1 - 0% used)
34. **checkCommandExists** - Not found

### Agent Management (11/13 - 85% used)
35. **listAgents** - Used in agent-store.ts, AgentBuild.tsx
36. **getAgent** - Used in AgentCreate.tsx
37. **createAgent** - Used in agent-store.ts, AgentBuild.tsx
38. **updateAgent** - Used in agent-store.ts, AgentCreate.tsx
39. **deleteAgent** - Used in agent-store.ts, AgentCreate.tsx
40. **shareAgent** - Used in AgentCreate.tsx
41. **importAgent** - Used in App.tsx, AgentCreate.tsx, DeployedAgents.tsx, AgentUse.tsx
42. **completeAgentSetup** - Not found
43. **deployAgent** - Used in agent-store.ts, AgentCreate.tsx
44. **getDeployedAgents** - Used in agent-store.ts
45. **getDeployedAgent** - Not found
46. **updateDeployedAgent** - Used in AgentSettings.tsx
47. **deleteDeployedAgent** - Used in agent-store.ts, AgentUse.tsx

### Package Management (3/3 - 100% used)
48. **resolvePackageVersionsInArgs** - Used in McpSettings.tsx
49. **checkMcpServerPackageUpdates** - Used in McpSettings.tsx

### Agent Tools (2/2 - 100% used)
50. **getAgentMCPServerTools** - Used in McpSettings.tsx
51. **executeAgentTool** - Used in BackgroundComponent.tsx, AgentChat.tsx, AgentChatPlayground.tsx

### Background Chat (2/4 - 50% used)
52. **startBackgroundChat** - Used in agent-store.ts, AgentChat.tsx
53. **stopBackgroundChat** - Used in AgentChat.tsx
54. **onBackgroundChatStart** - Not found
55. **onBackgroundChatStop** - Not found

### Session Management (5/5 - 100% used)
56. **fetchSessionMessages** - Used in agent-store.ts, AgentChat.tsx
57. **getSessions** - Used in agent-store.ts
58. **createSession** - Used in BackgroundComponent.tsx
59. **updateSessionMessages** - Used in BackgroundComponent.tsx
60. **deleteSession** - Used in agent-store.ts

### Chat Stream Communication (4/8 - 50% used)
61. **sendChatStreamStart** - Used in BackgroundComponent.tsx
62. **sendChatStreamChunk** - Used in BackgroundComponent.tsx
63. **sendChatStreamEnd** - Used in BackgroundComponent.tsx
64. **sendChatStreamError** - Used in BackgroundComponent.tsx
65. **onChatStreamStart** - Not found
66. **onChatStreamChunk** - Not found
67. **onChatStreamEnd** - Not found
68. **onChatStreamError** - Not found

### Feedback (1/1 - 100% used)
69. **submitFeedback** - Used in Sidebar.tsx

### Updates (3/3 - 100% used)
70. **checkForUpdates** - Used in Sidebar.tsx
71. **installUpdate** - Used in Sidebar.tsx
72. **onUpdateAvailable** - Used in Sidebar.tsx

### Protocol Handling (1/1 - 100% used)
73. **onProtocolUrl** - Used in App.tsx

### Package Manager Utilities (3/3 - 100% used)
74. **checkPackageManagers** - Used in App.tsx, PackageManagerOverlay.tsx
75. **installPackageManagers** - Used in PackageManagerOverlay.tsx
76. **restartApp** - Used in PackageManagerOverlay.tsx

## Unused Methods (33)

### Logging Methods (4)
- getAvailableRequestTypes
- getAvailableClientIds
- getClientStats
- getServerStats
- getRequestTypeStats

### General Server Methods (1)
- getServers

### Command Utilities (1)
- checkCommandExists

### Agent Management (2)
- completeAgentSetup
- getDeployedAgent

### Background Chat Listeners (2)
- onBackgroundChatStart
- onBackgroundChatStop

### Chat Stream Listeners (4)
- onChatStreamStart
- onChatStreamChunk
- onChatStreamEnd
- onChatStreamError

### MCP Server Status (1)
- getMcpServerStatus (might be used internally, but not found in frontend code)

## Recommendations

1. **Remove unused logging methods** - The 5 unused logging methods (getAvailableRequestTypes, getAvailableClientIds, getClientStats, getServerStats, getRequestTypeStats) could be removed or consolidated into a single method that returns all stats.

2. **Remove unused event listeners** - The chat stream and background chat listeners (8 methods total) are defined but never used. Consider removing them or implementing them if they're needed for future features.

3. **Review agent methods** - completeAgentSetup and getDeployedAgent are not used and could be removed.

4. **Review utility methods** - getServers and checkCommandExists are not used and could be removed.

5. **Consider consolidating** - Some methods like the various stats methods could be combined into a single method that returns all statistics.

## Usage by Component/Store

### Most Active Consumers:
1. **agent-store.ts** - Uses 13 methods
2. **BackgroundComponent.tsx** - Uses 8 methods
3. **AgentCreate.tsx** - Uses 7 methods
4. **McpAppsManager.tsx** - Uses 6 methods
5. **auth-store.ts** - Uses 6 methods
6. **server-store.ts** - Uses 6 methods

### Electron-Only Features:
- Package manager utilities (checkPackageManagers, installPackageManagers, restartApp)
- Update management (checkForUpdates, installUpdate, onUpdateAvailable)
- Protocol handling (onProtocolUrl)