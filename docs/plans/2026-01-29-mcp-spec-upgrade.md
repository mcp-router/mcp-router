# MCP Spec 2025-11-25 Upgrade Implementation Plan

> **STATUS: Phase 1 COMPLETED, Phases 2-5 DEFERRED**

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade mcp-router to MCP specification 2025-11-25, implementing tool annotations, structured output, OAuth RFC 8707, elicitation passthrough, and resource links.

**Architecture:** Phased implementation starting with zero-risk type additions, then security hardening, then advanced features. All changes maintain backward compatibility. Use passthrough pattern for new MCP features (router forwards, doesn't process).

**Tech Stack:** TypeScript, MCP SDK 1.25.1+, Electron, SQLite

---

## Phase 1: Quick Wins (Tool Annotations + Structured Output)

### Task 1.1: Add MCPToolAnnotations Type [DONE]

**Files:**
- Modify: `packages/shared/src/types/mcp-types.ts:39-44`

**Step 1: Write the type definition**

Add after line 44 (after MCPTool interface):

```typescript
/**
 * Tool annotations for behavioral hints (MCP 2025-06-18 spec)
 * These are HINTS only - never rely on them for security decisions
 */
export interface MCPToolAnnotations {
  /** Human-readable title for UI display */
  title?: string;
  /** Tool does not modify environment (default: false) */
  readOnlyHint?: boolean;
  /** Tool may perform destructive updates (default: true when readOnlyHint=false) */
  destructiveHint?: boolean;
  /** Repeated calls with same args have no additional effect (default: false) */
  idempotentHint?: boolean;
  /** Tool interacts with external entities (default: true) */
  openWorldHint?: boolean;
}
```

**Step 2: Update MCPTool interface**

Replace lines 39-44:

```typescript
export interface MCPTool {
  name: string;
  description?: string;
  enabled?: boolean;
  inputSchema?: any;
  /** Output schema for structured tool results (MCP 2025-06-18) */
  outputSchema?: any;
  /** Behavioral hints for clients (MCP 2025-06-18) */
  annotations?: MCPToolAnnotations;
}
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS (no errors)

**Step 4: Commit**

```bash
git add packages/shared/src/types/mcp-types.ts
git commit -m "$(cat <<'EOF'
feat(types): add MCPToolAnnotations and outputSchema to MCPTool

Adds MCP 2025-06-18 spec support for tool annotations (readOnlyHint,
destructiveHint, etc.) and structured output schema. These are passed
through from upstream servers via spread operator - no functional
changes needed in aggregation code.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Update ToolInfo Type for Catalog [DONE]

**Files:**
- Modify: `packages/shared/src/types/tool-catalog-types.ts:4-14`

**Step 1: Update ToolInfo interface**

Replace lines 4-14:

```typescript
/**
 * Tool information for search.
 */
export interface ToolInfo {
  toolKey: string; // `${serverId}:${toolName}`
  serverId: string;
  toolName: string;
  serverName: string;
  projectId: string | null;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { description?: string }>;
  };
  /** Output schema for structured results (MCP 2025-06-18) */
  outputSchema?: any;
  /** Behavioral hints from upstream server (MCP 2025-06-18) */
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}
```

**Step 2: Update SearchResult interface**

Replace lines 22-30:

```typescript
export interface SearchResult {
  toolName: string;
  serverId: string;
  serverName: string;
  projectId: string | null;
  description?: string;
  relevance: number; // 0-1 normalized score
  explanation?: string; // Optional explanation (e.g., selection reason)
  /** Output schema for structured results */
  outputSchema?: any;
  /** Behavioral hints from upstream server */
  annotations?: ToolInfo["annotations"];
}
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/types/tool-catalog-types.ts
git commit -m "$(cat <<'EOF'
feat(types): add outputSchema and annotations to ToolInfo/SearchResult

Enables tool catalog to pass through MCP 2025-06-18 structured output
schemas and behavioral annotations from upstream servers.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Pass Annotations Through Tool Catalog Service [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts:127-135`

**Step 1: Update collectAvailableTools to include annotations**

Replace lines 127-135:

```typescript
          tools.push({
            toolKey: `${serverId}:${tool.name}`,
            serverId,
            toolName: tool.name,
            serverName,
            projectId: server.projectId ?? null,
            description: tool.description,
            inputSchema: tool.inputSchema as ToolInfo["inputSchema"],
            outputSchema: tool.outputSchema,
            annotations: tool.annotations as ToolInfo["annotations"],
          });
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts
git commit -m "$(cat <<'EOF'
feat(tool-catalog): pass through outputSchema and annotations

Tool catalog now includes structured output schemas and behavioral
annotations when collecting tools from upstream servers.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Include Annotations in Discovery Results [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts:243-250`

**Step 1: Update handleToolDiscovery result mapping**

Replace lines 243-250:

```typescript
        const results = response.results.map((result) => ({
          toolKey: this.buildToolKey(result.serverId, result.toolName),
          toolName: result.toolName,
          serverName: result.serverName,
          description: result.description,
          relevance: result.relevance,
          explanation: result.explanation,
          outputSchema: result.outputSchema,
          annotations: result.annotations,
        }));
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts
git commit -m "$(cat <<'EOF'
feat(tool-catalog): include outputSchema and annotations in discovery

tool_discovery results now include structured output schemas and
behavioral annotations for better client decision-making.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Verify Protocol Header (SDK Check) [DONE]

**Files:**
- Read only: `node_modules/@modelcontextprotocol/sdk/`

**Step 1: Verify SDK handles protocol version header**

Run: `grep -r "mcp-protocol-version" node_modules/@modelcontextprotocol/sdk/`
Expected: Multiple matches showing header handling in transport code

**Step 2: Document finding**

No code changes needed - SDK 1.25.1 automatically handles MCP-Protocol-Version header.

**Step 3: Commit documentation update**

```bash
echo "# MCP Protocol Version Header\n\nThe MCP-Protocol-Version header is automatically handled by @modelcontextprotocol/sdk v1.25.1+.\nNo manual implementation required in mcp-router." >> docs/adr/MCP_PROTOCOL_VERSION.md
git add docs/adr/MCP_PROTOCOL_VERSION.md
git commit -m "$(cat <<'EOF'
docs: document SDK handling of MCP-Protocol-Version header

MCP 2025-06-18 requires MCP-Protocol-Version header on HTTP requests.
This is automatically handled by the SDK transport layer.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Security Hardening (OAuth + URL Validation)

### Task 2.1: Create URL Validation Utility [PENDING]

**Files:**
- Create: `apps/electron/src/main/utils/url-validation-utils.ts`

**Step 1: Write the URL validation utility**

```typescript
/**
 * URL validation utilities for security
 * Prevents SSRF attacks by validating URLs before use
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '169.254.169.254', // AWS metadata
  'metadata.google.internal', // GCP metadata
]);

const BLOCKED_HOST_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,     // 10.x.x.x
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16-31.x.x
  /^192\.168\.\d{1,3}\.\d{1,3}$/,         // 192.168.x.x
];

export interface URLValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Validate a URL for safety (prevents SSRF)
 */
export function validateExternalUrl(url: string): URLValidationResult {
  try {
    const parsed = new URL(url);

    // Must be HTTPS in production
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { isValid: false, error: 'URL must use http or https protocol' };
    }

    // Block internal hosts
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname)) {
      return { isValid: false, error: 'Internal hosts are not allowed' };
    }

    // Block private IP ranges
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return { isValid: false, error: 'Private IP ranges are not allowed' };
      }
    }

    // Block file:// and other dangerous protocols
    if (parsed.protocol === 'file:') {
      return { isValid: false, error: 'File protocol is not allowed' };
    }

    return { isValid: true, normalizedUrl: parsed.toString() };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate URL for elicitation (stricter - must be HTTPS)
 */
export function validateElicitationUrl(url: string): URLValidationResult {
  const result = validateExternalUrl(url);
  if (!result.isValid) return result;

  const parsed = new URL(url);

  // Elicitation URLs must be HTTPS (security requirement)
  if (parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Elicitation URLs must use HTTPS' };
  }

  return result;
}
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/electron/src/main/utils/url-validation-utils.ts
git commit -m "$(cat <<'EOF'
feat(security): add URL validation utility for SSRF prevention

Adds validateExternalUrl() and validateElicitationUrl() to block:
- Internal hosts (localhost, 127.0.0.1, etc.)
- Private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Cloud metadata endpoints
- Non-HTTPS URLs for elicitation

Addresses SECURITY.md item #2: SSRF via URL Injection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Add Token Expiration Support [PENDING]

**Files:**
- Modify: `packages/shared/src/types/token-types.ts`
- Modify: `apps/electron/src/main/modules/mcp-apps-manager/token-manager.ts`

**Step 1: Update Token type to include expiration**

In `packages/shared/src/types/token-types.ts`, add to Token interface:

```typescript
export interface Token {
  id: string;
  clientId: string;
  issuedAt: number;
  /** Token expiration timestamp (seconds since epoch) */
  expiresAt?: number;
  serverAccess: TokenServerAccess;
}
```

**Step 2: Update TokenManager.validateToken() to check expiration**

In `apps/electron/src/main/modules/mcp-apps-manager/token-manager.ts`, replace validateToken method (lines 51-65):

```typescript
  /**
   * Validate token including expiration check
   */
  public validateToken(tokenId: string): TokenValidationResult {
    const token = McpAppsManagerRepository.getInstance().getToken(tokenId);

    if (!token) {
      return {
        isValid: false,
        error: "Token not found",
      };
    }

    // Check expiration if set
    if (token.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (now > token.expiresAt) {
        return {
          isValid: false,
          error: "Token has expired",
        };
      }
    }

    return {
      isValid: true,
      clientId: token.clientId,
    };
  }
```

**Step 3: Update generateToken to set expiration**

In the same file, update generateToken (after line 40):

```typescript
    // Set default expiration to 24 hours if not specified
    const defaultExpirationSeconds = 24 * 60 * 60;
    const expiresAt = options.expiresAt ?? (now + defaultExpirationSeconds);

    const token: Token = {
      id: "mcpr_" + randomBytes,
      clientId,
      issuedAt: now,
      expiresAt,
      serverAccess: options.serverAccess || {},
    };
```

**Step 4: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types/token-types.ts apps/electron/src/main/modules/mcp-apps-manager/token-manager.ts
git commit -m "$(cat <<'EOF'
feat(security): add token expiration support

Tokens now have optional expiresAt field, defaulting to 24 hours.
validateToken() checks expiration before returning valid.

Addresses SECURITY.md item #3: Token Management vulnerabilities

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Add Resource Indicators Type (RFC 8707 Prep) [PENDING]

**Files:**
- Modify: `packages/shared/src/types/token-types.ts`

**Step 1: Add resource indicator type**

Add to token-types.ts:

```typescript
/**
 * OAuth 2.1 Resource Indicators (RFC 8707)
 * Used to restrict token scope to specific resource servers
 */
export interface TokenResourceIndicator {
  /** Resource server URI this token is valid for */
  resource: string;
  /** Scopes granted for this resource */
  scopes?: string[];
}

export interface Token {
  id: string;
  clientId: string;
  issuedAt: number;
  expiresAt?: number;
  serverAccess: TokenServerAccess;
  /** RFC 8707 resource indicators - restricts token to specific resources */
  resourceIndicators?: TokenResourceIndicator[];
}
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/shared/src/types/token-types.ts
git commit -m "$(cat <<'EOF'
feat(types): add RFC 8707 resource indicator types

Prepares for OAuth 2.1 compliance with resource indicators.
Tokens can now specify which resource servers they're valid for.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Elicitation Support

### Task 3.1: Add Elicitation Types [PENDING]

**Files:**
- Create: `packages/shared/src/types/elicitation-types.ts`

**Step 1: Write elicitation type definitions**

```typescript
/**
 * MCP Elicitation Types (MCP 2025-06-18 / 2025-11-25 spec)
 * Enables servers to request user input through the client
 */

/**
 * Elicitation mode - how user input is collected
 */
export type ElicitationMode = 'form' | 'url';

/**
 * Base elicitation request
 */
export interface ElicitationRequestBase {
  /** Unique identifier for this elicitation */
  elicitationId: string;
  /** Human-readable message explaining what's needed */
  message: string;
}

/**
 * Form mode elicitation - structured input via JSON Schema
 */
export interface FormElicitationRequest extends ElicitationRequestBase {
  mode: 'form';
  /** JSON Schema for the form fields */
  schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * URL mode elicitation - redirect to external URL (OAuth, etc.)
 */
export interface UrlElicitationRequest extends ElicitationRequestBase {
  mode: 'url';
  /** External URL for user to complete action */
  url: string;
}

export type ElicitationRequest = FormElicitationRequest | UrlElicitationRequest;

/**
 * User action in response to elicitation
 */
export type ElicitationAction = 'accept' | 'decline' | 'cancel';

/**
 * Response to form elicitation
 */
export interface FormElicitationResponse {
  action: ElicitationAction;
  /** Form data if action is 'accept' */
  content?: Record<string, unknown>;
}

/**
 * Response to URL elicitation (user consented to open URL)
 */
export interface UrlElicitationResponse {
  action: ElicitationAction;
}

/**
 * Elicitation completion notification
 */
export interface ElicitationCompleteNotification {
  elicitationId: string;
}

/**
 * Internal state for tracking elicitations through the proxy
 */
export interface ElicitationState {
  elicitationId: string;
  clientSessionId: string;
  backendServerId: string;
  mode: ElicitationMode;
  createdAt: number;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
}

/**
 * MCP Error code for URL elicitation required
 */
export const URL_ELICITATION_REQUIRED_ERROR = -32042;
```

**Step 2: Export from index**

Add to `packages/shared/src/types/index.ts`:

```typescript
export * from './elicitation-types';
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/types/elicitation-types.ts packages/shared/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add MCP elicitation types

Adds type definitions for MCP 2025-06-18/2025-11-25 elicitation:
- Form mode (structured JSON Schema input)
- URL mode (OAuth redirects, external flows)
- State tracking for proxy passthrough
- Error codes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Add Elicitation State Manager [PENDING]

**Files:**
- Create: `apps/electron/src/main/modules/mcp-server-runtime/elicitation-manager.ts`

**Step 1: Write the elicitation state manager**

```typescript
/**
 * Manages elicitation state for proxy passthrough
 */
import { ElicitationState, ElicitationMode } from '@mcp_router/shared';

const ELICITATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class ElicitationManager {
  private states: Map<string, ElicitationState> = new Map();

  /**
   * Create a new elicitation state entry
   */
  public createElicitation(
    elicitationId: string,
    clientSessionId: string,
    backendServerId: string,
    mode: ElicitationMode,
  ): ElicitationState {
    this.cleanupExpired();

    const state: ElicitationState = {
      elicitationId,
      clientSessionId,
      backendServerId,
      mode,
      createdAt: Date.now(),
      status: 'pending',
    };

    this.states.set(elicitationId, state);
    return state;
  }

  /**
   * Get elicitation state by ID
   */
  public getElicitation(elicitationId: string): ElicitationState | undefined {
    const state = this.states.get(elicitationId);
    if (!state) return undefined;

    // Check if expired
    if (Date.now() - state.createdAt > ELICITATION_TTL_MS) {
      state.status = 'expired';
      this.states.delete(elicitationId);
      return undefined;
    }

    return state;
  }

  /**
   * Mark elicitation as completed
   */
  public completeElicitation(elicitationId: string): boolean {
    const state = this.states.get(elicitationId);
    if (!state) return false;

    state.status = 'completed';
    this.states.delete(elicitationId);
    return true;
  }

  /**
   * Cancel an elicitation
   */
  public cancelElicitation(elicitationId: string): boolean {
    const state = this.states.get(elicitationId);
    if (!state) return false;

    state.status = 'cancelled';
    this.states.delete(elicitationId);
    return true;
  }

  /**
   * Get client session for an elicitation (for notification routing)
   */
  public getClientSession(elicitationId: string): string | undefined {
    return this.getElicitation(elicitationId)?.clientSessionId;
  }

  /**
   * Get backend server for an elicitation (for forwarding)
   */
  public getBackendServer(elicitationId: string): string | undefined {
    return this.getElicitation(elicitationId)?.backendServerId;
  }

  /**
   * Cleanup expired elicitations
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, state] of this.states) {
      if (now - state.createdAt > ELICITATION_TTL_MS) {
        this.states.delete(id);
      }
    }
  }
}

// Singleton instance
let instance: ElicitationManager | null = null;

export function getElicitationManager(): ElicitationManager {
  if (!instance) {
    instance = new ElicitationManager();
  }
  return instance;
}
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/elicitation-manager.ts
git commit -m "$(cat <<'EOF'
feat(elicitation): add state manager for proxy passthrough

Tracks elicitation requests through the proxy for:
- Client session -> elicitation ID mapping
- Backend server -> elicitation ID mapping
- Expiration handling (10 minute TTL)
- Completion/cancellation tracking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.3: Add Elicitation Capability to Aggregator [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts:47-53`

**Step 1: Update capabilities declaration**

Replace lines 47-53:

```typescript
        {
          capabilities: {
            resources: {},
            tools: {},
            prompts: {},
            // Enable elicitation passthrough (MCP 2025-06-18/2025-11-25)
            elicitation: {
              form: {},
              url: {},
            },
          },
        },
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts
git commit -m "$(cat <<'EOF'
feat(aggregator): declare elicitation capability

Advertises support for both form and URL mode elicitation.
Actual handler implementation in separate task.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.4: Add Elicitation Request Handler [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`

**Step 1: Add import for elicitation manager**

Add after line 23:

```typescript
import { getElicitationManager } from './elicitation-manager';
import { validateElicitationUrl } from '@/main/utils/url-validation-utils';
import type { ElicitationRequest } from '@mcp_router/shared';
```

**Step 2: Add handleElicitationCreate method**

Add new method to RequestHandlers class:

```typescript
  /**
   * Handle elicitation/create request (passthrough to client)
   * Routes elicitation requests from backend servers to the connected client
   */
  public async handleElicitationCreate(
    request: any,
    backendServerId: string,
  ): Promise<any> {
    const elicitationId = request.params?.elicitationId;
    const mode = request.params?.mode;
    const message = request.params?.message;

    if (!elicitationId || !mode) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'elicitationId and mode are required',
      );
    }

    // For URL mode, validate the URL for security
    if (mode === 'url') {
      const url = request.params?.url;
      if (!url) {
        throw new McpError(ErrorCode.InvalidRequest, 'URL is required for url mode');
      }

      const validation = validateElicitationUrl(url);
      if (!validation.isValid) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid elicitation URL: ${validation.error}`,
        );
      }
    }

    // Track the elicitation for notification routing
    const clientSessionId = request.params?._meta?.sessionId || 'default';
    getElicitationManager().createElicitation(
      elicitationId,
      clientSessionId,
      backendServerId,
      mode,
    );

    // Forward to client (the aggregator server will handle this)
    // Return the request for the aggregator to forward
    return {
      method: 'elicitation/create',
      params: {
        elicitationId,
        mode,
        message,
        ...(mode === 'form' && { schema: request.params.schema }),
        ...(mode === 'url' && { url: request.params.url }),
      },
    };
  }

  /**
   * Handle elicitation completion notification from client
   */
  public handleElicitationComplete(elicitationId: string): void {
    getElicitationManager().completeElicitation(elicitationId);
  }
```

**Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts
git commit -m "$(cat <<'EOF'
feat(elicitation): add passthrough request handler

Handles elicitation/create requests from backend servers:
- Validates URL mode URLs for security (SSRF prevention)
- Tracks elicitation state for notification routing
- Forwards requests to connected client

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Resource Links in Tool Results

### Task 4.1: Add Resource Link Transformation Utility [PENDING]

**Files:**
- Modify: `apps/electron/src/main/utils/uri-utils.ts`

**Step 1: Add resource link transformation function**

Add after line 70:

```typescript
/**
 * Transform resource URIs in tool results to use router's namespace
 * This ensures resource links in tool results point to the router, not backend servers
 */
export function transformResourceLinksInResult(
  result: any,
  serverName: string,
): any {
  if (!result) return result;

  // Handle array of content items
  if (Array.isArray(result.content)) {
    return {
      ...result,
      content: result.content.map((item: any) =>
        transformResourceContentItem(item, serverName)
      ),
    };
  }

  return result;
}

/**
 * Transform a single content item that may contain resource links
 */
function transformResourceContentItem(item: any, serverName: string): any {
  if (!item || typeof item !== 'object') return item;

  // Handle resource type content
  if (item.type === 'resource' && item.resource?.uri) {
    return {
      ...item,
      resource: {
        ...item.resource,
        uri: createResourceUri(serverName, item.resource.uri),
      },
    };
  }

  // Handle embedded resources in text
  if (item.type === 'text' && item.annotations?.resourceLinks) {
    return {
      ...item,
      annotations: {
        ...item.annotations,
        resourceLinks: item.annotations.resourceLinks.map((link: any) => ({
          ...link,
          uri: createResourceUri(serverName, link.uri),
        })),
      },
    };
  }

  return item;
}
```

**Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/electron/src/main/utils/uri-utils.ts
git commit -m "$(cat <<'EOF'
feat(uri-utils): add resource link transformation for tool results

Transforms resource URIs in tool results to use router's namespace.
This ensures clients can access resources via the router's
aggregated resource endpoints.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2: Apply Resource Link Transformation to Tool Calls [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`

**Step 1: Add import to request-handlers.ts**

Add to imports:

```typescript
import { transformResourceLinksInResult } from '@/main/utils/uri-utils';
```

**Step 2: Transform results in handleLegacyToolCall**

In handleLegacyToolCall, wrap the return (around line 752-763):

```typescript
      async () => {
        const result = await client.callTool(
          {
            name: originalToolName,
            arguments: request.params.arguments || {},
          },
          undefined,
          {
            timeout: 60 * 60 * 1000, // 60 minutes
            resetTimeoutOnProgress: true,
          },
        );
        // Transform resource links to use router's namespace
        return transformResourceLinksInResult(result, serverName);
      },
```

**Step 3: Add import to tool-catalog-handler.ts**

Add to imports:

```typescript
import { transformResourceLinksInResult } from '@/main/utils/uri-utils';
```

**Step 4: Transform results in handleToolExecute**

In handleToolExecute, wrap the return (around line 333-344):

```typescript
      async () => {
        const result = await client.callTool(
          {
            name: toolName,
            arguments: toolArguments,
          },
          undefined,
          {
            timeout: 60 * 60 * 1000, // 60 minutes
            resetTimeoutOnProgress: true,
          },
        );
        // Transform resource links to use router's namespace
        return transformResourceLinksInResult(result, serverName);
      },
```

**Step 5: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts
git commit -m "$(cat <<'EOF'
feat(tools): transform resource links in tool results

Tool results now have resource URIs transformed to use the router's
namespace, enabling clients to access embedded resources via the
router's aggregated resource endpoints.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Final Verification & Cleanup

### Task 5.1: Run Full Type Check [PENDING]

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS with no errors

### Task 5.2: Run Knip for Unused Code [PENDING]

**Step 1: Run knip**

Run: `pnpm knip`
Expected: No new unused exports from our changes

### Task 5.3: Run Linting [PENDING]

**Step 1: Run lint fix**

Run: `pnpm lint:fix`
Expected: Auto-fixes applied, no blocking errors

### Task 5.4: Update Documentation [PENDING]

**Files:**
- Modify: `docs/SECURITY.md`

**Step 1: Add section for implemented mitigations**

Add at the end of SECURITY.md:

```markdown
## Implemented Mitigations (2026-01-29)

### URL Validation (Addresses #2: SSRF)
- Added `url-validation-utils.ts` with `validateExternalUrl()` and `validateElicitationUrl()`
- Blocks internal hosts, private IP ranges, and cloud metadata endpoints
- Enforces HTTPS for elicitation URLs

### Token Expiration (Addresses #3: Token Management)
- Tokens now have optional `expiresAt` field
- Default expiration: 24 hours
- `validateToken()` checks expiration before returning valid

### Elicitation URL Security
- All URL mode elicitation requests validated before forwarding
- Only HTTPS URLs allowed for elicitation
```

**Step 2: Commit**

```bash
git add docs/SECURITY.md
git commit -m "$(cat <<'EOF'
docs: update SECURITY.md with implemented mitigations

Documents URL validation and token expiration features
that address SSRF and token management vulnerabilities.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Phase | Tasks | Effort | Risk |
|-------|-------|--------|------|
| 1. Quick Wins | 5 tasks | ~4 hours | Low |
| 2. Security | 3 tasks | ~6 hours | Medium |
| 3. Elicitation | 4 tasks | ~8 hours | Medium |
| 4. Resource Links | 2 tasks | ~4 hours | Low |
| 5. Verification | 4 tasks | ~2 hours | Low |

**Total: 18 tasks, ~24 hours**

---

## Deferred Items (Phase 5+)

These were researched but deferred based on agent recommendations:

1. **Sampling/CreateMessage** - Architectural mismatch with router; defer until ecosystem demand
2. **Roots Capability** - Not useful for aggregator; skip
3. **Tasks (Experimental)** - Wait for spec stabilization
4. **Full RFC 8707 Implementation** - Types added; full implementation requires auth service refactor
