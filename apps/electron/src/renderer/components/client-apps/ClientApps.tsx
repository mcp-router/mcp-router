import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Checkbox,
  ScrollArea,
  ScrollBar,
} from "@mcp_router/ui";
import {
  IconPlus,
  IconTrash,
  IconFolderOpen,
  IconPencil,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { usePlatformAPI } from "@/renderer/platform-api";
import type {
  ClientApp,
  CreateClientAppInput,
  TokenServerAccess,
} from "@mcp_router/shared";
import { toast } from "sonner";
import HowToUse, { HowToUseHandle } from "../mcp/apps/HowToUse";
import {
  UNASSIGNED_PROJECT_ID,
  useProjectStore,
} from "@/renderer/stores/project-store";

interface ServerItem {
  id: string;
  name: string;
  projectId?: string | null;
}

const ClientApps: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();

  // State
  const [clients, setClients] = useState<ClientApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const { projects, list: listProjects } = useProjectStore();

  // Selected client for dialogs
  const [selectedClient, setSelectedClient] = useState<ClientApp | null>(null);

  // Add Custom Client dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newMcpConfigPath, setNewMcpConfigPath] = useState("");
  const [newSkillsPath, setNewSkillsPath] = useState("");
  const [addDialogError, setAddDialogError] = useState<string | null>(null);

  // Edit Custom Client dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editMcpConfigPath, setEditMcpConfigPath] = useState("");
  const [editSkillsPath, setEditSkillsPath] = useState("");
  const [editDialogError, setEditDialogError] = useState<string | null>(null);

  // Server Access dialog state
  const [isServerAccessDialogOpen, setIsServerAccessDialogOpen] =
    useState(false);
  const [selectedServerAccess, setSelectedServerAccess] =
    useState<TokenServerAccess>({});

  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientApp | null>(null);

  // HowToUse modal ref
  const howToUseRef = useRef<HowToUseHandle>(null);

  // Load clients
  const loadClients = useCallback(async () => {
    try {
      const clientList = await platformAPI.clientApps.list();
      setClients(clientList);
    } catch (error) {
      console.error("Failed to load client apps:", error);
      toast.error(t("clientApps.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [platformAPI, t]);

  // Load servers for access control
  const loadServers = useCallback(async () => {
    try {
      const serverList = await platformAPI.servers.list();
      setServers(serverList);
    } catch (error) {
      console.error("Failed to load servers:", error);
    }
  }, [platformAPI]);

  useEffect(() => {
    loadClients();
    loadServers();
  }, [loadClients, loadServers]);

  useEffect(() => {
    listProjects();
  }, [listProjects]);

  // Get status badge for installation
  const getInstallationBadge = (client: ClientApp) => {
    if (client.isCustom) {
      return (
        <Badge variant="secondary" className="rounded-full px-3">
          {t("clientApps.custom")}
        </Badge>
      );
    }
    if (!client.installed) {
      return (
        <Badge variant="outline" className="rounded-full px-3">
          {t("clientApps.notInstalled")}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="rounded-full px-3">
        {t("clientApps.installed")}
      </Badge>
    );
  };

  // Get MCP status text
  const getMcpStatus = (client: ClientApp) => {
    if (client.mcpConfigured) {
      return (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <IconCheck className="w-4 h-4" />
          {t("clientApps.mcpConfigured")}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <IconX className="w-4 h-4" />
        {t("clientApps.mcpNotConfigured")}
      </span>
    );
  };

  // Get Skills status text
  const getSkillsStatus = (client: ClientApp) => {
    if (client.skillsConfigured) {
      return (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <IconCheck className="w-4 h-4" />
          {t("clientApps.skillsSynced")}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <IconX className="w-4 h-4" />
        {t("clientApps.skillsNotSetUp")}
      </span>
    );
  };

  // Handle folder selection for MCP config path
  const handleSelectMcpConfigPath = async (
    setter: (path: string) => void,
    errorSetter: (error: string | null) => void,
  ) => {
    try {
      const folderPath = await platformAPI.clientApps.selectFolder();
      if (folderPath) {
        setter(folderPath);
        errorSetter(null);
      }
    } catch (error: any) {
      if (error.message !== "No folder selected") {
        console.error("Failed to select folder:", error);
      }
    }
  };

  // Handle folder selection for skills path
  const handleSelectSkillsPath = async (
    setter: (path: string) => void,
    errorSetter: (error: string | null) => void,
  ) => {
    try {
      const folderPath = await platformAPI.clientApps.selectFolder();
      if (folderPath) {
        setter(folderPath);
        errorSetter(null);
      }
    } catch (error: any) {
      if (error.message !== "No folder selected") {
        console.error("Failed to select folder:", error);
      }
    }
  };

  // Add Custom Client
  const handleAddCustomClient = async () => {
    if (!newClientName.trim()) {
      setAddDialogError(t("clientApps.errors.nameRequired"));
      return;
    }

    setAddDialogError(null);
    try {
      const input: CreateClientAppInput = {
        name: newClientName.trim(),
        mcpConfigPath: newMcpConfigPath.trim() || undefined,
        skillsPath: newSkillsPath.trim() || undefined,
      };
      const result = await platformAPI.clientApps.create(input);

      if (result.success && result.clientApp) {
        setClients((prev) => [...prev, result.clientApp!]);
        toast.success(result.message);
        handleCloseAddDialog();
      } else {
        setAddDialogError(result.message);
      }
    } catch (error: any) {
      setAddDialogError(error.message || t("clientApps.errors.createFailed"));
    }
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewClientName("");
    setNewMcpConfigPath("");
    setNewSkillsPath("");
    setAddDialogError(null);
  };

  // Edit Custom Client
  const openEditDialog = (client: ClientApp) => {
    setSelectedClient(client);
    setEditClientName(client.name);
    setEditMcpConfigPath(client.mcpConfigPath || "");
    setEditSkillsPath(client.skillsPath || "");
    setEditDialogError(null);
    setIsEditDialogOpen(true);
  };

  const handleEditCustomClient = async () => {
    if (!selectedClient) return;
    if (!editClientName.trim()) {
      setEditDialogError(t("clientApps.errors.nameRequired"));
      return;
    }

    setEditDialogError(null);
    try {
      const result = await platformAPI.clientApps.update(selectedClient.id, {
        name: editClientName.trim(),
        mcpConfigPath: editMcpConfigPath.trim() || undefined,
        skillsPath: editSkillsPath.trim() || undefined,
      });

      if (result.success && result.clientApp) {
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClient.id ? result.clientApp! : c)),
        );
        toast.success(result.message);
        handleCloseEditDialog();
      } else {
        setEditDialogError(result.message);
      }
    } catch (error: any) {
      setEditDialogError(error.message || t("clientApps.errors.updateFailed"));
    }
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedClient(null);
    setEditClientName("");
    setEditMcpConfigPath("");
    setEditSkillsPath("");
    setEditDialogError(null);
  };

  // Configure MCP for standard client
  const handleConfigureMcp = async (client: ClientApp) => {
    try {
      const result = await platformAPI.clientApps.configure(client.id);
      if (result.success && result.clientApp) {
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? result.clientApp! : c)),
        );
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || t("clientApps.errors.configureFailed"));
    }
  };

  // Server Access Dialog
  const openServerAccessDialog = (client: ClientApp) => {
    setSelectedClient(client);
    setSelectedServerAccess({ ...client.serverAccess });
    setIsServerAccessDialogOpen(true);
  };

  const handleServerCheckboxChange = (serverId: string, checked: boolean) => {
    setSelectedServerAccess((prev) => ({
      ...prev,
      [serverId]: checked,
    }));
  };

  const handleProjectCheckboxChange = (projectId: string, checked: boolean) => {
    setSelectedServerAccess((prev) => {
      const next = { ...prev };
      const targetProjectId = projectId || UNASSIGNED_PROJECT_ID;
      const value = !!checked;

      servers.forEach((server) => {
        const serverProjectId =
          server.projectId === null || server.projectId === undefined
            ? UNASSIGNED_PROJECT_ID
            : server.projectId;

        if (serverProjectId === targetProjectId) {
          next[server.id] = value;
        }
      });

      return next;
    });
  };

  const saveServerAccess = async () => {
    if (!selectedClient) return;

    try {
      const result = await platformAPI.clientApps.updateServerAccess(
        selectedClient.id,
        selectedServerAccess,
      );

      if (result.success && result.clientApp) {
        setClients((prev) =>
          prev.map((c) => (c.id === selectedClient.id ? result.clientApp! : c)),
        );
        toast.success(t("clientApps.serverAccessSaved"));
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || t("clientApps.errors.serverAccessFailed"));
    } finally {
      setIsServerAccessDialogOpen(false);
    }
  };

  // How To Use modal
  const openHowToUseModal = (client: ClientApp) => {
    setSelectedClient(client);
    if (howToUseRef.current) {
      howToUseRef.current.showDialog();
    }
  };

  // Delete confirmation
  const openDeleteDialog = (client: ClientApp) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      const success = await platformAPI.clientApps.delete(clientToDelete.id);
      if (success) {
        setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
        toast.success(t("clientApps.deleted"));
      } else {
        toast.error(t("clientApps.errors.deleteFailed"));
      }
    } catch (error: any) {
      toast.error(error.message || t("clientApps.errors.deleteFailed"));
    } finally {
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  // Project sections for server access dialog
  const projectSections = (() => {
    if (!servers || servers.length === 0) return [];

    const projectMap = new Map<string, { id: string; name: string }>();
    projects.forEach((p) => projectMap.set(p.id, { id: p.id, name: p.name }));

    const grouped: Record<
      string,
      { projectId: string; name: string; servers: ServerItem[] }
    > = {};

    servers.forEach((server) => {
      const projectId =
        server.projectId === null || server.projectId === undefined
          ? UNASSIGNED_PROJECT_ID
          : server.projectId;

      if (!grouped[projectId]) {
        const project = projectMap.get(projectId);
        grouped[projectId] = {
          projectId,
          name:
            project?.name ||
            (projectId === UNASSIGNED_PROJECT_ID
              ? t("projects.unassigned")
              : projectId),
          servers: [],
        };
      }

      grouped[projectId].servers.push(server);
    });

    return Object.values(grouped).sort((a, b) => {
      if (a.projectId === UNASSIGNED_PROJECT_ID) return -1;
      if (b.projectId === UNASSIGNED_PROJECT_ID) return 1;
      return a.name.localeCompare(b.name);
    });
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-background/50 h-full overflow-auto">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-6 rounded-2xl soft-shadow border border-muted/50">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            {t("clientApps.title")}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t("clientApps.description")}
          </p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="rounded-full px-6 soft-shadow"
        >
          <IconPlus className="w-4 h-4 mr-2" />
          {t("clientApps.addClient")}
        </Button>
      </div>

      {/* Client Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {clients.map((client) => (
          <Card
            key={client.id}
            className="overflow-hidden rounded-2xl soft-shadow border-muted/50 bg-card/50 hover:bg-card transition-all duration-300"
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  {/* Display icon if available */}
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center soft-shadow border border-white/10 p-2">
                    {client.icon ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        dangerouslySetInnerHTML={{
                          __html: client.icon.replace(
                            /<svg/g,
                            '<svg style="width: 100%; height: 100%; max-width: 24px; max-height: 24px;"',
                          ),
                        }}
                      />
                    ) : (
                      <IconPlus className="w-6 h-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <CardTitle className="truncate max-w-[150px] font-bold tracking-tight">
                    {client.name}
                  </CardTitle>
                </div>
                <div className="flex gap-2">{getInstallationBadge(client)}</div>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl">
                {/* MCP Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    MCP Status
                  </span>
                  {getMcpStatus(client)}
                </div>
                {/* Skills Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {t("clientApps.skillsLabel")}
                  </span>
                  {getSkillsStatus(client)}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3 justify-between flex-wrap bg-muted/20 p-4">
              <div className="flex gap-2 flex-wrap">
                {/* How To Use button - only if configured with token */}
                {client.mcpConfigured && client.token && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openHowToUseModal(client)}
                    className="rounded-full px-4"
                  >
                    {t("clientApps.howToUse")}
                  </Button>
                )}
                {/* Edit/Delete for custom clients */}
                {client.isCustom && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(client)}
                      className="rounded-full px-4"
                    >
                      <IconPencil className="w-4 h-4 mr-2" />
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(client)}
                      className="rounded-full px-4"
                    >
                      <IconTrash className="w-4 h-4 mr-2" />
                      {t("common.delete")}
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Configure button for unconfigured standard clients */}
                {!client.mcpConfigured &&
                  client.isStandard &&
                  client.installed && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConfigureMcp(client)}
                      className="rounded-full px-6 soft-shadow"
                    >
                      {t("clientApps.configure")}
                    </Button>
                  )}
                {/* Server Access button for configured clients */}
                {client.mcpConfigured && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openServerAccessDialog(client)}
                    className="rounded-full px-4"
                  >
                    {t("clientApps.serverAccess")}
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {t("clientApps.noClients")}
        </div>
      )}

      {/* Add Custom Client Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="rounded-2xl soft-shadow border-muted/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {t("clientApps.addCustomClient.title")}
            </DialogTitle>
            <DialogDescription>
              {t("clientApps.addCustomClient.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            {/* Name field */}
            <div className="grid gap-2">
              <Label htmlFor="client-name" className="font-semibold text-sm">
                {t("clientApps.addCustomClient.name")}
              </Label>
              <Input
                id="client-name"
                value={newClientName}
                onChange={(e) => {
                  setNewClientName(e.target.value);
                  setAddDialogError(null);
                }}
                placeholder={t("clientApps.addCustomClient.namePlaceholder")}
                className="rounded-full bg-muted/30 focus-visible:bg-muted/50 transition-all border-muted/50"
              />
            </div>
            {/* MCP Config Path field */}
            <div className="grid gap-2">
              <Label
                htmlFor="mcp-config-path"
                className="font-semibold text-sm"
              >
                {t("clientApps.addCustomClient.mcpConfigPath")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="mcp-config-path"
                  value={newMcpConfigPath}
                  onChange={(e) => {
                    setNewMcpConfigPath(e.target.value);
                    setAddDialogError(null);
                  }}
                  placeholder={t(
                    "clientApps.addCustomClient.mcpConfigPathPlaceholder",
                  )}
                  className="flex-1 rounded-full bg-muted/30 focus-visible:bg-muted/50 transition-all border-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full shrink-0"
                  onClick={() =>
                    handleSelectMcpConfigPath(
                      setNewMcpConfigPath,
                      setAddDialogError,
                    )
                  }
                >
                  <IconFolderOpen className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground ml-1">
                {t("clientApps.addCustomClient.mcpConfigPathHint")}
              </p>
            </div>
            {/* Skills Path field */}
            <div className="grid gap-2">
              <Label htmlFor="skills-path" className="font-semibold text-sm">
                {t("clientApps.addCustomClient.skillsPath")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="skills-path"
                  value={newSkillsPath}
                  onChange={(e) => {
                    setNewSkillsPath(e.target.value);
                    setAddDialogError(null);
                  }}
                  placeholder={t(
                    "clientApps.addCustomClient.skillsPathPlaceholder",
                  )}
                  className="flex-1 rounded-full bg-muted/30 focus-visible:bg-muted/50 transition-all border-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full shrink-0"
                  onClick={() =>
                    handleSelectSkillsPath(setNewSkillsPath, setAddDialogError)
                  }
                >
                  <IconFolderOpen className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground ml-1">
                {t("clientApps.addCustomClient.skillsPathHint")}
              </p>
            </div>
            {addDialogError && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                {addDialogError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseAddDialog}
              className="rounded-full px-6"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAddCustomClient}
              className="rounded-full px-6 soft-shadow"
            >
              {t("clientApps.addClient")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Custom Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-2xl soft-shadow border-muted/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {t("clientApps.editClient.title")}
            </DialogTitle>
            <DialogDescription>
              {t("clientApps.editClient.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            {/* Name field */}
            <div className="grid gap-2">
              <Label
                htmlFor="edit-client-name"
                className="font-semibold text-sm"
              >
                {t("clientApps.addCustomClient.name")}
              </Label>
              <Input
                id="edit-client-name"
                value={editClientName}
                onChange={(e) => {
                  setEditClientName(e.target.value);
                  setEditDialogError(null);
                }}
                placeholder={t("clientApps.addCustomClient.namePlaceholder")}
                className="rounded-full bg-muted/30 focus-visible:bg-muted/50 transition-all border-muted/50"
              />
            </div>
            {/* MCP Config Path field */}
            <div className="grid gap-2">
              <Label
                htmlFor="edit-mcp-config-path"
                className="font-semibold text-sm"
              >
                {t("clientApps.addCustomClient.mcpConfigPath")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="edit-mcp-config-path"
                  value={editMcpConfigPath}
                  onChange={(e) => {
                    setEditMcpConfigPath(e.target.value);
                    setEditDialogError(null);
                  }}
                  placeholder={t(
                    "clientApps.addCustomClient.mcpConfigPathPlaceholder",
                  )}
                  className="flex-1 rounded-full bg-muted/30 focus-visible:bg-muted/50 transition-all border-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full shrink-0"
                  onClick={() =>
                    handleSelectMcpConfigPath(
                      setEditMcpConfigPath,
                      setEditDialogError,
                    )
                  }
                >
                  <IconFolderOpen className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* Skills Path field */}
            <div className="grid gap-2">
              <Label
                htmlFor="edit-skills-path"
                className="font-semibold text-sm"
              >
                {t("clientApps.addCustomClient.skillsPath")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="edit-skills-path"
                  value={editSkillsPath}
                  onChange={(e) => {
                    setEditSkillsPath(e.target.value);
                    setEditDialogError(null);
                  }}
                  placeholder={t(
                    "clientApps.addCustomClient.skillsPathPlaceholder",
                  )}
                  className="flex-1 rounded-full bg-muted/30 focus-visible:bg-muted/50 transition-all border-muted/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full shrink-0"
                  onClick={() =>
                    handleSelectSkillsPath(
                      setEditSkillsPath,
                      setEditDialogError,
                    )
                  }
                >
                  <IconFolderOpen className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {editDialogError && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                {editDialogError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseEditDialog}
              className="rounded-full px-6"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleEditCustomClient}
              className="rounded-full px-6 soft-shadow"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Server Access Dialog */}
      <Dialog
        open={isServerAccessDialogOpen}
        onOpenChange={setIsServerAccessDialogOpen}
      >
        <DialogContent className="max-w-md overflow-hidden rounded-2xl soft-shadow border-muted/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {t("clientApps.serverAccess")} - {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {t("clientApps.serverAccessDescription")}
            </p>
            <ScrollArea className="h-[50vh] pr-4">
              <div className="space-y-6 pr-2">
                {projectSections.map((section) => {
                  const totalServers = section.servers.length;
                  const selectedCount = section.servers.filter(
                    (server) => selectedServerAccess[server.id] === true,
                  ).length;
                  const allSelected =
                    totalServers > 0 && selectedCount === totalServers;

                  return (
                    <div
                      key={section.projectId}
                      className="space-y-3 bg-muted/20 p-4 rounded-xl border border-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`project-${section.projectId}`}
                            checked={allSelected}
                            className="rounded-sm"
                            onCheckedChange={(checked) =>
                              handleProjectCheckboxChange(
                                section.projectId,
                                !!checked,
                              )
                            }
                          />
                          <Label
                            htmlFor={`project-${section.projectId}`}
                            className="font-bold"
                          >
                            {section.name}
                          </Label>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full px-2 text-[10px] font-bold"
                        >
                          {selectedCount}/{totalServers}
                        </Badge>
                      </div>
                      <div className="space-y-2 pl-7 pt-1">
                        {section.servers.map((server) => (
                          <div
                            key={server.id}
                            className="flex items-center space-x-3"
                          >
                            <Checkbox
                              id={`server-${server.id}`}
                              checked={selectedServerAccess[server.id] === true}
                              className="rounded-sm"
                              onCheckedChange={(checked) =>
                                handleServerCheckboxChange(server.id, !!checked)
                              }
                            />
                            <Label
                              htmlFor={`server-${server.id}`}
                              className="text-sm font-medium"
                            >
                              {server.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              onClick={() => setIsServerAccessDialogOpen(false)}
              variant="outline"
              className="rounded-full px-6"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={saveServerAccess}
              className="rounded-full px-6 soft-shadow"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-2xl soft-shadow border-muted/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {t("clientApps.deleteConfirm.title")} - {clientToDelete?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("clientApps.deleteConfirm.message")}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => setIsDeleteDialogOpen(false)}
              variant="outline"
              className="rounded-full px-6"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleDeleteClient}
              variant="destructive"
              className="rounded-full px-6 soft-shadow"
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HowToUse Modal */}
      <div className="hidden">
        <HowToUse ref={howToUseRef} token={selectedClient?.token} />
      </div>
    </div>
  );
};

export default ClientApps;
