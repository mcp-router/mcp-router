const { describe, it, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const os = require("node:os");

process.env.TS_NODE_PROJECT = path.join(__dirname, "../tsconfig.json");

const originalLoad = Module._load;
Module._load = function loadWithElectronStub(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => path.join(os.tmpdir(), "mcp-router-token-test"),
      },
    };
  }
  if (request === "@mcp_router/shared") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

require("ts-node/register/transpile-only");

const {
  McpAppsManagerRepository,
} = require("../src/main/modules/mcp-apps-manager/mcp-apps-manager.repository.ts");
const {
  TokenManager,
} = require("../src/main/modules/mcp-apps-manager/token-manager.ts");

describe("TokenManager", () => {
  let tokens;

  beforeEach(() => {
    tokens = new Map();
    McpAppsManagerRepository.getInstance = () => ({
      getToken: (id) => tokens.get(id) || null,
      getTokensByClientId: (clientId) =>
        Array.from(tokens.values()).filter(
          (token) => token.clientId === clientId,
        ),
      deleteClientTokens: (clientId) => {
        let count = 0;
        for (const [id, token] of tokens.entries()) {
          if (token.clientId === clientId) {
            tokens.delete(id);
            count += 1;
          }
        }
        return count;
      },
      saveToken: (token) => {
        tokens.set(token.id, token);
      },
      deleteToken: (id) => tokens.delete(id),
      listTokens: () => Array.from(tokens.values()),
      updateTokenServerAccess: (id, serverAccess) => {
        const token = tokens.get(id);
        if (!token) return false;
        token.serverAccess = serverAccess || {};
        return true;
      },
    });
  });

  after(() => {
    Module._load = originalLoad;
  });

  it("keeps legacy tokens without expiresAt valid after the TTL feature is introduced", () => {
    const issuedAtMoreThanThirtyDaysAgo =
      Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;
    tokens.set("mcpr_legacy", {
      id: "mcpr_legacy",
      clientId: "codex",
      issuedAt: issuedAtMoreThanThirtyDaysAgo,
      serverAccess: {},
    });

    const validation = new TokenManager().validateToken("mcpr_legacy");

    assert.deepEqual(validation, {
      isValid: true,
      clientId: "codex",
    });
  });

  it("keeps tokens with expired expiresAt valid for MCP compatibility", () => {
    tokens.set("mcpr_expired", {
      id: "mcpr_expired",
      clientId: "codex",
      issuedAt: Math.floor(Date.now() / 1000) - 60,
      expiresAt: Math.floor(Date.now() / 1000) - 1,
      serverAccess: {},
    });

    const validation = new TokenManager().validateToken("mcpr_expired");

    assert.deepEqual(validation, {
      isValid: true,
      clientId: "codex",
    });
  });

  it("sets expiresAt on newly generated tokens", () => {
    const before = Math.floor(Date.now() / 1000);

    const token = new TokenManager().generateToken({
      clientId: "codex",
      serverAccess: {},
    });

    assert.equal(token.clientId, "codex");
    assert.match(token.id, /^mcpr_[A-Za-z0-9_-]+$/);
    assert.equal(typeof token.expiresAt, "number");
    assert.ok(token.expiresAt >= before + 30 * 24 * 60 * 60);
  });
});
