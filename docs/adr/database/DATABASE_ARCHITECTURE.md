# ADR: Database Architecture

## Status
Approved

## Context
The database layer of the Electron application needs to support multiple workspaces and persist various entities (servers, agents, logs, etc.). The following requirements needed to be met:

- **Multi-workspace support**: Each workspace has an independent database
- **Type safety**: Safe data access utilizing TypeScript's type system
- **Performance**: Efficient processing of large amounts of log data
- **Maintainability**: Easy addition of new entities
- **Transaction management**: Guarantee data integrity

## Decision

### Directory Structure

```
apps/electron/src/main/
├── infrastructure/database/           # Core database functionality
│   ├── base-repository.ts             # Repository base class
│   ├── sqlite-manager.ts              # SQLite connection management
│   └── main-database-migration.ts     # Database migrations
│
└── modules/                           # Modular repository structure
    ├── mcp-logger/
    │   └── mcp-logger.repository.ts   # Request logs repository
    ├── mcp-server-manager/
    │   └── mcp-server-manager.repository.ts  # Server repository
    ├── client-apps/
    │   ├── client-app.repository.ts          # Client app repository (SQLite)
    │   └── token-manager.repository.ts       # Token repository (file-based)
    ├── settings/
    │   └── settings.repository.ts     # Settings repository (file-based)
    ├── workspace/
    │   └── workspace.repository.ts    # Workspace repository
    ├── workflow/
    │   ├── hook.repository.ts         # Hook modules repository
    │   └── workflow.repository.ts     # Workflow repository
    ├── skills/
    │   ├── skills.repository.ts       # Skills repository
    │   └── agent-path.repository.ts   # Agent path repository
    └── projects/
        └── projects.repository.ts     # Projects repository
```

### Architecture Patterns

#### 1. Repository Pattern
```typescript
export abstract class BaseRepository<T extends { id: string }> {
  protected db: SqliteManager;
  protected tableName: string;

  // Common CRUD operations
  public getAll(options: any = {}): T[]
  public getById(id: string): T | undefined
  public create(data: Omit<T, 'id'>): T
  public update(id: string, data: Partial<T>): T | undefined
  public delete(id: string): boolean
}
```

Each entity's repository inherits from `BaseRepository` and adds entity-specific operations.

#### 2. Singleton Pattern
Each repository uses a static `getInstance()` singleton pattern for instance management:

```typescript
export class ExampleRepository extends BaseRepository<Example> {
  private static instance: ExampleRepository | null = null;

  private constructor() {
    super(getSqliteManager(), "examples");
  }

  public static getInstance(): ExampleRepository {
    if (!ExampleRepository.instance) {
      ExampleRepository.instance = new ExampleRepository();
    }
    return ExampleRepository.instance;
  }

  public static resetInstance(): void {
    ExampleRepository.instance = null;
  }
}
```

Each repository manages its own singleton instance, with a `resetInstance()` method for database switching scenarios.

### Database Selection: SQLite + better-sqlite3

#### Reasons for Selection
1. **Embedded database**: No external process required
2. **High performance**: better-sqlite3 provides fast synchronous API
3. **Transaction support**: Guarantees ACID properties
4. **Lightweight**: Ideal for Electron applications
5. **Type safety**: Good compatibility with TypeScript

### Multi-workspace Support

#### Database Separation
- **Main database** (`mcprouter.db`): Workspace information and global settings
- **Workspace database** (`workspace-{id}.db`): Data specific to each workspace

#### Processing During Workspace Switch
1. Close the current database connection
2. Open the new workspace's database
3. Call `resetInstance()` on each repository to clear singleton instances
4. New repository instances are created on next `getInstance()` call

### Schema Management

#### Inline Table Definitions
Each repository defines its own table schema using inline SQL within the repository class:

```typescript
export class McpServerManagerRepository extends BaseRepository<Server> {
  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      -- ... additional columns
    )
  `;

  protected initializeTable(): void {
    this.db.execute(McpServerManagerRepository.CREATE_TABLE_SQL);
    // Create indexes as needed
    this.db.execute("CREATE INDEX IF NOT EXISTS idx_servers_name ON servers(name)");
  }
}
```

#### Migration Strategy
1. **Automatic table initialization**: Each repository creates its table on first instantiation
2. **Migration file**: `main-database-migration.ts` handles ALTER TABLE operations for existing tables
3. **Backward compatibility**: Protection of existing data

### Performance Optimization

#### 1. Index Strategy
```sql
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_logs_serverId ON request_logs(serverId);
CREATE INDEX IF NOT EXISTS idx_request_logs_clientId ON request_logs(clientId);
```

#### 2. Batch Processing
```typescript
// Batch processing within transaction
this.db.transaction(() => {
  for (const item of items) {
    stmt.run(item);
  }
})();
```

#### 3. Prepared Statements
```typescript
const stmt = this.db.prepare("INSERT INTO servers VALUES (?, ?, ?)");
// Reusable
```

## Consequences

### Advantages
1. **Type safety**: Compile-time error detection
2. **Performance**: Fast access via synchronous API
3. **Maintainability**: Clear separation of responsibilities
4. **Extensibility**: Easy addition of new entities
5. **Reliability**: Data integrity through transactions

### Disadvantages
1. **SQLite limitations**: Limited concurrent writes
2. **Memory usage**: Memory consumption with large data volumes
3. **Backup**: Manual backup required

## Alternatives Considered

### 1. IndexedDB
- **Reason for rejection**: Not available in main process, complex API

### 2. PostgreSQL/MySQL
- **Reason for rejection**: Requires external process, complex deployment

### 3. LevelDB
- **Reason for rejection**: No SQL queries, unsuitable for relational data

## Security Considerations

1. **SQL injection prevention**: Use of prepared statements
2. **Data encryption**: Encryption of sensitive data (tokens)
3. **Access control**: Protection at file system level

## Future Extensibility

1. **Remote database**: Support for cloud synchronization
2. **Cache layer**: Addition of Redis-compatible cache
3. **Read-only replica**: Performance improvement
4. **Automatic backup**: Periodic backup functionality

## Repository Summary

| Repository Class | Table Name | Storage Type | Inherits BaseRepository |
|---|---|---|---|
| McpServerManagerRepository | servers | SQLite | Yes |
| McpLoggerRepository | requestLogs | SQLite | Yes |
| WorkspaceRepository | workspaces | SQLite | Yes |
| HookRepository | hook_modules | SQLite | No |
| WorkflowRepository | workflows | SQLite | No |
| SkillRepository | skills | SQLite | Yes |
| AgentPathRepository | agent_paths | SQLite | Yes |
| ProjectRepository | projects | SQLite | Yes |
| SettingsRepository | N/A | SharedConfigManager (file-based) | No |
| TokenManagerRepository | N/A | SharedConfigManager (file-based) | No |
| ClientAppRepository | client_apps | SQLite | Yes |

Note: SettingsRepository and TokenManagerRepository use SharedConfigManager for file-based storage instead of SQLite.

## Update History
- **January 2026**: Updated documentation to reflect actual implementation
  - Corrected directory structure to show modular repository organization
  - Replaced RepositoryFactory pattern with singleton getInstance() pattern
  - Updated schema management to reflect inline CREATE_TABLE_SQL pattern
  - Added missing repositories: ProjectRepository, SkillRepository, AgentPathRepository, WorkflowRepository
  - Noted that SettingsRepository and TokenManagerRepository use SharedConfigManager (file-based)
  - Corrected table name: hooks to hook_modules
- **August 2025**: Initial architecture documentation

## References
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [SQLite Best Practices](https://www.sqlite.org/bestpractice.html)
- [DATABASE_SCHEMA_MANAGEMENT.md](DATABASE_SCHEMA_MANAGEMENT.md) - Schema management strategy
- [DATABASE_DESIGN_PATTERNS.md](DATABASE_DESIGN_PATTERNS.md) - Database design patterns
