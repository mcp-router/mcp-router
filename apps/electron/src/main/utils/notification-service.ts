import { Notification, app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { getSettingsService } from "@/main/modules/settings/settings.service";

/**
 * Get notification messages based on language
 */
function getNotificationMessages(
  status: "running" | "stopped" | "error",
  serverName: string,
  errorMessage?: string,
): { title: string; body: string } {
  // Try to get language from settings, fallback to system locale
  let locale = "en";
  try {
    const settings = getSettingsService().getSettings();
    // Settings might have language preference, but for now use system locale
    locale = app.getLocale() || "en";
  } catch {
    locale = app.getLocale() || "en";
  }

  // Determine language code
  const lang = locale.startsWith("zh-TW")
    ? "zh-TW"
    : locale.startsWith("zh")
    ? "zh"
    : locale.startsWith("ja")
    ? "ja"
    : "en";

  switch (status) {
    case "running":
      if (lang === "zh-TW") {
        return {
          title: "MCP 伺服器已啟動",
          body: `${serverName} 已成功啟動並運行中`,
        };
      } else if (lang === "zh") {
        return {
          title: "MCP 服务器已启动",
          body: `${serverName} 已成功启动并运行中`,
        };
      } else if (lang === "ja") {
        return {
          title: "MCP サーバーが起動しました",
          body: `${serverName} が正常に起動し、実行中です`,
        };
      } else {
        return {
          title: "MCP Server Started",
          body: `${serverName} has started successfully and is running`,
        };
      }
    case "stopped":
      if (lang === "zh-TW") {
        return {
          title: "MCP 伺服器已停止",
          body: `${serverName} 已停止`,
        };
      } else if (lang === "zh") {
        return {
          title: "MCP 服务器已停止",
          body: `${serverName} 已停止`,
        };
      } else if (lang === "ja") {
        return {
          title: "MCP サーバーが停止しました",
          body: `${serverName} が停止しました`,
        };
      } else {
        return {
          title: "MCP Server Stopped",
          body: `${serverName} has stopped`,
        };
      }
    case "error":
      if (lang === "zh-TW") {
        return {
          title: "MCP 伺服器錯誤",
          body: `${serverName} 發生錯誤: ${errorMessage || "未知錯誤"}`,
        };
      } else if (lang === "zh") {
        return {
          title: "MCP 服务器错误",
          body: `${serverName} 发生错误: ${errorMessage || "未知错误"}`,
        };
      } else if (lang === "ja") {
        return {
          title: "MCP サーバーエラー",
          body: `${serverName} でエラーが発生しました: ${errorMessage || "不明なエラー"}`,
        };
      } else {
        return {
          title: "MCP Server Error",
          body: `${serverName} encountered an error: ${errorMessage || "Unknown error"}`,
        };
      }
  }
}

/**
 * Show system notification for MCP server status changes
 */
export function showServerStatusNotification(
  serverName: string,
  status: "running" | "stopped" | "error",
  errorMessage?: string,
): void {
  // Check if notifications are supported
  if (!Notification.isSupported()) {
    console.warn("Desktop notifications are not supported on this system");
    return;
  }

  const { title, body } = getNotificationMessages(status, serverName, errorMessage);

    // Try to get icon path
    let iconPath: string | undefined;
    try {
      const iconFile = path.join(__dirname, "../../../public/images/icon/icon.png");
      if (fs.existsSync(iconFile)) {
        iconPath = iconFile;
      }
    } catch {
      // Ignore icon loading errors
    }

  const notification = new Notification({
    title,
    body,
    icon: iconPath,
    silent: false,
  });

  notification.show();

  // Auto-close notification after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);
}
