import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@mcp-router/ui";
import { Button } from "@mcp-router/ui";
import {
  Package,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { usePlatformAPI } from "@mcp-router/platform-api";

interface PackageManagerOverlayProps {
  isOpen: boolean;
  onInstallComplete: () => void;
  onCancel: () => void;
}

const PackageManagerOverlay: React.FC<PackageManagerOverlayProps> = ({
  isOpen,
  onInstallComplete,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const platformAPI = usePlatformAPI();
  const [packageManagers, setPackageManagers] = useState<{
    node: boolean;
    pnpm: boolean;
    uv: boolean;
  }>({ node: false, pnpm: false, uv: false });
  const [isInstallingPM, setIsInstallingPM] = useState(false);
  const [installationComplete, setInstallationComplete] = useState(false);
  const [displayCount, setDisplayCount] = useState(0);

  // パッケージマネージャーの状態確認
  const checkPackageManagers = useCallback(async () => {
    try {
      const result = await platformAPI.checkPackageManagers();
      setPackageManagers(result);

      // インストール完了状態でない場合のみ自動クローズを実行
      // インストール完了後はユーザーが手動で閉じるまで表示を維持
      if (result.node && result.pnpm && result.uv && !installationComplete) {
        onInstallComplete();
      }
    } catch (error) {
      console.error("Failed to check package managers:", error);
    }
  }, [onInstallComplete, installationComplete]);

  // オーバーレイ表示回数を増加
  const incrementDisplayCount = useCallback(async () => {
    try {
      const result = await platformAPI.incrementPackageManagerOverlayCount();
      if (result.success) {
        setDisplayCount(result.count);
      }
    } catch (error) {
      console.error(
        "Failed to increment package manager overlay display count:",
        error,
      );
    }
  }, []);

  // 初期チェック
  useEffect(() => {
    if (isOpen) {
      checkPackageManagers();
      incrementDisplayCount();
    }
  }, [isOpen, checkPackageManagers, incrementDisplayCount]);

  // パッケージマネージャーのインストール
  const handleInstallPackageManagers = async () => {
    try {
      setIsInstallingPM(true);
      const result = await platformAPI.installPackageManagers();

      if (result.success) {
        // インストール完了状態に設定
        setInstallationComplete(true);
      } else {
        const errors = [];
        if (result.errors?.node) errors.push(`Node.js: ${result.errors.node}`);
        if (result.errors?.pnpm) errors.push(`pnpm: ${result.errors.pnpm}`);
        if (result.errors?.uv) errors.push(`uv: ${result.errors.uv}`);
        throw new Error(
          errors.join(", ") || "Failed to install package managers",
        );
      }
    } catch (error) {
      console.error("Failed to install package managers:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to install package managers",
      );
    } finally {
      setIsInstallingPM(false);
    }
  };

  // アプリケーション再起動
  const handleRestart = async () => {
    try {
      await platformAPI.restartApp();
    } catch (error) {
      console.error("Failed to restart app:", error);
      toast.error("Failed to restart application");
    }
  };

  // 必要なパッケージマネージャーのリストを取得
  const getMissingPackageManagers = () => {
    const missing = [];
    if (!packageManagers.node) missing.push("Node.js (JavaScript runtime)");
    if (!packageManagers.pnpm) missing.push("pnpm (for Node.js servers)");
    if (!packageManagers.uv) missing.push("uv (for Python servers)");
    return missing;
  };

  // ドキュメントページを開く
  const openDocumentation = () => {
    const isJapanese = i18n.language.startsWith("ja");
    window.open(
      `https://docs.mcp-router.net/${isJapanese ? "ja/" : ""}docs/agent/intro`,
      "_blank",
    );
  };

  const missingManagers = getMissingPackageManagers();
  const showTroubleshooting = displayCount >= 3;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        /* Dialog stays open until installation is complete */
      }}
    >
      <DialogContent className="sm:max-w-[500px] [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {installationComplete ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-500" />
            )}
            <DialogTitle className="text-xl">
              {installationComplete
                ? t("agents.installationComplete", "インストール完了")
                : t("agents.packageManagerRequired")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base mt-4">
            {installationComplete
              ? t(
                  "agents.installationCompleteMessage",
                  "パッケージマネージャーのインストールが完了しました。",
                )
              : t(
                  "agents.packageManagerOverlayDescription",
                  "Agents require package managers to run MCP servers. The following package managers need to be installed:",
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {installationComplete ? (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm text-green-800 font-medium mb-2">
                    {t("agents.nextSteps", "次のステップ:")}
                  </p>
                  <p className="text-sm text-green-700">
                    {t(
                      "agents.restartInstructions",
                      "環境変数を反映するためアプリを再起動してください。",
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">
                {t("agents.missingPackageManagers", "Missing Package Managers")}
                :
              </h4>
              <ul className="space-y-1">
                {missingManagers.map((manager, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4" />
                    {manager}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* トラブルシューティング情報 - 3回以上表示された場合 */}
          {showTroubleshooting && !installationComplete && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    {t("agents.troubleshootingTitle", "まだ問題がありますか？")}
                  </p>
                  <p className="text-sm text-blue-700 mb-3">
                    {t(
                      "agents.troubleshootingDescription",
                      "複数回試行してもパッケージマネージャーのインストールが失敗し続ける場合は、代替インストール方法やトラブルシューティング手順についてドキュメントをご確認ください。",
                    )}
                  </p>
                  <Button
                    onClick={openDocumentation}
                    variant="outline"
                    size="sm"
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("agents.viewDocumentation", "ドキュメントを表示")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {!installationComplete && (
              <Button
                onClick={onCancel}
                disabled={isInstallingPM}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                {t("common.back")}
              </Button>
            )}
            {!installationComplete && (
              <Button
                onClick={handleInstallPackageManagers}
                disabled={isInstallingPM}
                size="lg"
                className="flex-1"
              >
                <Package className="mr-2 h-5 w-5" />
                {isInstallingPM
                  ? t("agents.installing")
                  : t("agents.installPackageManagers")}
              </Button>
            )}
            {installationComplete && (
              <>
                <Button
                  onClick={onInstallComplete}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  {t("common.close", "閉じる")}
                </Button>
                <Button
                  onClick={handleRestart}
                  size="lg"
                  className="flex-1"
                  title={t(
                    "agents.restartDescription",
                    "変更を反映するためにアプリケーションを再起動します",
                  )}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("agents.restartApp", "アプリ再起動")}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PackageManagerOverlay;
