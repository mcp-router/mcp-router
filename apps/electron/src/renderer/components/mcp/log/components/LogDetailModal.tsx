import React from "react";
import { RequestLogEntry } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Card } from "@mcp_router/ui";
import { useTranslation } from "react-i18next";
import { formatDateI18n } from "@/renderer/utils/date-utils";
import { Copy, CheckCircle2 } from "lucide-react";

interface LogDetailModalProps {
  log: RequestLogEntry;
  onClose: () => void;
}

const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, onClose }) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(true);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatJson = (data: any): string => {
    if (!data) return "";
    if (typeof data === "object") {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 border-b pb-4">
          <DialogTitle className="text-xl">🛠️ {log.serverName}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 mt-2">
            {formatDateI18n(log.timestamp, t, "shortDateTimeWithSeconds")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            {/* 基本情報グリッド */}
            <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t("logs.viewer.detail.client")}
                </div>
                <div className="font-medium">{log.clientName}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t("logs.viewer.detail.server")}
                </div>
                <div className="font-medium">{log.serverName}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t("logs.viewer.detail.processingTime")}
                </div>
                <div className="font-medium">{log.duration}ms</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {t("logs.viewer.detail.requestType")}
                </div>
                <div className="font-medium font-mono text-sm">
                  {log.requestType}
                </div>
              </div>
            </div>

            {/* リクエストパラメータ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {t("logs.viewer.detail.requestParams")}
                </h3>
                {log.requestParams && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(formatJson(log.requestParams), "request")
                    }
                    className="h-7 px-2"
                  >
                    {copiedField === "request" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
              </div>
              <Card className="p-0 overflow-hidden">
                <div className="bg-muted/30 max-h-[300px] overflow-auto">
                  <pre className="p-4 text-xs font-mono whitespace-pre">
                    {log.requestParams
                      ? formatJson(log.requestParams)
                      : `(${t("logs.viewer.detail.none")})`}
                  </pre>
                </div>
              </Card>
            </div>

            {/* レスポンスデータ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {t("logs.viewer.detail.responseData")}
                </h3>
                {log.responseData && typeof log.responseData === "object" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(formatJson(log.responseData), "response")
                    }
                    className="h-7 px-2"
                  >
                    {copiedField === "response" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
              </div>
              <Card className="p-0 overflow-hidden">
                <div className="bg-muted/30 max-h-[300px] overflow-auto">
                  {log.responseData ? (
                    typeof log.responseData === "object" ? (
                      (() => {
                        const respData = log.responseData as any;
                        if (
                          respData.type === "object" &&
                          respData.keys &&
                          respData.keys.includes("content")
                        ) {
                          return (
                            <div className="p-4 space-y-2">
                              <div className="text-xs">
                                <span className="font-semibold">
                                  {t("logs.viewer.detail.dataFormat")}:
                                </span>{" "}
                                {respData.type}
                              </div>
                              <div className="text-xs">
                                <span className="font-semibold">
                                  {t("logs.viewer.detail.includedKeys")}:
                                </span>{" "}
                                {respData.keys.join(", ")}
                              </div>
                              <div className="text-xs text-amber-600 mt-3">
                                {t("logs.viewer.detail.largeResponseWarning")}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <pre className="p-4 text-xs font-mono whitespace-pre">
                              {formatJson(respData)}
                            </pre>
                          );
                        }
                      })()
                    ) : (
                      <pre className="p-4 text-xs font-mono whitespace-pre">
                        {String(log.responseData)}
                      </pre>
                    )
                  ) : (
                    <pre className="p-4 text-xs font-mono">
                      ({t("logs.viewer.detail.none")})
                    </pre>
                  )}
                </div>
              </Card>
            </div>

            {/* エラーメッセージ */}
            {log.errorMessage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-destructive">
                    {t("logs.viewer.detail.errorMessage")}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(log.errorMessage || "", "error")
                    }
                    className="h-7 px-2"
                  >
                    {copiedField === "error" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <Card className="p-0 overflow-hidden border-destructive/50">
                  <div className="bg-destructive/5 max-h-[300px] overflow-auto">
                    <pre className="p-4 text-xs font-mono whitespace-pre text-destructive">
                      {log.errorMessage}
                    </pre>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={handleClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogDetailModal;
