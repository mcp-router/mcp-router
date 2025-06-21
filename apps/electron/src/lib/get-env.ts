import process from "node:process";
import { execa } from "execa";
import stripAnsi from "strip-ansi";
import { userInfo } from "node:os";
import { logInfo } from "./utils/backend/error-handler";

const DELIMITER = "_ENV_DELIMITER_";

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
  } catch (error) {
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
    if (err.stderr || err.stdout) {
      const errorOutput = err.stdout || err.stderr;
      return errorOutput; // Return any output even on error
    }
    throw err;
  }
}

// ユーザのシェルで読み込まれる環境変数を取得する非同期関数
export async function getUserShellEnv() {
  // Windowsの場合、シェル初期化ファイルの問題がないのでそのまま返す
  if (process.platform === "win32") {
    return { ...process.env };
  }

  try {
    // ログインシェル( -l ) + 対話モード( -i )を実行し、envを取得する
    // `DISABLE_AUTO_UPDATE` は oh-my-zsh の自動アップデートを防ぐための例
    const shell = detectDefaultShell();
    const { stdout } = await execa(
      shell,
      ["-ilc", `echo -n "${DELIMITER}"; env; echo -n "${DELIMITER}"`],
      {
        env: {
          DISABLE_AUTO_UPDATE: "true",
        },
      },
    );

    // 出力は '_ENV_DELIMITER_env_vars_ENV_DELIMITER_' の形になるので、区切ってパースする
    const parts = stdout.split(DELIMITER);
    const rawEnv = parts[1] || ""; // 区切り文字の間の部分

    const shellEnv: { [key: string]: string } = {};
    for (const line of stripAnsi(rawEnv).split("\n")) {
      if (!line) continue;
      const [key, ...values] = line.split("=");
      shellEnv[key] = values.join("=");
    }

    return shellEnv;
  } catch (error) {
    // シェルの起動に失敗した場合は、Electron / Node.js の既存の環境変数を返す
    return { ...process.env };
  }
}

export const detectDefaultShell = () => {
  const { env } = process;

  if (process.platform === "win32") {
    return env.COMSPEC || "cmd.exe";
  }

  try {
    const { shell } = userInfo();
    if (shell) {
      return shell;
    }
  } catch {}

  if (process.platform === "darwin") {
    return env.SHELL || "/bin/zsh";
  }

  return env.SHELL || "/bin/sh";
};
