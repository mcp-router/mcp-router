import { BaseRepository } from "../../infrastructure/database/base-repository";
import {
  SqliteManager,
  getSqliteManager,
} from "../../infrastructure/database/sqlite-manager";
import { MCPServer, MCPServerConfig } from "@mcp_router/shared";
import { v4 as uuidv4 } from "uuid";

/**
 * Repository class for server information.
 * Manages server data using BetterSQLite3.
 */
export class McpServerManagerRepository extends BaseRepository<MCPServer> {
  private static instance: McpServerManagerRepository | null = null;
  /**
   * Table creation SQL
   */
  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT,
      args TEXT,
      env TEXT,
      auto_start INTEGER NOT NULL,
      disabled INTEGER NOT NULL,
      auto_approve TEXT,
      context_path TEXT,
      server_type TEXT NOT NULL DEFAULT 'local',
      remote_url TEXT,
      bearer_token TEXT,
      input_params TEXT,
      description TEXT,
      version TEXT,
      latest_version TEXT,
      verification_status TEXT,
      required_params TEXT,
      project_id TEXT,
      tool_permissions TEXT,
      dev TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;

  /**
   * Index creation SQL
   */
  private static readonly INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_servers_name ON servers(name)",
    "CREATE INDEX IF NOT EXISTS idx_servers_project_id ON servers(project_id)",
  ];

  /**
   * Constructor
   * @param db SqliteManager instance
   */
  private constructor(db: SqliteManager) {
    super(db, "servers");
    console.log(
      "[ServerRepository] Initialized with database:",
      db ? "Present" : "Missing",
    );
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): McpServerManagerRepository {
    const db = getSqliteManager();
    if (
      !McpServerManagerRepository.instance ||
      McpServerManagerRepository.instance.db !== db
    ) {
      McpServerManagerRepository.instance = new McpServerManagerRepository(db);
    }
    return McpServerManagerRepository.instance;
  }

  /**
   * Create a repository for a specific database
   */
  public static createForDatabase(
    db: SqliteManager,
  ): McpServerManagerRepository {
    return new McpServerManagerRepository(db);
  }

  /**
   * Reset the instance
   */
  public static resetInstance(): void {
    McpServerManagerRepository.instance = null;
  }

  /**
   * Initialize the table (implements BaseRepository abstract method)
   */
  protected initializeTable(): void {
    try {
      // Create the table
      this.db.execute(McpServerManagerRepository.CREATE_TABLE_SQL);

      // Create indexes
      McpServerManagerRepository.INDEXES.forEach((indexSQL) => {
        this.db.execute(indexSQL);
      });
    } catch (error) {
      console.error("[ServerRepository] Error initializing table:", error);
      throw error;
    }
  }

  /**
   * Safely parse a JSON string
   * @param jsonString JSON string
   * @param errorLabel Label for error messages
   * @param defaultValue Default value on parse failure
   * @returns Parsed object
   */
  private safeParseJSON<T>(
    jsonString: string | null,
    errorLabel: string,
    defaultValue: T,
  ): T {
    if (!jsonString) return defaultValue;

    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error(`Failed to parse JSON for ${errorLabel}:`, error);
      return defaultValue;
    }
  }

  /**
   * Convert a database row to an entity
   */
  protected mapRowToEntity(row: any): MCPServer {
    try {
      // Parse data fields
      const env = this.safeParseJSON<Record<string, any>>(
        row.env,
        "env",
        {},
      );
      const requiredParams: string[] = row.required_params
        ? JSON.parse(row.required_params)
        : [];
      const command = row.command;
      const bearerToken = row.bearer_token;
      const inputParams = this.safeParseJSON<any>(
        row.input_params,
        "input_params",
        undefined,
      );
      const args = this.safeParseJSON<any[]>(row.args, "args", []);
      const remoteUrl = row.remote_url;
      const toolPermissions = this.safeParseJSON<Record<string, boolean>>(
        row.tool_permissions,
        "tool_permissions",
        {},
      );
      const dev = this.safeParseJSON<
        | {
            enabled: boolean;
            watch: string[];
            cwd?: string;
          }
        | undefined
      >(row.dev, "dev", undefined);

      // Build entity object
      return {
        id: row.id,
        name: row.name,
        command: command || "",
        args: args,
        env: env,
        autoStart: !!row.auto_start,
        disabled: !!row.disabled,
        serverType: row.server_type || "local",
        remoteUrl: remoteUrl || undefined,
        bearerToken: bearerToken || undefined,
        inputParams: inputParams,
        description: row.description || undefined,
        version: row.version || undefined,
        latestVersion: row.latest_version || undefined,
        verificationStatus: row.verification_status || undefined,
        required: requiredParams,
        projectId: row.project_id || null,
        toolPermissions,
        dev,
        status: "stopped",
        logs: [],
      };
    } catch (error) {
      console.error("Error converting server data (mapRowToEntity):", error);
      throw error;
    }
  }

  /**
   * Serialize entity data to JSON strings
   * @param entity Server entity
   * @returns Object with JSON-stringified data
   */
  private serializeEntityData(entity: MCPServer) {
    return {
      bearerToken: entity.bearerToken || null,
      env: JSON.stringify(entity.env || {}),
      inputParams: entity.inputParams
        ? JSON.stringify(entity.inputParams)
        : null,
      toolPermissions: entity.toolPermissions
        ? JSON.stringify(entity.toolPermissions)
        : null,
      command: entity.command || null,
      args: JSON.stringify(entity.args || []),
      remoteUrl: entity.remoteUrl || null,
      dev: entity.dev ? JSON.stringify(entity.dev) : null,
    };
  }

  /**
   * Convert an entity to a database row
   */
  protected mapEntityToRow(entity: MCPServer): Record<string, any> {
    try {
      const now = Date.now();

      // Serialize data
      const {
        bearerToken,
        env,
        inputParams,
        command,
        args,
        remoteUrl,
        toolPermissions,
        dev,
      } = this.serializeEntityData(entity);

      // Build database row object
      return {
        id: entity.id,
        name: entity.name,
        // For remote servers, command can be null
        command: command,
        args: args,
        env: env,
        auto_start: entity.autoStart ? 1 : 0,
        disabled: entity.disabled ? 1 : 0,
        server_type: entity.serverType,
        remote_url: remoteUrl,
        bearer_token: bearerToken,
        input_params: inputParams,
        project_id: entity.projectId ?? null,
        tool_permissions: toolPermissions,
        dev: dev,
        description: entity.description || null,
        version: entity.version || null,
        latest_version: entity.latestVersion || null,
        verification_status: entity.verificationStatus || null,
        required_params: JSON.stringify(entity.required || []),
        created_at: now,
        updated_at: now,
      };
    } catch (error) {
      console.error("Error converting server data (mapEntityToRow):", error);
      throw error;
    }
  }

  /**
   * Add server information
   * @param serverConfig Server configuration
   * @returns Added server information
   */
  public addServer(serverConfig: MCPServerConfig): MCPServer {
    try {
      const id = serverConfig.id || uuidv4();

      // Create MCPServer object
      const server: MCPServer = {
        ...serverConfig,
        id,
        status: "stopped",
        logs: [],
        toolPermissions: serverConfig.toolPermissions || {},
      };

      // Add to repository
      this.add(server);

      return server;
    } catch (error) {
      console.error("Error adding server:", error);
      throw error;
    }
  }

  /**
   * Get all server information
   * @returns Array of server information
   */
  public getAllServers(): MCPServer[] {
    try {
      return this.getAll();
    } catch (error) {
      console.error("Error retrieving server list:", error);
      throw error;
    }
  }

  /**
   * Get server information by ID
   * @param id Server ID
   * @returns Server information (undefined if not found)
   */
  public getServerById(id: string): MCPServer | undefined {
    try {
      return this.getById(id);
    } catch (error) {
      console.error(
        `Error retrieving server with ID: ${id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Convert an entity to a database row for updates (with custom timestamps)
   */
  private mapEntityToRowForUpdate(
    entity: MCPServer,
    createdAt: number,
  ): Record<string, any> {
    try {
      // Serialize data
      const {
        bearerToken,
        env,
        inputParams,
        command,
        args,
        remoteUrl,
        toolPermissions,
        dev,
      } = this.serializeEntityData(entity);

      // Build database row object
      return {
        id: entity.id,
        name: entity.name,
        // For remote servers, command can be null
        command: command,
        args: args,
        env: env,
        auto_start: entity.autoStart ? 1 : 0,
        disabled: entity.disabled ? 1 : 0,
        server_type: entity.serverType,
        remote_url: remoteUrl,
        bearer_token: bearerToken,
        input_params: inputParams,
        project_id: entity.projectId ?? null,
        tool_permissions: toolPermissions,
        dev: dev,
        description: entity.description || null,
        version: entity.version || null,
        latest_version: entity.latestVersion || null,
        verification_status: entity.verificationStatus || null,
        required_params: JSON.stringify(entity.required || []),
        created_at: createdAt,
        updated_at: Date.now(),
      };
    } catch (error) {
      console.error("Error converting server data (mapEntityToRowForUpdate):", error);
      throw error;
    }
  }

  /**
   * Update server information
   * @param id Server ID
   * @param config Server configuration to update
   * @returns Updated server information (undefined if not found)
   */
  public updateServer(
    id: string,
    config: Partial<MCPServerConfig>,
  ): MCPServer | undefined {
    try {
      // Get existing server information
      const existingServer = this.getById(id);
      if (!existingServer) {
        return undefined;
      }

      // Get existing createdAt timestamp
      const createdAtResult = this.db.get<{ created_at: number }>(
        `SELECT created_at FROM ${this.tableName} WHERE id = :id`,
        { id },
      );
      const createdAt = createdAtResult?.created_at || Date.now();

      // Set fields to update
      const updatedServer: MCPServer = {
        ...existingServer,
        ...config,
        // Preserve fields that are not part of MCPServerConfig
        status: existingServer.status,
        logs: existingServer.logs,
        errorMessage: existingServer.errorMessage,
        tools: existingServer.tools,
        resources: existingServer.resources,
        prompts: existingServer.prompts,
      };

      // Generate row data
      const row = this.mapEntityToRowForUpdate(updatedServer, createdAt);

      // Generate SET clause (do not update ID)
      const setClauses = Object.keys(row)
        .filter((key) => key !== "id")
        .map((key) => `${key} = :${key}`)
        .join(", ");

      // Build SQL statement
      const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE id = :id`;

      // Execute query
      this.db.execute(sql, row);
      return updatedServer;
    } catch (error) {
      console.error(
        `Error updating server with ID: ${id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete server information
   * @param id Server ID
   * @returns true if deletion succeeded, false otherwise
   */
  public deleteServer(id: string): boolean {
    try {
      const server = this.getById(id);
      if (!server) {
        return false;
      }

      const result = this.delete(id);

      if (result) {
        console.log(`Server "${server.name}" deleted (ID: ${id})`);
      }

      return result;
    } catch (error) {
      console.error(
        `Error deleting server with ID: ${id}:`,
        error,
      );
      throw error;
    }
  }
}
