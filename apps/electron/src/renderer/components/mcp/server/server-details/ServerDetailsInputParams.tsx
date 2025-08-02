import React, { useState } from "react";
import { MCPServer, MCPInputParam } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { Info, Eye, EyeOff } from "lucide-react";
import { Label } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Checkbox } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { usePlatformAPI } from "@/renderer/platform-api/hooks/use-platform-api";

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
  const platformAPI = usePlatformAPI();
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!server.inputParams || Object.keys(server.inputParams).length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground italic p-2">
        <Info className="h-4 w-4" />
        <span>{t("serverDetails.noInputParams")}</span>
      </div>
    );
  }

  const validateField = (key: string, param: MCPInputParam, value: string) => {
    const newErrors = { ...errors };

    // 必須チェック
    if (param.required && !value.trim()) {
      newErrors[key] = t("validation.required");
    } else if (param.type === "number" && value.trim()) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        newErrors[key] = t("validation.mustBeNumber");
      } else {
        if (param.min !== undefined && numValue < param.min) {
          newErrors[key] = t("validation.minValue", { min: param.min });
        } else if (param.max !== undefined && numValue > param.max) {
          newErrors[key] = t("validation.maxValue", { max: param.max });
        } else {
          delete newErrors[key];
        }
      }
    } else {
      delete newErrors[key];
    }

    setErrors(newErrors);
  };

  const handleInputChange = (
    key: string,
    param: MCPInputParam,
    value: string,
  ) => {
    updateInputParam && updateInputParam(key, value);
    validateField(key, param, value);
  };

  const renderInputField = (
    key: string,
    param: MCPInputParam,
    value: string | undefined,
  ) => {
    const actualValue =
      value !== undefined
        ? value
        : param.default !== undefined
          ? String(param.default)
          : "";

    switch (param.type) {
      case "boolean":
        return (
          <Checkbox
            id={`input-param-${key}`}
            checked={actualValue === "true"}
            onCheckedChange={(checked) => {
              const newValue = String(checked);
              updateInputParam && updateInputParam(key, newValue);
              validateField(key, param, newValue);
            }}
          />
        );

      case "number":
        return (
          <Input
            id={`input-param-${key}`}
            type="number"
            value={actualValue}
            onChange={(e) => handleInputChange(key, param, e.target.value)}
            placeholder={
              param.default !== undefined ? String(param.default) : ""
            }
            className={`font-mono ${errors[key] ? "border-destructive" : ""}`}
            min={param.min}
            max={param.max}
          />
        );

      case "directory":
      case "file":
        return (
          <div className="flex gap-2">
            <Input
              id={`input-param-${key}`}
              value={actualValue}
              onChange={(e) => handleInputChange(key, param, e.target.value)}
              placeholder={
                param.type === "directory"
                  ? t("serverDetails.selectDirectory")
                  : t("serverDetails.selectFile")
              }
              className={`font-mono flex-1 ${errors[key] ? "border-destructive" : ""}`}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const result = await platformAPI.servers.selectFile({
                    title:
                      param.title ||
                      (param.type === "directory"
                        ? t("serverDetails.selectDirectory")
                        : t("serverDetails.selectFile")),
                    mode: param.type === "directory" ? "directory" : "file",
                  });
                  if (result.success && result.path) {
                    updateInputParam && updateInputParam(key, result.path);
                    validateField(key, param, result.path);
                  }
                } catch (error) {
                  console.error("File selection error:", error);
                }
              }}
            >
              {t("serverDetails.browse")}
            </Button>
          </div>
        );

      default: // string or undefined
        return (
          <div className="relative">
            <Input
              id={`input-param-${key}`}
              type={
                param.sensitive && !showSensitive[key] ? "password" : "text"
              }
              value={actualValue}
              onChange={(e) => handleInputChange(key, param, e.target.value)}
              placeholder={
                param.default !== undefined ? String(param.default) : ""
              }
              className={`font-mono pr-10 ${errors[key] ? "border-destructive" : ""}`}
            />
            {param.sensitive && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() =>
                  setShowSensitive((prev) => ({ ...prev, [key]: !prev[key] }))
                }
              >
                {showSensitive[key] ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(server.inputParams).map(([key, param]) => (
        <div key={key} className="space-y-3 p-4 border rounded-md bg-muted/30">
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`input-param-${key}`}
              className="font-medium text-primary"
            >
              {param.title || key}
            </Label>
            {param.required && (
              <span className="text-xs text-destructive">*</span>
            )}
          </div>
          {param.description && (
            <div className="text-sm bg-muted p-2 rounded-md border-l-4 border-primary/70">
              {param.description}
            </div>
          )}
          {renderInputField(key, param, inputParamValues[key])}
          {errors[key] && (
            <p className="text-sm text-destructive mt-1">{errors[key]}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default ServerDetailsInputParams;
