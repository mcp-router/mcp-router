import { DeployedAgent } from '../../types';
import { BaseRepository } from './base-repository';
import { SqliteManager, getSqliteManager } from './sqlite-manager';
import { v4 as uuidv4 } from 'uuid';
import { logError, logInfo } from '../utils/error-handler';

/**
 * Repository for managing deployed agents
 * Handles the storage and retrieval of agents that have been deployed to the "Use" section
 */
export class DeployedAgentRepository extends BaseRepository<DeployedAgent> {
    /**
     * Constructor
     * @param db SqliteManager instance
     */
    constructor(db: SqliteManager) {
        super(db, 'deployedAgents');
    }

    /**
     * Initialize table and indexes
     * Note: This method only handles initial table creation
     * Schema migrations are centrally managed by the DatabaseMigration class
     */
    protected initializeTable(): void {
        try {
            this.ensureTableExists();
        } catch (error) {
            console.error('Error initializing deployed agents table:', error);
            throw error;
        }
    }

    /**
     * Ensure the deployedAgents table exists and create if needed
     * This method is safe to call multiple times
     */
    private ensureTableExists(): void {
        try {
            // Check if table exists
            const tableExists = this.db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                [this.tableName]
            );

            if (!tableExists) {
                // Create the deployed_agents table if it doesn't exist
                this.db.execute(`
                    CREATE TABLE IF NOT EXISTS ${this.tableName} (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        mcp_servers TEXT NOT NULL,
                        purpose TEXT NOT NULL,
                        instructions TEXT NOT NULL,
                        description TEXT,
                        tool_permissions TEXT,
                        auto_execute_tool INTEGER DEFAULT 0,
                        mcp_server_enabled INTEGER DEFAULT 0,
                        user_id TEXT,
                        original_id TEXT NOT NULL DEFAULT '',
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )
                `);

                // Create indexes
                this.db.execute(`CREATE INDEX IF NOT EXISTS idx_deployed_agents_name ON ${this.tableName} (name)`);
            }
        } catch (error) {
            console.error(`Error ensuring ${this.tableName} table exists:`, error);
            throw error;
        }
    }

    /**
     * Convert database row to entity
     * @param row Database row
     * @returns Deployed agent entity
     */
    protected mapRowToEntity(row: any): DeployedAgent {
        try {
            return {
                id: row.id,
                name: row.name,
                mcpServers: JSON.parse(row.mcp_servers || '[]'),
                purpose: row.purpose || '',
                instructions: row.instructions || '',
                description: row.description || '',
                toolPermissions: row.tool_permissions ? JSON.parse(row.tool_permissions) : undefined,
                autoExecuteTool: Boolean(row.auto_execute_tool),
                mcpServerEnabled: Boolean(row.mcp_server_enabled),
                userId: row.user_id || undefined,
                originalId: row.original_id || '',
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            console.error('Error mapping deployed agent data:', error);
            throw error;
        }
    }

    /**
     * Convert entity to database row
     * @param entity Deployed agent entity
     * @returns Database row
     */
    protected mapEntityToRow(entity: DeployedAgent): Record<string, any> {
        try {
            const now = Date.now();
            
            return {
                id: entity.id,
                name: entity.name,
                mcp_servers: JSON.stringify(entity.mcpServers || []),
                purpose: entity.purpose || '',
                instructions: entity.instructions || '',
                description: entity.description || '',
                tool_permissions: entity.toolPermissions ? JSON.stringify(entity.toolPermissions) : null,
                auto_execute_tool: entity.autoExecuteTool ? 1 : 0,
                mcp_server_enabled: entity.mcpServerEnabled ? 1 : 0,
                user_id: entity.userId || null,
                original_id: entity.originalId || '',
                created_at: entity.createdAt || now,
                updated_at: entity.updatedAt || now
            };
        } catch (error) {
            console.error('Error mapping deployed agent entity to row:', error);
            throw error;
        }
    }

    /**
     * Get all deployed agents
     * @returns A promise resolving to an array of all deployed agents
     */
    public getAllDeployedAgents(): DeployedAgent[] {
        try {
            this.ensureTableExists();
            return this.getAll();
        } catch (error) {
            logError('Error retrieving deployed agents', error);
            throw error;
        }
    }

    /**
     * Get a deployed agent by ID
     * @param id The ID of the deployed agent to find
     * @returns The deployed agent or undefined if not found
     */
    public getDeployedAgentById(id: string): DeployedAgent | undefined {
        try {
            return this.getById(id);
        } catch (error) {
            logError(`Error retrieving deployed agent with ID: ${id}`, error);
            throw error;
        }
    }

    /**
     * Create a new deployed agent
     * @param agent The agent data to create
     * @returns The created agent
     */
    public createDeployedAgent(agent: Omit<DeployedAgent, 'id' | 'createdAt' | 'updatedAt'>): DeployedAgent {
        try {
            const now = Date.now();
            const deployedAgent: DeployedAgent = {
                ...agent,
                id: uuidv4(),
                autoExecuteTool: agent.autoExecuteTool ?? true,
                originalId: agent.originalId || '',
                createdAt: now,
                updatedAt: now
            };

            return this.add(deployedAgent);
        } catch (error) {
            logError('Error creating deployed agent', error);
            throw error;
        }
    }

    /**
     * Update an existing deployed agent
     * @param id The ID of the agent to update
     * @param data The partial agent data to update
     * @returns The updated agent or undefined if not found
     */
    public updateDeployedAgent(id: string, data: Partial<DeployedAgent>): DeployedAgent | undefined {
        try {
            return this.update(id, data);
        } catch (error) {
            logError(`Error updating deployed agent with ID: ${id}`, error);
            throw error;
        }
    }

    /**
     * Delete a deployed agent by ID
     * @param id The ID of the deployed agent to delete
     * @returns True if the agent was deleted
     */
    public deleteDeployedAgent(id: string): boolean {
        try {
            return this.delete(id);
        } catch (error) {
            logError(`Error deleting deployed agent with ID: ${id}`, error);
            throw error;
        }
    }

    /**
     * Deploy an agent from the build section to the use section
     * @param sourceAgent The source agent to deploy
     * @returns The deployed agent
     */
    public deployFromAgent(sourceAgent: any): DeployedAgent {
        try {
            const newDeployedAgent = this.add({
              name: sourceAgent.name,
              purpose: sourceAgent.purpose,
              instructions: sourceAgent.instructions,
              mcpServers: sourceAgent.mcpServers,
              description: sourceAgent.description || '',
              toolPermissions: sourceAgent.toolPermissions,
              autoExecuteTool: sourceAgent.autoExecuteTool ?? true,
              mcpServerEnabled: sourceAgent.mcpServerEnabled ?? false,
              userId: sourceAgent.userId,
              originalId: sourceAgent.originalId || '',
              createdAt: Date.now(),
              updatedAt: Date.now()
          });
          
          logInfo(`Agent "${sourceAgent.name}" has been deployed (ID: ${newDeployedAgent.id})`);
          return newDeployedAgent;
        } catch (error) {
            logError(`Error deploying agent with ID: ${sourceAgent.id}`, error);
            throw error;
        }
    }
}

/**
 * Get singleton instance of DeployedAgentRepository
 */
let instance: DeployedAgentRepository | null = null;

export function getDeployedAgentRepository(): DeployedAgentRepository {
    if (!instance) {
        // Get SqliteManager instance
        const db = getSqliteManager('mcprouter');
        instance = new DeployedAgentRepository(db);
    }
    return instance;
}
