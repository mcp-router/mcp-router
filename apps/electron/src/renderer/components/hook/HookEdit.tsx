import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MCPHook } from "@mcp_router/shared";
import { Button } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { useHookStore } from "@/renderer/stores";
import { CodeEditor } from "@/renderer/components/common/CodeEditor";
import { Alert, AlertDescription } from "@mcp_router/ui";
import { useTranslation } from "react-i18next";
import PageLayout from "@/renderer/components/layout/PageLayout";
import { ArrowLeft } from "lucide-react";

const DEFAULT_SCRIPT = `

// See https://mcp-router.net/docs/mcp-management/hooks for documentation on writing hooks
`;

export default function HookEdit() {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { hooks, createHook, updateHook, fetchHooks } = useHookStore();

  const [hook, setHook] = useState<MCPHook | null>(null);
  const [name, setName] = useState("");
  const [hookType, setHookType] = useState<"pre" | "post" | "both">("pre");
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      // Editing existing hook
      const existingHook = hooks.find((h) => h.id === id);
      if (existingHook) {
        setHook(existingHook);
        setName(existingHook.name);
        setHookType(existingHook.hookType);
        setScript(existingHook.script);
      } else {
        // Fetch hooks if not loaded
        fetchHooks().then(() => {
          const fetchedHook = hooks.find((h) => h.id === id);
          if (fetchedHook) {
            setHook(fetchedHook);
            setName(fetchedHook.name);
            setHookType(fetchedHook.hookType);
            setScript(fetchedHook.script);
          }
        });
      }
    }
  }, [id, hooks, fetchHooks]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("hooks.nameRequired"));
      return;
    }

    if (!script.trim()) {
      setError(t("hooks.scriptRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const hookData = {
        name: name.trim(),
        enabled: hook?.enabled ?? true,
        executionOrder: hook?.executionOrder ?? 0,
        hookType,
        script,
      };

      if (hook) {
        await updateHook(hook.id, hookData);
      } else {
        await createHook(hookData);
      }

      navigate("/hooks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/hooks")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">{t("hooks.name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Hook"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hookType">{t("hooks.type")}</Label>
              <Select
                value={hookType}
                onValueChange={(v: any) => setHookType(v)}
              >
                <SelectTrigger id="hookType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre">{t("hooks.pre")}</SelectItem>
                  <SelectItem value="post">{t("hooks.post")}</SelectItem>
                  <SelectItem value="both">{t("hooks.both")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("hooks.script")}</Label>
            <div className="border rounded-md overflow-auto">
              <CodeEditor
                value={script}
                onChange={setScript}
                language="javascript"
              />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
