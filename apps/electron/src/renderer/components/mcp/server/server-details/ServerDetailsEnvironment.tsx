import React from "react";
import { MCPServer } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { Settings, Info, Plus, Trash } from "lucide-react";
import { Label } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";

interface ServerDetailsEnvironmentProps {
  server: MCPServer;
  isEditing?: boolean;
  envPairs?: { key: string; value: string }[];
  updateEnvPair?: (
    index: number,
    field: "key" | "value",
    value: string,
  ) => void;
  removeEnvPair?: (index: number) => void;
  addEnvPair?: () => void;
}

const ServerDetailsEnvironment: React.FC<ServerDetailsEnvironmentProps> = ({
  server,
  isEditing = false,
  envPairs = [],
  updateEnvPair,
  removeEnvPair,
  addEnvPair,
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <Label className="text-base font-bold flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            {t("serverDetails.environmentVariables")}
          </Label>
          <Badge variant="outline" className="font-mono rounded-full px-3">
            {envPairs.length} {t("serverDetails.itemsCount")}
          </Badge>
        </div>

        <div className="space-y-4 bg-muted/10 p-6 rounded-2xl border border-muted/40">
          {envPairs.length === 0 && (
            <div className="text-sm text-muted-foreground italic flex items-center justify-center py-8">
              <Info className="h-4 w-4 mr-2 text-muted-foreground/50" />
              {t("serverDetails.noEnvironmentVariables")}
            </div>
          )}

          {envPairs.map((pair, index) => (
            <div key={index} className="flex gap-2 group">
              <Input
                className="w-2/5 h-11 rounded-full px-5 bg-muted/20 border-muted/40 focus:bg-muted/30 transition-all font-mono"
                value={pair.key}
                onChange={(e) =>
                  updateEnvPair && updateEnvPair(index, "key", e.target.value)
                }
                placeholder={t("serverDetails.key")}
              />
              <Input
                className="w-3/5 h-11 rounded-full px-5 bg-muted/20 border-muted/40 focus:bg-muted/30 transition-all font-mono"
                value={pair.value}
                onChange={(e) =>
                  updateEnvPair && updateEnvPair(index, "value", e.target.value)
                }
                placeholder={t("serverDetails.value")}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeEnvPair && removeEnvPair(index)}
                type="button"
                title={t("serverDetails.remove")}
                className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive hover:border-destructive transition-colors shrink-0"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addEnvPair}
            type="button"
            className="w-full h-10 rounded-full border-dashed hover:border-primary/70 bg-transparent"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("serverDetails.addEnvironmentVariable")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Settings className="h-4 w-4 text-primary" />
        <h3 className="text-base font-bold text-primary">
          {t("serverDetails.environmentVariables")}
        </h3>
        {Object.keys(server.env || {}).length > 0 && (
          <Badge variant="outline" className="ml-2 text-xs rounded-full px-2">
            {Object.keys(server.env || {}).length}
          </Badge>
        )}
      </div>
      <div className="rounded-2xl overflow-hidden border border-border/40 soft-shadow">
        {Object.keys(server.env || {}).length > 0 ? (
          <div className="bg-muted/20 p-6">
            <ScrollArea className="max-h-[200px]">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm font-mono text-primary/90">
                {Object.entries(server.env || {}).map(([key, value], i) => (
                  <React.Fragment key={i}>
                    <div className="font-semibold break-all">{key}=</div>
                    <div className="opacity-90 overflow-hidden break-all whitespace-pre-wrap">
                      {String(value)}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground italic p-6 bg-muted/10">
            <Info className="h-4 w-4" />
            <span>{t("serverDetails.none")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerDetailsEnvironment;
