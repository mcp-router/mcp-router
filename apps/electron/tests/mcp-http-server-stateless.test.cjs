const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const os = require("node:os");

process.env.TS_NODE_PROJECT = path.join(__dirname, "../tsconfig.json");

const originalLoad = Module._load;
Module._load = function loadWithRuntimeStubs(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { getPath: () => path.join(os.tmpdir(), "mcp-router-http-test") },
    };
  }
  if (request === "@mcp_router/shared") {
    return {
      PROJECT_HEADER: "x-mcpr-project",
      UNASSIGNED_PROJECT_ID: "__unassigned__",
    };
  }
  if (request === "./request-handlers") {
    return {
      RequestHandlers: class RequestHandlers {
        async handleListTools() {
          return { tools: [] };
        }
      },
    };
  }
  if (request === "@/main/modules/mcp-logger/mcp-logger.service") {
    return { getLogService: () => ({ recordMcpRequestLog() {} }) };
  }
  if (request === "@modelcontextprotocol/sdk/server/sse") {
    return { SSEServerTransport: class SSEServerTransport {} };
  }
  if (request === "../../workspace/platform-api-manager") {
    return {
      getPlatformAPIManager: () => ({ isRemoteWorkspace: () => false }),
    };
  }
  if (request === "../token-validator") {
    return {
      TokenValidator: class TokenValidator {
        validateToken() {
          return { isValid: true };
        }
      },
    };
  }
  if (request === "../../projects/projects.repository") {
    return {
      ProjectRepository: { getInstance: () => ({ findByName: () => null }) },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require("ts-node/register/transpile-only");

const {
  AggregatorServer,
} = require("../src/main/modules/mcp-server-runtime/aggregator-server.ts");
const {
  MCPHttpServer,
} = require("../src/main/modules/mcp-server-runtime/http/mcp-http-server.ts");

describe("MCPHttpServer stateless MCP sequence", () => {
  let aggregator;
  let listener;
  let endpoint;

  before(async () => {
    aggregator = new AggregatorServer({});
    const server = new MCPHttpServer({}, 0, aggregator);
    listener = server.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => listener.once("listening", resolve));
    endpoint = `http://127.0.0.1:${listener.address().port}/mcp`;
  });

  after(async () => {
    await new Promise((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve())),
    );
    await aggregator.shutdown();
    Module._load = originalLoad;
  });

  it("handles initialize followed by notifications/initialized", async () => {
    const headers = {
      accept: "application/json, text/event-stream",
      authorization: "mcpr_test",
      "content-type": "application/json",
    };
    const initialize = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(initialize.status, 200);

    const initialized = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }),
    });
    assert.equal(initialized.status, 202);
  });
});
