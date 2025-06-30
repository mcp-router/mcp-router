/**
 * Package management domain API (includes system utilities)
 */

import { ServerPackageUpdates } from "@mcp-router/shared";
import { Unsubscribe } from "./auth-api";

export type PackageManager = "pnpm" | "uvx";
export type Platform = "darwin" | "win32" | "linux";

export interface ResolveResult {
  success: boolean;
  resolvedArgs?: string;
  error?: string;
}

export interface UpdateResult {
  success: boolean;
  updates?: ServerPackageUpdates;
  error?: string;
}

export interface ManagerStatus {
  node: boolean;
  pnpm: boolean;
  uv: boolean;
}

export interface InstallResult {
  success: boolean;
  installed: ManagerStatus;
  errors?: {
    node?: string;
    pnpm?: string;
    uv?: string;
  };
}

export interface UpdateInfo {
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
