import React from "react";
import { MCPServer } from "../../../../../types";
import { useTranslation } from "react-i18next";
import { Settings, Info } from "lucide-react";
import { Label } from "@mcp-router/ui";
import { Input } from "@mcp-router/ui";

interface ServerDetailsInputParamsProps {
  server: MCPServer;
  inputParamValues?: Record<string, string>;
  updateInputParam?: (key: string, value: string) => void;
  toggleEdit?: () => void;
}

const ServerDetailsInputParams: React.FC<ServerDetailsInputParamsProps> = ({
  server,
  inputParamValues = {},
  updateInputParam,
}) => {
  const { t } = useTranslation();

  if (!server.inputParams || Object.keys(server.inputParams).length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground italic p-2">
        <Info className="h-4 w-4" />
        <span>{t("serverDetails.noInputParams")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(server.inputParams).map(([key, param]) => (
        <div key={key} className="space-y-3 p-4 border rounded-md bg-muted/30">
          <Label
            htmlFor={`input-param-${key}`}
            className="font-medium text-primary"
          >
            {key}
          </Label>
          {param.description && (
            <div className="text-sm bg-muted p-2 rounded-md border-l-4 border-primary/70">
              {param.description}
            </div>
          )}
          <Input
            id={`input-param-${key}`}
            value={
              inputParamValues[key] !== undefined
                ? inputParamValues[key]
                : param.default || ""
            }
            onChange={(e) =>
              updateInputParam && updateInputParam(key, e.target.value)
            }
            placeholder={param.default || ""}
            className="font-mono"
          />
        </div>
      ))}
    </div>
  );
};

export default ServerDetailsInputParams;
