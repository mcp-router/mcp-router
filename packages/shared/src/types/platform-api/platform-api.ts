/**
 * Platform API interface with consolidated domain structure
 */

import { AuthAPI } from "./domains/auth-api";
import { ServerAPI } from "./domains/server-api";
import { AppAPI } from "./domains/app-api";
import { PackageAPI } from "./domains/package-api";
import { SettingsAPI } from "./domains/settings-api";
import { CloudSyncAPI } from "./domains/cloud-sync-api";
import { LogAPI } from "./domains/log-api";
import { WorkspaceAPI } from "./domains/workspace-api";
import { WorkflowAPI } from "./domains/workflow-api";
import { ProjectsAPI } from "./domains/projects-api";
import { SkillsAPI } from "./domains/skills-api";

/**
 * Main Platform API interface with domain-driven structure
 * Consolidates related functionality into logical domains
 */
export interface PlatformAPI {
  // Authentication domain
  auth: AuthAPI;

  // Server management domain
  servers: ServerAPI;

  // Application management domain (includes token management)
  apps: AppAPI;

  // Package management domain (includes system utilities)
  packages: PackageAPI;

  // Settings management domain
  settings: SettingsAPI;

  // Cloud Sync domain
  cloudSync: CloudSyncAPI;

  // Log management domain
  logs: LogAPI;

  // Workspace management domain
  workspaces: WorkspaceAPI;

  // Workflow and Hook Module management domain
  workflows: WorkflowAPI;

  // Projects management domain
  projects: ProjectsAPI;

  // Skills management domain
  skills: SkillsAPI;
}
