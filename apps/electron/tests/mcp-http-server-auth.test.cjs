const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const os = require("node:os");

process.env.TS_NODE_PROJECT = path.join(__dirname, "../tsconfig.json");

const originalLoad = Module._load;
Module._load = function loadWithRuntimeStubs(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => path.join(os.tmpdir(), "mcp-router-http-test"),
      },
    };
  }
  if (request === "@mcp_router/shared") {
    return {
      PROJECT_HEADER: "x-mcpr-project",
      UNASSIGNED_PROJECT_ID: "__unassigned__",
    };
  }
  if (request === "@modelcontextprotocol/sdk/server/sse") {
    return { SSEServerTransport: class SSEServerTransport {} };
  }
  if (request === "../../mcp-server-manager/mcp-server-manager") {
    return { MCPServerManager: class MCPServerManager {} };
  }
  if (request === "../aggregator-server") {
    return { AggregatorServer: class AggregatorServer {} };
  }
  if (request === "../../workspace/platform-api-manager") {
    return {
      getPlatformAPIManager: () => ({ isRemoteWorkspace: () => false }),
    };
  }
  if (request === "../token-validator") {
    return { TokenValidator: class TokenValidator {} };
  }
  if (request === "../../projects/projects.repository") {
    return {
      ProjectRepository: {
        getInstance: () => ({ findByName: () => null }),
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require("ts-node/register/transpile-only");

const {
  MCPHttpServer,
} = require("../src/main/modules/mcp-server-runtime/http/mcp-http-server.ts");

const extractBearerToken = (value) =>
  MCPHttpServer.prototype.extractBearerToken.call({}, value);

describe("MCPHttpServer Authorization compatibility", () => {
  it("accepts legacy raw token headers", () => {
    assert.equal(extractBearerToken("mcpr_legacy"), "mcpr_legacy");
  });

  it("accepts Bearer headers with casing, spacing, and quoted token variations", () => {
    assert.equal(extractBearerToken("bearer mcpr_lower"), "mcpr_lower");
    assert.equal(extractBearerToken("Bearer   mcpr_spaced"), "mcpr_spaced");
    assert.equal(extractBearerToken("Bearer Bearer mcpr_nested"), "mcpr_nested");
    assert.equal(extractBearerToken('Bearer "mcpr_quoted"'), "mcpr_quoted");
  });

  it("rejects ambiguous or unsafe Authorization headers", () => {
    assert.equal(extractBearerToken(["Bearer mcpr_one", "Bearer mcpr_two"]), null);
    assert.equal(extractBearerToken("Bearer mcpr_bad\nnext"), null);
    assert.equal(extractBearerToken(""), null);
  });
});

Module._load = originalLoad;
