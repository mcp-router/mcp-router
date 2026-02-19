import { AuditLogRepository, AuditLogEntry } from "./audit-log.repository";
import { logError } from "@/main/utils/logger";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "authToken",
  "auth_token",
  "bearer",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "privateKey",
  "private_key",
]);

/**
 * Audit log service for compliance-grade action logging.
 * All configuration changes, auth events, and administrative actions
 * are recorded in an append-only audit log.
 */
export class AuditLogService {
  private static instance: AuditLogService | null = null;

  private constructor() {}

  public static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  public static resetInstance(): void {
    AuditLogService.instance = null;
  }

  private get repository(): AuditLogRepository {
    return AuditLogRepository.getInstance();
  }

  private log(
    action: string,
    target: string,
    targetType: string,
    details?: object,
    actor?: string,
  ): void {
    try {
      this.repository.insertEntry({
        timestamp: new Date().toISOString(),
        actor: actor ?? "system",
        action,
        target,
        targetType,
        details: details ? JSON.stringify(this.scrubSensitiveData(details)) : "{}",
        ipAddress: null,
      });
    } catch (error) {
      logError("Failed to write audit log entry", error);
    }
  }

  logServerAction(
    action: "create" | "update" | "delete" | "start" | "stop" | "toggle",
    serverName: string,
    details?: object,
  ): void {
    this.log(`server.${action}`, serverName, "server", details);
  }

  logSettingsChange(
    setting: string,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    this.log("settings.update", setting, "settings", {
      before: oldValue,
      after: newValue,
    });
  }

  logTokenAction(
    action: "generate" | "revoke",
    tokenName: string,
    details?: object,
  ): void {
    this.log(`token.${action}`, tokenName, "token", details);
  }

  logWorkspaceAction(
    action: "create" | "switch" | "delete",
    workspaceName: string,
    details?: object,
  ): void {
    this.log(`workspace.${action}`, workspaceName, "workspace", details);
  }

  logAuthAction(
    action: "login" | "logout" | "token_refresh",
    details?: object,
  ): void {
    this.log(`auth.${action}`, "auth", "auth", details);
  }

  logSkillAction(
    action: "install" | "uninstall" | "enable" | "disable",
    skillName: string,
    details?: object,
  ): void {
    this.log(`skill.${action}`, skillName, "skill", details);
  }

  logProjectAction(
    action: "create" | "update" | "delete",
    projectName: string,
    details?: object,
  ): void {
    this.log(`project.${action}`, projectName, "project", details);
  }

  public queryLogs(filters?: { action?: string; actor?: string; startDate?: string; endDate?: string; limit?: number }): AuditLogEntry[] {
    return this.repository.getEntries(filters);
  }

  public getLogCount(filters?: { action?: string; actor?: string }): number {
    return this.repository.getEntryCount(filters);
  }

  /**
   * Scrub sensitive data from objects before logging.
   * Replaces values of known sensitive keys with '***REDACTED***'.
   */
  scrubSensitiveData(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") return obj;
    if (typeof obj === "number" || typeof obj === "boolean") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.scrubSensitiveData(item));
    }

    if (typeof obj === "object") {
      const scrubbed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key)) {
          scrubbed[key] = "***REDACTED***";
        } else if (typeof value === "object" && value !== null) {
          scrubbed[key] = this.scrubSensitiveData(value);
        } else {
          scrubbed[key] = value;
        }
      }
      return scrubbed;
    }

    return obj;
  }
}

export function getAuditLogService(): AuditLogService {
  return AuditLogService.getInstance();
}
