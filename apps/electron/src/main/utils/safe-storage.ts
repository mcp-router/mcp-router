import { safeStorage } from "electron";

/** Prefix used to identify encrypted values in the config file */
const ENCRYPTED_PREFIX = "enc:";

/**
 * Check whether Electron's safeStorage encryption is available.
 */
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Encrypt a plaintext string using Electron's safeStorage API.
 * Returns the encrypted value with an "enc:" prefix.
 * If encryption is unavailable, returns the plaintext unchanged.
 */
export function encryptString(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (!isEncryptionAvailable()) return plaintext;
  try {
    const encrypted = safeStorage.encryptString(plaintext);
    return ENCRYPTED_PREFIX + encrypted.toString("base64");
  } catch (error) {
    console.error("[safe-storage] Encryption failed, storing plaintext:", error);
    return plaintext;
  }
}

/**
 * Decrypt a value that may be encrypted (prefixed with "enc:") or plaintext.
 * Transparently handles both formats for migration compatibility.
 */
export function decryptString(value: string): string {
  if (!value) return value;
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    // Plaintext value (pre-encryption or encryption unavailable)
    return value;
  }
  if (!isEncryptionAvailable()) {
    console.warn(
      "[safe-storage] Encryption not available, cannot decrypt value",
    );
    return "";
  }
  try {
    const base64 = value.slice(ENCRYPTED_PREFIX.length);
    return safeStorage.decryptString(Buffer.from(base64, "base64"));
  } catch (error) {
    console.error("[safe-storage] Decryption failed:", error);
    return "";
  }
}

/**
 * Check whether a value is already encrypted (has the enc: prefix).
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}
