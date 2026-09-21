import assert from "node:assert/strict";
import { test } from "node:test";
import { homedir, tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { resolveServerCwd } from "../src/utils/server-cwd.ts";
import { parseServeArgs } from "../src/commands/serve.ts";

for (const [input, expected] of [
  [undefined, homedir()],
  ["", homedir()],
  ["~", homedir()],
  ["~/project", resolve(homedir(), "project")],
  ["project", resolve(homedir(), "project")],
  ["../project", resolve(homedir(), "../project")],
  [
    resolve(tmpdir(), "project with spaces"),
    resolve(tmpdir(), "project with spaces"),
  ],
]) {
  test(`resolves cwd ${JSON.stringify(input)}`, () => {
    assert.equal(resolveServerCwd(input), expected);
  });
}

test("keeps cwd per server and preserves child flags", () => {
  const { servers } = parseServeArgs([
    "--server",
    "one",
    "One",
    "--cwd",
    "~/one",
    "node",
    "one.js",
    "--cwd",
    "child-dir",
    "--server",
    "two",
    "Two",
    "node",
    "two.js",
    "--server",
    "three",
    "Three",
    "--cwd",
    "~/three",
    "node",
    "three.js",
  ]);
  assert.deepEqual(
    servers.map((s) => s.cwd),
    ["~/one", undefined, "~/three"],
  );
  assert.deepEqual(servers[0].args, ["one.js", "--cwd", "child-dir"]);
});

test("supports cwd for legacy commands and the command separator", () => {
  for (const args of [
    ["--cwd", "project", "node", "server.js"],
    ["--cwd", "project", "--", "node", "server.js"],
  ]) {
    const { servers } = parseServeArgs(args);
    assert.equal(servers[0].cwd, "project");
    assert.equal(servers[0].command, "node");
  }
  assert.throws(() => parseServeArgs(["--cwd"]), /requires a directory/);
  assert.throws(
    () => parseServeArgs(["--server", "one", "One", "--cwd", "dir"]),
    /server command/,
  );
});

for (const configured of [false, true]) {
  test(
    `serve spawns child in ${configured ? "configured directory" : "home"} from /`,
    { timeout: 15000 },
    async () => {
      const directory = mkdtempSync(join(tmpdir(), "mcp-cwd-"));
      const marker = join(directory, "cwd.json");
      const script = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, JSON.stringify(process.cwd())); process.stdin.resume(); process.stdin.on("end", () => process.exit());`;
      const args = [
        fileURLToPath(new URL("../dist/mcpr.js", import.meta.url)),
        "serve",
        "--port",
        "0",
      ];
      if (configured) args.push("--cwd", directory);
      args.push(process.execPath, "-e", script);
      const child = spawn(process.execPath, args, { cwd: "/", stdio: "pipe" });
      const exited = once(child, "exit");
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      try {
        const deadline = Date.now() + 10000;
        while (
          !existsSync(marker) &&
          child.exitCode === null &&
          Date.now() < deadline
        ) {
          await new Promise((done) => setTimeout(done, 25));
        }
        assert.ok(existsSync(marker), stderr);
        const actual = JSON.parse(readFileSync(marker, "utf8"));
        // macOS resolves /var to /private/var in process.cwd().
        const { realpathSync } = await import("node:fs");
        assert.equal(actual, realpathSync(configured ? directory : homedir()));
      } finally {
        child.kill("SIGINT");
        await exited;
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
}
