const SENSITIVE_KEY_PATTERN =
  /(authorization|bearer|token|api[-_]?key|secret|password|passphrase|credential)/i;

const MAX_SANITIZE_DEPTH = 6;
const MAX_SANITIZE_ARRAY_LENGTH = 50;

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[circular]";
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return "[truncated]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_SANITIZE_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }

    const sanitizedValue = sanitizeValue(item, depth + 1, seen);
    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
}

export function sanitizeForSecurityBoundary(value: unknown): unknown {
  return sanitizeValue(value, 0, new WeakSet<object>());
}
