// Database schema types
export interface TableSchema {
  columns: string;
  indexes?: string[];
}

export interface DatabaseTableSchema {
  createSQL: string;
  indexes?: string[];
}

// Entity types
export type SessionStatus = "active" | "archived" | "deleted";

export interface ChatSession {
  id: string;
  agentId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  messages?: any[]; // Define proper message type when needed
}

// Local database session types
export type LocalSessionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface LocalChatSession {
  id: string;
  agentId: string;
  messages: any[]; // Array of messages from @ai-sdk/react
  createdAt: number;
  updatedAt: number;
  status: LocalSessionStatus;
  source: string; // Where the session originated from (e.g., 'mcp', 'ui'), default: 'ui'
}

// Request logging types are defined in log-types.ts

// Migration interface defining structure for each migration
export interface Migration {
  id: string; // Unique migration identifier (e.g., "20250511_add_scopes_to_tokens")
  description: string; // Human-readable description of what the migration does
  execute: (db: any) => void; // Function to execute the migration (SqliteManager)
}
