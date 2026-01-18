export type CloudSyncKdf = "argon2id";

export interface CloudSyncBlobEnvelope {
  nonce: string;
  ciphertext: string;
  schemaVersion: number;
  updatedAt: string;
  kdf: CloudSyncKdf;
  kdfSalt: string;
}

export interface CloudSyncState {
  enabled: boolean;
  lastSyncedAt?: string;
  lastError?: string;
  /** safeStorage で暗号化済み、Base64エンコード */
  encryptedPassphrase?: string;
}

export interface CloudSyncStatus extends CloudSyncState {
  hasPassphrase: boolean;
  encryptionAvailable: boolean;
}
