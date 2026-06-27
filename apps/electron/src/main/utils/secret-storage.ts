export const ENCRYPTED_SECRET_PREFIX = "mcpr-secret:v1:" as const;

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENCRYPTED_SECRET_PREFIX);
}

export function encryptSecret(
  value: string,
  storage: {
    isEncryptionAvailable: () => boolean;
    encryptString: (value: string) => Buffer;
  },
): string {
  if (!value || isEncryptedSecret(value)) {
    return value;
  }

  if (!storage.isEncryptionAvailable()) {
    return value;
  }

  return `${ENCRYPTED_SECRET_PREFIX}${storage.encryptString(value).toString("base64")}`;
}

export function decryptSecret(
  value: string | null | undefined,
  storage: {
    isEncryptionAvailable: () => boolean;
    decryptString: (value: Buffer) => string;
  },
): string | null {
  if (!value) {
    return null;
  }

  if (!isEncryptedSecret(value)) {
    return value;
  }

  if (!storage.isEncryptionAvailable()) {
    return null;
  }

  try {
    const encryptedValue = value.slice(ENCRYPTED_SECRET_PREFIX.length);
    return storage.decryptString(Buffer.from(encryptedValue, "base64")) || null;
  } catch (error) {
    console.error("[SecretStorage] Failed to decrypt stored secret:", error);
    return null;
  }
}

export function secretToStorage(
  value: string | null | undefined,
  storage: {
    isEncryptionAvailable: () => boolean;
    encryptString: (value: string) => Buffer;
  },
): string | null {
  return value ? encryptSecret(value, storage) : null;
}
