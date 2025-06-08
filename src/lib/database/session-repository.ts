import { BaseRepository } from './base-repository';
import { getSqliteManager } from './sqlite-manager';
import { v4 as uuidv4 } from 'uuid';

/**
 * Chat session entity interface
 */
export interface ChatSession {
  id: string;
  agentId: string;
  title?: string;
  messages: any[]; // Array of messages from @ai-sdk/react
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Chat session repository for local database storage
 */
export class SessionRepository extends BaseRepository<ChatSession> {
  constructor() {
    const db = getSqliteManager();
    super(db, 'chat_sessions');
  }

  /**
   * Initialize the chat_sessions table
   */
  protected initializeTable(): void {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        title TEXT,
        messages TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0
      )
    `;

    this.db.execute(createTableSql);

    // Create index for agent_id to improve query performance
    this.db.execute('CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id)');
    
    // Create index for created_at to improve sorting performance
    this.db.execute('CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at)');
  }

  /**
   * Map database row to ChatSession entity
   */
  protected mapRowToEntity(row: any): ChatSession {
    return {
      id: row.id,
      agentId: row.agent_id,
      title: row.title || undefined,
      messages: JSON.parse(row.messages || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count || 0,
    };
  }

  /**
   * Map ChatSession entity to database row
   */
  protected mapEntityToRow(entity: ChatSession): Record<string, any> {
    return {
      id: entity.id,
      agent_id: entity.agentId,
      title: entity.title || null,
      messages: JSON.stringify(entity.messages || []),
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
      message_count: entity.messageCount || 0,
    };
  }

  /**
   * Get sessions by agent ID with pagination
   */
  public getSessionsByAgent(agentId: string, options: {
    limit?: number;
    cursor?: string; // timestamp for cursor-based pagination
    orderBy?: 'created_at' | 'updated_at';
    order?: 'ASC' | 'DESC';
  } = {}): { sessions: ChatSession[], hasMore: boolean, nextCursor?: string } {
    try {
      const {
        limit = 10,
        cursor,
        orderBy = 'updated_at',
        order = 'DESC'
      } = options;

      // Build WHERE clause
      let whereClause = 'agent_id = :agentId';
      const params: any = { agentId };

      // Add cursor condition for pagination
      if (cursor) {
        const cursorTimestamp = parseInt(cursor, 10);
        if (order === 'DESC') {
          whereClause += ` AND ${orderBy} < :cursor`;
        } else {
          whereClause += ` AND ${orderBy} > :cursor`;
        }
        params.cursor = cursorTimestamp;
      }

      // Query with limit + 1 to check if there are more results
      const sql = `
        SELECT * FROM chat_sessions 
        WHERE ${whereClause} 
        ORDER BY ${orderBy} ${order} 
        LIMIT :limit
      `;

      const rows = this.db.all<any>(sql, {
        ...params,
        limit: limit + 1 // Get one extra to check if there are more
      });

      // Check if there are more results
      const hasMore = rows.length > limit;
      const sessions = rows.slice(0, limit).map(row => this.mapRowToEntity(row));

      // Get next cursor from the last item
      let nextCursor: string | undefined;
      if (hasMore && sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        nextCursor = String(orderBy === 'created_at' ? lastSession.createdAt : lastSession.updatedAt);
      }

      return {
        sessions,
        hasMore,
        nextCursor
      };
    } catch (error) {
      console.error('Error getting sessions by agent:', error);
      throw error;
    }
  }

  /**
   * Create a new chat session
   */
  public createSession(agentId: string, initialMessages: any[] = [], title?: string): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: uuidv4(),
      agentId,
      title,
      messages: initialMessages,
      createdAt: now,
      updatedAt: now,
      messageCount: initialMessages.length,
    };

    return this.add(session);
  }

  /**
   * Update session messages
   */
  public updateSessionMessages(sessionId: string, messages: any[]): ChatSession | undefined {
    const session = this.getById(sessionId);
    if (!session) {
      return undefined;
    }

    // Generate title from first user message if not set
    let title = session.title;
    if (!title && messages.length > 0) {
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      if (firstUserMessage && firstUserMessage.content) {
        title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
      }
    }

    return this.update(sessionId, {
      messages,
      messageCount: messages.length,
      updatedAt: Date.now(),
      title: title || session.title,
    });
  }

  /**
   * Add a message to an existing session
   */
  public addMessageToSession(sessionId: string, message: any): ChatSession | undefined {
    const session = this.getById(sessionId);
    if (!session) {
      return undefined;
    }

    const updatedMessages = [...session.messages, message];
    return this.updateSessionMessages(sessionId, updatedMessages);
  }

  /**
   * Delete sessions by agent ID
   */
  public deleteSessionsByAgent(agentId: string): number {
    try {
      const sql = 'DELETE FROM chat_sessions WHERE agent_id = :agentId';
      const result = this.db.execute(sql, { agentId });
      return Number(result.changes) || 0;
    } catch (error) {
      console.error('Error deleting sessions by agent:', error);
      throw error;
    }
  }

  /**
   * Get session count by agent
   */
  public getSessionCountByAgent(agentId: string): number {
    return this.count({ agent_id: agentId });
  }

  /**
   * Clean up old sessions (keep only the most recent N sessions per agent)
   */
  public cleanupOldSessions(maxSessionsPerAgent: number = 100): void {
    try {
      // Get all agent IDs
      const agentIds = this.db.all<{ agent_id: string }>(
        'SELECT DISTINCT agent_id FROM chat_sessions'
      );

      for (const { agent_id: agentId } of agentIds) {
        // Get sessions for this agent, ordered by updated_at DESC
        const sessions = this.db.all<{ id: string }>(
          `SELECT id FROM chat_sessions 
           WHERE agent_id = :agentId 
           ORDER BY updated_at DESC 
           LIMIT -1 OFFSET :offset`,
          { agentId, offset: maxSessionsPerAgent }
        );

        // Delete old sessions
        if (sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id);
          const placeholders = sessionIds.map(() => '?').join(',');
          this.db.execute(
            `DELETE FROM chat_sessions WHERE id IN (${placeholders})`,
            sessionIds
          );
          console.log(`Cleaned up ${sessions.length} old sessions for agent ${agentId}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }
}

// Singleton instance
let sessionRepositoryInstance: SessionRepository | null = null;

/**
 * Get the singleton instance of SessionRepository
 */
export function getSessionRepository(): SessionRepository {
  if (!sessionRepositoryInstance) {
    sessionRepositoryInstance = new SessionRepository();
  }
  return sessionRepositoryInstance;
}