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
  RadioGroup,
  RadioGroupItem,
  Alert,
  AlertDescription,
} from "@mcp-router/ui";
import { useWorkspaceStore } from "@/frontend/stores/workspace-store";
import { Globe, Monitor, AlertCircle } from "lucide-react";
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
    type: workspace?.type || "local",
    apiUrl: workspace?.remoteConfig?.apiUrl || "",
    authToken: "",
  });

  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    apiUrl?: string;
    authToken?: string;
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
        errors.apiUrl = "API URL is required";
      } else {
        try {
          new URL(formData.apiUrl);
        } catch {
          errors.apiUrl = "Please enter a valid URL";
        }
      }

      if (!workspace && !formData.authToken.trim()) {
        errors.authToken = "Authentication token is required";
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
      const config = {
        name: formData.name,
        type: formData.type as "local" | "remote",
        remoteConfig:
          formData.type === "remote"
            ? {
                apiUrl: formData.apiUrl,
                authToken: formData.authToken || undefined,
              }
            : undefined,
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
            {workspace ? t("workspace.editWorkspace") : t("workspace.createWorkspace")}
          </DialogTitle>
          <DialogDescription>
            Configure local or remote workspace
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

            <div className="space-y-3">
              <Label>{t("workspace.workspaceType")}</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
                disabled={!!workspace}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="local" id="local" />
                  <Label
                    htmlFor="local"
                    className="flex items-center cursor-pointer"
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    {t("workspace.local")} (Personal)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="remote" id="remote" />
                  <Label
                    htmlFor="remote"
                    className="flex items-center cursor-pointer"
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    {t("workspace.remote")} (Team)
                  </Label>
                </div>
              </RadioGroup>
            </div>

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

                <div className="space-y-2">
                  <Label htmlFor="authToken">
                    Authentication Token {workspace && "(Only enter to change)"}
                  </Label>
                  <Input
                    id="authToken"
                    type="password"
                    value={formData.authToken}
                    onChange={(e) =>
                      setFormData({ ...formData, authToken: e.target.value })
                    }
                    placeholder={
                      workspace ? "Leave blank to keep current" : "Enter API token"
                    }
                    className={
                      validationErrors.authToken ? "border-destructive" : ""
                    }
                  />
                  {validationErrors.authToken && (
                    <p className="text-sm text-destructive">
                      {validationErrors.authToken}
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
              {isSubmitting ? t("common.saving") : workspace ? t("common.update") : t("common.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
