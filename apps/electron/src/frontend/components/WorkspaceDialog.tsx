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

interface WorkspaceDialogProps {
  workspace?: any;
  onClose: () => void;
}

export function WorkspaceDialog({ workspace, onClose }: WorkspaceDialogProps) {
  const { createWorkspace, updateWorkspace, error, setError } =
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
      errors.name = "ワークスペース名を入力してください";
    }

    if (formData.type === "remote") {
      if (!formData.apiUrl.trim()) {
        errors.apiUrl = "API URLを入力してください";
      } else {
        try {
          new URL(formData.apiUrl);
        } catch {
          errors.apiUrl = "有効なURLを入力してください";
        }
      }

      if (!workspace && !formData.authToken.trim()) {
        errors.authToken = "認証トークンを入力してください";
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
      } else {
        await createWorkspace(config);
      }

      onClose();
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
            {workspace ? "ワークスペースを編集" : "新しいワークスペースを追加"}
          </DialogTitle>
          <DialogDescription>
            ローカルまたはリモートのワークスペースを設定します
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">ワークスペース名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例: 開発環境"
                className={validationErrors.name ? "border-destructive" : ""}
              />
              {validationErrors.name && (
                <p className="text-sm text-destructive">
                  {validationErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>タイプ</Label>
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
                    ローカル（個人用）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="remote" id="remote" />
                  <Label
                    htmlFor="remote"
                    className="flex items-center cursor-pointer"
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    リモート（チーム用）
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
                    認証トークン {workspace && "(変更する場合のみ入力)"}
                  </Label>
                  <Input
                    id="authToken"
                    type="password"
                    value={formData.authToken}
                    onChange={(e) =>
                      setFormData({ ...formData, authToken: e.target.value })
                    }
                    placeholder={
                      workspace ? "変更しない場合は空欄" : "APIトークンを入力"
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
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "処理中..." : workspace ? "更新" : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
