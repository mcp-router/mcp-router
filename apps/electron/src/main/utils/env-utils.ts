import process from "node:process";
import { execa } from "execa";
import stripAnsi from "strip-ansi";
import { userInfo, homedir } from "node:os";
import { logInfo } from "@/main/utils/logger";

const DELIMITER = "_ENV_DELIMITER_";

/**
 * Get common paths where npm/node binaries might be installed
 * This is used as a fallback when shell environment capture fails
 */
function getCommonNodePaths(): string[] {
  const home = homedir();
  const paths: string[] = [];

  if (process.platform === "darwin" || process.platform === "linux") {
    // Homebrew (macOS)
    paths.push("/opt/homebrew/bin");
    paths.push("/usr/local/bin");

    // nvm - check common node versions
    const nvmBase = `${home}/.nvm/versions/node`;
    // Add current node version path if running under nvm
    if (process.env.NVM_BIN) {
      paths.push(process.env.NVM_BIN);
    }
    // Common nvm paths - try to find installed versions
    paths.push(`${nvmBase}/v20.19.0/bin`);
    paths.push(`${nvmBase}/v22.0.0/bin`);
    paths.push(`${nvmBase}/v18.0.0/bin`);

    // fnm (Fast Node Manager)
    paths.push(`${home}/.fnm/current/bin`);
    paths.push(`${home}/Library/Application Support/fnm/current/bin`);

    // volta
    paths.push(`${home}/.volta/bin`);

    // asdf
    paths.push(`${home}/.asdf/shims`);

    // n (node version manager)
    paths.push("/usr/local/n/versions/node/20.19.0/bin");

    // Standard system paths
    paths.push("/usr/bin");
    paths.push("/bin");
    paths.push("/usr/sbin");
    paths.push("/sbin");

    // User local bin
    paths.push(`${home}/.local/bin`);
    paths.push(`${home}/bin`);
  }

  return paths;
}

/**
 * Augment PATH with common node binary locations
 */
function augmentPath(existingPath: string | undefined): string {
  const commonPaths = getCommonNodePaths();
  const existingPaths = existingPath ? existingPath.split(":") : [];

  // Combine existing PATH with common paths, removing duplicates
  const allPaths = [...existingPaths];
  for (const p of commonPaths) {
    if (!allPaths.includes(p)) {
      allPaths.push(p);
    }
  }

  return allPaths.join(":");
}

/**
 * Check if a command exists in the system's PATH
 * @param cmd Command to check
 * @returns boolean indicating whether the command exists
 */
export async function commandExists(cmd: string): Promise<boolean> {
  try {
    const shellEnv = await getUserShellEnv();
    // Get PATH from shell environment
    const PATH = shellEnv.PATH || shellEnv.Path || process.env.PATH;
    if (!PATH) return false;

    // Check if the command exists using 'which' on Unix or 'where' on Windows
    const checkCommand = process.platform === "win32" ? "where" : "which";
    await execa(checkCommand, [cmd], {
      env: shellEnv,
      stdio: "ignore",
      reject: true,
    });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Run a command with proper logging
 * @param cmd Command to run or executable path
 * @param args Array of arguments to pass to the command
 * @param useShell Whether to use shell for command execution (default: false)
 * @param useShellEnv Whether to use the user's shell environment (default: true)
 * @returns Command output as string
 */
export async function run(cmd: string, args: string[] = [], useShell = false) {
  const cmdDisplay = useShell ? cmd : `${cmd} ${args.join(" ")}`;
  logInfo(`\n> ${cmdDisplay}, useShell: ${useShell}\n`);

  try {
    // If useShellEnv is true, get and merge user's shell environment
    const shellEnv = await getUserShellEnv();

    // Change stdio to pipe both stdout and stderr
    const { stdout, stderr } = await execa(cmd, args, {
      shell: useShell,
      stdio: ["inherit", "pipe", "pipe"], // Changed to pipe stderr as well
      env: shellEnv,
    });

    // Return the combined output if stdout is empty but stderr has content
    // This handles commands that output to stderr instead of stdout
    return stdout || stderr;
  } catch (err) {
    // For errors, try to extract any useful output from stderr/stdout
    if (
      err &&
      typeof err === "object" &&
      ("stderr" in err || "stdout" in err)
    ) {
      const errorOutput = (err as any).stdout || (err as any).stderr;
      return errorOutput; // Return any output even on error
    }
    throw err;
  }
}

// Async function to retrieve environment variables loaded by the user's shell
export async function getUserShellEnv() {
  // On Windows, there are no shell initialization file issues, so return as-is
  if (process.platform === "win32") {
    return { ...process.env };
  }

  try {
    // Run a login shell (-l) + interactive mode (-i) and capture env
    // `DISABLE_AUTO_UPDATE` prevents oh-my-zsh auto-update prompts
    const shell = detectDefaultShell();
    const { stdout } = await execa(
      shell,
      ["-ilc", `echo -n "${DELIMITER}"; env; echo -n "${DELIMITER}"`],
      {
        env: {
          DISABLE_AUTO_UPDATE: "true",
        },
        timeout: 10000, // 10 second timeout to prevent hanging
      },
    );

    // Output format is '_ENV_DELIMITER_env_vars_ENV_DELIMITER_', so split and parse
    const parts = stdout.split(DELIMITER);
    const rawEnv = parts[1] || ""; // Content between the delimiters

    const shellEnv: { [key: string]: string } = {};
    for (const line of stripAnsi(rawEnv).split("\n")) {
      if (!line) continue;
      const [key, ...values] = line.split("=");
      shellEnv[key] = values.join("=");
    }

    // Augment PATH with common node paths to ensure npm/npx are found
    if (shellEnv.PATH) {
      shellEnv.PATH = augmentPath(shellEnv.PATH);
    }

    return shellEnv;
  } catch (error) {
    // If shell startup fails, return existing Electron/Node.js environment variables
    // Augment PATH with common paths to help find npm/npx binaries
    console.warn(
      "[env-utils] Failed to capture shell environment, using fallback with augmented PATH:",
      error instanceof Error ? error.message : error,
    );

    const fallbackEnv = { ...process.env };
    fallbackEnv.PATH = augmentPath(fallbackEnv.PATH);

    return fallbackEnv;
  }
}

/**
 * Detect the default shell for the current platform
 * @returns The path to the default shell
 */
const detectDefaultShell = () => {
  const { env } = process;

  if (process.platform === "win32") {
    return env.COMSPEC || "cmd.exe";
  }

  const { shell } = userInfo();
  if (shell) {
    return shell;
  }

  if (process.platform === "darwin") {
    return env.SHELL || "/bin/zsh";
  }

  return env.SHELL || "/bin/sh";
};
