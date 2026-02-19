/**
 * Registry for tracking MCP Tasks across backend servers.
 * Tasks are namespaced by server name to avoid ID collisions.
 */

export interface TaskEntry {
  /** Namespaced task ID: serverName:originalTaskId */
  namespacedId: string;
  /** Original task ID from the backend server */
  originalTaskId: string;
  /** Backend server name that owns this task */
  serverName: string;
  /** Backend server ID */
  serverId: string;
  /** When the task was registered */
  createdAt: number;
  /** Last known task status */
  status: string;
}

const TASK_SEPARATOR = "::";

export function createNamespacedTaskId(
  serverName: string,
  originalTaskId: string,
): string {
  return `${serverName}${TASK_SEPARATOR}${originalTaskId}`;
}

function parseNamespacedTaskId(
  namespacedId: string,
): { serverName: string; originalTaskId: string } | null {
  const idx = namespacedId.indexOf(TASK_SEPARATOR);
  if (idx === -1) return null;
  return {
    serverName: namespacedId.substring(0, idx),
    originalTaskId: namespacedId.substring(idx + TASK_SEPARATOR.length),
  };
}

export class TaskRegistry {
  private static instance: TaskRegistry | null = null;
  private tasks: Map<string, TaskEntry> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Clean up stale tasks every 5 minutes
    this.cleanupTimer = setInterval(
      () => this.cleanup(30 * 60 * 1000),
      5 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  static resetInstance(): void {
    if (TaskRegistry.instance?.cleanupTimer) {
      clearInterval(TaskRegistry.instance.cleanupTimer);
    }
    TaskRegistry.instance = null;
  }

  /**
   * Register a task from a backend server response.
   * Returns the namespaced task ID for the client.
   */
  registerTask(
    originalTaskId: string,
    serverName: string,
    serverId: string,
    status = "working",
  ): string {
    const namespacedId = createNamespacedTaskId(serverName, originalTaskId);
    this.tasks.set(namespacedId, {
      namespacedId,
      originalTaskId,
      serverName,
      serverId,
      createdAt: Date.now(),
      status,
    });
    return namespacedId;
  }

  /**
   * Look up a task by its namespaced ID.
   */
  getTask(namespacedId: string): TaskEntry | undefined {
    return this.tasks.get(namespacedId);
  }

  /**
   * Get the server name for a task (for routing).
   */
  getServerForTask(namespacedId: string): string | undefined {
    return this.tasks.get(namespacedId)?.serverName;
  }

  /**
   * List all tasks, optionally filtered by server.
   */
  listTasks(serverName?: string): TaskEntry[] {
    const entries = Array.from(this.tasks.values());
    if (serverName) {
      return entries.filter((t) => t.serverName === serverName);
    }
    return entries;
  }

  /**
   * Update the status of a tracked task.
   */
  updateStatus(namespacedId: string, status: string): void {
    const task = this.tasks.get(namespacedId);
    if (task) {
      task.status = status;
    }
  }

  /**
   * Remove a task from tracking.
   */
  removeTask(namespacedId: string): void {
    this.tasks.delete(namespacedId);
  }

  /**
   * Remove tasks older than the specified age.
   */
  cleanup(olderThanMs: number): void {
    const cutoff = Date.now() - olderThanMs;
    for (const [id, entry] of this.tasks) {
      if (entry.createdAt < cutoff) {
        this.tasks.delete(id);
      }
    }
  }

  /**
   * Get count of tracked tasks.
   */
  get size(): number {
    return this.tasks.size;
  }
}

export function getTaskRegistry(): TaskRegistry {
  return TaskRegistry.getInstance();
}
