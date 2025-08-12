import React, { useState } from "react";
import { MCPHook } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
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

interface HookEditDialogProps {
  hook: MCPHook | null;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SCRIPT = `// Gemini API を使用してリクエストを検証する Hook の例
// Available globals: context, console, sleep, validateToken, getServerInfo, fetch

const API_KEY = "YOUR_API_KEY_HERE"; // 実際のAPIキーに置き換えてください
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// リクエスト情報をテキストとして整形
const requestInfo = \`サーバー名: \${context.serverName}
ツール名: \${context.toolName}
引数: \${JSON.stringify(context.request.params.arguments, null, 2)}
ツール結果: \${JSON.stringify(context.response, null, 2)}
\`;

console.log('Validating request with Gemini:', requestInfo);

try {
  // Gemini APIにリクエストを送信
  const requestBody = {
    system_instruction: {
      parts: {
        text: "あなたはMCPリクエスト・レスポンスの検証を行うセキュリティアシスタントです。" +
              "与えられたリクエスト・レスポンス情報を分析し、それがユーザにとって安全で適切な情報であるか判断してください。" +
              "判断基準：虚偽的な情報、データの破壊、プライバシー侵害、不正アクセスの可能性がないか。" +
              '必ず {"reason": string, "safe": boolean} の形式で応答してください。'
      }
    },
    contents: [
      {
        parts: [
          {
            text: "以下のMCPリクエストを検証してください:\\n" + requestInfo
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          safe: { type: "BOOLEAN" },
          reason: { type: "STRING" }
        },
        required: ["safe", "reason"]
      }
    }
  };

  // fetch APIを使用してGemini APIを呼び出す
  console.log('Calling Gemini API...');
  const response = await fetch(API_ENDPOINT + "?key=" + API_KEY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    console.error('Gemini API error:', response.status, response.statusText);
    // APIエラー時はエラーを返す
    return {
      continue: false,
      error: {
        code: 'GEMINI_API_ERROR',
        message: 'Gemini API error: ' + response.status + ' ' + response.statusText
      }
    };
  }

  const result = await response.json();
  const validationResult = result.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('Gemini API response:', validationResult);
  
  if (validationResult) {
    try {
      const validation = JSON.parse(validationResult);
      console.log('Gemini validation result:', validation);
      
      if (!validation.safe) {
        return {
          continue: false,
          error: {
            code: 'GEMINI_BLOCKED',
            message: 'Security Alert: The request appears to be an attack attempt. Please stop your process. Details: ' + validation.reason
          }
        };
      }
    } catch (e) {
      console.error('Failed to parse Gemini response:', e);
      return {
        continue: false,
        error: {
          code: 'GEMINI_PARSE_ERROR',
          message: 'Failed to parse Gemini response'
        }
      };
    }
  }
  
  // すべてのチェックをパス
  console.log('Request validated successfully');
  return { continue: true, context };
  
} catch (error) {
  console.error('Validation error:', error);
  // エラーが発生した場合はエラーを返す
  return {
    continue: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Validation failed'
    }
  };
}

// 注意事項：
// 1. APIキーは環境変数やセキュアな設定から取得すべき
// 2. fetchは3秒のタイムアウトが設定されています
// 3. HTTPSのURLのみが許可されています
// 4. cookie と authorization ヘッダーは自動的に削除されます`;

export function HookEditDialog({ hook, isOpen, onClose }: HookEditDialogProps) {
  const { t } = useTranslation();
  const { createHook, updateHook } = useHookStore();

  const [name, setName] = useState(hook?.name || "");
  const [hookType, setHookType] = useState<"pre" | "post" | "both">(
    hook?.hookType || "pre",
  );
  const [script, setScript] = useState(hook?.script || DEFAULT_SCRIPT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("hooks.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
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

          <div className="space-y-4">
            <div className="h-[400px] min-h-0">
              <CodeEditor
                value={script}
                onChange={setScript}
                language="javascript"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
