// apps/electron/src/main/modules/mcp-server-manager/dev-watcher.service.ts
import chokidar, { FSWatcher } from "chokidar";
import path from "path";

interface DevConfig {
  enabled: boolean;
  watch: string[];
  cwd?: string;
}

type RestartCallback = (serverId: string) => Promise<void>;

export class DevWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private restartCallback: RestartCallback;
  private debounceMs: number;

  constructor(restartCallback: RestartCallback, debounceMs: number = 500) {
    this.restartCallback = restartCallback;
    this.debounceMs = debounceMs;
  }

  async startWatching(
    serverId: string,
    patterns: string[],
    cwd: string,
  ): Promise<void> {
    // Stop existing watcher if any
    await this.stopWatching(serverId);

    const absolutePatterns = patterns.map((p) =>
      path.isAbsolute(p) ? p : path.join(cwd, p),
    );

    const watcher = chokidar.watch(absolutePatterns, {
      ignoreInitial: true,
      cwd,
      persistent: true,
    });

    watcher.on("change", (filePath) => {
      this.handleChange(serverId, filePath);
    });

    watcher.on("add", (filePath) => {
      this.handleChange(serverId, filePath);
    });

    watcher.on("unlink", (filePath) => {
      this.handleChange(serverId, filePath);
    });

    watcher.on("error", (error) => {
      console.error(`[DevWatcher] Watcher error for ${serverId}:`, error);
    });

    this.watchers.set(serverId, watcher);
    console.log(
      `[DevWatcher] Started watching ${patterns.length} patterns for ${serverId}`,
    );
  }

  private handleChange(serverId: string, filePath: string): void {
    console.log(
      `[DevWatcher] File changed: ${filePath} for server ${serverId}`,
    );

    // Debounce restarts
    const existingTimer = this.debounceTimers.get(serverId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(serverId);
      console.log(`[DevWatcher] Triggering restart for ${serverId}`);
      try {
        await this.restartCallback(serverId);
      } catch (error) {
        console.error(`[DevWatcher] Restart failed for ${serverId}:`, error);
      }
    }, this.debounceMs);

    this.debounceTimers.set(serverId, timer);
  }

  async stopWatching(serverId: string): Promise<void> {
    const watcher = this.watchers.get(serverId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(serverId);
      console.log(`[DevWatcher] Stopped watching ${serverId}`);
    }

    const timer = this.debounceTimers.get(serverId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(serverId);
    }
  }

  async stopAll(): Promise<void> {
    const serverIds = Array.from(this.watchers.keys());
    await Promise.all(serverIds.map((id) => this.stopWatching(id)));
  }

  isWatching(serverId: string): boolean {
    return this.watchers.has(serverId);
  }

  getWatchedServers(): string[] {
    return Array.from(this.watchers.keys());
  }
}
