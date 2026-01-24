import os from "os";
import path from "path";

const HOME = os.homedir();

/**
 * Expand ~ to home directory in path
 */
export function expandHomePath(pathString: string): string {
  if (pathString.startsWith("~/")) {
    return path.join(HOME, pathString.slice(2));
  }
  if (pathString === "~") {
    return HOME;
  }
  return pathString;
}

/**
 * Get symlink target path for a skill
 * @param basePath The base path (can contain ~)
 * @param skillName The skill name
 */
export function getSymlinkTargetPath(
  basePath: string,
  skillName: string,
): string {
  return path.join(expandHomePath(basePath), skillName);
}
