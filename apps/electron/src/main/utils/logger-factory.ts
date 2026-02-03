// apps/electron/src/main/utils/logger-factory.ts
import pino from "pino";
import path from "path";
import os from "os";
import fs from "fs";

function getLogDirectory(): string {
  const xdgStateHome =
    process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  const logDir = path.join(xdgStateHome, "mcp-router", "logs");

  // Ensure directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return logDir;
}

function getLogFilePath(): string {
  const logDir = getLogDirectory();
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(logDir, `mcp-router-${date}.log`);
}

const isDev = process.env.NODE_ENV === "development";

let logger: pino.Logger;

if (isDev) {
  // Development: simple JSON to stdout (no worker threads)
  // Note: pino-pretty transport spawns workers that don't work with Electron's webpack bundle
  logger = pino({
    level: "debug",
    base: {
      app: "mcp-router",
    },
  });
} else {
  // Production: JSON to console + file
  const logFile = getLogFilePath();
  const fileStream = fs.createWriteStream(logFile, { flags: "a" });

  logger = pino(
    {
      level: "info",
      base: {
        app: "mcp-router",
      },
    },
    pino.multistream([{ stream: process.stdout }, { stream: fileStream }]),
  );
}

export { logger, getLogDirectory };
