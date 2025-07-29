/**
 * install-package-manager.ts
 *
 * Cross-platform bootstrapper for uv (Python package manager) and pnpm (Node.js package manager).
 * Tested on macOS 14, Windows 11, Node.js 18+.
 * uv: https://docs.astral.sh/uv/getting-started/installation
 * pnpm: https://pnpm.io/installation
 */

import * as os from "os";
import { commandExists, run } from "@/main/utils/env-utils";

/* ---------- uv ---------- */
export async function installUV() {
  if (os.platform() === "win32") {
    await run("powershell", [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "ByPass",
      "-Command",
      "iwr https://astral.sh/uv/install.ps1 -useb | iex",
    ]);
  } else {
    await run("curl -LsSf https://astral.sh/uv/install.sh | sh", [], true);
  }
}

/* ---------- pnpm ---------- */
export async function installPNPM() {
  // Check if Node.js is installed first
  const nodeExists = await commandExists("node");

  if (os.platform() === "win32") {
    await run("powershell", [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "ByPass",
      "-Command",
      "iwr https://get.pnpm.io/install.ps1 -useb | iex",
    ]);
  } else {
    await run("curl -fsSL https://get.pnpm.io/install.sh | sh -", [], true);
  }

  // If Node.js doesn't exist, install it using pnpm
  if (!nodeExists) {
    try {
      // pnpm env use --global lts will install the latest LTS version of Node.js
      await run("pnpm", ["env", "use", "--global", "lts"]);
    } catch (error) {
      console.error("Failed to install Node.js with pnpm:", error);
      throw new Error(
        "pnpm was installed but Node.js installation failed. You may need to install Node.js manually.",
      );
    }
  }
}

/**
 * Check if pnpm is installed (also checks Node.js as a prerequisite)
 */
export async function checkPnpmExists(): Promise<boolean> {
  const nodeExists = await commandExists("node");
  const pnpmExists = await commandExists("pnpm");

  // Return true only if both Node.js and pnpm exist
  return nodeExists && pnpmExists;
}

/**
 * Check if uv is installed
 */
export async function checkUvExists(): Promise<boolean> {
  return await commandExists("uv");
}
