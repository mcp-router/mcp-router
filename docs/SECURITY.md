# Security Findings Details

## 1. OAuth and Authentication Token Security Vulnerabilities (Severity: Critical)

### Target Feature
OAuth and Authentication Token Security Vulnerabilities

### Affected Locations
- apps/electron/src/main/modules/auth/auth.service.ts
- apps/electron/src/main.ts
- apps/electron/src/main/infrastructure/shared-config-manager.ts
- apps/electron/src/main/modules/settings/settings.service.ts
- apps/electron/src/main/modules/workspace/workspace.ipc.ts
- apps/electron/src/main/modules/auth/auth.ipc.ts

The handleAuthToken function in auth.service.ts (lines 94-119) - bypasses state validation when currentAuthState is null, processes arbitrary tokens, and stores them as plaintext in SharedConfigManager.

### Description
Multiple critical flaws in authentication token handling: 1) PKCE OAuth flow state parameter validation can be bypassed when currentAuthState does not exist, enabling CSRF attacks and protocol handler URL manipulation. 2) Authentication tokens are stored as plaintext without encryption and transmitted via IPC without protection. 3) The getDecryptedAuthToken() function misleadingly suggests encryption but returns plaintext tokens. 4) Authentication tokens and workspace credentials are exposed via IPC handlers without proper authentication checks. 5) No token rotation mechanism exists, making compromised tokens a persistent threat.

### Risk
This vulnerability allows attackers to bypass authentication and gain unauthorized access to user accounts. This can result in data leakage, account takeover, and tampering with sensitive information. Additionally, attackers may execute malicious operations and impersonate users. Without countermeasures, this can lead to serious security incidents.

### Countermeasures
The following countermeasures should be implemented to address this vulnerability:

- **OAuth Flow Improvement**: Ensure PKCE OAuth flow state parameter validation is properly implemented and only executes when currentAuthState exists.
- **Token Storage Encryption**: Change to store authentication tokens in encrypted format. Use secure storage mechanisms and implement proper key management.
- **IPC Handler Authentication**: Add proper authentication checks to IPC handlers to ensure only authorized processes can access sensitive data. Strictly restrict access to workspace credentials.
- **Token Rotation Introduction**: Implement periodic token rotation to mitigate the impact of compromised tokens. Set appropriate token expiration and issue new tokens regularly.
- **getDecryptedAuthToken() Fix**: Rename the function or clearly document its behavior to avoid misleading implications about returning plaintext tokens.

## 2. Server-Side Request Forgery (SSRF) via URL Injection (Severity: Critical)

### Target Feature
Server-Side Request Forgery (SSRF) via URL Injection

### Affected Locations
- apps/electron/src/main/utils/fetch-utils.ts
- apps/electron/src/main/modules/workspace/platform-api-manager.ts
- apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts
- apps/electron/src/main/modules/system/system-handler.ts

Line 29-31 in fetch-utils.ts: const url = path.startsWith('http') ? path : `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`; return fetch(url, options); OR Line 50 in reconnecting-mcp-client.ts: const transport = new StreamableHTTPClientTransport(new URL(server.remoteUrl)) OR Line 199 in platform-api-manager.ts: return this.currentWorkspace.remoteConfig.apiUrl;

### Description
Multiple SSRF vulnerabilities due to insufficient URL validation: 1) The `fetchWithToken` function allows arbitrary URLs if the path starts with 'http'. 2) Remote workspace configuration allows arbitrary `apiUrl` values that are directly used for API requests. 3) MCP server connections accept user-provided `remoteUrl` parameters without validation. 4) Server configuration testing and feedback submission make requests to attacker-controlled endpoints. This enables access to internal services, network scanning, credential extraction, and data access to cloud metadata endpoints.

### Risk
This vulnerability allows attackers to access internal services, steal sensitive information, scan internal networks, and potentially fully compromise servers. This can lead to data leakage, service disruption, and potential financial loss.

### Countermeasures
To fix this vulnerability, implement the following measures: • Enforce strict validation on all user-provided URLs using an allowlist of permitted domains. • Sanitize all URLs including `apiUrl` before accepting user input. • Sanitize the `remoteUrl` parameter used for remote server configuration. • Restrict access to internal resources to mitigate potential impact if an SSRF attack succeeds. • Configure firewall rules to block external requests on the network.

## 3. Token Management and Access Control Bypass Vulnerabilities (Severity: Critical)

### Target Feature
Token Management and Access Control Bypass Vulnerabilities

### Affected Locations
- apps/electron/src/main/modules/client-apps/token-manager.ts
- apps/electron/src/main/infrastructure/shared-config-manager.ts
- apps/electron/src/main/modules/mcp-server-manager/server-service.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts

`TokenManager.validateToken()` only checks for token existence (lines 50-64), ignoring expiration. `syncTokensWithWorkspaceServers()` in `shared-config-manager.ts` automatically adds all server IDs to serverAccess for existing tokens (lines 354-370). Migration code grants access to all workspace servers (lines 222-228). `ServerService.addServer()` grants access to new servers for all tokens (lines 53-70).

### Description
Critical authentication flaws in token and server management.

- No token expiration mechanism, so tokens are valid indefinitely.
- Token generation deletes existing tokens without proper authentication checks.
- `syncTokensWithWorkspaceServers()` automatically grants access to all workspace servers for existing tokens without permission verification.
- During database migration, tokens receive access to all servers regardless of original permissions.
- IPC handlers lack permission verification before executing sensitive operations like server start/stop and configuration changes.

### Risk
This vulnerability allows attackers to gain unauthorized access and access sensitive data or control systems. Since tokens are valid indefinitely and access to new servers is automatically granted without deleting existing tokens, attackers can gain persistent access and compromise systems over extended periods. The automatic granting of access to all servers during database migration or when new servers are created can also cause widespread impact. Furthermore, the lack of authentication checks in IPC handlers enables unauthorized access to sensitive operations such as server control and configuration changes, increasing further risk.

### Countermeasures
The main countermeasures to resolve this vulnerability are as follows:

- **Implement Token Expiration**: Introduce a mechanism to set expiration on tokens and periodically invalidate them. Expired tokens should be invalidated.
- **Strengthen Authentication During Token Generation**: Perform proper authentication checks (permission verification) before deleting existing tokens when generating tokens. Verify that users have permission to delete their own tokens.
- **Stricter Access Control**: In the `syncTokensWithWorkspaceServers()` function and database migration processing, change to perform proper permission verification instead of automatically granting access to all servers, granting only necessary access rights.
- **IPC Handler Authentication**: Always perform authentication checks before executing sensitive operations (server start/stop, configuration changes, etc.) in IPC handlers. This prevents unauthorized access and enhances system security.

## 4. Path Traversal and File System Access Vulnerabilities (Severity: Critical)

### Target Feature
Path Traversal and File System Access Vulnerabilities

### Affected Locations
- apps/electron/src/main/utils/uri-utils.ts
- apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts
- apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-processor.ts
- apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-converter.ts
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts
- apps/electron/src/main/modules/workspace/workspace.service.ts
- apps/electron/src/main/infrastructure/database/sqlite-manager.ts

parseResourceUri() extracts path without validation: path: match[2] containing traversal sequences; workspace.service.ts constructs paths: path.join(app.getPath("userData"), dbPath) where dbPath contains "../../../etc/passwd"

### Description
Multiple path traversal vulnerabilities across multiple components: 1) The `parseResourceUri` function uses insufficient regex validation that allows path traversal sequences in resource URIs. 2) DXT file processing allows arbitrary file extraction without path validation via `unpackExtension()` and `expandPathVariables()`. 3) IPC handlers allow file system operations via `server:selectFile` and arbitrary directory creation. 4) Workspace database path construction uses user-controlled input that may contain traversal sequences. These vulnerabilities enable unauthorized file access, system file overwriting, and placement of malicious executables.

### Risk
The main risk of this vulnerability is that attackers can access arbitrary files, overwrite system files, and place malicious executables. This can result in complete system compromise and leakage of sensitive data. The impact scope includes unauthorized access to user accounts, personal information, and system settings.

### Countermeasures
To fix this vulnerability, the following countermeasures should be implemented: • Strictly validate all path inputs and reject path traversal sequences. Specifically, use a regex in the `parseResourceUri` function that safely validates extracted path components. • Implement path validation in DXT file processing to prevent files from being written outside the intended directory. • Also validate inputs to IPC handlers such as `server:selectFile`. • Sanitize user-controlled input during workspace database path construction to remove path traversal sequences. • Apply the principle of least privilege to restrict file system access. • Consider using secure file system operation libraries.

## 5. Arbitrary Code Execution via Hooks and Workflow System (Severity: Critical)

### Target Feature
Arbitrary Code Execution via Hooks and Workflow System

### Affected Locations
- apps/electron/src/main/modules/workflow/hook.ipc.ts
- apps/electron/src/main/modules/workflow/workflow.ipc.ts
- apps/electron/src/main/modules/workflow/hook.service.ts
- apps/electron/src/main/modules/workflow/workflow-executor.ts
- apps/electron/src/main/modules/workflow/hook.repository.ts
- apps/electron/src/main/modules/workflow/workflow.repository.ts
- apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts

hook.service.ts line 196: vmScript.runInContext(vmContext, {timeout: 5000}) - where vmContext contains escapable sandbox with Object/Array constructors allowing access to Node.js process object

### Description
Critical code execution vulnerabilities in the workflow/hook system: 1) Hook and workflow IPC handlers accept arbitrary JavaScript code that executes in the main process context without proper sandboxing. 2) The VM sandbox implementation is insufficient, allowing attackers to escape through prototype pollution, constructor manipulation, or access to Node.js built-in modules. 3) Saved hook scripts and workflow definitions contain executable JavaScript that is retrieved from the database and executed without validation. 4) Workflow execution bypasses normal MCP request authentication/authorization. 5) Hook scripts receive extensive context including tokens and sensitive data. These enable complete privilege escalation and system compromise.

### Risk
This vulnerability allows attackers to execute arbitrary code, potentially leading to complete system compromise. Attackers can access all data on the system, steal sensitive information, compromise other systems, and cause service DoS. Such vulnerabilities pose serious threats to enterprises and can cause significant reputational and financial damage.

### Countermeasures
Solutions to fix this vulnerability are as follows: First, implement stricter validation and sanitization for inputs from hook module and workflow IPC handlers. Next, implement a more secure sandbox environment for executing JavaScript code. This should be designed to restrict access to Node.js built-in modules and prevent attacks such as prototype pollution. Also, ensure that hook scripts and workflow definitions stored in the database are validated before execution. Finally, ensure that workflow execution does not bypass normal authentication/authorization processes.

## 6. Unencrypted Storage of Sensitive Authentication Data (Severity: Critical)

### Target Feature
Unencrypted Storage of Sensitive Authentication Data

### Affected Locations
- apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.repository.ts
- apps/electron/src/main/modules/workspace/workspace.repository.ts
- apps/electron/src/main/modules/mcp-logger/mcp-logger.repository.ts
- apps/electron/src/main/modules/auth/auth.service.ts
- apps/electron/src/main/modules/settings/settings.repository.ts

1) Line 235 in mcp-server-manager.repository.ts: `bearer_token: bearerToken` stores plaintext tokens 2) Line 117 in shared-config-manager.ts: JSON.stringify saves plaintext authToken to file 3) Line 160 in workspace.repository.ts: base64 encoded token without encryption 4) Line 149 in mcp-logger.repository.ts: JSON.stringify may store sensitive request parameters

### Description
Sensitive authentication tokens (bearer tokens, auth tokens) are stored as plaintext in SQLite databases without encryption. Tokens are stored as plain JSON in server configurations, workspace settings, and application settings. Request logs may also contain these tokens in parameters or responses, creating multiple exposure vectors through database access, log file analysis, backup investigation, or memory dumps.

### Risk
The main risk of this vulnerability is that attackers can steal authentication tokens and, as a result, gain complete access to the application. This can lead to sensitive information leakage, data tampering, and complete service compromise.

### Countermeasures
The top priority for fixing this vulnerability is to encrypt all sensitive authentication data. This includes bearer tokens, authentication tokens, and other sensitive credentials.

- Use symmetric encryption algorithms (such as AES) to encrypt tokens before storage.
- Store encrypted tokens in secure storage.
- Implement key management securely and protect encryption keys.
- If possible, shorten token validity periods and rotate regularly.
- Remove sensitive authentication data from request logs.

Additionally, ensure that sensitive data is not stored as plaintext in application settings and logs.

## 7. HTTP Server Input Processing Vulnerabilities (Severity: High)

### Target Feature
HTTP Server Input Processing Vulnerabilities

### Affected Locations
- apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts

```
Lines 76-80: const tokenId = typeof token === "string" ? token.startsWith("Bearer ") ? token.substring(7) : token : ""; and Lines 184: skipValidation: platformManager.isRemoteWorkspace() in resolveProjectFilter method
```

### Description
Multiple input validation flaws in HTTP server processing:

1) Bearer token authentication has dual processing logic (lines 58-61 and 76-80), causing inconsistent validation behavior that may bypass authentication.
2) The resolveProjectFilter method performs insufficient validation on project header values, performing only basic trimming and taking the first array element. This may bypass access control through project header injection, especially in remote workspace mode where validation is completely skipped.

### Risk
This vulnerability can lead to unauthorized access control. Attackers may bypass authentication to access sensitive data or execute unauthorized operations on the system. Project header injection attacks may enable access to unintended projects, particularly in remote workspace mode, leading to further attacks.

### Countermeasures
To fix this vulnerability, the following countermeasures should be implemented:

- **Bearer Token Authentication Fix:** Implement consistent authentication logic and ensure token processing consistency. Fix to use the same token variable in token processing and validation.
- **Project Header Validation Strengthening:** Strengthen project header validation to prevent potential injection attacks. Perform proper header value validation to prevent unauthorized values from being used. Change implementation to perform proper validation even in remote workspace mode.
- **Thorough Input Validation:** Execute strict input validation on all inputs to the HTTP server. This prevents unauthorized inputs from affecting the system.

## 8. DoS and Information Leakage in Workflow Engine (Severity: High)

### Target Feature
Workflow Engine

### Affected Locations
- apps/electron/src/main/modules/workflow/workflow-executor.ts
- apps/electron/src/main/modules/workflow/hook.service.ts
- apps/electron/src/main/modules/workflow/workflow.service.ts
- apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts

In hook script execution at `hook.service.ts:196-203`, `vmScript.runInContext(vmContext, {timeout: 5000})` executes user-provided scripts with full access to context data including tokens, client IDs, and MCP responses, which may be logged or returned for leakage.

### Description
Vulnerabilities leading to DoS and data leakage in the workflow system.
1) Cycles in workflow graphs may bypass detection in `determineExecutionOrder()`, causing infinite execution. 2) Excessive workflow complexity causes algorithmic DoS in BFS/topological sort processing. 3) Hook scripts containing infinite loops or resource-intensive operations consume large amounts of CPU/memory despite timeouts. 4) Hook scripts receive sensitive context information including MCP parameters, client IDs, tokens, and internal state, and may leak them through console logging or return value manipulation.

### Risk
The main risk of this vulnerability is that attackers can cause DoS and steal sensitive context data within workflows. This data includes MCP parameters, client IDs, tokens, and internal state, which may be used for unauthorized access, account takeover, or other malicious activities. DoS attacks can affect workflow engine availability, leading to service interruptions and performance degradation. The potential impact of this vulnerability relates to both data confidentiality and availability, posing high risk.

### Countermeasures
Recommendations for fixing this vulnerability are as follows:
- Strengthen graph validation in workflows (robust cycle detection, node/edge limits, timeout/step limits).
- More strictly control hook script execution to prevent resource-intensive operations and infinite loops.
- Limit the scope of context data accessible to hook scripts to prevent sensitive data leakage.
- Implement context data escaping and validation to reduce information leakage risk.

---

## Implemented Mitigations (2026-01-29)

The following security mitigations have been implemented as part of the MCP Spec 2025-11-25 upgrade:

### URL Validation Utility (Addresses #2: SSRF)

**File:** `apps/electron/src/main/utils/url-validation-utils.ts`

Added `validateExternalUrl()` and `validateElicitationUrl()` functions that block:
- Internal hosts (localhost, 127.0.0.1, 0.0.0.0, [::1])
- Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Non-HTTPS URLs for elicitation (security requirement)

### Token Expiration (Addresses #3: Token Management)

**Files:**
- `packages/shared/src/types/token-types.ts`
- `apps/electron/src/main/modules/client-apps/token-manager.ts`

Tokens now have:
- Optional `expiresAt` field (UNIX timestamp)
- No default expiration (the original 24-hour default was removed in v0.7.0 as too aggressive)
- `validateToken()` checks expiration before returning valid, if `expiresAt` is set

### RFC 8707 Resource Indicators (Preparation)

**File:** `packages/shared/src/types/token-types.ts`

Added `TokenResourceIndicator` type for future OAuth 2.1 compliance:
- `resource`: Resource server URI the token is valid for
- `scopes`: Scopes granted for the resource

### Elicitation URL Security

**File:** `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`

All URL mode elicitation requests are validated:
- Only HTTPS URLs are allowed
- Internal hosts and private IPs are blocked
- Cloud metadata endpoints are blocked

---

## Implemented Mitigations (2026-02-02)

The following security mitigations have been implemented for the Skills Router system:

### Path Security Utility (Addresses #4: Path Traversal)

**File:** `apps/electron/src/main/utils/path-security.ts`

Added comprehensive path validation functions:
- `isPathContained()` - Validates a path is within an allowed base directory
- `isPathAllowed()` - Blocks forbidden system directories (/etc, /usr, /bin, etc.)
- `validateSkillSymlinkTarget()` - Validates symlink targets are in allowed agent directories
- `validateSkillName()` - Validates skill names prevent path traversal attacks
- `validateAgentPath()` - Validates agent path inputs for creating symlink targets
- `validateCopyOperation()` - Validates copy operations stay within boundaries

### Skills File Manager Hardening

**File:** `apps/electron/src/main/modules/skills/skills-file-manager.ts`

Security improvements:
- All file operations now validate paths are within the skills directory
- Symlink creation validates both source and target paths
- Directory deletion checks path containment before `rm -rf`
- Copy operations skip symlinks to prevent symlink attacks
- Maximum recursion depth (50) prevents infinite loops from circular symlinks
- Only symlinks can be removed by `removeSymlink()` (not regular files/directories)
- `openInFinder()` restricted to skills directory only

### Agent Path Validation (Addresses Symlink Attacks)

**File:** `apps/electron/src/main/modules/skills/skills.service.ts`

The `createAgentPath()` method now validates:
- Path must be within user's home directory
- Path must be in an allowed agent directory (.claude, .cursor, .config, etc.)
- Path must not be a forbidden system directory

### Client App Service Hardening

**File:** `apps/electron/src/main/modules/client-apps/client-app.service.ts`

Security improvements:
- Skill discovery scanning validates paths are within home directory
- Symlink creation validates client skills paths before creating links
- Forbidden system paths are blocked from being scanned

### Glob Path Resolution Security

**File:** `apps/electron/src/main/modules/client-apps/client-detector.ts`

Security improvements:
- Maximum recursion depth (20) prevents infinite loops
- Maximum results limit (100) prevents memory exhaustion
- Hidden directories are skipped unless explicitly matched

### SVG Sanitization (Addresses XSS via dangerouslySetInnerHTML)

**File:** `apps/electron/src/renderer/utils/svg-sanitizer.ts`

Added SVG content sanitization utility to prevent XSS attacks when rendering SVG content via `dangerouslySetInnerHTML`:
- Removes `<script>` tags and their contents
- Strips event handler attributes (onclick, onerror, onload, etc.)
- Blocks dangerous URL schemes (javascript:, data:text/html, data:application)
- Removes `<foreignObject>` elements that could contain arbitrary HTML
- Blocks dangerous `<use>` elements with external references
- Removes CSS expressions that could execute code

**Files Updated:**
- `apps/electron/src/renderer/components/skills/ClientStatusIcon.tsx` - Now uses `sanitizeSvgWithStyles()` before rendering client icons
- `apps/electron/src/renderer/components/skills/UnifiedSkillDetailSheet.tsx` - Now uses `sanitizeSvgWithStyles()` before rendering client icons

---

## Detailed Remediation Checklist

The following is a line-by-line remediation checklist for all identified security findings. Use this as a reference when implementing fixes.

### 1. OAuth/Authentication Token Vulnerabilities (Critical)

- `apps/electron/src/main/modules/auth/auth.service.ts:94` -- Strengthen state validation in handleAuthToken (reject when state/currentAuthState is not set). Also clarify argument name to code.
- `apps/electron/src/main/modules/auth/auth.service.ts:223` -- getDecryptedAuthToken returns plaintext. Change to actual encryption implementation, or align function name/specification.
- `apps/electron/src/main/modules/auth/auth.service.ts:255` -- Stop status() from returning token (don't pass token to renderer).
- `apps/electron/src/main/modules/auth/auth.ipc.ts:22` -- Exclude sensitive information like tokens from auth:status return value. Introduce authorization checks.
- `apps/electron/src/main/modules/auth/auth.ipc.ts:36` -- Add caller verification/rate limiting/reentrancy prevention for auth:handle-token.
- `apps/electron/src/main/modules/workspace/workspace.ipc.ts:50` -- Deprecate workspace:get-credentials or add authorization guard (don't expose credentials to UI).
- `apps/electron/src/main/infrastructure/shared-config-manager.ts:104` -- Change from plaintext storage in saveConfig to secure storage (OS Keychain/Keytar or encryption + secure key management).
- `apps/electron/src/preload.ts:160` -- Review exposed content of getWorkspaceCredentials and onAuthStatusChanged (don't bridge sensitive information).
- `apps/electron/src/main.ts:444` -- Strictly parse mcpr:// URLs received by handleProtocolUrl with limited use cases (reject non-authentication flows).

### 2. SSRF (URL Injection) (Critical)

- `apps/electron/src/main/utils/fetch-utils.ts:28` -- Deprecate allowing arbitrary URLs starting with http/https. Only allow allowlist-based base URL concatenation.
- `apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts:50` -- Validate scheme/host/path before new URL(server.remoteUrl) (https only, prohibit internal/local, etc.).
- `apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts:81` -- Similarly validate remoteUrl for SSE.
- `apps/electron/src/main/modules/workspace/platform-api-manager.ts:208` -- Validate remoteConfig.apiUrl at save/read time before adoption (allowed domains/schemes).
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:26` -- Strict validation of remoteUrl/bearerToken during add/update (protocol, port, prohibit private addresses).
- `apps/electron/src/main/modules/system/system-handler.ts:30` -- Only allow fixed feedback submission destinations. Strict validation if made configurable in the future.

### 3. Token Management/Access Control Bypass (Critical)

- `apps/electron/src/main/modules/client-apps/token-manager.ts:46` -- Add expiration/revocation/scope validation to validateToken.
- `apps/electron/src/main/modules/client-apps/token-manager.ts:13` -- Add expiration/rotation attributes like expiresAt to generated tokens.
- `apps/electron/src/main/modules/mcp-server-manager/server-service.ts:41` -- Remove automatic permission granting to all tokens for new servers (change to explicit permission flow).
- `apps/electron/src/main/infrastructure/shared-config-manager.ts:351` -- Deprecate batch permission granting via syncTokensWithWorkspaceServers / change to consent-based.
- `apps/electron/src/main/infrastructure/shared-config-manager.ts:222` -- Deprecate "grant all servers" during migration (migrate with least privilege).
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:9` -- Introduce authorization checks for start/stop/update IPCs.

### 4. Path Traversal/FS Access (Critical)

- `apps/electron/src/main/utils/uri-utils.ts:10` -- Normalize/validate path in parseResourceUri to prevent ../ scheme injection.
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:435` -- Apply allowed scheme/server-side constraints before passing raw paths to createUriVariants in readResourceByUri.
- `apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-processor.ts:45` -- Prevent extraction escape in unpackExtension (Zip Slip countermeasures, extraction destination validation).
- `apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-converter.ts:162` -- Normalize and exclude paths outside allowed directories after path variable expansion.
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:91` -- Restrict acceptance of server:selectFile (enforce mode/filters, path validation).
- `apps/electron/src/main/modules/workspace/workspace.service.ts:432` -- Don't allow user input for databasePath / normalize (reject traversal).
- `apps/electron/src/main/infrastructure/database/sqlite-manager.ts:17` -- Normalize and check path composition on relative input (exclude ..).

### 5. Arbitrary Code Execution via Hooks/Workflows (Critical)

- `apps/electron/src/main/modules/workflow/hook.service.ts:206` -- Strengthen vm.runInContext sandbox (freeze Object/Array/Pipeline, block require/process, prohibit I/O).
- `apps/electron/src/main/modules/workflow/hook.ipc.ts:10` -- Strict validation and authorization for create/update/execute IPCs (admin only, etc.).
- `apps/electron/src/main/modules/workflow/workflow.ipc.ts:10` -- Same as above (validation during enable/execute).
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts:39` -- Remove or dummy tokens/sensitive data from workflow execution context.
- `apps/electron/src/main/modules/workflow/workflow.repository.ts` -- Defense measures such as script validation/signing/size limits before saving.

### 6. Plaintext Storage of Sensitive Data (Critical)

- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.repository.ts:235` -- Encrypt bearer_token storage (Keytar, KMS preferred).
- `apps/electron/src/main/infrastructure/shared-config-manager.ts:116` -- Don't store settings.authToken etc. as plaintext to file (migrate to secure storage).
- `apps/electron/src/main/modules/workspace/workspace.repository.ts:160` -- Deprecate Base64 pseudo "encryption". Change to genuine encryption + key management.
- `apps/electron/src/main/modules/mcp-logger/mcp-logger.repository.ts:146` -- Remove/mask sensitive information mixed into request_params/response_data, store only minimum necessary.
- `apps/electron/src/renderer/stores/auth-store.ts:122` -- Don't hold authToken in renderer state (temporary memory only when needed, prefer main-side processing).

### 7. HTTP Server Input Processing (High)

- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:56` -- Unify dual/inconsistent Bearer token processing (consolidate pre/post processing).
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:110` -- Strengthen resolveProjectFilter validation (format/length/existence check, don't skip validation even for remote).
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:47` -- Limit cors() to allowed origins. Add size limit with express.json({limit}).
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:392` -- ~~Change listen(port) to listen(port, '127.0.0.1')~~ **DONE** (localhost bind implemented). Consider TLS introduction.
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:145` -- Deprecate/minimize _meta.token assignment (don't flow sensitive information to downstream/logs).

### 8. Workflow DoS/Information Leakage (High)

- `apps/electron/src/main/modules/workflow/workflow-executor.ts:210` -- Strengthen graph validation (robust cycle detection, node/edge limits, timeout/step limits).
- `apps/electron/src/main/modules/workflow/hook.service.ts:206` -- Limit hook script CPU/memory consumption, execution count, and maximum output.
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts:39` -- Remove sensitive information from context/logs (minimum meta only).
- `apps/electron/src/main/modules/workflow/workflow.service.ts:119` -- Strengthen validation during activation (make structure/load/permission checks mandatory).

### Supplementary (Recommended Cross-Cutting Measures)

- `apps/electron/src/main.ts:295` -- CSP should prohibit unsafe-eval/unsafe-inline in production. Relax only during development.
- ~~`McpAppsManager.tsx:303` -- Remove dangerouslySetInnerHTML or apply strict sanitization~~ **DONE** (component removed; SVG sanitization now applied in `ClientStatusIcon.tsx` and `UnifiedSkillDetailSheet.tsx`).
- Introduce input schema validation (zod, etc.), authorization guards, and rate limiting to all IPCs. Always mask sensitive information in logs.
