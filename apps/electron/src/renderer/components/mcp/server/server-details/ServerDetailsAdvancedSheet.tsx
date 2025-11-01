import React, { useState, useEffect, useCallback } from "react";
import { MCPServer, MCPTool } from "@mcp_router/shared";
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
import { Switch } from "@mcp_router/ui";
import FinalCommandDisplay from "./FinalCommandDisplay";
import ServerDetailsRemote from "./ServerDetailsRemote";
import ServerDetailsEnvironment from "./ServerDetailsEnvironment";
import ServerDetailsAutoStart from "./ServerDetailsAutoStart";
import ServerDetailsInputParams from "./ServerDetailsInputParams";
import { useServerEditingStore } from "@/renderer/stores";
import { usePlatformAPI } from "@/renderer/platform-api";

interface ServerDetailsAdvancedSheetProps {
  server: MCPServer;
  handleSave: (
    updatedInputParams?: Record<string, unknown>,
    editedName?: string,
    updatedToolPermissions?: Record<string, boolean>,
  ) => Promise<void>;
}

const ServerDetailsAdvancedSheet: React.FC<ServerDetailsAdvancedSheetProps> = ({
  server,
  handleSave,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const {
    isAdvancedEditing: isOpen,
    isLoading,
    editedName,
    editedCommand,
    editedArgs,
    editedBearerToken,
    editedAutoStart,
    envPairs,
    editedToolPermissions,
    setIsAdvancedEditing: setIsOpen,
    setEditedName,
    setEditedCommand,
    setEditedArgs,
    setEditedBearerToken,
    setEditedAutoStart,
    setIsLoading,
    setEditedToolPermissions,
    updateArg,
    removeArg,
    addArg,
    updateEnvPair,
    removeEnvPair,
    addEnvPair,
  } = useServerEditingStore();
  const deriveInitialToolPermissions = useCallback(
    (toolList?: MCPTool[] | null): Record<string, boolean> => {
      const serverPermissions = server.toolPermissions || {};
      if (!toolList || toolList.length === 0) {
        return { ...serverPermissions };
      }

      const permissions: Record<string, boolean> = {};
      for (const tool of toolList) {
        if (serverPermissions[tool.name] !== undefined) {
          permissions[tool.name] = serverPermissions[tool.name] !== false;
        } else if (tool.enabled !== undefined) {
          permissions[tool.name] = !!tool.enabled;
        } else {
          permissions[tool.name] = true;
        }
      }

      return permissions;
    },
    [server.toolPermissions],
  );

  // State for input parameters
  const [inputParamValues, setInputParamValues] = useState<
    Record<string, string>
  >({});
  const [initialInputParamValues, setInitialInputParamValues] = useState<
    Record<string, string>
  >({});
  const [isParamsDirty, setIsParamsDirty] = useState(false);
  const [tools, setTools] = useState<MCPTool[]>(server.tools ?? []);
  const [isToolsLoading, setIsToolsLoading] = useState(false);
  const [needsServerRunning, setNeedsServerRunning] = useState(false);
  const [initialToolPermissions, setInitialToolPermissions] = useState<
    Record<string, boolean>
  >(() => deriveInitialToolPermissions(server.tools));
  const [isToolPermissionsDirty, setIsToolPermissionsDirty] = useState(false);
  const [hasAttemptedToolFetch, setHasAttemptedToolFetch] = useState(false);

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
  }, [server.id, isOpen, server.inputParams]);

  // Initialize tool permissions when sheet opens or server changes
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const basePermissions = deriveInitialToolPermissions(server.tools);
    setTools(server.tools ?? []);
    setInitialToolPermissions(basePermissions);
    setEditedToolPermissions(basePermissions);
    setIsToolPermissionsDirty(false);
    setNeedsServerRunning(false);
    setHasAttemptedToolFetch(false);
  }, [
    deriveInitialToolPermissions,
    isOpen,
    server.id,
    server.tools,
    setEditedToolPermissions,
  ]);

  // Fetch tools from platform API
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const fetchTools = async () => {
      setIsToolsLoading(true);
      setNeedsServerRunning(false);

      try {
        const toolList = await platformAPI.servers.listTools(server.id);
        if (cancelled) {
          return;
        }
        setTools(toolList);
        const permissions = deriveInitialToolPermissions(toolList);
        setInitialToolPermissions(permissions);
        setEditedToolPermissions(permissions);
        setIsToolPermissionsDirty(false);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const rawMessage =
          error instanceof Error ? error.message : String(error);
        if (/must be running/i.test(rawMessage)) {
          setNeedsServerRunning(true);
        } else {
          console.error("Failed to load tools", error);
        }
      } finally {
        if (!cancelled) {
          setIsToolsLoading(false);
          setHasAttemptedToolFetch(true);
        }
      }
    };

    fetchTools();

    return () => {
      cancelled = true;
    };
  }, [
    deriveInitialToolPermissions,
    isOpen,
    platformAPI,
    server.id,
    setEditedToolPermissions,
  ]);

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

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    setEditedToolPermissions((prev) => {
      const updated = { ...prev, [toolName]: enabled };
      const initial = initialToolPermissions;
      const initialKeys = Object.keys(initial);
      const updatedKeys = Object.keys(updated);
      const keysMatch =
        initialKeys.length === updatedKeys.length &&
        updatedKeys.every((key) => initialKeys.includes(key));
      const dirty =
        !keysMatch || updatedKeys.some((key) => updated[key] !== initial[key]);
      setIsToolPermissionsDirty(dirty);
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

  const renderToolsContent = () => {
    if (isToolsLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {t("serverDetails.toolsLoading")}
        </div>
      );
    }

    if (needsServerRunning) {
      return (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>{t("serverDetails.toolsRequireRunning")}</span>
        </div>
      );
    }

    if (tools.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          {t("serverDetails.toolsEmpty")}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {tools.map((tool) => {
            const isEnabled = editedToolPermissions[tool.name] ?? true;
            return (
              <div
                key={tool.name}
                className="flex items-start justify-between gap-4 rounded-md border border-border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{tool.name}</p>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground">
                      {tool.description}
                    </p>
                  )}
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) =>
                    handleToolToggle(tool.name, checked)
                  }
                  aria-label={
                    isEnabled
                      ? t("serverDetails.toolEnabled")
                      : t("serverDetails.toolDisabled")
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const hasInputParams =
    !!server.inputParams && Object.keys(server.inputParams).length > 0;
  const showToolsTab =
    isToolsLoading ||
    tools.length > 0 ||
    needsServerRunning ||
    Object.keys(initialToolPermissions).length > 0 ||
    hasAttemptedToolFetch;
  const tabsListClassWithParams = showToolsTab ? "grid-cols-3" : "grid-cols-2";
  const tabsListClassWithoutParams = showToolsTab
    ? "grid-cols-2"
    : "grid-cols-1";

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

        {hasInputParams ? (
          <Tabs defaultValue="params" className="mt-4">
            <TabsList className={`grid w-full ${tabsListClassWithParams}`}>
              <TabsTrigger value="params">
                {t("serverDetails.inputParameters")}
              </TabsTrigger>
              <TabsTrigger value="general">
                {t("serverDetails.generalSettings")}
              </TabsTrigger>
              {showToolsTab && (
                <TabsTrigger value="tools">
                  {t("serverDetails.tools")}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="general" className="space-y-6 mt-4">
              {/* Server Name */}
              <div className="space-y-3">
                <Label
                  htmlFor="server-name"
                  className="text-base font-medium flex items-center gap-1.5"
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {t("serverDetails.serverName")}
                </Label>
                <Input
                  id="server-name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder={t("discoverServers.serverNameRequired")}
                />
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
            </TabsContent>

            <TabsContent value="params" className="space-y-6 mt-4">
              <ServerDetailsInputParams
                server={server}
                inputParamValues={inputParamValues}
                updateInputParam={updateInputParam}
              />
            </TabsContent>
            {showToolsTab && (
              <TabsContent value="tools" className="space-y-6 mt-4">
                {renderToolsContent()}
              </TabsContent>
            )}
          </Tabs>
        ) : showToolsTab ? (
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className={`grid w-full ${tabsListClassWithoutParams}`}>
              <TabsTrigger value="general">
                {t("serverDetails.generalSettings")}
              </TabsTrigger>
              {showToolsTab && (
                <TabsTrigger value="tools">
                  {t("serverDetails.tools")}
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="general" className="space-y-6 mt-4">
              {/* Server Name */}
              <div className="space-y-3">
                <Label
                  htmlFor="server-name"
                  className="text-base font-medium flex items-center gap-1.5"
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {t("serverDetails.serverName")}
                </Label>
                <Input
                  id="server-name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder={t("discoverServers.serverNameRequired")}
                />
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
            </TabsContent>
            <TabsContent value="tools" className="space-y-6 mt-4">
              {renderToolsContent()}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Server Name */}
            <div className="space-y-3">
              <Label
                htmlFor="server-name"
                className="text-base font-medium flex items-center gap-1.5"
              >
                <Info className="h-4 w-4 text-muted-foreground" />
                {t("serverDetails.serverName")}
              </Label>
              <Input
                id="server-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder={t("discoverServers.serverNameRequired")}
              />
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
          </div>
        )}

        {!needsServerRunning && (
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
                  const toolPermissionsToSave = isToolPermissionsDirty
                    ? { ...editedToolPermissions }
                    : undefined;

                  // Call the parent's handleSave with inputParams and editedName
                  await handleSave(
                    updatedInputParams,
                    editedName,
                    toolPermissionsToSave,
                  );

                  // Reset dirty state after successful save
                  if (isParamsDirty) {
                    setInitialInputParamValues(inputParamValues);
                    setIsParamsDirty(false);
                  }
                  if (isToolPermissionsDirty) {
                    setInitialToolPermissions(editedToolPermissions);
                    setIsToolPermissionsDirty(false);
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
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ServerDetailsAdvancedSheet;
