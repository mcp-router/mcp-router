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
import { ScrollArea } from "@mcp_router/ui";
import { useTranslation } from "react-i18next";
import { formatDateI18n } from "@/renderer/utils/date-utils";

interface LogDetailModalProps {
  log: RequestLogEntry;
  onClose: () => void;
}

const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, onClose }) => {
  const { t } = useTranslation();
  // Modal is open since the component is rendered
  const [open, setOpen] = React.useState(true);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="fixed inset-x-0 top-8 bottom-0 w-full max-w-none !sm:max-w-none !max-w-none overflow-hidden flex flex-col rounded-none border-0 translate-x-0 translate-y-0 left-0">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("logs.viewer.detail.title")}</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full max-h-full w-full py-4 px-2">
            <div className="grid md:grid-cols-2 grid-cols-1 gap-4 mb-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  {t("logs.viewer.detail.timestamp")}
                </div>
                <div className="font-medium">
                  {formatDateI18n(log.timestamp, t, "shortDateTimeWithSeconds")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  {t("logs.viewer.detail.processingTime")}
                </div>
                <div className="font-medium">{log.duration}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  {t("logs.viewer.detail.client")}
                </div>
                <div className="font-medium">{log.clientName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  {t("logs.viewer.detail.server")}
                </div>
                <div className="font-medium">{log.serverName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  {t("logs.viewer.detail.requestType")}
                </div>
                <div className="font-medium">{log.requestType}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  {t("logs.viewer.detail.status")}
                </div>
                <div
                  className={`font-medium ${log.responseStatus === "success" ? "text-green-500" : "text-red-500"}`}
                >
                  {log.responseStatus === "success"
                    ? t("logs.viewer.detail.success")
                    : t("logs.viewer.detail.error")}
                </div>
              </div>
            </div>

            {/* リクエストパラメータ */}
            <div className="mb-6">
              <div className="text-sm text-muted-foreground mb-2">
                {t("logs.viewer.detail.requestParams")}
              </div>
              <Card className="p-4 overflow-x-auto max-h-[400px] overflow-y-auto bg-muted/50">
                <pre className="text-sm whitespace-pre-wrap">
                  {log.requestParams
                    ? typeof log.requestParams === "object"
                      ? JSON.stringify(log.requestParams, null, 2)
                      : String(log.requestParams)
                    : `(${t("logs.viewer.detail.none")})`}
                </pre>
              </Card>
            </div>

            {/* レスポンスデータ */}
            <div className="mb-6">
              <div className="text-sm text-muted-foreground mb-2">
                {t("logs.viewer.detail.responseData")}
              </div>
              <Card className="p-4 overflow-x-auto max-h-[400px] overflow-y-auto bg-muted/50">
                <pre className="text-sm whitespace-pre-wrap">
                  {log.responseData
                    ? typeof log.responseData === "object"
                      ? (() => {
                          // レスポンスデータがオブジェクトの場合、特殊な処理を行う
                          const respData = log.responseData;

                          // typeがobjectでcontentキーがある特殊な形式の場合
                          if (
                            respData.type === "object" &&
                            respData.keys &&
                            respData.keys.includes("content")
                          ) {
                            // APIから返ってきたデータ形式をチェック
                            return (
                              <div>
                                <p>
                                  <strong>
                                    {t("logs.viewer.detail.dataFormat")}:
                                  </strong>{" "}
                                  {respData.type}
                                </p>
                                <p>
                                  <strong>
                                    {t("logs.viewer.detail.includedKeys")}:
                                  </strong>{" "}
                                  {respData.keys.join(", ")}
                                </p>
                                <p className="mt-2 text-amber-600">
                                  {t("logs.viewer.detail.largeResponseWarning")}
                                </p>
                              </div>
                            );
                          } else {
                            // 通常のJSONオブジェクト
                            return JSON.stringify(respData, null, 2);
                          }
                        })()
                      : String(log.responseData)
                    : `(${t("logs.viewer.detail.none")})`}
                </pre>
              </Card>
            </div>

            {/* エラーメッセージ */}
            {log.errorMessage && (
              <div className="mb-6">
                <div className="text-sm text-muted-foreground mb-2">
                  {t("logs.viewer.detail.errorMessage")}
                </div>
                <Card className="p-4 overflow-x-auto max-h-[400px] overflow-y-auto bg-destructive/10 text-destructive">
                  <pre className="text-sm whitespace-pre-wrap">
                    {log.errorMessage}
                  </pre>
                </Card>
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter className="shrink-0 pt-2">
          <Button variant="outline" onClick={handleClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogDetailModal;
