import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Alert,
  AlertDescription,
} from "@mcp-router/ui";
import { useWorkspaceStore } from "@/frontend/stores/workspace-store";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WorkspaceDialogProps {
  workspace?: any;
  onClose: () => void;
}

export function WorkspaceDialog({ workspace, onClose }: WorkspaceDialogProps) {
  const { t } = useTranslation();
  const { createWorkspace, updateWorkspace, switchWorkspace, error, setError } =
    useWorkspaceStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: workspace?.name || "",
  });

  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
  }>({});

  useEffect(() => {
    // エラーをクリア
    setError(null);
  }, [setError]);

  const validateForm = () => {
    const errors: typeof validationErrors = {};

    if (!formData.name.trim()) {
      errors.name = "Workspace name is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const config = {
        name: formData.name,
        type: "local" as const,
      };

      if (workspace) {
        await updateWorkspace(workspace.id, config);
        onClose();
      } else {
        const newWorkspace = await createWorkspace(config);
        onClose();
        // Switch to the newly created workspace
        await switchWorkspace(newWorkspace.id);
      }
    } catch (err) {
      // エラーは store で設定される
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {workspace
              ? t("workspace.editWorkspace")
              : t("workspace.createWorkspace")}
          </DialogTitle>
          <DialogDescription>Configure your local workspace</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("workspace.workspaceName")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. Development"
                className={validationErrors.name ? "border-destructive" : ""}
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">
                  {validationErrors.name}
                </p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t("common.saving")
                : workspace
                  ? t("common.update")
                  : t("common.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
