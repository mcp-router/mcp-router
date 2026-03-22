import React from "react";
import { MCPServer } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { Globe, Info, Plus, Trash } from "lucide-react";
import { Label } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";

interface HeaderPair {
  key: string;
  value: string;
}

interface ServerDetailsHeadersProps {
  server: MCPServer;
  isEditing?: boolean;
  headerPairs?: HeaderPair[];
  updateHeaderPair?: (
    index: number,
    field: "key" | "value",
    value: string,
  ) => void;
  removeHeaderPair?: (index: number) => void;
  addHeaderPair?: () => void;
}

const ServerDetailsHeaders: React.FC<ServerDetailsHeadersProps> = ({
  server,
  isEditing = false,
  headerPairs = [],
  updateHeaderPair,
  removeHeaderPair,
  addHeaderPair,
}) => {
  const { t } = useTranslation();
  const headers = server.headers || {};

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-base font-medium flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {t("serverDetails.headers")}
          </Label>
          <Badge variant="outline" className="font-mono">
            {headerPairs.length} {t("serverDetails.itemsCount")}
          </Badge>
        </div>

        <div className="space-y-2 bg-muted/30 p-3 rounded-md">
          {headerPairs.length === 0 && (
            <div className="text-sm text-muted-foreground italic flex items-center justify-center py-4">
              <Info className="h-4 w-4 mr-2 text-muted-foreground" />
              {t("serverDetails.noHeaders")}
            </div>
          )}

          {headerPairs.map((pair, index) => (
            <div key={index} className="flex gap-2 group">
              <Input
                className="w-2/5 font-mono group-hover:border-primary/50 transition-colors"
                value={pair.key}
                onChange={(e) =>
                  updateHeaderPair &&
                  updateHeaderPair(index, "key", e.target.value)
                }
                placeholder={t("serverDetails.key")}
              />
              <Input
                className="w-3/5 font-mono group-hover:border-primary/50 transition-colors"
                value={pair.value}
                onChange={(e) =>
                  updateHeaderPair &&
                  updateHeaderPair(index, "value", e.target.value)
                }
                placeholder={t("serverDetails.value")}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeHeaderPair && removeHeaderPair(index)}
                type="button"
                title={t("serverDetails.remove")}
                className="text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addHeaderPair}
          type="button"
          className="mt-2 border-dashed hover:border-primary/70"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("serverDetails.addHeader")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-primary">
          {t("serverDetails.headers")}
        </h3>
        {Object.keys(headers).length > 0 && (
          <Badge variant="outline" className="ml-2 text-xs">
            {Object.keys(headers).length}
          </Badge>
        )}
      </div>
      <div className="pl-6">
        {Object.keys(headers).length > 0 ? (
          <div className="bg-muted p-3 rounded-md border shadow-sm">
            <ScrollArea className="max-h-[200px]">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm font-mono text-primary/90">
                {Object.entries(headers).map(([key, value], i) => (
                  <React.Fragment key={i}>
                    <div className="font-semibold break-all">{key}:</div>
                    <div className="opacity-90 overflow-hidden break-all whitespace-pre-wrap">
                      {String(value)}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground italic p-2">
            <Info className="h-4 w-4" />
            <span>{t("serverDetails.none")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerDetailsHeaders;
