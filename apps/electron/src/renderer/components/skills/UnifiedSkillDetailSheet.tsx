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
          <Badge variant="default">{t("skills.unified.status.enabled")}</Badge>
        );
      case "disabled":
        return (
          <Badge variant="secondary">
            {t("skills.unified.status.disabled")}
          </Badge>
        );
      case "not-installed":
        return (
          <Badge variant="outline">
            {t("skills.unified.status.notInstalled")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  // Render client icon from SVG string (sanitized to prevent XSS)
  const renderClientIcon = (iconSvg?: string) => {
    if (!iconSvg) {
      return <div className="w-5 h-5 bg-muted rounded" />;
    }

    // Sanitize SVG content to prevent XSS and apply sizing styles
    const sanitizedSvg = sanitizeSvgWithStyles(
      iconSvg,
      "width: 100%; height: 100%; max-width: 20px; max-height: 20px;",
    );

    if (!sanitizedSvg) {
      // If sanitization fails, show fallback
      return <div className="w-5 h-5 bg-muted rounded" />;
    }

    return (
      <div
        className="w-5 h-5 flex items-center justify-center"
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
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDisableForClient(clientState.clientId)}
              disabled={isLoading}
              aria-label={t("skills.unified.actions.disable")}
            >
              {isLoading ? (
                <IconRefresh className="w-4 h-4 animate-spin" />
              ) : (
                <IconPlayerStop className="w-4 h-4" />
              )}
              <span className="ml-1 hidden sm:inline">
                {t("skills.unified.actions.disable")}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveFromClient(clientState.clientId)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
              aria-label={t("skills.unified.actions.remove")}
            >
              <IconTrash className="w-4 h-4" />
            </Button>
          </div>
        );
      case "disabled":
        return (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEnableForClient(clientState.clientId)}
              disabled={isLoading}
              aria-label={t("skills.unified.actions.enable")}
            >
              {isLoading ? (
                <IconRefresh className="w-4 h-4 animate-spin" />
              ) : (
                <IconPlayerPlay className="w-4 h-4" />
              )}
              <span className="ml-1 hidden sm:inline">
                {t("skills.unified.actions.enable")}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveFromClient(clientState.clientId)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
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
            aria-label={t("skills.unified.actions.install")}
          >
            {isLoading ? (
              <IconRefresh className="w-4 h-4 animate-spin" />
            ) : (
              <IconDownload className="w-4 h-4" />
            )}
            <span className="ml-1">{t("skills.unified.actions.install")}</span>
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
        <SheetContent className="w-full sm:max-w-xl flex flex-col h-full overflow-hidden">
          {/* Header */}
          <SheetHeader className="pb-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-xl font-bold">
                {skill.name}
              </SheetTitle>
              {skill.source === "discovered" && (
                <Badge variant="secondary">
                  {t("skills.unified.discovered")}
                </Badge>
              )}
            </div>
            <SheetDescription>
              {t("skills.unified.sheetDescription")}
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Content Editor Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="skill-content" className="text-sm font-medium">
                  {t("skills.unified.contentLabel")}
                </label>
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  {isLoadingContent ? (
                    <>
                      <IconRefresh className="w-4 h-4 animate-spin" />
                      <span>
                        {t("skills.unified.loading", {
                          defaultValue: "Loading...",
                        })}
                      </span>
                    </>
                  ) : isSaving ? (
                    <>
                      <IconRefresh className="w-4 h-4 animate-spin" />
                      <span>{t("skills.unified.saving")}</span>
                    </>
                  ) : isSaved ? (
                    <>
                      <IconCheck className="w-4 h-4 text-green-600" />
                      <span>{t("skills.unified.saved")}</span>
                    </>
                  ) : (
                    <span>{t("skills.unified.unsaved")}</span>
                  )}
                </div>
              </div>
              <Textarea
                id="skill-content"
                value={content}
                onChange={handleContentChange}
                disabled={isLoadingContent}
                className="min-h-[200px] font-mono text-sm resize-none"
                placeholder={t("skills.unified.contentPlaceholder")}
                aria-label={t("skills.unified.contentLabel")}
              />
            </div>

            {/* Client Installation Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {t("skills.unified.clientInstallations")}
              </h3>
              {skill.clientStates && skill.clientStates.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">
                          {t("skills.unified.table.client")}
                        </TableHead>
                        <TableHead className="w-[100px]">
                          {t("skills.unified.table.status")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("skills.unified.table.actions")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skill.clientStates.map((clientState) => (
                        <TableRow key={clientState.clientId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {renderClientIcon(clientState.clientIcon)}
                              <span className="font-medium">
                                {clientState.clientName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(clientState.state)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderClientActions(clientState)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  {t("skills.unified.noClients")}
                </p>
              )}
            </div>
          </div>

          {/* Bulk Actions Footer - Fixed at bottom */}
          <SheetFooter className="border-t pt-4 flex-shrink-0 flex-col sm:flex-row gap-2 bg-background">
            <div className="flex flex-wrap gap-2 flex-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncToAll}
                disabled={isSyncLoading || isActionLoading}
                aria-label={t("skills.unified.bulkActions.syncToAll")}
              >
                {isSyncLoading ? (
                  <IconRefresh className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <IconRefresh className="w-4 h-4 mr-1" />
                )}
                {t("skills.unified.bulkActions.syncToAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnableAll}
                disabled={isActionLoading}
                aria-label={t("skills.unified.bulkActions.enableAll")}
              >
                <IconPlayerPlay className="w-4 h-4 mr-1" />
                {t("skills.unified.bulkActions.enableAll")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableAll}
                disabled={isActionLoading}
                aria-label={t("skills.unified.bulkActions.disableAll")}
              >
                <IconPlayerStop className="w-4 h-4 mr-1" />
                {t("skills.unified.bulkActions.disableAll")}
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isActionLoading}
              aria-label={t("skills.unified.bulkActions.delete")}
            >
              <IconTrash className="w-4 h-4 mr-1" />
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
