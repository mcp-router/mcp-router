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
  RadioGroup,
  RadioGroupItem,
} from "@mcp_router/ui";
import { useWorkspaceStore } from "@/renderer/stores/workspace-store";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WorkspaceDialogProps {
  workspace?: {
    id: string;
    name: string;
    type: "local" | "remote";
    remoteConfig?: {
      apiUrl?: string;
    };
  };
  onClose: () => void;
}

export function WorkspaceDialog({ workspace, onClose }: WorkspaceDialogProps) {
  const { t } = useTranslation();
  const { createWorkspace, updateWorkspace, switchWorkspace, error, setError } =
    useWorkspaceStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: workspace?.name || "",
    type: workspace?.type || ("local" as "local" | "remote"),
    apiUrl: workspace?.remoteConfig?.apiUrl || "",
  });

  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    apiUrl?: string;
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

    if (formData.type === "remote") {
      if (!formData.apiUrl.trim()) {
        errors.apiUrl = "API URL is required for remote workspaces";
      } else if (!formData.apiUrl.match(/^https?:\/\/.+/)) {
        errors.apiUrl = "Please enter a valid URL";
      }
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
      const config: {
        name: string;
        type: "local" | "remote";
        remoteConfig?: {
          apiUrl: string;
        };
      } = {
        name: formData.name,
        type: formData.type,
      };

      if (formData.type === "remote") {
        config.remoteConfig = {
          apiUrl: formData.apiUrl,
        };
      }

      if (workspace) {
        await updateWorkspace(workspace.id, config);
        onClose();
      } else {
        const newWorkspace = await createWorkspace(config);
        onClose();
        // Switch to the newly created workspace
        await switchWorkspace(newWorkspace.id);
      }
    } catch {
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
          <DialogDescription>
            {workspace
              ? "Update workspace configuration"
              : "Create a new workspace for organizing your MCP servers"}
          </DialogDescription>
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

            {!workspace && (
              <div className="space-y-2">
                <Label>Workspace Type</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value: "local" | "remote") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="local" id="local" />
                    <Label htmlFor="local" className="font-normal">
                      Local workspace
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="remote" id="remote" />
                    <Label htmlFor="remote" className="font-normal">
                      Remote workspace (Connect to team API)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {formData.type === "remote" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="apiUrl">API URL</Label>
                  <Input
                    id="apiUrl"
                    type="url"
                    value={formData.apiUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, apiUrl: e.target.value })
                    }
                    placeholder="https://api.example.com"
                    className={
                      validationErrors.apiUrl ? "border-destructive" : ""
                    }
                  />
                  {validationErrors.apiUrl && (
                    <p className="text-sm text-destructive">
                      {validationErrors.apiUrl}
                    </p>
                  )}
                </div>
              </>
            )}

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
