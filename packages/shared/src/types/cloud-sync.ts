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
  /** Encrypted with safeStorage, Base64-encoded */
  encryptedPassphrase?: string;
}

export interface CloudSyncStatus extends CloudSyncState {
  hasPassphrase: boolean;
  encryptionAvailable: boolean;
}
