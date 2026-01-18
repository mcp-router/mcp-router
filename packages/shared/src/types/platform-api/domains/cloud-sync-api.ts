/**
 * Cloud Sync domain API
 */

import type { CloudSyncStatus } from "../../cloud-sync";

export interface CloudSyncAPI {
  getStatus(): Promise<CloudSyncStatus>;
  setEnabled(enabled: boolean): Promise<CloudSyncStatus>;
  setPassphrase(passphrase: string): Promise<void>;
}
