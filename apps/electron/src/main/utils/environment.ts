/**
 * Utilities for environment detection
 */

import { app } from "electron";

/**
 * Environment type definition
 */
type EnvironmentType = "development" | "production";

/**
 * Variable holding the current environment type
 * Defaults based on the value of app.isPackaged
 */
let currentEnvironment: EnvironmentType = app.isPackaged
  ? "production"
  : "development";

/**
 * Initialize environment settings from startup arguments
 * Can be specified with --env=production or --env=development
 */
export function initializeEnvironment(): void {
  const args = process.argv;
  const envArgIndex = args.findIndex((arg) => arg.startsWith("--env="));

  if (envArgIndex !== -1) {
    const envValue = args[envArgIndex].split("=")[1];
    if (envValue === "production" || envValue === "development") {
      currentEnvironment = envValue;
    }
  }

  // Also allow setting via environment variable
  if (process.env.ELECTRON_ENV === "production") {
    currentEnvironment = "production";
  } else if (process.env.ELECTRON_ENV === "development") {
    currentEnvironment = "development";
  }
}

/**
 * Check whether the current environment is production
 */
export function isProduction(): boolean {
  return currentEnvironment === "production";
}

/**
 * Check whether the current environment is development
 */
export function isDevelopment(): boolean {
  return currentEnvironment === "development";
}
