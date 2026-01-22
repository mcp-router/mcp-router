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
}

export interface SearchRequest {
  query: string[];
  context?: string;
  maxResults?: number;
}

export interface SearchResult {
  toolName: string;
  serverId: string;
  serverName: string;
  projectId: string | null;
  description?: string;
  relevance: number; // 0-1 normalized score
  explanation?: string; // Optional explanation (e.g., selection reason)
}

export interface SearchResponse {
  results: SearchResult[];
}
