/**
 * URL validation utilities for security
 * Prevents SSRF attacks by validating URLs before use
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
]);

const BLOCKED_HOST_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.x.x.x
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16-31.x.x
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.x.x
];

export interface URLValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Validate a URL for safety (prevents SSRF)
 */
function validateExternalUrl(url: string): URLValidationResult {
  try {
    const parsed = new URL(url);

    // Must be HTTPS or HTTP
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { isValid: false, error: "URL must use http or https protocol" };
    }

    // Block internal hosts
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname)) {
      return { isValid: false, error: "Internal hosts are not allowed" };
    }

    // Block private IP ranges
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return { isValid: false, error: "Private IP ranges are not allowed" };
      }
    }

    return { isValid: true, normalizedUrl: parsed.toString() };
  } catch (_error) {
    return { isValid: false, error: "Invalid URL format" };
  }
}

/**
 * Validate URL for elicitation (stricter - must be HTTPS)
 */
export function validateElicitationUrl(url: string): URLValidationResult {
  const result = validateExternalUrl(url);
  if (!result.isValid) return result;

  const parsed = new URL(url);

  // Elicitation URLs must be HTTPS (security requirement)
  if (parsed.protocol !== "https:") {
    return { isValid: false, error: "Elicitation URLs must use HTTPS" };
  }

  return result;
}
