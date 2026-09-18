const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(relative, mocks = {}) {
  const file = path.join(__dirname, relative);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    console,
    Buffer,
    fetch: () => {
      throw new Error("Unexpected network access");
    },
    setInterval: () => {
      throw new Error("Unexpected polling");
    },
    clearInterval() {},
    require: (name) => {
      if (name === "@mcp_router/shared")
        return {
          SERVICE_RETIRED: true,
          SERVICE_RETIRED_MESSAGE: "Service retired",
        };
      if (name in mocks) return mocks[name];
      if (
        name.startsWith("@/") ||
        name.includes("/main") ||
        name === "electron" ||
        name === "argon2" ||
        name === "node-machine-id" ||
        name === "./cloud-sync.service"
      )
        return {};
      return require(name);
    },
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

test("retired authentication never opens a browser, exchanges tokens or refreshes credentials", async () => {
  const auth = load("../src/main/modules/auth/auth.service.ts");
  assert.throws(() => auth.startAuthFlow(), /Service retired/);
  assert.equal(auth.handleAuthToken("old-token", "old-state"), undefined);
  assert.equal(await auth.getDecryptedAuthToken(), null);
  assert.equal((await auth.status(true)).authenticated, false);
});

test("cloud sync remains offline even when existing settings have it enabled", async () => {
  const { CloudSyncService } = load(
    "../src/main/modules/cloud-sync/cloud-sync.service.ts",
  );
  const service = CloudSyncService.getInstance();
  service.initialize(() => {
    throw new Error("Must not access local servers");
  });
  await service.syncNow();
  await assert.rejects(service.setEnabled(true), /Service retired/);
  await assert.rejects(
    service.setPassphrase("existing passphrase"),
    /Service retired/,
  );
});

test("automatic updates and analytics remain off regardless of saved preferences", () => {
  const updater = load("../src/main/modules/system/app-updator.ts");
  assert.equal(updater.resolveAutoUpdateConfig().enabled, false);
  const { postHogService } = load(
    "../src/renderer/services/posthog-service.ts",
    {
      "posthog-js/dist/module.full.no-external": {
        init() {
          throw new Error("Analytics must not start");
        },
      },
    },
  );
  postHogService.initialize({ analyticsEnabled: true });
  postHogService.updateConfig({ analyticsEnabled: true });
});

test("feedback IPC does not send requests", async () => {
  const handlers = new Map();
  const { setupSystemHandlers } = load(
    "../src/main/modules/system/system-handler.ts",
    {
      electron: {
        ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
        app: {},
        autoUpdater: { on() {} },
      },
    },
  );
  setupSystemHandlers();
  await assert.rejects(
    handlers.get("system:submitFeedback")({}, "hello"),
    /Service retired/,
  );
});

test("legacy payment errors do not offer credit purchases", () => {
  const { parseErrorMessage } = load(
    "../src/renderer/utils/error-message-utils.ts",
  );
  for (const message of [
    "HTTP 402 Payment Required",
    JSON.stringify({
      code: "insufficient_credits",
      message: "old billing error",
    }),
  ]) {
    const parsed = parseErrorMessage(message);
    assert.equal(parsed.isPaymentError, false);
    assert.equal(parsed.purchaseUrl, undefined);
  }
});
