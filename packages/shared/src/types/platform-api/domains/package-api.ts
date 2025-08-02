/**
 * Package management domain API (includes system utilities)
 */

import type { ServerPackageUpdates } from "../../mcp-app-types";
import type { Unsubscribe } from "./auth-api";

type PackageManager = "pnpm" | "uvx";
type Platform = "darwin" | "win32" | "linux";

interface ResolveResult {
  success: boolean;
  resolvedArgs?: string;
  error?: string;
}

interface UpdateResult {
  success: boolean;
  updates?: ServerPackageUpdates;
  error?: string;
}

interface ManagerStatus {
  node: boolean;
  pnpm: boolean;
  uv: boolean;
}

interface InstallResult {
  success: boolean;
  installed: ManagerStatus;
  errors?: {
    node?: string;
    pnpm?: string;
    uv?: string;
  };
}

interface UpdateInfo {
  updateAvailable: boolean;
  version?: string;
  releaseNotes?: string;
}

export interface PackageAPI {
  // Package management
  resolveVersions(
    argsString: string,
    manager: PackageManager,
  ): Promise<ResolveResult>;
  checkUpdates(args: string[], manager: PackageManager): Promise<UpdateResult>;
  checkManagers(): Promise<ManagerStatus>;
  installManagers(): Promise<InstallResult>;

  // System utilities
  system: {
    getPlatform(): Promise<Platform>;
    checkCommand(command: string): Promise<boolean>;
    restartApp(): Promise<boolean>;
    checkForUpdates(): Promise<UpdateInfo>;
    installUpdate(): Promise<boolean>;
    onUpdateAvailable(callback: (available: boolean) => void): Unsubscribe;
    onProtocolUrl(callback: (url: string) => void): Unsubscribe;
  };
}
