// Database schema types
export interface TableSchema {
  columns: string;
  indexes?: string[];
}

export interface DatabaseTableSchema {
  createSQL: string;
  indexes?: string[];
}

// Migration interface defining structure for each migration
export interface Migration {
  id: string; // Unique migration identifier (e.g., "20250511_add_scopes_to_tokens")
  description: string; // Human-readable description of what the migration does
  execute: (db: any) => void; // Function to execute the migration (SqliteManager)
}
