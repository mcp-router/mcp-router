import type { Theme } from "./ui";
import type { CloudSyncState } from "./cloud-sync";
import type { SubscriptionStatus } from "./auth";

/**
 * Application settings interface
 */
export interface AppSettings {
  /**
   * User ID
   */
  userId?: string;

  /**
   * Authentication token
   */
  authToken?: string;

  /**
   * Login date/time
   */
  loggedInAt?: string;

  /**
   * Subscription status
   */
  subscriptionStatus?: SubscriptionStatus | null;

  /**
   * Plan name
   */
  planName?: string | null;

  /**
   * Number of times the package manager overlay has been displayed
   */
  packageManagerOverlayDisplayCount?: number;

  /**
   * Whether to enable loading MCP configs from external applications
   * Default: true
   */
  loadExternalMCPConfigs?: boolean;

  /**
   * Whether to enable sending analytics
   * Default: true
   */
  analyticsEnabled?: boolean;

  /**
   * Whether to enable auto-updates
   * Default: true
   */
  autoUpdateEnabled?: boolean;

  /**
   * Whether to show the app main window on OS startup
   * Default: true
   */
  showWindowOnStartup?: boolean;

  /**
   * Application theme setting
   * Default: "system"
   */
  theme?: Theme;

  /**
   * Cloud Sync state
   */
  cloudSync?: CloudSyncState;

  /**
   * Whether to prefix tool names with the source server name
   * Tool names will be prefixed with source server name (e.g., "krisp__search_meetings")
   * Default: true
   */
  prefixToolNames?: boolean;
}

/**
 * Default application settings
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  userId: "",
  authToken: "",
  loggedInAt: "",
  subscriptionStatus: null,
  planName: null,
  packageManagerOverlayDisplayCount: 0,
  loadExternalMCPConfigs: true,
  analyticsEnabled: true,
  autoUpdateEnabled: true,
  showWindowOnStartup: true,
  theme: "system",
  cloudSync: {
    enabled: false,
  },
  prefixToolNames: true,
};
