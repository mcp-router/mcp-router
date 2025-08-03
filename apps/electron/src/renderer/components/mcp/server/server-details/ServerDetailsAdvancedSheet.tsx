import React, { useState, useEffect } from "react";
import { MCPServer } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import {
  Settings2,
  Check,
  RefreshCw,
  Info,
  FileText,
  Plus,
  Trash,
  Terminal,
} from "lucide-react";
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
  handleSave: (updatedInputParams?: any) => void;
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
  const [inputParamValues, setInputParamValues] = useState<
    Record<string, string>
  >({});
  const [initialInputParamValues, setInitialInputParamValues] = useState<
    Record<string, string>
  >({});
  const [isParamsDirty, setIsParamsDirty] = useState(false);

  // Initialize inputParamValues from server inputParams defaults
  useEffect(() => {
    if (server.inputParams) {
      const initialValues: Record<string, string> = {};
      Object.entries(server.inputParams).forEach(([key, param]) => {
        initialValues[key] =
          param.default !== undefined ? String(param.default) : "";
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

  // This function is now only used internally to update inputParams in handleSave
  const prepareInputParamsForSave = () => {
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

    return updatedInputParams;
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

        {server.inputParams && Object.keys(server.inputParams).length > 0 ? (
          <Tabs defaultValue="params" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="params">
                {t("serverDetails.inputParameters")}
              </TabsTrigger>
              <TabsTrigger value="general">
                {t("serverDetails.generalSettings")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 mt-4">
              {/* Final Command Display */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-primary">
                    {t("serverDetails.finalCommand")}
                  </h3>
                </div>
                {server.serverType === "local" ? (
                  <FinalCommandDisplay
                    server={server}
                    inputParamValues={inputParamValues}
                    editedCommand={editedCommand}
                    editedArgs={editedArgs}
                  />
                ) : (
                  <ServerDetailsRemote server={server} isEditing={false} />
                )}
              </div>

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

            <TabsContent value="params" className="space-y-6 mt-4">
              <ServerDetailsInputParams
                server={server}
                inputParamValues={inputParamValues}
                updateInputParam={updateInputParam}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Final Command Display */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-primary">
                  {t("serverDetails.finalCommand")}
                </h3>
              </div>
              {server.serverType === "local" ? (
                <FinalCommandDisplay
                  server={server}
                  inputParamValues={inputParamValues}
                  editedCommand={editedCommand}
                  editedArgs={editedArgs}
                />
              ) : (
                <ServerDetailsRemote server={server} isEditing={false} />
              )}
            </div>

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
          </div>
        )}

        <SheetFooter className="flex justify-between sm:justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
            className="gap-2"
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={async () => {
              setIsLoading(true);
              try {
                // Prepare input params if they were modified
                const updatedInputParams = isParamsDirty
                  ? prepareInputParamsForSave()
                  : server.inputParams;

                // Call the parent's handleSave with inputParams
                await handleSave(updatedInputParams);

                // Reset dirty state after successful save
                if (isParamsDirty) {
                  setInitialInputParamValues(inputParamValues);
                  setIsParamsDirty(false);
                }
              } catch (error) {
                console.error("Failed to save:", error);
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ServerDetailsAdvancedSheet;
