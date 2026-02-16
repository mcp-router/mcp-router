# ADR: Unification of Database Schema Management

## Status
Approved (Implemented August 2025)

## Context
In the MCP Router project, there were 9 repository classes for managing multiple database tables.
Initially, these repository classes directly wrote SQL statements within their respective initializeTable() methods.
Additionally, some tables (hooks) were also created in migration files, causing the following issues:

1. **Duplicate table definitions**: Same table definitions exist in multiple locations
2. **Inconsistent management**: Schema definition files exist but are not utilized
3. **Reduced maintainability**: Multiple locations need modification when changing table structure
4. **Ambiguous responsibility**: Table creation responsibility is distributed

## Decisions

### 1. Inline Schema Definition per Repository
Each repository class defines its own table schema using inline SQL constants. This approach keeps schema definitions co-located with the repository logic:

```typescript
export class ExampleRepository extends BaseRepository<Example> {
  /**
   * SQL for table creation
   */
  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS examples (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;

  protected initializeTable(): void {
    this.db.execute(ExampleRepository.CREATE_TABLE_SQL);
    // Create indexes as needed
    this.db.execute("CREATE INDEX IF NOT EXISTS idx_examples_name ON examples(name)");
  }
}
```

### 2. Repository-Level Table Initialization
Each repository is responsible for creating its own table during initialization:

```typescript
protected initializeTable(): void {
  try {
    // Create table using inline SQL constant
    this.db.execute(ExampleRepository.CREATE_TABLE_SQL);

    // Create indexes
    this.db.execute("CREATE INDEX IF NOT EXISTS idx_name ON table(column)");

    console.log(`[${this.constructor.name}] Table initialization completed`);
  } catch (error) {
    console.error(`[${this.constructor.name}] Error during table initialization:`, error);
    throw error;
  }
}
```

### 3. Migration File for Schema Modifications
The `main-database-migration.ts` file handles ALTER TABLE operations for existing tables. New table creation is handled by repository initialization.

### 4. File-Based Storage for Configuration Data
Some repositories (SettingsRepository, TokenManagerRepository) use SharedConfigManager for file-based JSON storage instead of SQLite, keeping configuration data portable and human-readable.

## Implementation Details

### Repository Class List and Mapping

| Repository Class | Table Name | Storage Type | Inherits BaseRepository |
|---|---|---|---|
| McpServerManagerRepository | servers | SQLite | Yes |
| McpLoggerRepository | requestLogs | SQLite | Yes |
| WorkspaceRepository | workspaces | SQLite | Yes |
| HookRepository | hook_modules | SQLite | No |
| WorkflowRepository | workflows | SQLite | No |
| SkillRepository | skills | SQLite | Yes |
| AgentPathRepository | agent_paths | SQLite | Yes (deprecated, replaced by ClientAppRepository) |
| ClientAppRepository | client_apps | SQLite | Yes |
| ClientSkillStateRepository | client_skill_states | SQLite | Yes |
| ProjectRepository | projects | SQLite | Yes |
| SettingsRepository | N/A | SharedConfigManager (file-based) | No |
| TokenManagerRepository | N/A | SharedConfigManager (file-based) | No |

### File-Based Repositories
SettingsRepository and TokenManagerRepository use SharedConfigManager for file-based JSON storage:

```typescript
export class SettingsRepository {
  private static instance: SettingsRepository | null = null;

  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  public getSettings(): AppSettings {
    return getSharedConfigManager().getSettings();
  }
}
```

This approach provides:
- Portable configuration files
- Human-readable JSON format
- Easy backup and migration

## Consequences

### Advantages
1. **Co-location**: Schema definitions are co-located with repository logic
2. **Self-contained repositories**: Each repository manages its own table lifecycle
3. **Flexibility**: Repositories can use SQLite or file-based storage as appropriate
4. **Consistency**: All SQLite-based repositories follow the same initialization pattern
5. **Readability**: Easy to understand table structure by reading the repository

### Disadvantages
1. **Distributed definitions**: Table definitions are spread across multiple files
2. **Potential duplication**: Similar patterns repeated in each repository

## Alternatives Considered

### Alternative 1: Continue Direct SQL Statement Writing
Maintain the current approach of directly writing SQL statements in each repository class.
- Advantage: Direct and easy to understand
- Disadvantage: High duplication, low maintainability

### Alternative 2: ORM Introduction
Introduce an ORM such as TypeORM or Prisma.
- Advantage: Higher level of abstraction, migration management
- Disadvantage: Learning cost, increased dependencies, performance overhead

### Alternative 3: Schema Definition Auto-generation
Create schema definitions by reverse-engineering from the database.
- Advantage: Consistency with existing DB is guaranteed
- Disadvantage: Separate method needed for initial DB creation, challenges in CI/CD environments

## Future Considerations

1. **Schema versioning**: Consider methods for schema version management
2. **Migration strategy**: Support for more complex migrations
3. **Test strategy**: Add tests to ensure accuracy of schema definitions
4. **Documentation generation**: Auto-generate documentation from schema definitions

## Update History
- **February 2026**: Added client_skill_states table and ClientSkillStateRepository
  - New client_skill_states table for per-client skill state tracking
  - Junction table between skills and client_apps for tracking installation state per client
  - Migration 20260202_create_client_skill_states_table creates the table with indexes
- **February 2026**: Added client_apps table and ClientAppRepository
  - New unified client_apps table for managing MCP client applications
  - AgentPathRepository marked as deprecated (replaced by ClientAppRepository)
  - Migration 20260201_create_client_apps_table migrates data from agent_paths
- **January 2026**: Updated documentation to reflect actual implementation
  - Removed references to non-existent DATABASE_SCHEMA object and schema/tables/ directory
  - Updated to reflect inline CREATE_TABLE_SQL pattern per repository
  - Corrected repository-table mapping
  - Added documentation for file-based repositories (SettingsRepository, TokenManagerRepository)
  - Corrected table name: hooks to hook_modules
- **August 2025**: Initial schema management documentation

## References
- [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) - Overall database architecture design
- [DATABASE_DESIGN_PATTERNS.md](DATABASE_DESIGN_PATTERNS.md) - Database design patterns
