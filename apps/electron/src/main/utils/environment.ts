/**
 * 環境判定のためのユーティリティ
 */

import { app } from "electron";

/**
 * 環境タイプの定義
 */
type EnvironmentType = "development" | "production";

/**
 * 現在の環境タイプを保持する変数
 * デフォルトはapp.isPackagedの値に基づいて設定
 */
let currentEnvironment: EnvironmentType = app.isPackaged
  ? "production"
  : "development";

/**
 * 起動時引数から環境設定を初期化
 * --env=production または --env=development で指定可能
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

  // 環境変数からも取得できるようにする
  if (process.env.ELECTRON_ENV === "production") {
    currentEnvironment = "production";
  } else if (process.env.ELECTRON_ENV === "development") {
    currentEnvironment = "development";
  }
}

/**
 * 現在の環境がproductionかどうかを判定
 */
export function isProduction(): boolean {
  return currentEnvironment === "production";
}

/**
 * 現在の環境がdevelopmentかどうかを判定
 */
export function isDevelopment(): boolean {
  return currentEnvironment === "development";
}
