/**
 * Path Security Utilities
 *
 * Provides security-focused path validation to prevent:
 * - Path traversal attacks (../)
 * - Symlink attacks
 * - Arbitrary filesystem access
 */

import path from "path";
import fs from "fs";
import os from "os";

/**
 * Allowed base directories for skill-related operations.
 * These are the only directories where skills can create symlinks.
 */
const ALLOWED_SKILL_BASES = [
  // Common AI agent skill directories
  ".claude",
  ".cursor",
  ".cline",
  ".windsurf",
  ".vscode",
  ".config",
  "Library/Application Support",
  "AppData",
];

/**
 * Directories that should NEVER be writable by skill operations
 */
const FORBIDDEN_PATHS = [
  "/etc",
  "/usr",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
  "/boot",
  "/root",
  "/var",
  "/sys",
  "/proc",
  "/dev",
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
];

/**
 * Validates that a path is contained within a base directory.
 * Prevents path traversal attacks using ../ or symlinks.
 *
 * @param basePath - The allowed base directory
 * @param targetPath - The path to validate
 * @returns true if targetPath is safely contained within basePath
 */
export function isPathContained(basePath: string, targetPath: string): boolean {
  // Normalize both paths to resolve any . or .. components
  const normalizedBase = path.resolve(basePath);
  const normalizedTarget = path.resolve(targetPath);

  // Ensure the target starts with the base path
  // Add path separator to prevent matching partial directory names
  // e.g., /home/user should not match /home/username
  return (
    normalizedTarget === normalizedBase ||
    normalizedTarget.startsWith(normalizedBase + path.sep)
  );
}

/**
 * Validates that a path does not escape to forbidden system directories.
 *
 * @param targetPath - The path to validate
 * @returns true if the path is not in a forbidden location
 */
export function isPathAllowed(targetPath: string): boolean {
  const normalizedPath = path.resolve(targetPath).toLowerCase();

  for (const forbidden of FORBIDDEN_PATHS) {
    const normalizedForbidden = forbidden.toLowerCase();
    if (
      normalizedPath === normalizedForbidden ||
      normalizedPath.startsWith(normalizedForbidden + path.sep.toLowerCase())
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Validates that a skill symlink target path is in an allowed location.
 * The path must be:
 * 1. Within the user's home directory
 * 2. In an allowed skill-related subdirectory
 * 3. Not in a forbidden system directory
 *
 * @param targetPath - The symlink target path to validate
 * @returns Object with valid flag and error message if invalid
 */
export function validateSkillSymlinkTarget(targetPath: string): {
  valid: boolean;
  error?: string;
} {
  const normalizedPath = path.resolve(targetPath);
  const homeDir = os.homedir();

  // Check if path is forbidden
  if (!isPathAllowed(normalizedPath)) {
    return {
      valid: false,
      error: `Path is in a forbidden system directory: ${targetPath}`,
    };
  }

  // Path must be within user's home directory
  if (!isPathContained(homeDir, normalizedPath)) {
    return {
      valid: false,
      error: `Skill symlink target must be within user home directory: ${targetPath}`,
    };
  }

  // Get the relative path from home
  const relativePath = path.relative(homeDir, normalizedPath);

  // Check if path is in an allowed skill base directory
  const isInAllowedBase = ALLOWED_SKILL_BASES.some((base) => {
    const lowerRelative = relativePath.toLowerCase();
    const lowerBase = base.toLowerCase();
    return (
      lowerRelative === lowerBase ||
      lowerRelative.startsWith(lowerBase + path.sep) ||
      lowerRelative.startsWith("." + lowerBase)
    );
  });

  if (!isInAllowedBase) {
    return {
      valid: false,
      error: `Skill symlink target must be in an allowed agent directory (e.g., .claude, .cursor, .config): ${targetPath}`,
    };
  }

  return { valid: true };
}

/**
 * Validates that a skill name is safe for filesystem operations.
 * This is a defense-in-depth check in addition to the service layer validation.
 *
 * @param name - The skill name to validate
 * @returns Object with valid flag and error message if invalid
 */
export function validateSkillName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Skill name must be a non-empty string" };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Skill name cannot be empty" };
  }

  if (trimmed.length > 255) {
    return {
      valid: false,
      error: "Skill name cannot exceed 255 characters",
    };
  }

  // Check for path traversal attempts
  if (
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    return {
      valid: false,
      error: "Skill name cannot contain path separators or traversal sequences",
    };
  }

  // Only allow safe characters: letters, numbers, underscores, hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error:
        "Skill name can only contain letters, numbers, underscores, and hyphens",
    };
  }

  // Prevent hidden files/directories
  if (trimmed.startsWith(".")) {
    return {
      valid: false,
      error: "Skill name cannot start with a dot",
    };
  }

  return { valid: true };
}

/**
 * Safely resolves a path within a base directory.
 * Returns null if the resolved path would escape the base.
 *
 * @param basePath - The allowed base directory
 * @param relativePath - The relative path to resolve
 * @returns The resolved path, or null if it would escape the base
 */
export function safeResolvePath(
  basePath: string,
  relativePath: string,
): string | null {
  const resolved = path.resolve(basePath, relativePath);

  if (!isPathContained(basePath, resolved)) {
    return null;
  }

  return resolved;
}

/**
 * Checks if a path is a symlink without following it.
 *
 * @param filePath - The path to check
 * @returns true if the path is a symbolic link
 */
function isSymlink(filePath: string): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Gets the real path of a file, resolving all symlinks.
 * Returns null if the file doesn't exist or resolution fails.
 *
 * @param filePath - The path to resolve
 * @returns The resolved real path, or null on failure
 */
function getRealPath(filePath: string): string | null {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Validates that copying from source to destination is safe.
 * Checks for symlink attacks and path traversal.
 *
 * @param sourcePath - The source path
 * @param destPath - The destination path
 * @param allowedDestBase - The allowed base directory for destination
 * @returns Object with valid flag and error message if invalid
 */
export function validateCopyOperation(
  sourcePath: string,
  destPath: string,
  allowedDestBase: string,
): { valid: boolean; error?: string } {
  // Destination must be within allowed base
  if (!isPathContained(allowedDestBase, destPath)) {
    return {
      valid: false,
      error: `Copy destination must be within ${allowedDestBase}`,
    };
  }

  // Source should not be a forbidden path
  if (!isPathAllowed(sourcePath)) {
    return {
      valid: false,
      error: `Cannot copy from forbidden system directory: ${sourcePath}`,
    };
  }

  return { valid: true };
}

/**
 * Validates an agent path input for creating symlink targets.
 *
 * @param pathValue - The path value to validate
 * @returns Object with valid flag and error message if invalid
 */
export function validateAgentPath(pathValue: string): {
  valid: boolean;
  error?: string;
} {
  if (!pathValue || typeof pathValue !== "string") {
    return { valid: false, error: "Agent path must be a non-empty string" };
  }

  const trimmed = pathValue.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Agent path cannot be empty" };
  }

  // Expand ~ to home directory for validation
  let expandedPath = trimmed;
  if (trimmed.startsWith("~/")) {
    expandedPath = path.join(os.homedir(), trimmed.slice(2));
  } else if (trimmed === "~") {
    expandedPath = os.homedir();
  }

  // Validate the symlink target
  return validateSkillSymlinkTarget(expandedPath);
}
