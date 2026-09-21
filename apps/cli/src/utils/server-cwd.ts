import { homedir } from "node:os";
import { resolve } from "node:path";

export function resolveServerCwd(cwd?: string): string {
  const home = homedir();
  if (!cwd || cwd === "~") return home;
  if (cwd.startsWith("~/") || cwd.startsWith("~\\")) {
    return resolve(home, cwd.slice(2));
  }
  return resolve(home, cwd);
}
