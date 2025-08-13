/**
 * package-version-resolver.ts
 *
 * Utility for resolving the latest version of a package using pnpm or uvx.
 */

import * as semver from "semver";
import { run, commandExists } from "@/main/utils/env-utils";
import { installPNPM, installUV } from "./install-package-manager";
import { logError } from "@/main/utils/logger";
import { PackageUpdateInfo, ServerPackageUpdates } from "@mcp_router/shared";

/**
 * Extract the package name without version from a package specifier
 * @param packageSpec Package specifier with or without version
 * @returns The package name without version
 */
function extractPackageName(packageSpec: string): string {
  // Handle scoped packages (@org/package-name)
  if (packageSpec.startsWith("@")) {
    const scopedMatch = packageSpec.match(/^(@[^/]+\/[^@]+)(?:@.*)?$/);
    return scopedMatch ? scopedMatch[1] : packageSpec;
  }

  // Handle normal packages
  const match = packageSpec.match(/^([^@]+)(?:@.*)?$/);
  return match ? match[1] : packageSpec;
}
/**
 * Extract the package name from command arguments for pnpm dlx or uvx
 * @param args Array of command arguments
 * @returns The package name or null if not found
 */
function extractPackageNameFromCommand(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("-")) {
      return args[i];
    }
  }
  return null;
}

/**
 * Extract version from a package specifier
 * @param packageSpec Package specifier with or without version
 * @returns The version string if found, otherwise null
 */
function extractPackageVersion(packageSpec: string): string | null {
  // Handle scoped packages (@org/package-name@version)
  if (packageSpec.startsWith("@")) {
    const versionMatch = packageSpec.match(/@[^/]+\/[^@]+@(.+)$/);
    return versionMatch ? versionMatch[1] : null;
  }

  // Handle normal packages (package@version)
  const versionMatch = packageSpec.match(/^[^@]+@(.+)$/);
  return versionMatch ? versionMatch[1] : null;
}

/**
 * Check if a package specification already includes a version
 * @param packageSpec Package specifier string
 * @returns True if the package spec includes a version
 */
function hasVersionSpecified(packageSpec: string): boolean {
  // For scoped packages (@org/package-name)
  if (packageSpec.startsWith("@")) {
    return /@[^/]+\/[^@]+@.+/.test(packageSpec);
  }

  // For regular packages
  return /^[^@]+@.+/.test(packageSpec);
}

/**
 * Validate if a string is a valid version format
 * @param version Version string to validate
 * @returns True if the version is valid
 */
function isValidVersion(version: string): boolean {
  if (!version || version.trim() === "") {
    return false;
  }

  // Check if it's a valid semver or Python-style version
  // Semver: 1.2.3, 1.2.3-alpha.1, etc.
  // Python: 1.2.3, 1.2.3a1, 1.2.3.dev0, etc.
  const semverPattern = /^\d+\.\d+\.\d+(?:-[\w\.]+)?(?:\+[\w\.]+)?$/;
  const pythonPattern = /^\d+(?:\.\d+)*(?:[a-zA-Z]+\d*)?(?:\.dev\d+)?$/;

  return semverPattern.test(version) || pythonPattern.test(version);
}

/**
 * Get the latest version of a package using the specified package manager
 * @param packageName Package name without version
 * @param packageManager The package manager to use (pnpm or uvx)
 * @returns The latest version as a string
 */
async function getLatestVersion(
  packageName: string,
  packageManager: "pnpm" | "uvx",
): Promise<string> {
  // Execute the appropriate command to get the latest version
  if (packageManager === "pnpm") {
    try {
      const result = await run("pnpm", ["view", packageName, "version"]);
      const version = result.trim();

      // Validate the version format
      if (!isValidVersion(version)) {
        console.error(
          `Invalid version format received for ${packageName}: ${version}`,
        );
        throw new Error(`Invalid version format: ${version}`);
      }

      return version;
    } catch (error) {
      console.error(
        `Failed to get version for ${packageName} using pnpm:`,
        error,
      );
      throw error;
    }
  } else {
    // Try progressively more reliable methods to get package version information
    try {
      // Method 1: Try the "show" command first if the package is already installed
      try {
        const showResult = await run("uv", ["pip", "show", packageName]);
        // Package found - parse the version
        if (!showResult.includes("WARNING: Package(s) not found")) {
          // Extract version from output format like "Version: x.y.z"
          const versionMatch = showResult.match(/Version:\s*([^\s]+)/);
          if (versionMatch && versionMatch[1]) {
            const version = versionMatch[1].trim();

            // Validate the version format
            if (!isValidVersion(version)) {
              console.error(`Invalid version format from uv show: ${version}`);
              throw new Error(`Invalid version format: ${version}`);
            }

            return version;
          }
        }
      } catch (showError) {
        logError(
          `'uv pip show' command failed: ${showError}. Trying next method.`,
        );
      }

      // Method 2: If show command didn't work, try dry-run install method
      try {
        const dryRunResult = await run("uv", [
          "pip",
          "install",
          packageName,
          "--dry-run",
        ]);

        // Find the line that contains the package name and version
        // Format: " + packageName==version"
        const lines = dryRunResult.split("\n");
        for (const line of lines) {
          const packageMatch = line.match(
            new RegExp(
              `\\s+\\+\\s+(${packageName})\\s*==\\s*([\\d\\.]+(?:\\.[\\d]+)*)`,
            ),
          );
          if (packageMatch && packageMatch[2]) {
            const version = packageMatch[2].trim();

            // Validate the version format
            if (!isValidVersion(version)) {
              console.error(
                `Invalid version format from uv dry-run: ${version}`,
              );
              throw new Error(`Invalid version format: ${version}`);
            }

            return version;
          }
        }
      } catch (dryRunError) {
        logError(
          `'uv pip install --dry-run' command failed: ${dryRunError}. Trying next method.`,
        );
      }
      // If we still couldn't get a version
      const errorMsg = `Could not determine version for ${packageName}`;
      throw new Error(errorMsg);
    } catch (error) {
      console.error(
        `Failed to get version information for ${packageName}: ${error}`,
      );
      throw error;
    }
  }
}

/**
 * Check if an update is available for a package
 * @param packageSpec Package specifier with version
 * @param packageManager The package manager to use (pnpm or uvx)
 * @returns Object containing the current version, latest version, and update status
 */
async function checkPackageUpdate(
  packageSpec: string,
  packageManager: "pnpm" | "uvx",
): Promise<PackageUpdateInfo> {
  // Extract package name and current version
  const packageName = extractPackageName(packageSpec);
  const currentVersion = extractPackageVersion(packageSpec);

  // Default return object
  const result: PackageUpdateInfo = {
    packageName,
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
  };

  // If no current version, we can't check for updates
  if (!currentVersion) {
    return result;
  }

  try {
    // Ensure the package manager is installed
    if (packageManager === "pnpm") {
      if (!(await commandExists("pnpm"))) {
        await installPNPM();
      }
    } else if (packageManager === "uvx") {
      if (!(await commandExists("uv"))) {
        await installUV();
      }
    }

    // Get the latest version using the common helper function
    const latestVersion = await getLatestVersion(packageName, packageManager);

    // Compare versions
    result.latestVersion = latestVersion;

    // Use semantic version comparison
    if (latestVersion && currentVersion && latestVersion.trim() !== "") {
      try {
        // Clean versions to ensure they are valid semver
        const cleanCurrent = semver.coerce(currentVersion);
        const cleanLatest = semver.coerce(latestVersion);

        // Only proceed if both versions are valid semver
        if (cleanCurrent && cleanLatest) {
          result.updateAvailable = semver.lt(
            cleanCurrent.version,
            cleanLatest.version,
          );
        } else {
          // Fallback to string comparison for non-semver versions
          result.updateAvailable =
            currentVersion !== latestVersion && latestVersion.trim() !== "";
        }
      } catch (_) {
        // Fallback to string comparison
        result.updateAvailable =
          currentVersion !== latestVersion && latestVersion.trim() !== "";
      }
    } else {
      result.updateAvailable = false;
    }

    return result;
  } catch (error) {
    console.error(`Failed to check update for ${packageSpec}:`, error);
    return result;
  }
}

/**
 * Check for updates to packages in a server configuration
 * @param serverArgs Array of command arguments containing package names and versions
 * @param packageManager The package manager to use (pnpm or uvx)
 * @returns Object with package update information
 */
export async function checkMcpServerPackageUpdates(
  serverArgs: string[],
  packageManager: "pnpm" | "uvx",
): Promise<ServerPackageUpdates> {
  // Default result
  const result: ServerPackageUpdates = {
    packages: [],
    hasUpdates: false,
  };

  // Find package name from command structure
  const packageArg = extractPackageNameFromCommand(serverArgs);

  if (!packageArg) {
    return result;
  }

  // Process the package
  const updateCheck = hasVersionSpecified(packageArg)
    ? await checkPackageUpdate(packageArg, packageManager)
    : ({
        packageName: packageArg,
        currentVersion: null,
        latestVersion: null,
        updateAvailable: false,
      } as PackageUpdateInfo);

  result.packages = [updateCheck];
  result.hasUpdates = updateCheck.updateAvailable;

  return result;
}

/**
 * Resolve the latest version of a package using the specified package manager
 * @param packageSpec Package specifier (with or without version)
 * @param packageManager The package manager to use (pnpm or uvx)
 * @returns The package specifier with the latest version
 */
async function resolvePackageVersion(
  packageSpec: string,
  packageManager: "pnpm" | "uvx",
): Promise<string> {
  // If the package already has a version specified, return it as is
  if (hasVersionSpecified(packageSpec)) {
    return packageSpec;
  }

  try {
    // Ensure the package manager is installed
    if (packageManager === "pnpm") {
      if (!(await commandExists("pnpm"))) {
        await installPNPM();
      }
    } else if (packageManager === "uvx") {
      if (!(await commandExists("uv"))) {
        await installUV();
      }
    }

    // Get the package name without version
    const packageName = extractPackageName(packageSpec);

    // Get the latest version using the common helper function
    const latestVersion = await getLatestVersion(packageName, packageManager);

    // Return the package with the exact version
    return `${packageName}@${latestVersion}`;
  } catch (error) {
    console.error(
      `Failed to resolve package version for ${packageSpec}:`,
      error,
    );
    // Throw error instead of silently returning original spec
    throw new Error(
      `Failed to resolve version for ${packageSpec}: ${(error as Error).message}`,
    );
  }
}

/**
 * Resolve all package versions in a string of args
 * @param argsString Space-separated arguments string that may contain package specifiers
 * @param packageManager The package manager to use (pnpm or uvx)
 * @returns The args string with all package specifiers resolved to their latest versions
 */
export async function resolvePackageVersionsInArgs(
  argsString: string,
  packageManager: "pnpm" | "uvx",
): Promise<string> {
  // Split args by spaces and ensure non-empty
  const args = argsString
    .trim()
    .split(/\s+/)
    .filter((arg) => arg.length > 0);

  // Find package name from command structure
  const packageArg = extractPackageNameFromCommand(args);

  // If no package name found, return the original string
  if (!packageArg) {
    return argsString;
  }

  try {
    // Resolve the version for the identified package
    const resolvedPackage = await resolvePackageVersion(
      packageArg,
      packageManager,
    );

    // Replace only the specific package argument with the resolved version
    return argsString.replace(packageArg, resolvedPackage);
  } catch (error) {
    console.error(
      `Failed to resolve package version in args: ${argsString}`,
      error,
    );
    // Re-throw the error instead of silently returning original args
    throw error;
  }
}
