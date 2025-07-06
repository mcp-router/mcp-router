import React, { useState, useMemo, useEffect } from "react";
import { AgentConfig, MCPServerConfig, MCPTool } from "@mcp-router/shared";
import { Button } from "@mcp-router/ui";
import { Input } from "@mcp-router/ui";
import { Label } from "@mcp-router/ui";
import { Textarea } from "@mcp-router/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@mcp-router/ui";
import { Switch } from "@mcp-router/ui";
import { Badge } from "@mcp-router/ui";
import { toast } from "sonner";
import { Server, Plus, X, Edit, Trash2, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp-router/ui";
import { v4 as uuidv4 } from "uuid";
import { usePlatformAPI } from "@/lib/platform-api";

// Setup Settings Component
interface McpSettingsProps {
  agent: AgentConfig;
  setAgent: React.Dispatch<React.SetStateAction<Omit<AgentConfig, "id">>>;
  isDev?: boolean;
}

export const McpSettings: React.FC<McpSettingsProps> = ({
  agent,
  setAgent,
  isDev = false,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();

  // Server dialog state
  const [isServerDialogOpen, setIsServerDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(
    null,
  );

  // Tool list and permissions state
  const [serverTools, setServerTools] = useState<Record<string, MCPTool[]>>({});
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  // Error modal state
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Server form fields
  const [serverName, setServerName] = useState("");
  const [commandType, setCommandType] = useState<"pnpm dlx" | "uvx">(
    "pnpm dlx",
  );
  const [args, setArgs] = useState("");
  const [envKeys, setEnvKeys] = useState<string[]>([]);
  const [requiredParams, setRequiredParams] = useState<string[]>([]);
  const [serverSetupInstructions, setServerSetupInstructions] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    serverName?: string;
    args?: string;
    remoteUrl?: string;
  }>({});

  // Dynamically extract setup items - based on current form values
  const extractFormSetupItems = useMemo(() => {
    const parseDynamic = (argString: string) => {
      const argsArray = argString
        .trim()
        .split(/\s+/)
        .filter((arg) => arg);
      const dynamicParams = argsArray
        .filter((arg) => /^\{([^}]+)\}$/.test(arg))
        .map((arg) => arg.replace(/[{}]/g, ""));
      return dynamicParams;
    };

    if (dialogMode === "edit" && editingServer) {
      const dynamicParams = parseDynamic(args);
      const allItems = [
        ...dynamicParams,
        ...envKeys.filter((k) => k.trim() !== ""),
      ];
      return allItems.length ? allItems : null;
    }
    if (dialogMode === "create") {
      const dynamicParams = parseDynamic(args);
      const allItems = [
        ...dynamicParams,
        ...envKeys.filter((k) => k.trim() !== ""),
      ];
      return allItems.length ? allItems : null;
    }
    return null;
  }, [args, envKeys, dialogMode, editingServer]);

  useEffect(() => {
    if (extractFormSetupItems) {
      setRequiredParams((prev) =>
        prev.filter((item) => extractFormSetupItems.includes(item)),
      );
    }
  }, [extractFormSetupItems]);

  // ツール権限ダイアログを開く関数
  const openToolPermissionsDialog = async (serverId: string) => {
    setSelectedServerId(serverId);
    setIsLoadingTools(true);

    try {
      const agentId = agent.id;
      const response = await platformAPI.agents.tools.list(
        agentId,
        serverId,
        isDev,
      );

      if (!response) {
        setErrorMessage("Failed to connect to server");
        setIsErrorModalOpen(true);
      } else if (response.success && response.tools) {
        setServerTools((prev) => ({ ...prev, [serverId]: response.tools }));
        setIsToolDialogOpen(true);
      } else if (response.error) {
        // Display error in modal
        setErrorMessage(response.error);
        setIsErrorModalOpen(true);
      } else {
        setErrorMessage("Failed to fetch tools from server");
        setIsErrorModalOpen(true);
      }
    } catch (error) {
      console.error("Error fetching tools:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Error fetching tools",
      );
      setIsErrorModalOpen(true);
    } finally {
      setIsLoadingTools(false);
    }
  };

  const toggleToolPermission = (
    serverId: string,
    toolName: string,
    enabled: boolean,
  ) => {
    const updatedTools = { ...serverTools };
    if (updatedTools[serverId]) {
      updatedTools[serverId] = updatedTools[serverId].map((tool) =>
        tool.name === toolName ? { ...tool, enabled } : tool,
      );
      setServerTools(updatedTools);
    }
  };

  const updateToolPermissions = async (
    serverId: string,
    permissions: Record<string, boolean>,
  ) => {
    try {
      const currentToolPermissions = agent.toolPermissions || {};
      const updatedToolPermissions = { ...currentToolPermissions };

      const currentServerTools = serverTools[serverId] || [];
      const permissionArray = currentServerTools.map((tool) => ({
        toolName: tool.name,
        inputSchema: tool.inputSchema,
        description: tool.description || tool.name || "",
        enabled: permissions[tool.name] !== false,
      }));

      updatedToolPermissions[serverId] = permissionArray;
      setAgent((prev) => ({
        ...prev,
        toolPermissions: updatedToolPermissions,
      }));

      const updatedTools = { ...serverTools };
      if (updatedTools[serverId]) {
        updatedTools[serverId] = updatedTools[serverId].map((tool) => ({
          ...tool,
          enabled: permissions[tool.name] !== false,
        }));
        setServerTools(updatedTools);
      }
      return true;
    } catch (error) {
      console.error("Failed to update tool permissions:", error);
      toast.error(t("agents.mcpSettings.toolPermissionsUpdateFailed"));
      return false;
    }
  };

  // Server form helpers
  const validateServerForm = (): boolean => {
    const errors: { serverName?: string; args?: string; remoteUrl?: string } =
      {};
    if (!serverName.trim())
      errors.serverName = t("agents.mcpSettings.messages.serverNameRequired");
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addEnvKey = () => setEnvKeys([...envKeys, ""]);
  const removeEnvKey = (index: number) =>
    setEnvKeys(envKeys.filter((_, i) => i !== index));
  const updateEnvKey = (index: number, value: string) =>
    setEnvKeys(envKeys.map((k, i) => (i === index ? value : k)));
  const toggleRequiredParam = (param: string) => {
    setRequiredParams((prev) =>
      prev.includes(param) ? prev.filter((p) => p !== param) : [...prev, param],
    );
  };

  // アップデート関連 state
  const [packagesWithUpdates, setPackagesWithUpdates] = useState<
    Record<string, boolean>
  >({});
  const [updatingPackages, setUpdatingPackages] = useState<
    Record<string, boolean>
  >({});

  // 更新状況を確認
  const checkForUpdates = async (server: MCPServerConfig) => {
    try {
      const serverArgs = server.args || [];
      const argsList =
        server.command === "pnpm"
          ? serverArgs.filter((arg) => arg !== "dlx")
          : serverArgs;
      const response = await platformAPI.packages.checkUpdates(
        argsList,
        server.command as "pnpm" | "uvx",
      );

      if (response && response.success && response.updates?.hasUpdates) {
        setPackagesWithUpdates((prev) => ({
          ...prev,
          [server.id]:
            !!response.updates && Object.keys(response.updates).length > 0,
        }));
        return response.updates;
      } else {
        setPackagesWithUpdates((prev) => ({
          ...prev,
          [server.id]: false,
        }));
      }
      return null;
    } catch (error) {
      console.error("Failed to check for updates:", error);
      return null;
    }
  };

  // パッケージを更新
  const handleUpdatePackage = async (server: MCPServerConfig) => {
    try {
      setUpdatingPackages((prev) => ({ ...prev, [server.id]: true }));

      // 更新情報を取得
      const serverArgs = server.args || [];
      const argsList =
        server.command === "pnpm"
          ? serverArgs.filter((arg) => arg !== "dlx")
          : serverArgs;
      const updateResult = await platformAPI.packages.checkUpdates(
        argsList,
        server.command as "pnpm" | "uvx",
      );

      if (
        !updateResult?.success ||
        !updateResult.updates ||
        !updateResult.updates.packages
      ) {
        toast.error(
          t("agents.mcpSettings.updateInfoFetchFailed", { name: server.name }),
        );
        return;
      }

      // パッケージの更新情報から最新バージョンを取得
      const updates = updateResult.updates.packages;

      // 編集ダイアログが開いている場合は、フォームのargs値を更新
      if (
        dialogMode === "edit" &&
        editingServer &&
        editingServer.id === server.id
      ) {
        const updatedArgs = args.split(/\s+/).filter((arg) => arg);

        // 各パッケージの更新を適用
        updates.forEach((update) => {
          if (update.updateAvailable && update.latestVersion) {
            const packageName = update.packageName;
            const latestVersion = update.latestVersion;

            for (let i = 0; i < updatedArgs.length; i++) {
              const arg = updatedArgs[i];
              if (
                arg.includes(packageName) &&
                (arg === packageName || arg.startsWith(`${packageName}@`))
              ) {
                updatedArgs[i] = `${packageName}@${latestVersion}`;
                break;
              }
            }
          }
        });

        setArgs(updatedArgs.join(" "));
        toast.success(t("agents.mcpSettings.updateApplied"));
      } else {
        // 通常のリストからの更新（このケースは今回削除されたが、念のため残す）
        const updatedMcpServers = agent.mcpServers.map((s) => {
          if (s.id === server.id) {
            const updatedArgs = [...(s.args || [])];

            updates.forEach((update) => {
              if (update.updateAvailable && update.latestVersion) {
                const packageName = update.packageName;
                const latestVersion = update.latestVersion;

                for (let i = 0; i < updatedArgs.length; i++) {
                  const arg = updatedArgs[i];
                  if (
                    arg.includes(packageName) &&
                    (arg === packageName || arg.startsWith(`${packageName}@`))
                  ) {
                    updatedArgs[i] = `${packageName}@${latestVersion}`;
                    break;
                  }
                }
              }
            });

            return { ...s, args: updatedArgs };
          }
          return s;
        });

        setAgent((prev) => ({
          ...prev,
          mcpServers: updatedMcpServers,
        }));
      }

      // 更新後は更新可能フラグをオフにする
      setPackagesWithUpdates((prev) => ({
        ...prev,
        [server.id]: false,
      }));
    } catch (error) {
      console.error("Failed to update package:", error);
      toast.error(t("agents.mcpSettings.updateFailed", { name: server.name }));
    } finally {
      setUpdatingPackages((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  const resetServerForm = () => {
    setServerName("");
    setCommandType("pnpm dlx");
    setArgs("");
    setEnvKeys([]);
    setRequiredParams([]);
    setServerSetupInstructions("");
    setValidationErrors({});
    setEditingServer(null);
  };

  const removeServer = (serverId: string) => {
    setAgent((prev) => ({
      ...prev,
      mcpServers: prev.mcpServers.filter((server) => server.id !== serverId),
    }));
  };

  const openServerDialog = async (
    mode: "create" | "edit",
    server?: MCPServerConfig,
  ) => {
    setDialogMode(mode);
    resetServerForm();
    if (mode === "edit" && server) {
      // Find the current server from agent.mcpServers to get the latest env values
      const currentServer =
        agent.mcpServers.find((s) => s.id === server.id) || server;
      setEditingServer(currentServer);
      setServerName(currentServer.name);
      setCommandType(currentServer.command === "pnpm" ? "pnpm dlx" : "uvx");
      const argString =
        currentServer.args?.filter((arg) => arg !== "dlx").join(" ") || "";
      setArgs(argString);
      setEnvKeys(Object.keys(currentServer.env || {}));
      setRequiredParams(currentServer.required || []);
      setServerSetupInstructions(currentServer.setupInstructions || "");

      // 編集ダイアログを開いた時に自動でアップデートをチェック
      checkForUpdates(currentServer);
    }
    if (mode === "create") {
      setRequiredParams([]);
    }
    setIsServerDialogOpen(true);
  };

  const handleSaveServer = async () => {
    if (!validateServerForm()) return;
    setIsLoading(true);
    try {
      const envObject: Record<string, string> = {};
      // Preserve existing env values from the current agent state
      const currentServer = agent.mcpServers.find(
        (s) => s.id === editingServer?.id,
      );
      envKeys.forEach((key) => {
        if (key.trim()) {
          // First check if there's a value in the current server state, then fall back to editingServer
          envObject[key] =
            currentServer?.env?.[key] || editingServer?.env?.[key] || "";
        }
      });
      const packageManager = commandType === "pnpm dlx" ? "pnpm" : "uvx";
      const response = await platformAPI.packages.resolveVersions(
        args,
        packageManager,
      );
      const resolvedArgs =
        response && response.success && response.resolvedArgs
          ? response.resolvedArgs
          : args;
      const argsArray = resolvedArgs
        .trim()
        .split(/\s+/)
        .filter((arg) => arg);
      const serverConfig: MCPServerConfig = {
        id: editingServer?.id || uuidv4(),
        name: serverName,
        serverType: "local",
        command: commandType === "pnpm dlx" ? "pnpm" : "uvx",
        args: commandType === "pnpm dlx" ? ["dlx", ...argsArray] : argsArray,
        env: envObject,
        required: requiredParams,
        setupInstructions: serverSetupInstructions,
        remoteUrl: undefined,
        bearerToken: undefined,
        autoStart: editingServer?.autoStart || false,
        disabled: editingServer?.disabled || false,
        inputParams: editingServer?.inputParams, // Preserve inputParams from existing server
        description: editingServer?.description, // Preserve description
        latestVersion: editingServer?.latestVersion, // Preserve latestVersion
        verificationStatus: editingServer?.verificationStatus, // Preserve verificationStatus
        version: editingServer?.version, // Preserve version
        toolPermissions: editingServer?.toolPermissions, // Preserve toolPermissions
      };
      if (dialogMode === "create") {
        setAgent((prev) => ({
          ...prev,
          mcpServers: [...prev.mcpServers, serverConfig],
        }));
      } else {
        setAgent((prev) => ({
          ...prev,
          mcpServers: prev.mcpServers.map((s) =>
            s.id === serverConfig.id ? serverConfig : s,
          ),
        }));
      }
      resetServerForm();
      setIsServerDialogOpen(false);
    } catch (error) {
      console.error(`Failed to ${dialogMode} server:`, error);
      toast.error(
        t(
          `agents.mcpSettings.server${dialogMode === "create" ? "Create" : "Update"}Failed`,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* MCPサーバ設定部分 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">
              {t("agents.mcpSettings.title")}
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => openServerDialog("create")}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("common.add")}
            </Button>
          </div>
          {/* サーバ一覧 */}
          {agent.mcpServers.length ? (
            <div className="space-y-2 mb-4">
              {agent.mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex flex-col p-2 bg-muted/30 rounded-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{server.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openToolPermissionsDialog(server.id)}
                        title={t("agents.mcpSettings.configureToolPermissions")}
                        disabled={isLoadingTools}
                      >
                        {isLoadingTools && selectedServerId === server.id ? (
                          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openServerDialog("edit", server)}
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeServer(server.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-6 text-muted-foreground">
              {t("agents.mcpSettings.noServersConfigured")}
            </div>
          )}
        </div>
      </div>

      {/* サーバ作成・編集ダイアログ */}
      <Dialog
        open={isServerDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetServerForm();
          setIsServerDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create"
                ? t("agents.mcpSettings.createServerTitle")
                : t("agents.mcpSettings.editServerTitle")}
            </DialogTitle>
            {dialogMode === "create" && (
              <DialogDescription>
                {t("agents.mcpSettings.createServerDescription")}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serverName">
                  {t("agents.mcpSettings.serverName")}
                </Label>
                <Input
                  id="serverName"
                  value={serverName}
                  onChange={(e) => {
                    setServerName(e.target.value);
                    if (validationErrors.serverName) {
                      setValidationErrors({
                        ...validationErrors,
                        serverName: undefined,
                      });
                    }
                  }}
                  placeholder={"e.g. puppeteer-server"}
                  className={
                    validationErrors.serverName ? "border-destructive" : ""
                  }
                />
                {validationErrors.serverName && (
                  <p className="text-xs text-destructive">
                    {validationErrors.serverName}
                  </p>
                )}
              </div>

              <div className="grid w-full items-center gap-1.5">
                <Label className="text-right">
                  {t("agents.mcpSettings.command")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={commandType}
                  onValueChange={(value) =>
                    setCommandType(value as "pnpm dlx" | "uvx")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pnpm dlx">pnpm dlx</SelectItem>
                    <SelectItem value="uvx">uvx</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("agents.mcpSettings.commandDescription")}
                </p>
              </div>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="args" className="text-right">
                  {t("agents.mcpSettings.args")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="args"
                  value={args}
                  onChange={(e) => {
                    setArgs(e.target.value);
                    if (validationErrors.args) {
                      setValidationErrors({
                        ...validationErrors,
                        args: undefined,
                      });
                    }
                  }}
                  placeholder={"@modelcontextprotocol/server-puppeteer"}
                  className={
                    validationErrors.args
                      ? "border-destructive flex-1"
                      : "flex-1"
                  }
                />
                {dialogMode === "edit" &&
                  editingServer &&
                  packagesWithUpdates[editingServer.id] && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleUpdatePackage(editingServer)}
                      disabled={updatingPackages[editingServer.id]}
                      className="flex items-center gap-2"
                    >
                      {updatingPackages[editingServer.id] ? (
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <>{t("common.update")}</>
                      )}
                    </Button>
                  )}
              </div>
              {validationErrors.args ? (
                <p className="text-xs text-destructive">
                  {validationErrors.args}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("agents.mcpSettings.argsDescription")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Label>
                      {t("agents.mcpSettings.environmentVariables")}
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEnvKey}
                    className="h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    {t("common.add")}
                  </Button>
                </div>

                <div className="space-y-2">
                  {envKeys.map((key, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder={t("agents.mcpSettings.variableName")}
                        value={key}
                        onChange={(e) => updateEnvKey(index, e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEnvKey(index)}
                        className="h-9 w-9"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {envKeys.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">
                      {t("agents.mcpSettings.environmentVariablesDescription")}
                    </p>
                  )}
                </div>
                {extractFormSetupItems && extractFormSetupItems.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>{t("agents.mcpSettings.requiredParameters")}</Label>
                    {extractFormSetupItems.map((item) => (
                      <label
                        key={item}
                        className="flex items-center gap-2 text-sm font-mono"
                      >
                        <input
                          type="checkbox"
                          checked={requiredParams.includes(item)}
                          onChange={() => toggleRequiredParam(item)}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid w-full items-start gap-1.5">
                <Label htmlFor="setupInstructions">
                  {t("agents.mcpSettings.setupInstructions")}
                </Label>

                {/* 設定項目の表示 */}
                {extractFormSetupItems && extractFormSetupItems.length > 0 && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-2">
                    <div className="text-sm font-medium text-blue-800 mb-1 flex items-center gap-1">
                      {t("agents.mcpSettings.setupItems")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {extractFormSetupItems.map((item, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="bg-blue-100 text-blue-800 border-blue-200"
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Textarea
                  id="setupInstructions"
                  value={serverSetupInstructions}
                  onChange={(e) => setServerSetupInstructions(e.target.value)}
                  placeholder={t(
                    "agents.mcpSettings.setupInstructionsPlaceholder",
                  )}
                  rows={5}
                  className="h-full min-h-[120px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetServerForm();
                setIsServerDialogOpen(false);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSaveServer}
              disabled={isLoading}
              className="flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  {dialogMode === "create"
                    ? t("agents.mcpSettings.addButtonText")
                    : t("agents.mcpSettings.saveButtonText")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ツール権限設定ダイアログ */}
      <Dialog open={isToolDialogOpen} onOpenChange={setIsToolDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {t("agents.mcpSettings.toolPermissionsTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("agents.mcpSettings.toolPermissionsDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingTools ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" />
                <span className="ml-2">
                  {t("agents.mcpSettings.loadingTools")}
                </span>
              </div>
            ) : selectedServerId &&
              serverTools[selectedServerId]?.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {serverTools[selectedServerId].map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-start justify-between p-2 border rounded-md"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{tool.name}</h4>
                      {tool.description && (
                        <p className="text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center ml-4">
                      <Switch
                        checked={tool.enabled !== false}
                        onCheckedChange={(checked) =>
                          toggleToolPermission(
                            selectedServerId,
                            tool.name,
                            checked,
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 text-muted-foreground">
                {t("agents.mcpSettings.noToolsAvailable")}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsToolDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (selectedServerId && serverTools[selectedServerId]) {
                  // Create tool permissions object from tool list
                  const toolPermissions: Record<string, boolean> = {};
                  serverTools[selectedServerId].forEach((tool) => {
                    toolPermissions[tool.name] = tool.enabled !== false;
                  });

                  // Update tool permissions
                  updateToolPermissions(selectedServerId, toolPermissions).then(
                    (success) => {
                      if (success) {
                        setIsToolDialogOpen(false);
                      }
                    },
                  );
                }
              }}
            >
              {t("agents.mcpSettings.saveButtonText")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("common.error")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            <p className="text-sm break-words whitespace-pre-wrap">
              {errorMessage}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsErrorModalOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
