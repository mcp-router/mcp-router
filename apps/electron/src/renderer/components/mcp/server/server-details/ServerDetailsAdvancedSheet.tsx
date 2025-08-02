import React, { useState, useEffect } from "react";
import { MCPServer } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { Settings2, Check, RefreshCw, Info, FileText, Plus, Trash, Terminal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mcp_router/ui";
import FinalCommandDisplay from "./FinalCommandDisplay";
import ServerDetailsRemote from "./ServerDetailsRemote";
import ServerDetailsEnvironment from "./ServerDetailsEnvironment";
import ServerDetailsAutoStart from "./ServerDetailsAutoStart";
import ServerDetailsInputParams from "./ServerDetailsInputParams";
import { useServerEditingStore, useServerStore } from "@/renderer/stores";
import { toast } from "sonner";

interface ServerDetailsAdvancedSheetProps {
  server: MCPServer;
  handleSave: () => void;
}

const ServerDetailsAdvancedSheet: React.FC<ServerDetailsAdvancedSheetProps> = ({
  server,
  handleSave,
}) => {
  const { t } = useTranslation();
  const { updateServerConfig } = useServerStore();
  const {
    isAdvancedEditing: isOpen,
    isLoading,
    editedCommand,
    editedArgs,
    editedBearerToken,
    editedAutoStart,
    envPairs,
    setIsAdvancedEditing: setIsOpen,
    setEditedCommand,
    setEditedArgs,
    setEditedBearerToken,
    setEditedAutoStart,
    setIsLoading,
    updateArg,
    removeArg,
    addArg,
    updateEnvPair,
    removeEnvPair,
    addEnvPair,
  } = useServerEditingStore();
  
  
  // State for input parameters
  const [inputParamValues, setInputParamValues] = useState<Record<string, string>>({});
  const [initialInputParamValues, setInitialInputParamValues] = useState<Record<string, string>>({});
  const [isParamsDirty, setIsParamsDirty] = useState(false);
  
  // Initialize inputParamValues from server inputParams defaults
  useEffect(() => {
    if (server.inputParams) {
      const initialValues: Record<string, string> = {};
      Object.entries(server.inputParams).forEach(([key, param]) => {
        initialValues[key] = param.default !== undefined ? String(param.default) : "";
      });
      setInputParamValues(initialValues);
      setInitialInputParamValues(initialValues);
      setIsParamsDirty(false);
    }
  }, [server.id, isOpen]);
  
  const updateInputParam = (key: string, value: string) => {
    setInputParamValues((prev) => {
      const updated = { ...prev, [key]: value };
      const dirty = Object.keys(updated).some(
        (k) => updated[k] !== initialInputParamValues[k],
      );
      setIsParamsDirty(dirty);
      return updated;
    });
  };
  
  const handleSaveParams = async () => {
    setIsLoading(true);
    try {
      const updatedInputParams = { ...(server.inputParams || {}) };
      
      if (server.inputParams) {
        Object.entries(inputParamValues).forEach(([key, value]) => {
          if (updatedInputParams[key]) {
            updatedInputParams[key] = {
              ...updatedInputParams[key],
              default: value,
            };
          }
        });
      }
      
      const updatedConfig: any = {
        inputParams: updatedInputParams,
        env: server.env,
        name: server.name,
        command: server.command,
        args: server.args,
      };
      
      await updateServerConfig(server.id, updatedConfig);
      setInitialInputParamValues(inputParamValues);
      setIsParamsDirty(false);
      toast.success(t("serverDetails.updateSuccess"));
    } catch (error) {
      console.error("Failed to update server:", error);
      toast.error(t("serverDetails.updateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            {t("serverDetails.advancedConfiguration")}
          </SheetTitle>
          <SheetDescription>
            {t("serverDetails.advancedConfigurationDescription")}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue={server.inputParams && Object.keys(server.inputParams).length > 0 ? "params" : "general"} className="mt-4">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: server.inputParams && Object.keys(server.inputParams).length > 0 ? 'repeat(2, 1fr)' : '1fr' }}>
            {server.inputParams && Object.keys(server.inputParams).length > 0 && (
              <TabsTrigger value="params">{t("serverDetails.inputParameters")}</TabsTrigger>
            )}
            <TabsTrigger value="general">{t("serverDetails.generalSettings")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-6 mt-4">
            {/* Final Command Display */}
            {server.serverType === "local" ? (
              <FinalCommandDisplay
                server={server}
                inputParamValues={inputParamValues}
              />
            ) : (
              <ServerDetailsRemote
                server={server}
                isEditing={false}
              />
            )}

            {/* Edit Forms */}
            {server.serverType === "local" ? (
              <>
                {/* Command */}
                <div className="space-y-3">
                  <Label
                    htmlFor="server-command"
                    className="text-base font-medium flex items-center gap-1.5"
                  >
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    {t("serverDetails.command")}
                  </Label>
                  <Input
                    id="server-command"
                    value={editedCommand}
                    onChange={(e) => setEditedCommand(e.target.value)}
                    placeholder={t("serverDetails.commandPlaceholder")}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                    {t("serverDetails.commandHelp")}
                  </p>
                </div>

                {/* Arguments */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {t("serverDetails.arguments")}
                    </Label>
                    <Badge variant="outline" className="font-mono">
                      {editedArgs.length} {t("serverDetails.itemsCount")}
                    </Badge>
                  </div>

                  <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                    {editedArgs.length === 0 && (
                      <div className="text-sm text-muted-foreground italic flex items-center justify-center py-4">
                        <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                        {t("serverDetails.noArguments")}
                      </div>
                    )}

                    {editedArgs.map((arg, index) => (
                      <div key={index} className="flex gap-2 group">
                        <Input
                          value={arg}
                          onChange={(e) => updateArg(index, e.target.value)}
                          placeholder={t("serverDetails.argumentPlaceholder")}
                          className="font-mono group-hover:border-primary/50 transition-colors"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeArg(index)}
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
                    onClick={addArg}
                    type="button"
                    className="mt-2 border-dashed hover:border-primary/70"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("serverDetails.addArgument")}
                  </Button>
                </div>
              </>
            ) : (
              <ServerDetailsRemote
                server={server}
                isEditing={true}
                editedBearerToken={editedBearerToken}
                setEditedBearerToken={setEditedBearerToken}
              />
            )}

            {/* Auto Start Configuration (common for both server types) */}
            <ServerDetailsAutoStart
              server={server}
              isEditing={true}
              editedAutoStart={editedAutoStart}
              setEditedAutoStart={setEditedAutoStart}
            />

            {/* Environment Variables (common for both server types) */}
            <ServerDetailsEnvironment
              server={server}
              isEditing={true}
              envPairs={envPairs}
              updateEnvPair={updateEnvPair}
              removeEnvPair={removeEnvPair}
              addEnvPair={addEnvPair}
            />
          </TabsContent>
          
          {server.inputParams && Object.keys(server.inputParams).length > 0 && (
            <TabsContent value="params" className="space-y-6 mt-4">
              <ServerDetailsInputParams
                server={server}
                inputParamValues={inputParamValues}
                updateInputParam={updateInputParam}
              />
              {isParamsDirty && (
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveParams}
                    disabled={isLoading}
                    size="sm"
                    className="gap-2"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t("common.saving")}
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {t("common.save")}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <SheetFooter className="flex justify-between sm:justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
            className="gap-2"
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {t("common.save")}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ServerDetailsAdvancedSheet;
