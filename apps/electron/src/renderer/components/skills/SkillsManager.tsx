import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Switch,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@mcp_router/ui";
import {
  IconDownload,
  IconFolderOpen,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { usePlatformAPI } from "@/renderer/platform-api";
import type { SkillWithContent } from "@mcp_router/shared";
import { toast } from "sonner";

const SkillsManager: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [skills, setSkills] = useState<SkillWithContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected skill state
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillMdContent, setSkillMdContent] = useState("");

  // New skill dialog state
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      const skillsList = await platformAPI.skills.list();
      setSkills(skillsList);
    } catch (error) {
      console.error("Failed to load skills:", error);
      toast.error(t("skills.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [platformAPI, t]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Load content from selected skill
  useEffect(() => {
    if (selectedSkillId) {
      const skill = skills.find((s) => s.id === selectedSkillId);
      setSkillMdContent(skill?.content || "");
    }
  }, [selectedSkillId, skills]);

  // Auto-save with debounce
  const autoSave = useCallback(
    async (skillId: string, content: string) => {
      try {
        await platformAPI.skills.update(skillId, { content });
        loadSkills();
      } catch (error) {
        console.error("Failed to auto-save:", error);
      }
    },
    [platformAPI, loadSkills],
  );

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setSkillMdContent(newContent);

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (500ms debounce)
    if (selectedSkillId) {
      saveTimeoutRef.current = setTimeout(() => {
        autoSave(selectedSkillId, newContent);
      }, 500);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Filter skills by search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) {
      return skills;
    }
    const query = searchQuery.toLowerCase();
    return skills.filter((skill) => skill.name.toLowerCase().includes(query));
  }, [skills, searchQuery]);

  const handleSelectSkill = (skillId: string) => {
    setSelectedSkillId(skillId);
  };

  const handleCreateSkill = async () => {
    if (!newSkillName.trim()) {
      setDialogError(t("skills.nameRequired"));
      return;
    }

    setDialogError(null);
    try {
      const skill = await platformAPI.skills.create({
        name: newSkillName.trim(),
      });
      toast.success(t("skills.createSuccess"));
      setIsNewDialogOpen(false);
      setNewSkillName("");
      await loadSkills();
      setSelectedSkillId(skill.id);
    } catch (error: any) {
      setDialogError(error.message || t("skills.createError"));
    }
  };

  const handleCloseNewDialog = () => {
    setIsNewDialogOpen(false);
    setNewSkillName("");
    setDialogError(null);
  };

  const handleImport = async () => {
    try {
      const skill = await platformAPI.skills.import();
      toast.success(t("skills.importSuccess"));
      await loadSkills();
      setSelectedSkillId(skill.id);
    } catch (error: any) {
      // Don't show error for cancel
      if (error.message !== "No folder selected") {
        toast.error(error.message || t("skills.importError"));
      }
    }
  };

  const handleDeleteSkill = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await platformAPI.skills.delete(id);
      toast.success(t("skills.deleteSuccess"));
      if (selectedSkillId === id) {
        setSelectedSkillId(null);
        setSkillMdContent("");
      }
      loadSkills();
    } catch (error: any) {
      toast.error(error.message || t("skills.deleteError"));
    }
  };

  const handleOpenSkillsFolder = async () => {
    try {
      await platformAPI.skills.openFolder();
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const handleToggleEnabled = async (
    e: React.MouseEvent,
    skill: SkillWithContent,
  ) => {
    e.stopPropagation();
    try {
      await platformAPI.skills.update(skill.id, { enabled: !skill.enabled });
      loadSkills();
    } catch (error) {
      console.error("Failed to toggle skill:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("skills.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 ml-4">
          <Button variant="outline" onClick={handleOpenSkillsFolder}>
            <IconFolderOpen className="w-4 h-4 mr-2" />
            {t("skills.openFolder")}
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <IconDownload className="w-4 h-4 mr-2" />
            {t("skills.import")}
          </Button>
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <IconPlus className="w-4 h-4 mr-2" />
            {t("skills.new")}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Skill List */}
        <div className="w-64 border-r overflow-y-auto">
          {filteredSkills.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? t("skills.noResults") : t("skills.empty")}
            </div>
          ) : (
            <div className="py-2">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  onClick={() => handleSelectSkill(skill.id)}
                  className={`px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                    selectedSkillId === skill.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate flex-1">
                      {skill.name}
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      <Switch
                        checked={skill.enabled}
                        onClick={(e) => handleToggleEnabled(e, skill)}
                        className="scale-75"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => handleDeleteSkill(e, skill.id)}
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Skill Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedSkillId ? (
            <Textarea
              value={skillMdContent}
              onChange={handleContentChange}
              className="flex-1 font-mono text-sm resize-none border-0 rounded-none focus-visible:ring-0 p-4"
              placeholder="# Skill Name..."
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t("skills.selectToEdit")}
            </div>
          )}
        </div>
      </div>

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
            <Button onClick={handleCreateSkill}>{t("skills.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SkillsManager;
