import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.TS_NODE_TRANSPILE_ONLY = "true";

const { parseServeArgs } = await import("../src/commands/serve.ts");

describe("parseServeArgs", () => {
  it("binds serve to localhost by default", () => {
    const options = parseServeArgs(["node", "server.js"]);

    assert.equal(options.host, "127.0.0.1");
    assert.equal(options.port, 3283);
  });

  it("allows an explicit network host when a token is configured", () => {
    const options = parseServeArgs([
      "--host",
      "0.0.0.0",
      "--token",
      "secret",
      "node",
      "server.js",
    ]);

    assert.equal(options.host, "0.0.0.0");
    assert.equal(options.token, "secret");
  });

  it("rejects an explicit network host without a token", () => {
    assert.throws(
      () => parseServeArgs(["--host", "0.0.0.0", "node", "server.js"]),
      /--token is required when --host is not localhost/,
    );
  });
});
