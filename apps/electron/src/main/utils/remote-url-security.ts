import dns from "dns/promises";
import net from "net";

const MAX_REMOTE_URL_LENGTH = 2048;
const MAX_REMOTE_REDIRECTS = 3;

const PRIVATE_IPV4_RANGES = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  ["255.255.255.255", 32],
] as const;

function ipv4ToNumber(address: string): number {
  return (
    address.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>>
    0
  );
}

function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function isIpv4InRange(address: string, cidrBase: string, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToNumber(address) & mask) === (ipv4ToNumber(cidrBase) & mask);
}

function isPrivateIpv4(address: string): boolean {
  return PRIVATE_IPV4_RANGES.some(([cidrBase, prefix]) =>
    isIpv4InRange(address, cidrBase, prefix),
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff")
  );
}

function isBlockedIpAddress(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    return isPrivateIpv4(address);
  }
  if (ipVersion === 6) {
    return isBlockedIpv6(address);
  }
  return false;
}

function assertSafeHostname(url: URL): void {
  const hostname = url.hostname.toLowerCase();

  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error("Remote MCP URL must not target localhost");
  }

  if (!hostname.includes(".") && net.isIP(hostname) === 0) {
    throw new Error("Remote MCP URL must use a fully qualified hostname");
  }

  if (isBlockedIpAddress(hostname)) {
    throw new Error("Remote MCP URL must not target private or reserved IPs");
  }
}

export function normalizeRemoteMcpUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_REMOTE_URL_LENGTH ||
    hasControlChars(trimmed)
  ) {
    throw new Error("Invalid remote MCP URL");
  }

  const url = new URL(trimmed);
  if (url.protocol !== "https:") {
    throw new Error("Remote MCP URL must use https");
  }

  if (url.username || url.password) {
    throw new Error("Remote MCP URL must not include credentials");
  }

  assertSafeHostname(url);
  return url;
}

export async function validateRemoteMcpUrl(rawUrl: string): Promise<URL> {
  const url = normalizeRemoteMcpUrl(rawUrl);
  const addresses = await dns.lookup(url.hostname, { all: true });

  if (addresses.length === 0) {
    throw new Error("Remote MCP URL hostname could not be resolved");
  }

  if (addresses.some(({ address }) => isBlockedIpAddress(address))) {
    throw new Error("Remote MCP URL resolves to a private or reserved IP");
  }

  return url;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof input === "string") {
    return input;
  }
  return input.url;
}

export async function secureRemoteMcpFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  redirectCount = 0,
): Promise<Response> {
  const url = await validateRemoteMcpUrl(getRequestUrl(input));
  const response = await fetch(url, { ...init, redirect: "manual" });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.has("location")
  ) {
    if (redirectCount >= MAX_REMOTE_REDIRECTS) {
      throw new Error("Remote MCP URL exceeded redirect limit");
    }

    const redirectedUrl = new URL(response.headers.get("location")!, url);
    if (redirectedUrl.origin !== url.origin) {
      throw new Error("Remote MCP URL redirects must stay on the same origin");
    }
    await validateRemoteMcpUrl(redirectedUrl.toString());
    return secureRemoteMcpFetch(redirectedUrl, init, redirectCount + 1);
  }

  return response;
}
