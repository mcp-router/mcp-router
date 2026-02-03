import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  Badge,
  Textarea,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@mcp_router/ui";
import {
  IconCheck,
  IconRefresh,
  IconTrash,
  IconPlayerPlay,
  IconPlayerStop,
  IconDownload,
} from "@tabler/icons-react";
import { usePlatformAPI } from "@/renderer/platform-api";
import type { UnifiedSkill, ClientSkillSummary } from "@mcp_router/shared";
import { toast } from "sonner";
import { sanitizeSvgWithStyles } from "@/renderer/utils/svg-sanitizer";
import { cn } from "@/renderer/utils/tailwind-utils";

interface UnifiedSkillDetailSheetProps {
  skill: UnifiedSkill | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

/**
 * UnifiedSkillDetailSheet - A sheet component for managing individual skills.
 *
 * Displays:
 * 1. Header with skill name and DISCOVERED badge
 * 2. SKILL.md content editor with auto-save
 * 3. Client installation table with per-client controls
 * 4. Bulk action buttons
 */
const UnifiedSkillDetailSheet: React.FC<UnifiedSkillDetailSheetProps> = ({
  skill,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Content editor state
  const [content, setContent] = useState("");
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Loading states for actions
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [loadingClientId, setLoadingClientId] = useState<string | null>(null);

  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Load content on-demand when skill changes (lazy loading optimization)
  useEffect(() => {
    const loadContent = async () => {
      if (!skill) {
        setContent("");
        return;
      }

      // If content is already available, use it
      if (skill.content !== undefined && skill.content !== null) {
        setContent(skill.content);
        setIsSaved(true);
        return;
      }

      // Load content based on skill source
      setIsLoadingContent(true);
      try {
        let skillContent: string | null = null;

        if (skill.source === "local") {
          // For local skills, fetch by ID
          skillContent = await platformAPI.skills.getContent(skill.id);
        } else if (skill.source === "discovered" && skill.sourcePath) {
          // For discovered skills, fetch from path
          skillContent = await platformAPI.skills.getContentFromPath(
            skill.sourcePath,
          );
        }

        setContent(skillContent || "");
        setIsSaved(true);
      } catch (error) {
        console.error("Failed to load skill content:", error);
        setContent("");
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();
  }, [skill?.id, skill?.source, skill?.sourcePath, platformAPI]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save with debounce
  const autoSave = useCallback(
    async (skillId: string, newContent: string) => {
      setIsSaving(true);
      try {
        await platformAPI.skills.update(skillId, { content: newContent });
        setIsSaved(true);
        onUpdate();
      } catch (error) {
        console.error("Failed to auto-save skill content:", error);
        toast.error(t("skills.unified.saveError"));
      } finally {
        setIsSaving(false);
      }
    },
    [platformAPI, onUpdate, t],
  );

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsSaved(false);

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (500ms debounce)
    if (skill) {
      saveTimeoutRef.current = setTimeout(() => {
        autoSave(skill.id, newContent);
      }, 500);
    }
  };

  // Client skill actions
  const handleEnableForClient = async (clientId: string) => {
    if (!skill) return;
    setLoadingClientId(clientId);
    try {
      await platformAPI.skills.unified.enableForClient(skill.id, clientId);
      toast.success(t("skills.unified.enabledForClient"));
      onUpdate();
    } catch (error) {
      console.error("Failed to enable skill for client:", error);
      toast.error(t("skills.unified.enableError"));
    } finally {
      setLoadingClientId(null);
    }
  };

  const handleDisableForClient = async (clientId: string) => {
    if (!skill) return;
    setLoadingClientId(clientId);
    try {
      await platformAPI.skills.unified.disableForClient(skill.id, clientId);
      toast.success(t("skills.unified.disabledForClient"));
      onUpdate();
    } catch (error) {
      console.error("Failed to disable skill for client:", error);
      toast.error(t("skills.unified.disableError"));
    } finally {
      setLoadingClientId(null);
    }
  };

  const handleRemoveFromClient = async (clientId: string) => {
    if (!skill) return;
    setLoadingClientId(clientId);
    try {
      await platformAPI.skills.unified.removeFromClient(skill.id, clientId);
      toast.success(t("skills.unified.removedFromClient"));
      onUpdate();
    } catch (error) {
      console.error("Failed to remove skill from client:", error);
      toast.error(t("skills.unified.removeError"));
    } finally {
      setLoadingClientId(null);
    }
  };

  const handleInstallToClient = async (clientId: string) => {
    if (!skill) return;
    setLoadingClientId(clientId);
    try {
      // Install is the same as enable - it creates the symlink
      await platformAPI.skills.unified.enableForClient(skill.id, clientId);
      toast.success(t("skills.unified.installedToClient"));
      onUpdate();
    } catch (error) {
      console.error("Failed to install skill to client:", error);
      toast.error(t("skills.unified.installError"));
    } finally {
      setLoadingClientId(null);
    }
  };

  // Bulk actions
  const handleSyncToAll = async () => {
    if (!skill) return;
    setIsSyncLoading(true);
    try {
      await platformAPI.skills.unified.sync(skill.id);
      toast.success(t("skills.unified.syncedToAll"));
      onUpdate();
    } catch (error) {
      console.error("Failed to sync skill to all clients:", error);
      toast.error(t("skills.unified.syncError"));
    } finally {
      setIsSyncLoading(false);
    }
  };

  const handleEnableAll = async () => {
    if (!skill) return;
    setIsActionLoading(true);
    try {
      await platformAPI.skills.unified.enableAll(skill.id);
      toast.success(t("skills.unified.enabledAll"));
      onUpdate();
    } catch (error) {
      console.error("Failed to enable skill for all clients:", error);
      toast.error(t("skills.unified.enableAllError"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisableAll = async () => {
    if (!skill) return;
    setIsActionLoading(true);
    try {
      await platformAPI.skills.unified.disableAll(skill.id);
      toast.success(t("skills.unified.disabledAll"));
      onUpdate();
    } catch (error) {
      console.error("Failed to disable skill for all clients:", error);
      toast.error(t("skills.unified.disableAllError"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteSkill = async () => {
    if (!skill) return;
    setIsActionLoading(true);
    try {
      await platformAPI.skills.delete(skill.id);
      toast.success(t("skills.unified.deleted"));
      setIsDeleteDialogOpen(false);
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Failed to delete skill:", error);
      toast.error(t("skills.unified.deleteError"));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Get status badge variant based on client skill state
  const getStatusBadge = (state: ClientSkillSummary["state"]) => {
    switch (state) {
      case "enabled":
        return (
          <Badge className="h-6 rounded-full px-3 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            {t("skills.unified.status.enabled")}
          </Badge>
        );
      case "disabled":
        return (
          <Badge
            variant="secondary"
            className="h-6 rounded-full px-3 text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-600 border-orange-500/20"
          >
            {t("skills.unified.status.disabled")}
          </Badge>
        );
      case "not-installed":
        return (
          <Badge
            variant="outline"
            className="h-6 rounded-full px-3 text-[10px] font-black uppercase tracking-widest border-border/60 text-muted-foreground"
          >
            {t("skills.unified.status.notInstalled")}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="h-6 rounded-full px-3 text-[10px]"
          >
            {state}
          </Badge>
        );
    }
  };

  // Render client icon from SVG string (sanitized to prevent XSS)
  const renderClientIcon = (iconSvg?: string) => {
    if (!iconSvg) {
      return <div className="w-6 h-6 bg-muted rounded-lg" />;
    }

    // Force currentColor and sanitize SVG content
    const themedSvg = iconSvg
      .replace(/fill="[^"]*"/g, 'fill="currentColor"')
      .replace(/stroke="[^"]*"/g, 'stroke="currentColor"');

    // Sanitize SVG content to prevent XSS and apply sizing styles
    const sanitizedSvg = sanitizeSvgWithStyles(
      themedSvg,
      "width: 100%; height: 100%; max-width: 24px; max-height: 24px;",
    );

    if (!sanitizedSvg) {
      // If sanitization fails, show fallback
      return <div className="w-6 h-6 bg-muted rounded-lg" />;
    }

    return (
      <div
        className="w-6 h-6 flex items-center justify-center text-foreground [&_path]:fill-current [&_circle]:fill-current [&_rect]:fill-current [&_ellipse]:fill-current [&_polygon]:fill-current"
        dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
      />
    );
  };

  // Render action buttons based on client state
  const renderClientActions = (clientState: ClientSkillSummary) => {
    const isLoading = loadingClientId === clientState.clientId;

    switch (clientState.state) {
      case "enabled":
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDisableForClient(clientState.clientId)}
              disabled={isLoading}
              className="rounded-full h-9 px-4 font-bold border-border/60 hover:bg-orange-500/5 hover:text-orange-600 hover:border-orange-500/20"
              aria-label={t("skills.unified.actions.disable")}
            >
              {isLoading ? (
                <IconRefresh className="w-4 h-4 animate-spin" />
              ) : (
                <IconPlayerStop className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline text-xs">
                {t("skills.unified.actions.disable")}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveFromClient(clientState.clientId)}
              disabled={isLoading}
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label={t("skills.unified.actions.remove")}
            >
              <IconTrash className="w-4 h-4" />
            </Button>
          </div>
        );
      case "disabled":
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEnableForClient(clientState.clientId)}
              disabled={isLoading}
              className="rounded-full h-9 px-4 font-bold border-border/60 hover:bg-emerald-500/5 hover:text-emerald-600 hover:border-emerald-500/20"
              aria-label={t("skills.unified.actions.enable")}
            >
              {isLoading ? (
                <IconRefresh className="w-4 h-4 animate-spin" />
              ) : (
                <IconPlayerPlay className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline text-xs">
                {t("skills.unified.actions.enable")}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveFromClient(clientState.clientId)}
              disabled={isLoading}
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label={t("skills.unified.actions.remove")}
            >
              <IconTrash className="w-4 h-4" />
            </Button>
          </div>
        );
      case "not-installed":
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInstallToClient(clientState.clientId)}
            disabled={isLoading}
            className="rounded-full h-9 px-5 font-bold border-border/60 hover:bg-primary/5 shadow-sm"
            aria-label={t("skills.unified.actions.install")}
          >
            {isLoading ? (
              <IconRefresh className="w-4 h-4 animate-spin" />
            ) : (
              <IconDownload className="w-4 h-4" />
            )}
            <span className="ml-2 text-xs">
              {t("skills.unified.actions.install")}
            </span>
          </Button>
        );
      default:
        return null;
    }
  };

  if (!skill) {
    return null;
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col h-full overflow-hidden p-0 border-l border-border/40">
          {/* Header */}
          <SheetHeader className="p-8 pb-6 bg-muted/20 backdrop-blur-md border-b border-border/40 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <IconDownload className="w-5 h-5 text-primary" />
                </div>
                <SheetTitle className="text-2xl font-black tracking-tight">
                  {skill.name}
                </SheetTitle>
              </div>
              {skill.source === "discovered" && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 font-black text-[10px] uppercase tracking-widest bg-blue-500/10 text-blue-600 border-blue-500/20"
                >
                  {t("skills.unified.discovered")}
                </Badge>
              )}
            </div>
            <SheetDescription className="mt-2 text-sm font-medium opacity-70">
              {t("skills.unified.sheetDescription")}
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* Content Editor Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="skill-content"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  {t("skills.unified.contentLabel")}
                </label>
                <div
                  className="flex items-center gap-2 text-xs font-bold"
                  aria-live="polite"
                >
                  {isLoadingContent ? (
                    <div className="flex items-center gap-1.5 text-primary">
                      <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                      <span>{t("skills.unified.loading")}</span>
                    </div>
                  ) : isSaving ? (
                    <div className="flex items-center gap-1.5 text-primary">
                      <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                      <span>{t("skills.unified.saving")}</span>
                    </div>
                  ) : isSaved ? (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <IconCheck className="w-3.5 h-3.5" />
                      <span>{t("skills.unified.saved")}</span>
                    </div>
                  ) : (
                    <span className="text-orange-500">
                      {t("skills.unified.unsaved")}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative group">
                <Textarea
                  id="skill-content"
                  value={content}
                  onChange={handleContentChange}
                  disabled={isLoadingContent}
                  className="min-h-[300px] font-mono text-sm resize-none rounded-3xl border-border/40 bg-muted/10 focus:bg-background p-6 shadow-sm transition-all"
                  placeholder={t("skills.unified.contentPlaceholder")}
                  aria-label={t("skills.unified.contentLabel")}
                />
                <div className="absolute inset-0 rounded-3xl pointer-events-none border-2 border-primary/0 group-focus-within:border-primary/10 transition-all" />
              </div>
            </div>

            {/* Client Installation Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {t("skills.unified.clientInstallations")}
              </h3>
              {skill.clientStates && skill.clientStates.length > 0 ? (
                <div className="grid gap-3">
                  {skill.clientStates.map((clientState) => (
                    <div
                      key={clientState.clientId}
                      className="flex items-center justify-between p-5 bg-card/40 rounded-2xl border border-border/40 soft-shadow hover:bg-card/60 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-muted/50 p-2.5 rounded-xl shadow-inner">
                          {renderClientIcon(clientState.clientIcon)}
                        </div>
                        <div>
                          <div className="font-bold tracking-tight">
                            {clientState.clientName}
                          </div>
                          <div className="mt-1">
                            {getStatusBadge(clientState.state)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderClientActions(clientState)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center bg-muted/10 rounded-3xl border border-dashed border-border/40">
                  <p className="text-sm font-bold text-muted-foreground">
                    {t("skills.unified.noClients")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bulk Actions Footer - Fixed at bottom */}
          <SheetFooter className="p-8 border-t border-border/40 flex-shrink-0 flex-col sm:flex-row gap-4 bg-background/80 backdrop-blur-md">
            <div className="flex flex-wrap gap-2 flex-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncToAll}
                disabled={isSyncLoading || isActionLoading}
                className="rounded-full h-10 px-5 font-bold border-border/60 hover:bg-primary/5"
              >
                <IconRefresh
                  className={cn(
                    "w-4 h-4 mr-2",
                    isSyncLoading && "animate-spin",
                  )}
                />
                {t("skills.unified.bulkActions.syncToAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnableAll}
                disabled={isActionLoading}
                className="rounded-full h-10 px-5 font-bold border-border/60 hover:bg-emerald-500/5 hover:text-emerald-600 hover:border-emerald-500/20"
              >
                <IconPlayerPlay className="w-4 h-4 mr-2" />
                {t("skills.unified.bulkActions.enableAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableAll}
                disabled={isActionLoading}
                className="rounded-full h-10 px-5 font-bold border-border/60 hover:bg-orange-500/5 hover:text-orange-600 hover:border-orange-500/20"
              >
                <IconPlayerStop className="w-4 h-4 mr-2" />
                {t("skills.unified.bulkActions.disableAll")}
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isActionLoading}
              className="rounded-full h-10 px-6 font-bold shadow-lg shadow-destructive/10"
            >
              <IconTrash className="w-4 h-4 mr-2" />
              {t("skills.unified.bulkActions.delete")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("skills.unified.deleteDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("skills.unified.deleteDialog.description", {
                name: skill.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSkill}
              disabled={isActionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isActionLoading ? (
                <>
                  <IconRefresh className="w-4 h-4 animate-spin mr-1" />
                  {t("common.deleting")}
                </>
              ) : (
                t("common.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UnifiedSkillDetailSheet;
