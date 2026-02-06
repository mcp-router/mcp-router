import { SqliteManager } from "./sqlite-manager";
import { v4 as uuidv4 } from "uuid";

/**
 * Base repository class.
 * Provides CRUD operations using SQLite database.
 * @template T Entity type
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected db: SqliteManager;
  protected tableName: string;

  /**
   * Get the current database instance (for external comparison)
   */
  public get database(): SqliteManager {
    return this.db;
  }

  /**
   * Constructor
   * @param db SqliteManager instance
   * @param tableName Table name
   */
  constructor(db: SqliteManager, tableName: string) {
    this.db = db;
    this.tableName = tableName;

    // Initialize table
    this.initializeTable();
  }

  /**
   * Abstract method to initialize the table.
   * Must be implemented by each subclass.
   */
  protected abstract initializeTable(): void;

  /**
   * Get a list of entities
   * @param options Query options
   */
  public getAll(options: any = {}): T[] {
    try {
      // Check if table exists before query
      const tableExists = this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [this.tableName],
      );

      if (!tableExists) {
        console.warn(
          `Table ${this.tableName} does not exist, returning empty array`,
        );
        return [];
      }

      // Build SQL query
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any = {};

      // Add WHERE clause (optional)
      if (options.where) {
        const whereClauses = Object.entries(options.where)
          .map(([key]) => `${key} = :${key}`)
          .join(" AND ");

        if (whereClauses) {
          sql += ` WHERE ${whereClauses}`;

          // Set parameters
          Object.entries(options.where).forEach(([key, value]) => {
            params[key] = value;
          });
        }
      }

      // Add ORDER BY clause (optional)
      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy}`;

        if (options.order) {
          sql += ` ${options.order}`;
        }
      }

      // Add LIMIT clause (optional)
      if (options.limit) {
        sql += ` LIMIT :limit`;
        params.limit = options.limit;

        if (options.offset) {
          sql += ` OFFSET :offset`;
          params.offset = options.offset;
        }
      }

      // Execute query
      const rows = this.db.all<any>(sql, params);

      // Convert to entities
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      console.error(`Error retrieving from ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get an entity by ID
   * @param id Entity ID
   */
  public getById(id: string): T | undefined {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE id = :id`;
      const row = this.db.get<any>(sql, { id });

      if (!row) {
        return undefined;
      }

      // Convert to entity
      return this.mapRowToEntity(row);
    } catch (error) {
      console.error(
        `Error retrieving ID:${id} from ${this.tableName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get the first entity matching conditions
   * @param whereClause WHERE clause
   * @param params Parameters
   */
  public findOne(whereClause: string, params: any[] = []): T | null {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
      const row = this.db.get<any>(sql, params);

      if (!row) {
        return null;
      }

      // Convert to entity
      return this.mapRowToEntity(row);
    } catch (error) {
      console.error(`Error searching in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get an entity by ID (findById alias)
   * @param id Entity ID
   */
  public findById(id: string): T | null {
    const result = this.getById(id);
    return result || null;
  }

  /**
   * Add an entity
   * @param data Entity to add
   */
  public add(data: Omit<T, "id">): T {
    try {
      // Generate ID if not specified
      const entityWithId = {
        ...data,
        id: (data as any).id || uuidv4(),
      } as T;

      // Convert entity to database row
      const row = this.mapEntityToRow(entityWithId);

      // Generate column names and value placeholders
      const columns = Object.keys(row).join(", ");
      const placeholders = Object.keys(row)
        .map((key) => `:${key}`)
        .join(", ");

      // Build SQL statement
      const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

      // Execute query
      this.db.execute(sql, row);

      return entityWithId;
    } catch (error) {
      console.error(`Error adding to ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update an entity
   * @param id ID of the entity to update
   * @param data Update data
   */
  public update(id: string, data: Partial<T>): T | undefined {
    try {
      // Get existing entity
      const existingEntity = this.getById(id);
      if (!existingEntity) {
        return undefined;
      }

      // Create updated entity
      const updatedEntity = {
        ...existingEntity,
        ...data,
        id, // Ensure ID is not overwritten
      };

      // Convert entity to database row
      const row = this.mapEntityToRow(updatedEntity);

      // Generate SET clause
      const setClauses = Object.keys(row)
        .filter((key) => key !== "id") // Don't update ID
        .map((key) => `${key} = :${key}`)
        .join(", ");

      // Build SQL statement
      const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE id = :id`;

      // Execute query
      this.db.execute(sql, row);

      return updatedEntity;
    } catch (error) {
      console.error(
        `Error updating ID:${id} in ${this.tableName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete an entity
   * @param id ID of the entity to delete
   */
  public delete(id: string): boolean {
    try {
      // Build SQL statement
      const sql = `DELETE FROM ${this.tableName} WHERE id = :id`;

      // Execute query
      this.db.execute(sql, { id });

      return true;
    } catch (error) {
      console.error(
        `Error deleting ID:${id} from ${this.tableName}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get count
   * @param whereClause WHERE clause (optional)
   */
  public count(whereClause?: { [key: string]: any }): number {
    try {
      // Build SQL query
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any = {};

      // Add WHERE clause (optional)
      if (whereClause) {
        const conditions = Object.entries(whereClause)
          .map(([key, _value]) => `${key} = :${key}`)
          .join(" AND ");

        if (conditions) {
          sql += ` WHERE ${conditions}`;

          // Set parameters
          Object.entries(whereClause).forEach(([key, value]) => {
            params[key] = value;
          });
        }
      }

      // Execute query
      const result = this.db.get<{ count: number }>(sql, params);

      return result?.count || 0;
    } catch (error) {
      console.error(
        `Error getting count from ${this.tableName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Execute a transaction
   * @param callback Function to execute within the transaction
   */
  public transaction<R>(callback: () => R): R {
    return this.db.transaction(callback);
  }

  /**
   * Abstract method to convert a database row to an entity.
   * Must be implemented by each subclass.
   * @param row Database row
   */
  protected abstract mapRowToEntity(row: any): T;

  /**
   * Abstract method to convert an entity to a database row.
   * Must be implemented by each subclass.
   * @param entity Entity
   */
  protected abstract mapEntityToRow(entity: T): Record<string, any>;
}
