import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@mcp_router/ui";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@mcp_router/ui";
import { parseErrorMessage } from "@/lib/utils/error-message-utils";
import { Button } from "@mcp_router/ui";

interface ServerErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  errorMessage?: string;
}

export const ServerErrorModal: React.FC<ServerErrorModalProps> = ({
  isOpen,
  onClose,
  serverName,
  errorMessage,
}) => {
  const { t } = useTranslation();

  // Parse the error message for better display
  const parsedError = errorMessage ? parseErrorMessage(errorMessage) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {t("serverList.errorDetails")}
          </DialogTitle>
          <DialogDescription>{serverName}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] rounded-md border p-4">
          <pre className="text-sm whitespace-pre-wrap break-words font-mono">
            {parsedError?.displayMessage ||
              errorMessage ||
              t("serverList.noErrorDetails")}
          </pre>
        </ScrollArea>
        {parsedError?.isPaymentError && parsedError.purchaseUrl && (
          <div className="flex justify-end mt-4">
            <Button
              onClick={() => window.open(parsedError.purchaseUrl, "_blank")}
              variant="default"
            >
              Purchase Credits
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
