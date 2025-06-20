/**
 * Stub encryption utilities for database package
 * Note: These are placeholder functions that don't actually encrypt.
 * The actual encryption is handled by the Electron app.
 */

export function encryptStringSync(text: string): string {
  return text;
}

export function decryptStringSync(encryptedText: string): string {
  return encryptedText;
}

export function encryptObjectSync<T>(obj: T): string {
  if (obj === undefined || obj === null) return '';
  try {
    return JSON.stringify(obj);
  } catch (err) {
    console.error('Object serialization error:', err);
    return '';
  }
}

export function decryptObjectSync<T>(encryptedText: string): T | null {
  if (!encryptedText) return null;
  try {
    return JSON.parse(encryptedText) as T;
  } catch (err) {
    console.error('Object deserialization error:', err);
    return null;
  }
}