/**
 * Shared workspace types used across the application
 */

export interface Workspace {
  id: string;
  name: string;
  type: "local" | "remote";
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  localConfig?: {
    databasePath: string;
  };
  remoteConfig?: {
    apiUrl: string;
    authToken?: string;
  };
  displayInfo?: {
    avatarUrl?: string;
    teamName?: string;
  };
}

export interface WorkspaceCreateConfig {
  id?: string;
  name: string;
  type: "local" | "remote";
  remoteConfig?: {
    apiUrl: string;
    authToken?: string;
  };
}

export interface WorkspaceUpdateConfig {
  name?: string;
  type?: "local" | "remote";
  remoteConfig?: {
    apiUrl?: string;
    authToken?: string;
  };
}
