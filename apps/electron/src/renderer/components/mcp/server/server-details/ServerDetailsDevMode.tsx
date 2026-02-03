import React from "react";
import { useTranslation } from "react-i18next";
import { Code, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Switch,
  Input,
  Label,
} from "@mcp_router/ui";
import { MCPServer } from "@mcp_router/shared";

interface ServerDetailsDevModeProps {
  server: MCPServer;
  editedDevEnabled: boolean;
  setEditedDevEnabled: (enabled: boolean) => void;
  editedWatchPatterns: string;
  setEditedWatchPatterns: (patterns: string) => void;
  detectedSourceDir?: string | null;
}

const ServerDetailsDevMode: React.FC<ServerDetailsDevModeProps> = ({
  server,
  editedDevEnabled,
  setEditedDevEnabled,
  editedWatchPatterns,
  setEditedWatchPatterns,
  detectedSourceDir,
}) => {
  const { t } = useTranslation();

  // Handle hot reload toggle with auto-population of watch patterns
  const handleHotReloadChange = (enabled: boolean) => {
    setEditedDevEnabled(enabled);

    // Auto-populate watch patterns when enabling hot reload with empty patterns
    if (enabled && !editedWatchPatterns.trim() && detectedSourceDir) {
      const defaultPatterns = [
        `${detectedSourceDir}/**/*.ts`,
        `${detectedSourceDir}/**/*.js`,
        `${detectedSourceDir}/**/*.json`,
      ].join(", ");
      setEditedWatchPatterns(defaultPatterns);
    }
  };

  return (
    <Collapsible className="group/collapsible-dev">
      <div className="border border-border/50 rounded-2xl overflow-hidden soft-shadow bg-muted/5">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/20 transition-all">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            <span className="text-base font-bold">
              {t("serverDetails.developerOptions", {
                defaultValue: "Developer Options",
              })}
            </span>
          </div>
          <div className="h-8 w-8 rounded-full bg-muted/20 flex items-center justify-center group-data-[state=open]/collapsible-dev:bg-primary/10 transition-colors">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]/collapsible-dev:rotate-180 group-data-[state=open]/collapsible-dev:text-primary" />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 pt-0 space-y-6">
            {/* Enable Hot Reload Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-muted/10 transition-all hover:bg-muted/20">
              <div className="space-y-1">
                <Label
                  htmlFor="dev-enabled"
                  className="text-sm font-bold cursor-pointer"
                >
                  {t("serverDetails.enableHotReload", {
                    defaultValue: "Enable Hot Reload",
                  })}
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("serverDetails.enableHotReloadDescription", {
                    defaultValue:
                      "Automatically restart the server when source files change",
                  })}
                </p>
              </div>
              <Switch
                id="dev-enabled"
                checked={editedDevEnabled}
                onCheckedChange={handleHotReloadChange}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* Watch Patterns Input */}
            <div className="space-y-3">
              <Label
                htmlFor="watch-patterns"
                className="text-sm font-bold flex items-center gap-2 px-1"
              >
                {t("serverDetails.watchPatterns", {
                  defaultValue: "Watch Patterns",
                })}
              </Label>
              <Input
                id="watch-patterns"
                value={editedWatchPatterns}
                onChange={(e) => setEditedWatchPatterns(e.target.value)}
                placeholder="src/**/*.ts, lib/**/*.js"
                className="h-11 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all font-mono text-sm"
                disabled={!editedDevEnabled}
              />
              <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-2xl px-4 border border-border/50">
                {t("serverDetails.watchPatternsHelp", {
                  defaultValue:
                    "Comma-separated glob patterns for files to watch. Changes to matching files will trigger a server restart.",
                })}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default ServerDetailsDevMode;
