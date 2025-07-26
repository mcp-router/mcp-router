import React from "react";
import { MCPServer } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { AlertCircle, Server, Trash, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";

interface ServerDetailsRemoveDialogProps {
  server: MCPServer;
  isOpen: boolean;
  isLoading: boolean;
  setIsOpen: (isOpen: boolean) => void;
  handleRemove: () => void;
}

const ServerDetailsRemoveDialog: React.FC<ServerDetailsRemoveDialogProps> = ({
  server,
  isOpen,
  isLoading,
  setIsOpen,
  handleRemove,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-4 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-destructive">
            {t("serverDetails.confirmRemove", { name: server.name })}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("serverDetails.removeWarning")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-between gap-3 mt-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
            className="sm:w-32"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isLoading}
            className="gap-2 sm:w-32"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {t("common.removing")}
              </>
            ) : (
              <>
                <Trash className="h-4 w-4" />
                {t("common.remove")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServerDetailsRemoveDialog;
