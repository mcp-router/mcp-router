const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const os = require("node:os");

process.env.TS_NODE_PROJECT = path.join(__dirname, "../tsconfig.json");
require("ts-node/register/transpile-only");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@/main/utils/env-utils")
    return { getUserShellEnv: async () => ({}) };
  if (request === "@/main/utils/logger")
    return { logInfo: () => {}, logError: () => {} };
  if (request === "electron")
    return { safeStorage: { isEncryptionAvailable: () => false } };
  if (request.startsWith("@/"))
    return originalLoad.call(
      this,
      path.join(__dirname, "../src", request.slice(2)),
      parent,
      isMain,
    );
  return originalLoad.call(this, request, parent, isMain);
};
after(() => {
  Module._load = originalLoad;
});

const { resolveServerCwd } = require("../src/main/utils/server-cwd.ts");
const {
  McpServerManagerRepository,
} = require("../src/main/modules/mcp-server-manager/mcp-server-manager.repository.ts");
const {
  MainDatabaseMigration,
} = require("../src/main/infrastructure/database/main-database-migration.ts");
const {
  processMcpServerConfigs,
  validateMcpServerJson,
} = require("../src/renderer/components/mcp/server/utils/mcp-server-utils.ts");
const {
  useServerEditingStore,
} = require("../src/renderer/stores/server-editing-store.ts");

for (const [input, expected] of [
  [undefined, os.homedir()],
  ["", os.homedir()],
  ["~", os.homedir()],
  ["~/project", path.resolve(os.homedir(), "project")],
  ["project", path.resolve(os.homedir(), "project")],
  ["../project", path.resolve(os.homedir(), "../project")],
  [
    path.resolve(os.tmpdir(), "project with spaces"),
    path.resolve(os.tmpdir(), "project with spaces"),
  ],
]) {
  test(`resolves cwd ${JSON.stringify(input)}`, () =>
    assert.equal(resolveServerCwd(input), expected));
}

test("migrates existing servers once, preserves rows, and handles new databases", () => {
  const columns = [{ name: "id" }];
  const sql = [];
  const db = {
    get: () => ({ name: "servers" }),
    all: () => columns,
    execute: (statement) => {
      sql.push(statement);
      columns.push({ name: "cwd" });
    },
  };
  const migration = new MainDatabaseMigration(db).migrations.find(
    (entry) => entry.id === "20260916_add_server_cwd_column",
  );
  assert.ok(migration);
  migration.execute(db);
  migration.execute(db);
  assert.deepEqual(sql, ["ALTER TABLE servers ADD COLUMN cwd TEXT"]);
  migration.execute({
    ...db,
    get: () => undefined,
    execute: () =>
      assert.fail("fresh database migration should defer to CREATE TABLE"),
  });
});

test("round-trips imported cwd through repository create, update and clearing", () => {
  const config = {
    example: { command: "node", args: ["server.js"], cwd: "~/project" },
  };
  const validated = validateMcpServerJson({ mcpServers: config });
  assert.equal(validated.valid, true);
  assert.equal(
    validateMcpServerJson({ example: { command: "node", cwd: 42 } }).valid,
    false,
  );
  const imported = processMcpServerConfigs(
    validated.serverConfigs,
    new Set(),
  )[0].server;
  const statements = [];
  const repo = McpServerManagerRepository.createForDatabase({
    execute: (sql) => statements.push(sql),
  });
  assert.match(statements[0], /cwd TEXT/);
  const row = repo.mapEntityToRow({ ...imported, status: "stopped" });
  assert.equal(row.cwd, "~/project");
  const restored = repo.mapRowToEntity(row);
  assert.equal(restored.cwd, "~/project");
  const updated = repo.mapEntityToRowForUpdate(
    { ...restored, cwd: "~/other" },
    row.created_at,
  );
  assert.equal(updated.cwd, "~/other");
  const cleared = repo.mapEntityToRowForUpdate(
    { ...restored, cwd: "" },
    row.created_at,
  );
  assert.equal(repo.mapRowToEntity(cleared).cwd, undefined);
  assert.equal(repo.mapRowToEntity({ ...row, cwd: null }).cwd, undefined);
});

test("editing state initializes, changes, clears and resets cwd", () => {
  const store = useServerEditingStore;
  store.getState().initializeFromServer({ cwd: "~/project" });
  assert.equal(store.getState().editedCwd, "~/project");
  store.getState().setEditedCwd("~/other");
  assert.equal(store.getState().editedCwd, "~/other");
  store.getState().setEditedCwd("");
  assert.equal(store.getState().editedCwd, "");
  store.getState().initializeFromServer({ cwd: "~/project" });
  store.getState().reset();
  assert.equal(store.getState().editedCwd, "");
  store.getState().initializeFromServer({});
  assert.equal(store.getState().editedCwd, "");
});

const {
  MCPClient,
} = require("../src/main/modules/mcp-apps-manager/mcp-client.ts");
const fs = require("node:fs");
for (const configured of [false, true]) {
  test(
    `Electron transport launches in ${configured ? "configured cwd" : "home"} from /`,
    { timeout: 10000 },
    async () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "electron-cwd-"));
      const marker = path.join(directory, "cwd.json");
      const script = `
      require("node:fs").writeFileSync(${JSON.stringify(marker)}, JSON.stringify(process.cwd()));
      require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {
        const request = JSON.parse(line);
        if (request.method === "initialize") {
          process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: {
            protocolVersion: request.params.protocolVersion, capabilities: {}, serverInfo: { name: "cwd-test", version: "1.0" }
          } }) + "\\n");
        }
      });
    `;
      const originalCwd = process.cwd();
      let result;
      try {
        process.chdir("/");
        result = await new MCPClient().connectToMCPServer({
          id: "test",
          name: "test",
          serverType: "local",
          env: {},
          command: process.execPath,
          args: ["-e", script],
          cwd: configured ? directory : undefined,
        });
        assert.equal(result.status, "success", result.error);
        assert.equal(
          JSON.parse(fs.readFileSync(marker, "utf8")),
          fs.realpathSync(configured ? directory : os.homedir()),
        );
      } finally {
        process.chdir(originalCwd);
        if (result?.client) await result.client.close();
        fs.rmSync(directory, { recursive: true, force: true });
      }
    },
  );
}

test("remote API schemas preserve cwd on create, update and clearing", () => {
  const {
    createServerSchema,
    updateServerSchema,
  } = require("../../../packages/remote-api-types/src/schema/servers.ts");
  const created = createServerSchema.parse({
    type: "config",
    config: {
      id: "cwd-test",
      name: "cwd-test",
      serverType: "local",
      command: "node",
      env: {},
      cwd: "~/project",
    },
  });
  assert.equal(created.config.cwd, "~/project");
  assert.equal(
    updateServerSchema.parse({ id: "cwd-test", config: { cwd: "~/other" } })
      .config.cwd,
    "~/other",
  );
  assert.equal(
    updateServerSchema.parse({ id: "cwd-test", config: { cwd: "" } }).config
      .cwd,
    "",
  );
});
