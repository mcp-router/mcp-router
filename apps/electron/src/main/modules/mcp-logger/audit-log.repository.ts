import {
  SqliteManager,
  getSqliteManager,
} from "../../infrastructure/database/sqlite-manager";

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  targetType: string;
  details: string;
  ipAddress: string | null;
}

export type AuditLogEntryInput = Omit<AuditLogEntry, "id">;

export interface AuditLogQueryOptions {
  limit?: number;
  offset?: number;
  action?: string;
  actor?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Append-only audit log repository for compliance-grade logging.
 * Intentionally does NOT extend BaseRepository to prevent update/delete operations.
 */
export class AuditLogRepository {
  private static instance: AuditLogRepository | null = null;

  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      target_type TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT
    )
  `;

  private static readonly INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_target_type ON audit_log(target_type)",
  ];

  private db: SqliteManager;

  private constructor(db: SqliteManager) {
    this.db = db;
    this.initializeTable();
  }

  private initializeTable(): void {
    this.db.exec(AuditLogRepository.CREATE_TABLE_SQL);
    for (const index of AuditLogRepository.INDEXES) {
      this.db.exec(index);
    }
  }

  static getInstance(): AuditLogRepository {
    if (!AuditLogRepository.instance) {
      const db = getSqliteManager();
      AuditLogRepository.instance = new AuditLogRepository(db);
    }
    return AuditLogRepository.instance;
  }

  static resetInstance(): void {
    AuditLogRepository.instance = null;
  }

  /**
   * Insert an audit log entry. This is the ONLY write operation.
   * No update or delete methods exist by design.
   */
  insertEntry(entry: AuditLogEntryInput): void {
    this.db.execute(
      `INSERT INTO audit_log (timestamp, actor, action, target, target_type, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.timestamp,
        entry.actor,
        entry.action,
        entry.target,
        entry.targetType,
        entry.details,
        entry.ipAddress ?? null,
      ],
    );
  }

  /**
   * Query audit log entries with optional filters.
   */
  getEntries(options: AuditLogQueryOptions = {}): AuditLogEntry[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.action) {
      conditions.push("action = ?");
      params.push(options.action);
    }
    if (options.actor) {
      conditions.push("actor = ?");
      params.push(options.actor);
    }
    if (options.targetType) {
      conditions.push("target_type = ?");
      params.push(options.targetType);
    }
    if (options.startDate) {
      conditions.push("timestamp >= ?");
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push("timestamp <= ?");
      params.push(options.endDate);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const rows = this.db.all<{
      id: number;
      timestamp: string;
      actor: string;
      action: string;
      target: string;
      target_type: string;
      details: string;
      ip_address: string | null;
    }>(
      `SELECT id, timestamp, actor, action, target, target_type, details, ip_address
       FROM audit_log ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      actor: row.actor,
      action: row.action,
      target: row.target,
      targetType: row.target_type,
      details: row.details,
      ipAddress: row.ip_address,
    }));
  }

  /**
   * Get total count of entries matching filters.
   */
  getEntryCount(filters?: { action?: string; actor?: string }): number {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.action) {
      conditions.push("action = ?");
      params.push(filters.action);
    }
    if (filters?.actor) {
      conditions.push("actor = ?");
      params.push(filters.actor);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_log ${where}`,
      params,
    );

    return result?.count ?? 0;
  }

  /**
   * Export entries as JSON Lines format for SIEM integration.
   */
  exportJsonLines(
    startDate: string,
    endDate: string,
    limit: number = 100000,
  ): string {
    const entries = this.getEntries({
      startDate,
      endDate,
      limit,
    });
    return entries.map((entry) => JSON.stringify(entry)).join("\n");
  }
}
