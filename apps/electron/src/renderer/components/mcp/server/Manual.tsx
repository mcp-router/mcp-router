import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePlatformAPI } from "@/renderer/platform-api";
import { Button } from "@mcp_router/ui";
import {
  Upload,
  AlertTriangle,
  Plus,
  FileJson,
  X,
  ExternalLink,
  HardDrive,
  Globe,
  FileCode2,
  Loader2,
} from "lucide-react";
import {
  validateMcpServerJson,
  processMcpServerConfigs,
} from "./utils/mcp-server-utils";
import { toast } from "sonner";
import { Textarea } from "@mcp_router/ui";
import { Alert, AlertDescription, AlertTitle } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mcp_router/ui";
import { v4 as uuidv4 } from "uuid";
import { MCPServerConfig } from "@mcp_router/shared";
import { Checkbox } from "@mcp_router/ui";
import { RadioGroup, RadioGroupItem } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";
import { useServerStore, useProjectStore } from "@/renderer/stores";
import { cn } from "@/renderer/utils/tailwind-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";

interface EnvVariable {
  key: string;
  value: string;
}

// ---- Small presentational helpers -----------------------------------------
const TabIntro: React.FC<{
  right?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ right, children }) => (
  <div className="flex items-start justify-between pt-4 pb-2">
    <div className="inline-flex items-start gap-2 text-sm">
      <div>{children}</div>
    </div>
    {right ? <div className="shrink-0">{right}</div> : null}
  </div>
);

const FieldNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-muted-foreground">{children}</p>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid w-full items-center gap-1.5">{children}</div>
);

// ---- Component -------------------------------------------------------------
const Manual: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const { createServer, refreshServers } = useServerStore();
  const { projects, list: listProjects } = useProjectStore();

  // Project Selection State (shared between Local and Remote tabs)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  // Load projects on mount
  React.useEffect(() => {
    listProjects();
  }, [listProjects]);

  // JSON Import State
  const [jsonInput, setJsonInput] = useState("");
  const [isLoadingJson, setIsLoadingJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [importedServers, setImportedServers] = useState<any>(null);

  // Manual Configuration State
  const [serverName, setServerName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    serverName?: string;
    command?: string;
    args?: string;
  }>({});

  // Remote Server State
  const [remoteServerName, setRemoteServerName] = useState("");
  const [remoteServerUrl, setRemoteServerUrl] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [remoteServerType, setRemoteServerType] = useState<
    "remote" | "remote-streamable"
  >("remote");
  const [remoteValidationErrors, setRemoteValidationErrors] = useState<{
    serverName?: string;
    serverUrl?: string;
  }>({});
  const [autoStart, setAutoStart] = useState(false);

  // DXT Import State
  const [dxtFile, setDxtFile] = useState<File | null>(null);
  const [isLoadingDxt, setIsLoadingDxt] = useState(false);
  const [dxtError, setDxtError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    const newEnvVars = [...envVars];
    newEnvVars.splice(index, 1);
    setEnvVars(newEnvVars);
  };

  const updateEnvVar = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const validateJson = (
    input: string,
  ): { valid: boolean; error?: string; jsonData?: any } => {
    try {
      const result = validateMcpServerJson(input);

      if (!result.valid) {
        if (result.error?.includes("Invalid JSON format")) {
          return {
            valid: false,
            error: t("importFromJson.errorInvalidFormat"),
          };
        } else if (result.error?.includes("No server configurations found")) {
          return {
            valid: false,
            error: t("importFromJson.errorEmptyMcpServers"),
          };
        } else if (result.error?.includes("Invalid server configuration for")) {
          const serverName = result.error.match(/'([^']+)'/)?.[1] || "";
          return {
            valid: false,
            error: t("importFromJson.errorInvalidServerConfig", { serverName }),
          };
        } else if (result.error?.includes("Missing or invalid command")) {
          const serverName = result.error.match(/'([^']+)'/)?.[1] || "";
          return {
            valid: false,
            error: t("importFromJson.errorMissingCommand", { serverName }),
          };
        } else if (result.error?.includes("Arguments must be an array")) {
          const serverName = result.error.match(/'([^']+)'/)?.[1] || "";
          return {
            valid: false,
            error: t("importFromJson.errorInvalidArgs", { serverName }),
          };
        } else if (result.error?.includes("Invalid JSON:")) {
          return { valid: false, error: t("importFromJson.errorInvalidJson") };
        }
        return { valid: false, error: result.error };
      }
      return { valid: true, jsonData: result.jsonData };
    } catch {
      return { valid: false, error: t("importFromJson.errorInvalidJson") };
    }
  };

  const handleJsonImport = async () => {
    setJsonError(null);
    const validation = validateJson(jsonInput);
    if (!validation.valid) {
      setJsonError(validation.error || t("importFromJson.errorUnknown"));
      return;
    }

    setIsLoadingJson(true);

    try {
      const jsonConfig = validation.jsonData!;
      setImportedServers(jsonConfig);
      const serverConfigs = jsonConfig.mcpServers || jsonConfig;
      if (!serverConfigs || typeof serverConfigs !== "object") {
        throw new Error(
          "Invalid configuration: server configuration is missing or invalid",
        );
      }

      const existingServers = await platformAPI.servers.list();
      const existingServerNames = new Set<string>(
        existingServers.map((server: any) => server.name as string),
      );

      const results = processMcpServerConfigs(
        serverConfigs,
        existingServerNames,
      );

      for (const result of results) {
        if (result.success && result.server) {
          try {
            const serverResponse = await platformAPI.servers.create({
              type: "config",
              config: result.server,
            });
            result.server = serverResponse;
          } catch (error: any) {
            result.success = false;
            result.message = `Error adding server: ${error.message}`;
            delete result.server;
          }
        }
      }

      const success = results.some((r: any) => r.success);

      if (success) {
        toast.success(
          t("importFromJson.successImport", { count: results.length }),
        );
        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.filter((r: any) => !r.success).length;
        if (failCount > 0) {
          toast.error(
            t("importFromJson.partialSuccess", {
              success: successCount,
              fail: failCount,
            }),
          );
        }
        await refreshServers();
      } else {
        toast.error(t("importFromJson.errorFailedImport"));
      }
    } catch {
      toast.error(t("importFromJson.errorFailedImport"));
      setJsonError(t("importFromJson.errorUnknown"));
    } finally {
      setIsLoadingJson(false);
    }
  };

  const clearImportedServers = () => {
    setImportedServers(null);
    setJsonInput("");
    setJsonError(null);
  };

  const resetForm = () => {
    setServerName("");
    setCommand("");
    setArgs("");
    setEnvVars([]);
    setValidationErrors({});
    setSelectedProjectId(null);
  };

  const resetRemoteForm = () => {
    setRemoteServerName("");
    setRemoteServerUrl("");
    setBearerToken("");
    setRemoteValidationErrors({});
    setRemoteServerType("remote");
    setAutoStart(false);
    setSelectedProjectId(null);
  };

  const handleDxtFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".dxt")) {
      setDxtError(t("manual.dxt.errorInvalidFile"));
      return;
    }
    setDxtFile(file);
    setDxtError(null);
  };

  const handleDxtImport = async () => {
    if (!dxtFile) return;
    setIsLoadingDxt(true);
    setDxtError(null);
    try {
      const arrayBuffer = await dxtFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await platformAPI.servers.create({ type: "dxt", dxtFile: uint8Array });
      toast.success(t("manual.dxt.successImport", { name: dxtFile.name }));
      await refreshServers();
      setDxtFile(null);
      setDxtError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("manual.dxt.errorFailedImport");
      toast.error(errorMessage);
      setDxtError(errorMessage);
    } finally {
      setIsLoadingDxt(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: { serverName?: string; command?: string; args?: string } = {};
    if (!serverName.trim()) errors.serverName = t("manual.errors.nameRequired");
    if (!command.trim()) errors.command = t("manual.errors.commandRequired");
    if (!args.trim()) errors.args = t("manual.errors.argsRequired");
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRemoteForm = (): boolean => {
    const errors: { serverName?: string; serverUrl?: string } = {};
    if (!remoteServerName.trim())
      errors.serverName = t("manual.errors.nameRequired");
    if (!remoteServerUrl.trim())
      errors.serverUrl = t("manual.errors.urlRequired");
    setRemoteValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualCreate = async () => {
    if (!validateForm()) return;
    setIsLoadingManual(true);
    try {
      const argsArray = args.split(" ").filter((arg) => arg.trim() !== "");
      const envObject: Record<string, string> = {};
      for (const envVar of envVars) {
        if (envVar.key && envVar.value) envObject[envVar.key] = envVar.value;
      }
      const serverConfig: MCPServerConfig = {
        id: uuidv4(),
        name: serverName,
        command,
        args: argsArray,
        env: envObject,
        autoStart,
        disabled: false,
        serverType: "local",
        projectId: selectedProjectId,
      };
      await createServer(serverConfig);
      toast.success(t("manual.successCreate", { name: serverName }));
      resetForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("manual.errorFailedCreate");
      toast.error(errorMessage);
    } finally {
      setIsLoadingManual(false);
    }
  };

  const connectToRemoteServer = async () => {
    if (!validateRemoteForm()) return;
    setIsLoadingRemote(true);
    try {
      const config: MCPServerConfig = {
        id: uuidv4(),
        name: remoteServerName,
        env: {},
        serverType: remoteServerType,
        remoteUrl: remoteServerUrl,
        bearerToken,
        autoStart,
        disabled: false,
        projectId: selectedProjectId,
      };
      await createServer(config);
      toast.success(
        t("manual.successConnectRemote", { name: remoteServerName }),
      );
      resetRemoteForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("manual.errorFailedConnectRemote");
      toast.error(errorMessage);
    } finally {
      setIsLoadingRemote(false);
    }
  };

  return (
    <div className="p-0 space-y-0">
      <Tabs defaultValue="json" className="w-full">
        {/* Underline tabs with softer weight and no header vibe */}
        <div className="px-8 pt-6 pb-2">
          <TabsList className="bg-muted/30 p-1 rounded-full w-fit">
            <TabsTrigger
              value="json"
              className="rounded-full px-6 transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <FileJson className="h-4 w-4" /> {t("manual.importFromJson")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="dxt"
              className="rounded-full px-6 transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <FileCode2 className="h-4 w-4" /> {t("manual.importFromDxt")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className="rounded-full px-6 transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> {t("manual.createManually")}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="remote"
              className="rounded-full px-6 transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <Globe className="h-4 w-4" /> {t("manual.remote.name")}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* JSON Import */}
        <TabsContent
          value="json"
          className="space-y-6 p-8 mt-0 focus-visible:outline-none"
        >
          <TabIntro
            right={
              importedServers ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearImportedServers}
                  title={t("common.clear")}
                  className="rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null
            }
          >
            {t("importFromJson.description")}
          </TabIntro>

          <div className="space-y-6">
            {importedServers ? (
              <ScrollArea className="h-80 rounded-2xl border bg-muted/30 p-4">
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(importedServers, null, 2)}
                </pre>
              </ScrollArea>
            ) : (
              <>
                <Textarea
                  value={jsonInput}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setJsonInput(e.target.value);
                    setJsonError(null);
                  }}
                  placeholder={`{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "env": {
        "PUPPETEER_LAUNCH_OPTIONS": "{ \"headless\": false }",
        "ALLOW_DANGEROUS": "true"
      }
    }
  }
}`}
                  className="font-mono h-80 text-sm rounded-2xl p-4 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all"
                />

                {jsonError && (
                  <Alert variant="destructive" className="rounded-2xl">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t("importFromJson.errorTitle")}</AlertTitle>
                    <AlertDescription>{jsonError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleJsonImport}
                  disabled={isLoadingJson || !jsonInput.trim()}
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-full text-base font-semibold soft-shadow transition-all hover:-translate-y-0.5"
                >
                  {isLoadingJson ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("common.loading")}
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      {t("importFromJson.import")}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </TabsContent>

        {/* DXT Import */}
        <TabsContent
          value="dxt"
          className="space-y-6 p-8 mt-0 focus-visible:outline-none"
        >
          <TabIntro>{t("manual.dxt.description")}</TabIntro>

          <div className="space-y-6">
            <div
              className="border-2 border-dashed border-border/60 rounded-2xl p-12 text-center bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".dxt"
                onChange={handleDxtFileSelect}
                className="hidden"
              />
              {dxtFile ? (
                <div className="space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <FileCode2 className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-bold">{dxtFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(dxtFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDxtFile(null);
                        setDxtError(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t("manual.dxt.remove")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-bold">
                      {t("manual.dxt.clickToUpload")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("manual.dxt.dxtFilesOnly")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {dxtError && (
              <Alert variant="destructive" className="rounded-2xl">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t("manual.dxt.error")}</AlertTitle>
                <AlertDescription>{dxtError}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleDxtImport}
              disabled={isLoadingDxt || !dxtFile}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-full text-base font-semibold soft-shadow transition-all hover:-translate-y-0.5"
            >
              {isLoadingDxt ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  {t("manual.dxt.importServers")}
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Local */}
        <TabsContent
          value="local"
          className="space-y-6 p-8 mt-0 focus-visible:outline-none"
        >
          <TabIntro>{t("manual.description")}</TabIntro>

          <div className="space-y-6">
            <Row>
              <div className="flex items-center gap-2 px-1">
                <Label htmlFor="serverName" className="font-bold">
                  {t("manual.remote.serverName")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
              </div>
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
                placeholder="puppeteer"
                aria-invalid={!!validationErrors.serverName}
                className={cn(
                  "h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all",
                  validationErrors.serverName ? "border-destructive" : "",
                )}
              />
              {validationErrors.serverName && (
                <p className="text-xs text-destructive px-1">
                  {validationErrors.serverName}
                </p>
              )}
            </Row>

            <Row>
              <div className="flex items-center gap-2 px-1">
                <Label htmlFor="command" className="font-bold">
                  {t("manual.command")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
              </div>
              <Input
                id="command"
                value={command}
                onChange={(e) => {
                  setCommand(e.target.value);
                  if (validationErrors.command) {
                    setValidationErrors({
                      ...validationErrors,
                      command: undefined,
                    });
                  }
                }}
                placeholder="npx"
                aria-invalid={!!validationErrors.command}
                className={cn(
                  "h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all",
                  validationErrors.command ? "border-destructive" : "",
                )}
              />
              {validationErrors.command && (
                <p className="text-xs text-destructive px-1">
                  {validationErrors.command}
                </p>
              )}
            </Row>

            <Row>
              <div className="flex items-center gap-2 px-1">
                <Label htmlFor="args" className="font-bold">
                  {t("manual.args")} <span className="text-destructive">*</span>
                </Label>
              </div>
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
                placeholder="-y @modelcontextprotocol/server-puppeteer"
                aria-invalid={!!validationErrors.args}
                className={cn(
                  "h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all",
                  validationErrors.args ? "border-destructive" : "",
                )}
              />
              {validationErrors.args ? (
                <p className="text-xs text-destructive px-1">
                  {validationErrors.args}
                </p>
              ) : (
                <div className="px-1">
                  <FieldNote>{t("manual.argsHelp")}</FieldNote>
                </div>
              )}
            </Row>

            <div className="mt-2 p-6 rounded-2xl bg-muted/10 border border-muted/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="font-bold">
                    {t("serverDetails.environmentVariables")}
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEnvVar}
                  className="h-9 rounded-full px-4"
                >
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  {t("serverDetails.addEnvironmentVariable")}
                </Button>
              </div>
              <div className="space-y-3">
                {envVars.map((envVar, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Input
                      className="flex-1 h-11 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all"
                      placeholder={t("serverDetails.key")}
                      value={envVar.key}
                      onChange={(e) =>
                        updateEnvVar(index, "key", e.target.value)
                      }
                    />
                    <Input
                      className="flex-1 h-11 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all"
                      placeholder={t("serverDetails.value")}
                      value={envVar.value}
                      onChange={(e) =>
                        updateEnvVar(index, "value", e.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvVar(index)}
                      className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("common.remove")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {envVars.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 italic">
                    No environment variables added.
                  </p>
                )}
              </div>
            </div>

            <Row>
              <div className="px-1">
                <Label className="font-bold">
                  {t("serverSettings.project")}
                </Label>
              </div>
              <Select
                value={selectedProjectId ?? "__none__"}
                onValueChange={(v) =>
                  setSelectedProjectId(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all">
                  <SelectValue placeholder={t("projects.unassigned")} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="__none__" className="rounded-lg">
                    {t("projects.unassigned")}
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="rounded-lg">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>

            <div className="flex items-center space-x-3 px-1">
              <Checkbox
                id="auto-start-local"
                checked={autoStart}
                onCheckedChange={(checked) => setAutoStart(!!checked)}
                className="h-5 w-5 rounded-md"
              />
              <Label
                htmlFor="auto-start-local"
                className="font-medium cursor-pointer"
              >
                {t("manual.autoStart")}
              </Label>
            </div>

            <Button
              onClick={handleManualCreate}
              disabled={isLoadingManual}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-full text-base font-semibold soft-shadow transition-all hover:-translate-y-0.5 mt-4"
            >
              {isLoadingManual ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  {t("manual.create")}
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Remote */}
        <TabsContent
          value="remote"
          className="space-y-6 p-8 mt-0 focus-visible:outline-none"
        >
          <TabIntro>{t("manual.remote.description")}</TabIntro>

          <div className="space-y-6">
            <Row>
              <div className="flex items-center gap-2 px-1">
                <Label htmlFor="remote-server-name" className="font-bold">
                  {t("manual.serverName")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
              </div>
              <Input
                id="remote-server-name"
                value={remoteServerName}
                onChange={(e) => {
                  setRemoteServerName(e.target.value);
                  if (remoteValidationErrors.serverName) {
                    setRemoteValidationErrors({
                      ...remoteValidationErrors,
                      serverName: undefined,
                    });
                  }
                }}
                placeholder="remote-mcp"
                aria-invalid={!!remoteValidationErrors.serverName}
                className={cn(
                  "h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all",
                  remoteValidationErrors.serverName ? "border-destructive" : "",
                )}
              />
              {remoteValidationErrors.serverName && (
                <p className="text-xs text-destructive px-1">
                  {remoteValidationErrors.serverName}
                </p>
              )}
            </Row>

            <Row>
              <div className="flex items-center gap-2 px-1">
                <Label htmlFor="remote-server-url" className="font-bold">
                  {t("manual.remote.serverUrl")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
              </div>
              <Input
                id="remote-server-url"
                value={remoteServerUrl}
                onChange={(e) => {
                  setRemoteServerUrl(e.target.value);
                  if (remoteValidationErrors.serverUrl) {
                    setRemoteValidationErrors({
                      ...remoteValidationErrors,
                      serverUrl: undefined,
                    });
                  }
                }}
                placeholder="https://example.com/mcp"
                aria-invalid={!!remoteValidationErrors.serverUrl}
                className={cn(
                  "h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all",
                  remoteValidationErrors.serverUrl ? "border-destructive" : "",
                )}
              />
              {remoteValidationErrors.serverUrl && (
                <p className="text-xs text-destructive px-1">
                  {remoteValidationErrors.serverUrl}
                </p>
              )}
            </Row>

            <Row>
              <div className="flex items-center gap-2 px-1">
                <Label htmlFor="bearer-token" className="font-bold">
                  {t("manual.remote.bearerToken")}
                </Label>
              </div>
              <Input
                id="bearer-token"
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                className="h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all"
              />
            </Row>

            <div className="mt-2 p-6 rounded-2xl bg-muted/10 border border-muted/50 space-y-4">
              <Label className="font-bold px-1">
                {t("manual.remote.transportType")}
              </Label>
              <RadioGroup
                value={remoteServerType}
                onValueChange={(value: "remote" | "remote-streamable") =>
                  setRemoteServerType(value)
                }
                className="flex flex-col space-y-3 px-1"
              >
                <div className="flex items-center space-x-3 group cursor-pointer">
                  <RadioGroupItem
                    value="remote"
                    id="remote-sse"
                    className="h-5 w-5"
                  />
                  <Label
                    htmlFor="remote-sse"
                    className="cursor-pointer font-medium group-hover:text-primary transition-colors"
                  >
                    {t("manual.remote.transportSSE")}
                  </Label>
                </div>
                <div className="flex items-center space-x-3 group cursor-pointer">
                  <RadioGroupItem
                    value="remote-streamable"
                    id="remote-streamable"
                    className="h-5 w-5"
                  />
                  <Label
                    htmlFor="remote-streamable"
                    className="cursor-pointer font-medium group-hover:text-primary transition-colors"
                  >
                    {t("manual.remote.transportStreamable")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Row>
              <div className="px-1">
                <Label className="font-bold">
                  {t("serverSettings.project")}
                </Label>
              </div>
              <Select
                value={selectedProjectId ?? "__none__"}
                onValueChange={(v) =>
                  setSelectedProjectId(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all">
                  <SelectValue placeholder={t("projects.unassigned")} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="__none__" className="rounded-lg">
                    {t("projects.unassigned")}
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="rounded-lg">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>

            <div className="flex items-center space-x-3 px-1">
              <Checkbox
                id="auto-start-remote"
                checked={autoStart}
                onCheckedChange={(checked) => setAutoStart(!!checked)}
                className="h-5 w-5 rounded-md"
              />
              <Label
                htmlFor="auto-start-remote"
                className="font-medium cursor-pointer"
              >
                {t("manual.autoStart")}
              </Label>
            </div>

            <Button
              onClick={connectToRemoteServer}
              disabled={isLoadingRemote}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-full text-base font-semibold soft-shadow transition-all hover:-translate-y-0.5 mt-4"
            >
              {isLoadingRemote ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <ExternalLink className="h-5 w-5" />
                  {t("manual.remote.connect")}
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Manual;
