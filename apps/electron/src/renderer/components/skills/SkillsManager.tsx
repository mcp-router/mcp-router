import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Badge,
  TooltipProvider,
  ScrollArea,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@mcp_router/ui";
import {
  IconDownload,
  IconFolderOpen,
  IconPlus,
  IconSearch,
  IconRefresh,
  IconFilter,
  IconChevronDown,
} from "@tabler/icons-react";
import { usePlatformAPI } from "@/renderer/platform-api";
import type { UnifiedSkill, ClientApp } from "@mcp_router/shared";
import { toast } from "sonner";
import { cn } from "@/renderer/utils/tailwind-utils";
import { UnifiedSkillCard } from "./UnifiedSkillCard";
import UnifiedSkillDetailSheet from "./UnifiedSkillDetailSheet";
import { ErrorBoundary } from "@/renderer/components/common/ErrorBoundary";

const SkillsManager: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();

  // Data state - now using unified skills from backend
  const [unifiedSkills, setUnifiedSkills] = useState<UnifiedSkill[]>([]);
  const [clientApps, setClientApps] = useState<ClientApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  // New skill dialog state
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Load all data - now using unified skills API from backend
  const loadData = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      }

      try {
        const [skills, clients] = await Promise.all([
          platformAPI.skills.unified.list(),
          platformAPI.clientApps.list(),
        ]);

        setUnifiedSkills(skills);
        setClientApps(clients);
      } catch (error) {
        console.error("Failed to load skills data:", error);
        toast.error(t("skills.loadError"));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [platformAPI, t],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter skills by search query and selected clients
  const filteredSkills = useMemo(() => {
    let filtered = unifiedSkills;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((skill) =>
        skill.name.toLowerCase().includes(query),
      );
    }

    // Filter by selected clients
    if (selectedClientIds.size > 0) {
      filtered = filtered.filter((skill) =>
        skill.clientStates.some(
          (cs) =>
            selectedClientIds.has(cs.clientId) && cs.state !== "not-installed",
        ),
      );
    }

    return filtered;
  }, [unifiedSkills, searchQuery, selectedClientIds]);

  // Client filter toggle
  const handleClientFilterToggle = (clientId: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  // Clear all client filters
  const handleClearClientFilters = () => {
    setSelectedClientIds(new Set());
  };

  // Create new skill
  const handleCreateSkill = async () => {
    if (!newSkillName.trim()) {
      setDialogError(t("skills.nameRequired"));
      return;
    }

    setDialogError(null);
    try {
      await platformAPI.skills.create({
        name: newSkillName.trim(),
      });
      toast.success(t("skills.createSuccess"));
      setIsNewDialogOpen(false);
      setNewSkillName("");
      await loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setDialogError(message || t("skills.createError"));
    }
  };

  const handleCloseNewDialog = () => {
    setIsNewDialogOpen(false);
    setNewSkillName("");
    setDialogError(null);
  };

  // Import skill
  const handleImport = async () => {
    try {
      await platformAPI.skills.import();
      toast.success(t("skills.importSuccess"));
      await loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "No folder selected") {
        toast.error(message || t("skills.importError"));
      }
    }
  };

  // Open skills folder
  const handleOpenSkillsFolder = async () => {
    try {
      await platformAPI.skills.openFolder();
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  // Refresh data
  const handleRefresh = () => {
    loadData(true);
  };

  // Derive selectedSkill from ID (avoids re-render loop from object reference changes)
  const selectedSkill = useMemo(
    () => unifiedSkills.find((s) => s.id === selectedSkillId) ?? null,
    [unifiedSkills, selectedSkillId],
  );

  // Handle skill selection
  const handleSkillClick = (skill: UnifiedSkill) => {
    setSelectedSkillId(skill.id);
  };

  // Handle detail sheet close
  const handleDetailClose = () => {
    setSelectedSkillId(null);
  };

  // Handle skill update (refresh data)
  const handleSkillUpdate = () => {
    loadData(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className="flex flex-col h-full bg-background/30">
          {/* Header */}
          <div className="flex flex-col gap-6 p-10 border-b border-border/40 bg-background/50 backdrop-blur-md">
            {/* Top row: Title, Search, and Actions */}
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-4 shrink-0">
                <div className="bg-primary/10 p-2.5 rounded-2xl">
                  <IconPlus className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-black tracking-tight">
                  {t("skills.unified.title", {
                    defaultValue: "Skills Library",
                  })}
                </h2>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-xl">
                <IconSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("skills.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-11 rounded-full bg-background border-border/40 shadow-sm focus:ring-primary/20 transition-all"
                  aria-label={t("skills.searchPlaceholder")}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 shrink-0">
                <Button
                  onClick={() => setIsNewDialogOpen(true)}
                  className="rounded-full px-6 h-11 font-bold shadow-lg shadow-primary/5"
                >
                  <IconPlus className="w-4 h-4 mr-2" />
                  {t("skills.new")}
                </Button>
              </div>
            </div>

            {/* Bottom row: Client filters and secondary actions */}
            <div className="flex items-center justify-between gap-6">
              {/* Consolidated Client Filter */}
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={
                        selectedClientIds.size > 0 ? "default" : "outline"
                      }
                      size="sm"
                      className="rounded-full px-5 h-9 font-bold text-xs uppercase tracking-widest gap-2 border-border/60"
                    >
                      <IconFilter className="w-3.5 h-3.5" />
                      {t("skills.unified.filter", {
                        defaultValue: "Filter Clients",
                      })}
                      {selectedClientIds.size > 0 && (
                        <Badge className="ml-1 h-5 min-w-[20px] px-1 bg-background text-primary rounded-full text-[10px] font-black border-none">
                          {selectedClientIds.size}
                        </Badge>
                      )}
                      <IconChevronDown className="w-3.5 h-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-56 rounded-2xl border-border/40 soft-shadow"
                    align="start"
                  >
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 px-3 py-2">
                      Select Clients
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border/20" />
                    <DropdownMenuCheckboxItem
                      checked={selectedClientIds.size === 0}
                      onCheckedChange={handleClearClientFilters}
                      className="rounded-xl mx-1 my-0.5 focus:bg-primary/5"
                    >
                      {t("skills.unified.all", { defaultValue: "All Clients" })}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator className="bg-border/20" />
                    <ScrollArea className="h-[200px]">
                      {clientApps.map((client) => (
                        <DropdownMenuCheckboxItem
                          key={client.id}
                          checked={selectedClientIds.has(client.id)}
                          onCheckedChange={() =>
                            handleClientFilterToggle(client.id)
                          }
                          className="rounded-xl mx-1 my-0.5 focus:bg-primary/5"
                        >
                          {client.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedClientIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearClientFilters}
                    className="h-8 rounded-full px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Secondary Actions */}
              <div className="flex gap-2 shrink-0 bg-muted/30 p-1 rounded-full border border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="rounded-full h-8 px-4 text-xs font-bold"
                >
                  <IconRefresh
                    className={cn(
                      "w-3.5 h-3.5 mr-2",
                      isRefreshing && "animate-spin",
                    )}
                  />
                  {t("common.refresh")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleImport}
                  className="rounded-full h-8 px-4 text-xs font-bold"
                >
                  <IconDownload className="w-3.5 h-3.5 mr-2" />
                  {t("skills.import")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenSkillsFolder}
                  className="rounded-full h-8 px-4 text-xs font-bold"
                >
                  <IconFolderOpen className="w-3.5 h-3.5 mr-2" />
                  {t("skills.openFolder")}
                </Button>
              </div>
            </div>
          </div>

          {/* Skills Grid */}
          <ScrollArea className="flex-1 bg-background/10">
            <div className="p-10">
              {filteredSkills.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground bg-card/30 backdrop-blur-sm rounded-[2.5rem] border border-dashed border-border/60">
                  <div className="bg-muted/50 p-6 rounded-full mb-6">
                    <IconSearch className="w-12 h-12 opacity-20" />
                  </div>
                  <p className="text-xl font-bold tracking-tight">
                    {searchQuery || selectedClientIds.size > 0
                      ? t("skills.noResults")
                      : t("skills.empty")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredSkills.map((skill) => (
                    <UnifiedSkillCard
                      key={skill.id}
                      skill={skill}
                      onClick={() => handleSkillClick(skill)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Skill Detail Sheet */}
          <UnifiedSkillDetailSheet
            skill={selectedSkill}
            isOpen={!!selectedSkill}
            onClose={handleDetailClose}
            onUpdate={handleSkillUpdate}
          />

          {/* New Skill Dialog */}
          <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("skills.newDialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("skills.newDialog.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="skill-name">{t("skills.name")}</Label>
                  <Input
                    id="skill-name"
                    value={newSkillName}
                    onChange={(e) => {
                      setNewSkillName(e.target.value);
                      setDialogError(null);
                    }}
                    placeholder={t("skills.namePlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateSkill();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("skills.nameHint")}
                  </p>
                  {dialogError && (
                    <p className="text-xs text-destructive">{dialogError}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseNewDialog}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreateSkill}>
                  {t("skills.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  );
};

export default SkillsManager;
