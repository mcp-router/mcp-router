const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

require("ts-node/register/transpile-only");

const {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} = require("../src/main/utils/secret-storage.ts");
const {
  sanitizeForSecurityBoundary,
} = require("../src/main/utils/sensitive-data.ts");
const {
  normalizeRemoteMcpUrl,
} = require("../src/main/utils/remote-url-security.ts");

const createFakeSafeStorage = () => ({
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`sealed:${value}`, "utf8"),
  decryptString: (value) => value.toString("utf8").replace(/^sealed:/, ""),
});

describe("secret storage utilities", () => {
  it("encrypts secrets with an identifiable prefix and decrypts them", () => {
    const storage = createFakeSafeStorage();

    const encrypted = encryptSecret("raw-token", storage);

    assert.equal(isEncryptedSecret(encrypted), true);
    assert.equal(encrypted.includes("raw-token"), false);
    assert.equal(decryptSecret(encrypted, storage), "raw-token");
  });

  it("keeps encryption idempotent and reads legacy plaintext", () => {
    const storage = createFakeSafeStorage();
    const encrypted = encryptSecret("raw-token", storage);

    assert.equal(encryptSecret(encrypted, storage), encrypted);
    assert.equal(decryptSecret("legacy-token", storage), "legacy-token");
  });

  it("does not expose encrypted values when encryption is unavailable", () => {
    const storage = {
      isEncryptionAvailable: () => false,
      encryptString: () => Buffer.from(""),
      decryptString: () => "raw-token",
    };
    const encrypted = encryptSecret("raw-token", createFakeSafeStorage());

    assert.equal(decryptSecret(encrypted, storage), null);
  });
});

describe("security boundary sanitizer", () => {
  it("redacts secrets and removes functions before returning or scripting context", () => {
    const sanitized = sanitizeForSecurityBoundary({
      method: "tools/call",
      mcpHandler: () => "must not cross boundary",
      params: {
        name: "search",
        authorization: "Bearer raw-token",
        _meta: {
          token: "mcpr_secret",
        },
        nested: {
          apiKey: "api-key",
          visible: "value",
        },
      },
    });

    assert.deepEqual(sanitized, {
      method: "tools/call",
      params: {
        name: "search",
        authorization: "[redacted]",
        _meta: {
          token: "[redacted]",
        },
        nested: {
          apiKey: "[redacted]",
          visible: "value",
        },
      },
    });
  });
});

describe("remote MCP URL validation", () => {
  it("accepts normalized https URLs for remote MCP servers", () => {
    const url = normalizeRemoteMcpUrl(" https://example.com/mcp ");

    assert.equal(url.toString(), "https://example.com/mcp");
  });

  it("rejects localhost, private IPs, credentials, and non-https URLs", () => {
    assert.throws(() => normalizeRemoteMcpUrl("http://example.com/mcp"));
    assert.throws(() => normalizeRemoteMcpUrl("https://localhost/mcp"));
    assert.throws(() => normalizeRemoteMcpUrl("https://127.0.0.1/mcp"));
    assert.throws(() =>
      normalizeRemoteMcpUrl("https://user:pass@example.com/mcp"),
    );
  });
});
