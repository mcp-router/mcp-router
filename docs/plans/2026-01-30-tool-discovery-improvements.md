# Tool Discovery Improvements Implementation Plan

> **STATUS: COMPLETED**

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve MCP Router tool discovery for 200+ tools across 10+ servers, with universal compatibility for Claude Desktop, Claude Code, Cursor (40 tool limit), OpenCode, Gemini CLI, and Codex.

**Architecture:** Conservative 40-tool default using meta-tools pattern. All clients receive only 3 meta-tools (`tool_discovery`, `tool_execute`, `tool_capabilities`) by default, with unlimited tools accessible via discovery. Enhanced search with MiniSearch + CLI synonyms. Token efficiency via `detail_level` parameter.

**Tech Stack:** TypeScript, MiniSearch (29KB), Zod for config validation

---

## Phase 1: Token Efficiency & Meta-Tool Descriptions (P0)

### Task 1: Add DetailLevel Type and Update SearchRequest [DONE]

**Files:**
- Modify: `packages/shared/src/types/tool-catalog-types.ts`

**Step 1: Add DetailLevel enum and update types**

Add after line 24 (after ToolInfo interface):

```typescript
/**
 * Detail level for tool discovery responses.
 * - minimal: toolKey, toolName, serverName only (~5 tokens/tool)
 * - summary: + truncated description (~20 tokens/tool)
 * - full: + inputSchema, outputSchema, annotations (~100+ tokens/tool)
 */
export type DetailLevel = 'minimal' | 'summary' | 'full';

/**
 * Expiration metadata for tool discovery responses.
 */
export interface ExpirationMetadata {
  expiresAt: string; // ISO timestamp
  expiresInSeconds: number;
  ttlMinutes: number;
}
```

**Step 2: Update SearchRequest interface**

Replace the SearchRequest interface (lines 26-30):

```typescript
export interface SearchRequest {
  query: string[];
  context?: string;
  maxResults?: number;
  detailLevel?: DetailLevel;
  category?: string; // Filter by category
}
```

**Step 3: Update SearchResult for detail levels**

Replace SearchResult interface (lines 32-44):

```typescript
export interface SearchResult {
  toolKey: string; // Always included
  toolName: string; // Always included
  serverName: string; // Always included
  serverId: string;
  projectId: string | null;
  // summary+ level
  description?: string;
  relevance?: number; // 0-1 normalized score
  // full level only
  explanation?: string;
  inputSchema?: ToolInfo['inputSchema'];
  outputSchema?: any;
  annotations?: ToolInfo['annotations'];
}
```

**Step 4: Add SearchResponseMetadata**

Add after SearchResponse interface:

```typescript
export interface SearchResponseMetadata {
  query: string[];
  detailLevel: DetailLevel;
  resultCount: number;
  expiration: ExpirationMetadata;
}

export interface SearchResponseWithMetadata extends SearchResponse {
  metadata: SearchResponseMetadata;
}
```

**Step 5: Run type check**

Run: `pnpm typecheck`
Expected: May show errors in files that use these types (will fix in next tasks)

**Step 6: Commit**

```bash
git add packages/shared/src/types/tool-catalog-types.ts
git commit -m "feat(types): add DetailLevel and expiration metadata types

- Add DetailLevel enum (minimal/summary/full)
- Add ExpirationMetadata interface
- Update SearchRequest with detailLevel and category
- Update SearchResult for progressive disclosure
- Add SearchResponseWithMetadata

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create CLI Synonym Dictionary [DONE]

**Files:**
- Create: `packages/shared/src/utils/cli-synonyms.ts`

**Step 1: Create synonym dictionary file**

```typescript
/**
 * CLI synonym dictionary for expanding search queries.
 * Maps common terms to their synonyms/aliases used in CLI tools.
 */
export const CLI_SYNONYMS: Record<string, string[]> = {
  // File operations
  delete: ['remove', 'rm', 'trash', 'erase', 'unlink', 'del'],
  list: ['ls', 'show', 'display', 'enumerate', 'dir', 'll'],
  create: ['make', 'new', 'add', 'init', 'touch', 'mkdir', 'mkfile'],
  read: ['get', 'cat', 'view', 'show', 'display', 'fetch', 'load'],
  write: ['put', 'set', 'save', 'store', 'update', 'echo', 'output'],
  copy: ['cp', 'duplicate', 'clone', 'replicate'],
  move: ['mv', 'rename', 'relocate', 'transfer'],

  // Search/find
  find: ['search', 'locate', 'grep', 'query', 'lookup', 'seek'],
  filter: ['grep', 'select', 'match', 'where'],

  // Execution
  execute: ['run', 'exec', 'invoke', 'call', 'start', 'launch'],
  stop: ['kill', 'terminate', 'halt', 'end', 'quit', 'exit'],

  // Git operations
  commit: ['save', 'checkpoint', 'snapshot'],
  push: ['upload', 'sync', 'publish', 'deploy'],
  pull: ['download', 'fetch', 'sync', 'update'],
  branch: ['fork', 'diverge'],
  merge: ['combine', 'join', 'integrate'],
  diff: ['compare', 'changes', 'delta'],
  status: ['state', 'info', 'check'],

  // Navigation
  navigate: ['cd', 'go', 'change', 'switch'],
  back: ['previous', 'return', 'undo'],

  // Info/help
  info: ['about', 'details', 'describe', 'status', 'stat'],
  help: ['usage', 'manual', 'docs', 'guide', 'man'],

  // Common verbs
  open: ['launch', 'start', 'load', 'access'],
  close: ['quit', 'exit', 'end', 'shutdown'],
  edit: ['modify', 'change', 'update', 'alter'],
  check: ['verify', 'validate', 'test', 'inspect'],

  // Messaging/communication
  send: ['post', 'message', 'notify', 'transmit'],
  receive: ['get', 'fetch', 'retrieve', 'pull'],

  // Calendar/scheduling
  schedule: ['book', 'plan', 'calendar', 'event'],
  meeting: ['event', 'appointment', 'call'],
};

/**
 * Expand a query string with CLI synonyms.
 * @param query - Original search query
 * @param customSynonyms - Optional custom synonym mappings to merge
 * @returns Expanded query with synonyms
 */
export function expandQueryWithSynonyms(
  query: string,
  customSynonyms?: Record<string, string[]>
): string {
  const synonyms = customSynonyms
    ? { ...CLI_SYNONYMS, ...customSynonyms }
    : CLI_SYNONYMS;

  const terms = query.toLowerCase().split(/\s+/);
  const expanded = terms.flatMap(term => {
    // Check if this term is a key in synonyms
    const directSynonyms = synonyms[term] || [];

    // Also check if this term appears as a synonym value
    const reverseSynonyms: string[] = [];
    for (const [key, values] of Object.entries(synonyms)) {
      if (values.includes(term) && key !== term) {
        reverseSynonyms.push(key);
      }
    }

    return [term, ...directSynonyms, ...reverseSynonyms];
  });

  return [...new Set(expanded)].join(' ');
}

/**
 * Get all synonyms for a term (bidirectional lookup).
 */
export function getSynonymsFor(term: string): string[] {
  const lowerTerm = term.toLowerCase();
  const result = new Set<string>();

  // Direct lookup
  if (CLI_SYNONYMS[lowerTerm]) {
    CLI_SYNONYMS[lowerTerm].forEach(s => result.add(s));
  }

  // Reverse lookup
  for (const [key, values] of Object.entries(CLI_SYNONYMS)) {
    if (values.includes(lowerTerm)) {
      result.add(key);
      values.forEach(s => result.add(s));
    }
  }

  result.delete(lowerTerm); // Don't include the original term
  return Array.from(result);
}
```

**Step 2: Export from shared package**

Add to `packages/shared/src/index.ts`:

```typescript
export * from "./utils/cli-synonyms";
```

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/utils/cli-synonyms.ts packages/shared/src/index.ts
git commit -m "feat(shared): add CLI synonym dictionary for search expansion

- Add 50+ CLI term mappings (delete/rm, list/ls, etc.)
- Add expandQueryWithSynonyms() for query expansion
- Add getSynonymsFor() for bidirectional lookup
- Support custom synonym overrides

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Install and Configure MiniSearch [DONE]

**Files:**
- Modify: `apps/electron/package.json`
- Create: `apps/electron/src/main/modules/tool-catalog/minisearch-provider.ts`

**Step 1: Install MiniSearch**

Run: `cd apps/electron && pnpm add minisearch`
Expected: Package added to dependencies

**Step 2: Create MiniSearch provider**

Create `apps/electron/src/main/modules/tool-catalog/minisearch-provider.ts`:

```typescript
import MiniSearch from 'minisearch';
import type { ToolInfo, SearchResult, DetailLevel } from '@mcp_router/shared';
import { expandQueryWithSynonyms } from '@mcp_router/shared';
import type { SearchProvider, SearchProviderRequest } from './tool-catalog.service';

/**
 * CLI-aware tokenizer that preserves short commands like 'ls', 'rm', 'ps'.
 */
function cliTokenizer(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-./,;:!?()[\]{}'"]+/)
    .filter(token => token.length > 0); // Don't filter short tokens!
}

/**
 * Extract searchable text from a tool's input schema.
 */
function extractSchemaText(tool: ToolInfo): string {
  const props = tool.inputSchema?.properties;
  if (!props) return '';

  const parts: string[] = [];
  for (const [name, prop] of Object.entries(props)) {
    parts.push(name);
    if (prop.description) {
      parts.push(prop.description);
    }
  }
  return parts.join(' ');
}

/**
 * MiniSearch-based search provider with fuzzy matching and synonym expansion.
 */
export class MiniSearchProvider implements SearchProvider {
  private index: MiniSearch<ToolInfo> | null = null;
  private indexedTools: ToolInfo[] = [];
  private customSynonyms?: Record<string, string[]>;

  constructor(options?: { customSynonyms?: Record<string, string[]> }) {
    this.customSynonyms = options?.customSynonyms;
  }

  /**
   * Build or rebuild the search index from tools.
   */
  private buildIndex(tools: ToolInfo[]): MiniSearch<ToolInfo> {
    const index = new MiniSearch<ToolInfo>({
      fields: ['toolName', 'serverName', 'description', 'schemaText'],
      storeFields: ['toolKey', 'serverId', 'toolName', 'serverName', 'projectId', 'description', 'inputSchema', 'outputSchema', 'annotations'],
      tokenize: cliTokenizer,
      searchOptions: {
        boost: { toolName: 3, serverName: 2, description: 1.5, schemaText: 0.5 },
        fuzzy: 0.2, // Allow ~20% character difference for typo tolerance
        prefix: true, // Match prefixes
        combineWith: 'OR', // More inclusive results
      },
      // Custom extraction for schema text
      extractField: (document, fieldName) => {
        if (fieldName === 'schemaText') {
          return extractSchemaText(document);
        }
        return (document as any)[fieldName];
      },
    });

    // Add documents with unique IDs
    const docsWithIds = tools.map((tool, idx) => ({
      ...tool,
      id: idx,
      schemaText: extractSchemaText(tool),
    }));

    index.addAll(docsWithIds);
    return index;
  }

  /**
   * Search for tools matching the query.
   */
  public async search(request: SearchProviderRequest): Promise<SearchResult[]> {
    const { query, tools, maxResults = 20, detailLevel = 'summary' } = request;

    // Rebuild index if tools changed
    if (this.indexedTools !== tools || !this.index) {
      this.index = this.buildIndex(tools);
      this.indexedTools = tools;
    }

    // Expand query with synonyms
    const queryString = query.join(' ');
    const expandedQuery = expandQueryWithSynonyms(queryString, this.customSynonyms);

    // Search
    const searchResults = this.index.search(expandedQuery, { limit: maxResults });

    if (searchResults.length === 0) {
      return [];
    }

    // Normalize scores to 0-1 range
    const maxScore = searchResults[0].score;

    return searchResults.map(result => {
      const tool = tools.find(t => t.toolKey === result.toolKey) || result as unknown as ToolInfo;
      return this.formatResult(tool, result.score / maxScore, detailLevel);
    });
  }

  /**
   * Format a search result based on detail level.
   */
  private formatResult(
    tool: ToolInfo,
    relevance: number,
    detailLevel: DetailLevel
  ): SearchResult {
    // Minimal: just identification
    const minimal: SearchResult = {
      toolKey: tool.toolKey,
      toolName: tool.toolName,
      serverName: tool.serverName,
      serverId: tool.serverId,
      projectId: tool.projectId,
    };

    if (detailLevel === 'minimal') {
      return minimal;
    }

    // Summary: add truncated description and relevance
    const summary: SearchResult = {
      ...minimal,
      description: tool.description?.substring(0, 150),
      relevance,
    };

    if (detailLevel === 'summary') {
      return summary;
    }

    // Full: everything
    return {
      ...summary,
      description: tool.description, // Full description
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    };
  }
}
```

**Step 3: Update SearchProviderRequest type**

Modify `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts` lines 14-19:

```typescript
/**
 * Search request parameters for search providers.
 */
export type SearchProviderRequest = {
  query: string[];
  context?: string;
  tools: ToolInfo[];
  maxResults?: number;
  detailLevel?: DetailLevel;
};
```

Add import at top:
```typescript
import type { DetailLevel } from '@mcp_router/shared';
```

**Step 4: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/electron/package.json apps/electron/pnpm-lock.yaml apps/electron/src/main/modules/tool-catalog/minisearch-provider.ts apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts
git commit -m "feat(search): add MiniSearch provider with fuzzy matching

- Install minisearch (29KB)
- Add MiniSearchProvider with CLI-aware tokenizer
- Preserve short tokens (ls, rm, ps) unlike BM25
- Add fuzzy matching (~20% tolerance)
- Integrate synonym expansion
- Support detail levels in results

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Rewrite Meta-Tool Descriptions [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`

**Step 1: Replace META_TOOLS constant (lines 24-72)**

```typescript
export const META_TOOLS: MCPTool[] = [
  {
    name: "tool_discovery",
    description: `REQUIRED FIRST STEP: Search for available tools before execution.

You have access to 200+ tools across multiple servers, but they are NOT listed directly to save context space.

WORKFLOW (you MUST follow this):
1. Call tool_discovery with keywords describing what you need
2. Review the returned tools and their toolKeys
3. Use tool_execute with the exact toolKey to run a tool

AVAILABLE SERVERS: Slack, GitHub, Notion, Google Workspace, filesystem, git, and more.

EXAMPLE QUERIES:
- ["send", "slack", "message"] → Slack messaging tools
- ["github", "pull", "request"] → GitHub PR tools
- ["read", "file"] → File reading tools
- ["calendar", "events"] → Calendar tools

PARAMETERS:
- query (required): Keywords array describing functionality needed
- detailLevel (optional): "minimal" | "summary" | "full" (default: summary)
- maxResults (optional): Max results to return (default: 10, max: 100)
- category (optional): Filter by category from tool_capabilities

ERROR RECOVERY:
- If toolKey expires, call tool_discovery again with the same query
- Use tool_capabilities first if unsure what categories exist`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "array",
          items: { type: "string" },
          description: "Keywords describing the functionality you need.",
        },
        detailLevel: {
          type: "string",
          enum: ["minimal", "summary", "full"],
          description: "Response detail level. minimal=~5 tokens/tool, summary=~20, full=~100+",
        },
        maxResults: {
          type: "number",
          description: "Maximum results (default: 10, max: 100).",
        },
        category: {
          type: "string",
          description: "Filter by category (use tool_capabilities to see categories).",
        },
        context: {
          type: "string",
          description: "Your current task context to improve relevance.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "tool_execute",
    description: `Execute a discovered tool using its toolKey.

PREREQUISITE: You must first call tool_discovery to obtain a valid toolKey.

PARAMETERS:
- toolKey (required): Exact key from tool_discovery results (UUID format)
- arguments (required): Tool-specific parameters as JSON object

ERROR RECOVERY:
- "toolKey has expired" → Call tool_discovery again with same query, use new toolKey
- "toolKey not found" → Verify toolKey matches exactly from discovery results
- "permission denied" → Tool requires elevated access, check tool_capabilities

IMPORTANT: toolKeys expire after 60 minutes. If you cached a toolKey and get an expiration error, simply re-run tool_discovery.`,
    inputSchema: {
      type: "object",
      properties: {
        toolKey: {
          type: "string",
          description: "Tool identifier (UUID) from tool_discovery results.",
        },
        arguments: {
          type: "object",
          description: "Arguments to pass to the tool.",
        },
      },
      required: ["toolKey"],
    },
  },
  {
    name: "tool_capabilities",
    description: `Browse available tool categories and servers WITHOUT consuming context.

Use this for high-level exploration BEFORE detailed search:
- "What kinds of tools are available?"
- "What can the GitHub server do?"
- "Show me messaging capabilities"

Returns categories with tool counts and example operations.
Does NOT return executable toolKeys—use tool_discovery for that.

WORKFLOW:
1. Call tool_capabilities to see what's available
2. Call tool_discovery with specific category or keywords
3. Call tool_execute with discovered toolKey`,
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "Filter to a specific server (e.g., 'github', 'slack').",
        },
        category: {
          type: "string",
          description: "Filter to a specific category.",
        },
      },
      required: [],
    },
  },
];
```

**Step 2: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts
git commit -m "feat(meta-tools): rewrite descriptions with workflow enforcement

- Add REQUIRED FIRST STEP language to tool_discovery
- Add numbered workflow steps (1, 2, 3)
- Include ERROR RECOVERY instructions in descriptions
- Add detailLevel parameter to tool_discovery
- Add tool_capabilities meta-tool for hierarchical browsing
- List available servers and example queries

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Implement detail_level in Discovery Handler [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`

**Step 1: Add imports and TTL config at top of file**

After line 14, add:

```typescript
import type { DetailLevel, ExpirationMetadata } from "@mcp_router/shared";

// Configurable TTL (can be overridden via config in future)
const TOOL_KEY_TTL_MINUTES = 60;
const TOOL_KEY_TTL_MS = TOOL_KEY_TTL_MINUTES * 60 * 1000;
```

Remove the old `TOOL_KEY_TTL_MS` constant (line 22).

**Step 2: Add helper method for expiration metadata**

Add after `cleanupExpiredToolKeys()` method (around line 190):

```typescript
  private buildExpirationMetadata(): ExpirationMetadata {
    const now = Date.now();
    const expiresAt = new Date(now + TOOL_KEY_TTL_MS);
    return {
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: TOOL_KEY_TTL_MINUTES * 60,
      ttlMinutes: TOOL_KEY_TTL_MINUTES,
    };
  }
```

**Step 3: Update handleToolDiscovery to use detailLevel**

Replace the `handleToolDiscovery` method (lines 199-265):

```typescript
  /**
   * Handle tool_discovery request.
   */
  public async handleToolDiscovery(request: any): Promise<any> {
    const token = request.params._meta?.token as string | undefined;
    const projectId = this.normalizeProjectId(request.params._meta?.projectId);
    const { clientId, token: validatedToken } = this.requireValidToken(token);

    const args = request.params.arguments || {};
    const rawQuery = args.query;
    const query = Array.isArray(rawQuery)
      ? rawQuery.filter((q): q is string => typeof q === "string")
      : [];
    if (query.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, "Query is required");
    }

    const context = typeof args.context === "string" ? args.context : undefined;
    const maxResults = typeof args.maxResults === "number" ? args.maxResults : 10;
    const detailLevel: DetailLevel =
      args.detailLevel === "minimal" || args.detailLevel === "full"
        ? args.detailLevel
        : "summary";
    const category = typeof args.category === "string" ? args.category : undefined;

    const optimization = this.getProjectOptimization(projectId);

    return await this.executeWithHooksAndLogging(
      "tools/discovery",
      { query, context, maxResults, detailLevel, category },
      clientId,
      AGGREGATOR_SERVER_NAME,
      "ToolDiscovery",
      async () => {
        const allowedServerIds = new Set<string>();
        for (const serverId of this.servers.keys()) {
          if (this.tokenValidator.hasServerAccess(validatedToken, serverId)) {
            allowedServerIds.add(serverId);
          }
        }

        const response = await this.toolCatalogService.searchTools(
          { query, context, maxResults, detailLevel, category },
          {
            projectId,
            allowedServerIds,
            toolCatalogEnabled: !!optimization,
          },
        );

        // Format results based on detail level
        const results = response.results.map((result) => {
          const toolKey = this.buildToolKey(result.serverId, result.toolName);

          // Minimal: just identification
          const minimal = {
            toolKey,
            toolName: result.toolName,
            serverName: result.serverName,
          };

          if (detailLevel === "minimal") {
            return minimal;
          }

          // Summary: add description and relevance
          const summary = {
            ...minimal,
            description: result.description?.substring(0, 150),
            relevance: result.relevance,
          };

          if (detailLevel === "summary") {
            return summary;
          }

          // Full: everything
          return {
            ...summary,
            description: result.description,
            serverId: result.serverId,
            explanation: result.explanation,
            outputSchema: result.outputSchema,
            annotations: result.annotations,
          };
        });

        // Build response with metadata
        const expiration = this.buildExpirationMetadata();
        const responsePayload = {
          tools: results,
          metadata: {
            query,
            detailLevel,
            resultCount: results.length,
            expiration,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(responsePayload, null, 2),
            },
          ],
        };
      },
    );
  }
```

**Step 4: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts
git commit -m "feat(discovery): implement detailLevel parameter

- Add detailLevel support (minimal/summary/full)
- minimal: ~5 tokens/tool (toolKey, toolName, serverName)
- summary: ~20 tokens/tool (+ truncated description, relevance)
- full: ~100+ tokens/tool (+ schemas, annotations)
- Include expiration metadata in response
- Add configurable TTL constant

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Improve Error Messages with Recovery Hints [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`

**Step 1: Add error helper method**

Add after `buildExpirationMetadata()` method:

```typescript
  /**
   * Create an actionable error with recovery hints.
   */
  private createActionableError(
    code: ErrorCode,
    type: string,
    message: string,
    recovery: {
      action: string;
      steps: string[];
      hint?: string;
      suggestedTools?: string[];
    }
  ): McpError {
    const errorData = {
      errorType: type,
      recoveryAction: recovery.action,
      recoverySteps: recovery.steps,
      hint: recovery.hint,
      suggestedTools: recovery.suggestedTools,
    };

    // Include recovery info in the message for LLMs that don't parse error data
    const fullMessage = `${message}\n\nRECOVERY: ${recovery.action}\nSTEPS:\n${recovery.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${recovery.hint ? `\n\nHINT: ${recovery.hint}` : ''}`;

    const error = new McpError(code, fullMessage);
    (error as any).data = errorData;
    return error;
  }
```

**Step 2: Update parseToolKey to use actionable errors**

Replace `parseToolKey` method (lines 133-167):

```typescript
  private parseToolKey(toolKey: string): {
    serverId: string;
    toolName: string;
  } {
    // First, try to resolve from the temporary toolKey map
    const entry = this.toolKeyMap.get(toolKey);
    if (entry) {
      // Check TTL
      if (Date.now() - entry.createdAt > TOOL_KEY_TTL_MS) {
        this.toolKeyMap.delete(toolKey);
        throw this.createActionableError(
          ErrorCode.InvalidRequest,
          "TOOLKEY_EXPIRED",
          `toolKey has expired: ${toolKey}`,
          {
            action: "Rediscover the tool",
            steps: [
              "Call tool_discovery with your original search query",
              "Use the new toolKey from the response",
              "Retry tool_execute with the fresh toolKey"
            ],
            hint: `toolKeys expire after ${TOOL_KEY_TTL_MINUTES} minutes to ensure you have current tool definitions`,
          }
        );
      }
      return {
        serverId: entry.serverId,
        toolName: entry.toolName,
      };
    }

    // Fallback: parse as legacy format (serverId:toolName)
    const separatorIndex = toolKey.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex >= toolKey.length - 1) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "TOOLKEY_INVALID",
        `Invalid toolKey format: ${toolKey}`,
        {
          action: "Verify the toolKey",
          steps: [
            "Ensure the toolKey matches exactly from tool_discovery results",
            "toolKeys are UUIDs (e.g., '550e8400-e29b-41d4-a716-446655440000')",
            "If unsure, call tool_discovery again to get a fresh toolKey"
          ],
          suggestedTools: ["tool_discovery"],
        }
      );
    }

    return {
      serverId: toolKey.slice(0, separatorIndex),
      toolName: toolKey.slice(separatorIndex + 1),
    };
  }
```

**Step 3: Update handleToolExecute errors**

In `handleToolExecute` method, update the error throws. Replace the error at line 284-288:

```typescript
    if (!server) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "SERVER_NOT_FOUND",
        `Unknown server: ${serverId}`,
        {
          action: "Verify the server exists",
          steps: [
            "Call tool_capabilities to see available servers",
            "Call tool_discovery to find tools on available servers",
            "Use a toolKey from the discovery results"
          ],
          suggestedTools: ["tool_capabilities", "tool_discovery"],
        }
      );
    }
```

Replace the "Token does not have access" error (line 292-296):

```typescript
    if (!this.tokenValidator.hasServerAccess(validatedToken, serverId)) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "ACCESS_DENIED",
        "Token does not have access to this server",
        {
          action: "Check your access permissions",
          steps: [
            "Use tool_capabilities to see servers you have access to",
            "Call tool_discovery to find accessible tools",
            "Contact your administrator if you need access to additional servers"
          ],
          suggestedTools: ["tool_capabilities"],
        }
      );
    }
```

Replace the "Tool not available for project" error (line 299-304):

```typescript
    if (!this.toolCatalogService.matchesProject(server, projectId)) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "PROJECT_MISMATCH",
        "Tool not available for the selected project",
        {
          action: "Use tools available in your current project",
          steps: [
            "Call tool_discovery to find tools in your current project",
            "Switch to a different project if you need this tool",
            "Check if the server is assigned to your project"
          ],
          suggestedTools: ["tool_discovery"],
        }
      );
    }
```

Replace the tool disabled error (line 306-311):

```typescript
    if (server.toolPermissions && server.toolPermissions[toolName] === false) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "TOOL_DISABLED",
        `Tool "${toolName}" is disabled for this server`,
        {
          action: "Use an alternative tool or request access",
          steps: [
            "This tool has been disabled by an administrator",
            "Call tool_discovery to find similar tools that are enabled",
            "Contact your administrator if you need this specific tool"
          ],
          suggestedTools: ["tool_discovery"],
        }
      );
    }
```

Replace server not connected error (line 313-319):

```typescript
    const client = this.clients.get(serverId);
    if (!client) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "SERVER_DISCONNECTED",
        `Server ${serverName} is not connected`,
        {
          action: "Wait for server to reconnect or use alternative",
          steps: [
            "The server may be temporarily unavailable",
            "Try again in a few moments",
            "Call tool_capabilities to see currently connected servers"
          ],
          hint: "Server connections are managed automatically and will reconnect when available",
          suggestedTools: ["tool_capabilities"],
        }
      );
    }
```

Replace server not running error (line 321-326):

```typescript
    if (!this.serverStatusMap.get(serverName)) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "SERVER_NOT_RUNNING",
        `Server ${serverName} is not running`,
        {
          action: "Wait for server to start or use alternative",
          steps: [
            "The server may be starting up or temporarily stopped",
            "Try again in a few moments",
            "Call tool_capabilities to see currently running servers"
          ],
          suggestedTools: ["tool_capabilities"],
        }
      );
    }
```

**Step 4: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts
git commit -m "feat(errors): add actionable error messages with recovery hints

- Add createActionableError() helper
- Include recoveryAction, recoverySteps, hint in errors
- Add suggestedTools for each error type
- Errors include full recovery instructions in message text
- Cover: expired, invalid, server not found, access denied, etc.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: Hierarchical Discovery & Search Enhancement (P1)

### Task 7: Implement tool_capabilities Handler [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`
- Modify: `packages/shared/src/types/tool-catalog-types.ts`

**Step 1: Add capability types to shared types**

Add to `packages/shared/src/types/tool-catalog-types.ts`:

```typescript
/**
 * Category information for tool_capabilities.
 */
export interface CategoryInfo {
  name: string;
  description: string;
  toolCount: number;
  examples: string[]; // Example tool names (not keys)
}

/**
 * Server information for tool_capabilities.
 */
export interface ServerInfo {
  name: string;
  serverId: string;
  toolCount: number;
  status: 'running' | 'stopped' | 'error';
  categories: string[];
}

/**
 * Response from tool_capabilities.
 */
export interface ToolCapabilitiesResponse {
  totalTools: number;
  categories: CategoryInfo[];
  servers: ServerInfo[];
}
```

**Step 2: Add handleToolCapabilities method to ToolCatalogHandler**

Add after `handleToolExecute` method:

```typescript
  /**
   * Handle tool_capabilities request.
   * Returns high-level overview of available categories and servers.
   */
  public async handleToolCapabilities(request: any): Promise<any> {
    const token = request.params._meta?.token as string | undefined;
    const projectId = this.normalizeProjectId(request.params._meta?.projectId);
    const { clientId, token: validatedToken } = this.requireValidToken(token);

    const args = request.params.arguments || {};
    const filterServer = typeof args.server === "string" ? args.server : undefined;
    const filterCategory = typeof args.category === "string" ? args.category : undefined;

    return await this.executeWithHooksAndLogging(
      "tools/capabilities",
      { server: filterServer, category: filterCategory },
      clientId,
      AGGREGATOR_SERVER_NAME,
      "ToolCapabilities",
      async () => {
        const allowedServerIds = new Set<string>();
        for (const serverId of this.servers.keys()) {
          if (this.tokenValidator.hasServerAccess(validatedToken, serverId)) {
            allowedServerIds.add(serverId);
          }
        }

        // Collect tools to analyze
        const { servers, clients, serverStatusMap } = this.toolCatalogService.getServerManager().getMaps();

        const serverInfos: ServerInfo[] = [];
        const categoryMap = new Map<string, { tools: string[]; description: string }>();
        let totalTools = 0;

        for (const [serverId, server] of servers.entries()) {
          if (!allowedServerIds.has(serverId)) continue;
          if (!this.toolCatalogService.matchesProject(server, projectId)) continue;
          if (filterServer && server.name !== filterServer && serverId !== filterServer) continue;

          const serverName = server.name || serverId;
          const client = clients.get(serverId);
          const isRunning = serverStatusMap.get(serverName) && !!client;

          const serverCategories = new Set<string>();
          let serverToolCount = 0;

          if (isRunning && client) {
            try {
              const toolResponse = await client.getClient().listTools();
              const tools = toolResponse?.tools ?? [];

              for (const tool of tools) {
                if (server.toolPermissions?.[tool.name] === false) continue;

                serverToolCount++;
                totalTools++;

                // Infer category from tool name/description
                const category = this.inferCategory(tool.name, tool.description || '');
                serverCategories.add(category);

                if (!filterCategory || category === filterCategory) {
                  if (!categoryMap.has(category)) {
                    categoryMap.set(category, {
                      tools: [],
                      description: this.getCategoryDescription(category)
                    });
                  }
                  const cat = categoryMap.get(category)!;
                  if (cat.tools.length < 3) { // Keep only 3 examples
                    cat.tools.push(tool.name);
                  }
                }
              }
            } catch (error) {
              console.error(`[ToolCapabilities] Failed to list tools from ${serverName}:`, error);
            }
          }

          serverInfos.push({
            name: serverName,
            serverId,
            toolCount: serverToolCount,
            status: isRunning ? 'running' : 'stopped',
            categories: Array.from(serverCategories),
          });
        }

        const categories: CategoryInfo[] = Array.from(categoryMap.entries())
          .map(([name, data]) => ({
            name,
            description: data.description,
            toolCount: data.tools.length,
            examples: data.tools,
          }))
          .sort((a, b) => b.toolCount - a.toolCount);

        const response: ToolCapabilitiesResponse = {
          totalTools,
          categories,
          servers: serverInfos.sort((a, b) => b.toolCount - a.toolCount),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      },
    );
  }

  /**
   * Infer category from tool name and description.
   */
  private inferCategory(toolName: string, description: string): string {
    const text = `${toolName} ${description}`.toLowerCase();

    const categoryPatterns: [string, RegExp][] = [
      ['file_operations', /file|read|write|directory|folder|path|fs/],
      ['git', /git|commit|branch|merge|push|pull|clone|diff/],
      ['github', /github|issue|pull.?request|pr|repo|gist/],
      ['messaging', /message|chat|slack|send|channel|dm/],
      ['calendar', /calendar|event|schedule|meeting|appointment/],
      ['email', /email|mail|inbox|send.*mail/],
      ['database', /database|db|query|sql|table|record/],
      ['api', /api|http|request|endpoint|rest|fetch/],
      ['shell', /shell|bash|terminal|command|exec|run/],
      ['search', /search|find|query|lookup|filter/],
      ['auth', /auth|login|token|password|credential/],
      ['notification', /notification|notify|alert|push/],
    ];

    for (const [category, pattern] of categoryPatterns) {
      if (pattern.test(text)) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * Get description for a category.
   */
  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      file_operations: 'Read, write, and manipulate files and directories',
      git: 'Version control operations (commit, branch, merge)',
      github: 'GitHub-specific operations (issues, PRs, repos)',
      messaging: 'Send and receive messages (Slack, chat)',
      calendar: 'Calendar and scheduling operations',
      email: 'Email sending and management',
      database: 'Database queries and operations',
      api: 'HTTP/REST API interactions',
      shell: 'Shell command execution',
      search: 'Search and find operations',
      auth: 'Authentication and authorization',
      notification: 'Push notifications and alerts',
      other: 'Other tools',
    };
    return descriptions[category] || 'Miscellaneous tools';
  }
```

**Step 3: Add getServerManager method to ToolCatalogService**

Add to `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts`:

```typescript
  public getServerManager(): MCPServerManager {
    return this.serverManager;
  }
```

**Step 4: Import new types**

Add to imports in `tool-catalog-handler.ts`:

```typescript
import type {
  DetailLevel,
  ExpirationMetadata,
  ServerInfo,
  CategoryInfo,
  ToolCapabilitiesResponse,
} from "@mcp_router/shared";
```

**Step 5: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/types/tool-catalog-types.ts apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts
git commit -m "feat(capabilities): implement tool_capabilities meta-tool

- Add CategoryInfo, ServerInfo, ToolCapabilitiesResponse types
- Implement handleToolCapabilities handler
- Auto-infer categories from tool names/descriptions
- Support filtering by server or category
- Show tool counts per category and server
- Include 3 example tools per category

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Wire Up MiniSearch as Default Provider [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts`

**Step 1: Update imports and default provider**

Replace the imports and constructor:

```typescript
import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  MCPServer,
  ToolInfo,
  DetailLevel,
} from "@mcp_router/shared";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { MiniSearchProvider } from "./minisearch-provider";

/**
 * Search request parameters for search providers.
 */
export type SearchProviderRequest = {
  query: string[];
  context?: string;
  tools: ToolInfo[];
  maxResults?: number;
  detailLevel?: DetailLevel;
};

/**
 * Interface for search providers.
 */
export interface SearchProvider {
  search(request: SearchProviderRequest): Promise<SearchResult[]>;
}

type SearchContext = {
  projectId: string | null;
  allowedServerIds?: Set<string>;
  toolCatalogEnabled?: boolean;
};

const DEFAULT_MAX_RESULTS = 10; // Reduced from 20 for token efficiency
const MAX_RESULTS_LIMIT = 100;

export class ToolCatalogService {
  private serverManager: MCPServerManager;
  private searchProvider: SearchProvider;

  constructor(
    serverManager: MCPServerManager,
    searchProvider?: SearchProvider,
  ) {
    this.serverManager = serverManager;
    // Default to MiniSearch for better fuzzy matching and synonym support
    this.searchProvider = searchProvider ?? new MiniSearchProvider();
  }
```

**Step 2: Update searchTools to pass detailLevel**

Update the `searchTools` method:

```typescript
  public async searchTools(
    request: SearchRequest,
    context: SearchContext,
  ): Promise<SearchResponse> {
    if (context.toolCatalogEnabled === false) {
      return { results: [] };
    }

    const query = request.query.filter((q) => q.trim());
    if (query.length === 0) {
      return { results: [] };
    }
    const maxResults = this.normalizeMaxResults(request.maxResults);
    const detailLevel = request.detailLevel || 'summary';

    const availableTools = await this.collectAvailableTools(context);

    if (availableTools.length === 0) {
      return { results: [] };
    }

    const results = await this.searchProvider.search({
      query,
      context: request.context,
      tools: availableTools,
      maxResults,
      detailLevel,
    });

    return { results };
  }
```

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts
git commit -m "feat(search): switch default provider to MiniSearch

- Replace BM25SearchProvider with MiniSearchProvider as default
- Pass detailLevel through to search provider
- Reduce default maxResults from 20 to 10 for token efficiency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Register tool_capabilities in Request Router [DONE]

**Files:**
- Explore and modify the request router that dispatches to meta-tool handlers

**Step 1: Find where meta-tools are routed**

Search for where `tool_discovery` and `tool_execute` are handled and add `tool_capabilities`.

This will depend on the request handler structure. The handler needs to be wired up wherever `handleToolDiscovery` and `handleToolExecute` are called.

Look for patterns like:
```typescript
if (toolName === "tool_discovery") {
  return this.toolCatalogHandler.handleToolDiscovery(request);
}
```

Add:
```typescript
if (toolName === "tool_capabilities") {
  return this.toolCatalogHandler.handleToolCapabilities(request);
}
```

**Step 2: Verify META_TOOLS includes tool_capabilities**

Confirm the `META_TOOLS` array export includes all three meta-tools (already done in Task 4).

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add [modified files]
git commit -m "feat(routing): wire up tool_capabilities handler

- Add routing for tool_capabilities meta-tool
- Handler returns category/server overview

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: Final Integration & Testing (P2)

### Task 10: Update Exports and Documentation [DONE]

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Export new types**

Ensure `packages/shared/src/types/index.ts` exports:

```typescript
export * from "./tool-catalog-types";
```

**Step 2: Verify shared package exports**

Ensure `packages/shared/src/index.ts` includes:

```typescript
export * from "./types";
export * from "./utils/cli-synonyms";
export * from "./utils/tool-naming";
```

**Step 3: Run full build**

Run: `pnpm build`
Expected: PASS

**Step 4: Run type check across all packages**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types/index.ts packages/shared/src/index.ts
git commit -m "chore(exports): ensure all new types are exported

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: End-of-Chat Verification [DONE]

**Step 1: Run type safety check**

Run: `pnpm typecheck`
Expected: All 8+ tasks successful

**Step 2: Run unused code detection**

Run: `pnpm knip`
Review output, address any new unused exports from this work.

**Step 3: Run linter**

Run: `pnpm lint:fix`
Review and fix any new lint errors (ignore existing warnings).

**Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "chore: fix lint and type issues from tool discovery improvements

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

### What This Plan Delivers

| Feature | Impact | Tokens Saved |
|---------|--------|--------------|
| `detail_level` parameter | 80-95% token reduction | ~15,000-19,000 per query |
| Enhanced meta-tool descriptions | LLMs follow workflow correctly | N/A |
| MiniSearch with fuzzy matching | Typo tolerance, synonym expansion | N/A |
| `tool_capabilities` browsing | Hierarchical discovery | Avoids unnecessary full discovery |
| Actionable error messages | Faster recovery from errors | N/A |
| CLI synonym dictionary | "rm" finds "delete", etc. | N/A |

### Files Modified

| File | Changes |
|------|---------|
| `packages/shared/src/types/tool-catalog-types.ts` | DetailLevel, ExpirationMetadata, CategoryInfo, ServerInfo |
| `packages/shared/src/utils/cli-synonyms.ts` | NEW: 50+ CLI synonyms |
| `packages/shared/src/index.ts` | Export cli-synonyms |
| `apps/electron/src/main/modules/tool-catalog/minisearch-provider.ts` | NEW: MiniSearch provider |
| `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts` | META_TOOLS rewrite, detailLevel, capabilities, errors |
| `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts` | MiniSearch default, detailLevel passthrough |

### Dropped from Plan (P3/Future)

- Client detection (unreliable across clients)
- Configurable TTL via config file (hardcoded 60min is fine)
- Usage tracking for auto-curation (nice-to-have)
- Embeddings/semantic search (overkill for 200 tools)
