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
import { InfoIcon } from "lucide-react";

interface HookEditDialogProps {
  hook: MCPHook | null;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SCRIPT = `// Gemini API を使用してリクエストを検証する Hook の例
// Available globals: context, console, sleep, validateToken, getServerInfo, fetch

const API_KEY = "YOUR_API_KEY_HERE"; // 実際のAPIキーに置き換えてください
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

// リクエスト情報を整形
const requestInfo = {
  type: context.requestType,
  server: context.serverName,
  tool: context.toolName,
  params: context.request.params
};

console.log('Validating request with Gemini:', requestInfo);

try {
  // Gemini APIにリクエストを送信
  const requestBody = {
    system_instruction: {
      parts: {
        text: "あなたはMCPリクエストの検証を行うセキュリティアシスタントです。" +
              "与えられたリクエスト情報を分析し、それが安全で適切かどうかを判断してください。" +
              "判断基準：データの破壊、プライバシー侵害、不正アクセスの可能性がないか。" +
              '必ず {"safe": boolean, "reason": string} の形式で応答してください。'
      }
    },
    contents: [
      {
        parts: [
          {
            text: "以下のMCPリクエストを検証してください:\\n" + 
                  JSON.stringify(requestInfo, null, 2)
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
    // APIエラー時はフォールバックロジックを使用
    return fallbackValidation();
  }

  const result = await response.json();
  const validationResult = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (validationResult) {
    try {
      const validation = JSON.parse(validationResult);
      console.log('Gemini validation result:', validation);
      
      if (!validation.safe) {
        return {
          continue: false,
          error: {
            code: 'GEMINI_BLOCKED',
            message: validation.reason
          }
        };
      }
    } catch (e) {
      console.error('Failed to parse Gemini response:', e);
      return fallbackValidation();
    }
  }
  
  // すべてのチェックをパス
  console.log('Request validated successfully');
  return { continue: true, context };
  
} catch (error) {
  console.error('Validation error:', error);
  // エラーが発生した場合はフォールバックロジックを使用
  return fallbackValidation();
}

// フォールバックの検証ロジック
function fallbackValidation() {
  // 危険なツール名のパターンをチェック
  const dangerousPatterns = [
    /delete/i,
    /remove/i,
    /drop/i,
    /truncate/i,
    /exec/i,
    /system/i
  ];
  
  const isDangerous = dangerousPatterns.some(pattern => 
    pattern.test(context.toolName || '') || 
    pattern.test(JSON.stringify(context.request.params))
  );
  
  if (isDangerous) {
    console.warn('Potentially dangerous request detected (fallback)');
    return {
      continue: false,
      error: {
        code: 'DANGEROUS_REQUEST',
        message: 'このリクエストは潜在的に危険な操作を含んでいます'
      }
    };
  }
  
  // デフォルトで許可
  return { continue: true, context };
}

// 注意事項：
// 1. APIキーは環境変数やセキュアな設定から取得すべき
// 2. fetchは3秒のタイムアウトが設定されています
// 3. HTTPSのURLのみが許可されています
// 4. cookie と authorization ヘッダーは自動的に削除されます`;

export function HookEditDialog({ hook, isOpen, onClose }: HookEditDialogProps) {
  const { createHook, updateHook } = useHookStore();

  const [name, setName] = useState(hook?.name || "");
  const [description, setDescription] = useState(hook?.description || "");
  const [hookType, setHookType] = useState<"pre" | "post" | "both">(
    hook?.hookType || "pre",
  );
  const [script, setScript] = useState(hook?.script || DEFAULT_SCRIPT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Hook name is required");
      return;
    }

    if (!script.trim()) {
      setError("Hook script is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const hookData = {
        name: name.trim(),
        description: description.trim() || undefined,
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
      setError(err instanceof Error ? err.message : "Failed to save hook");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{hook ? "Edit Hook" : "Create New Hook"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Hook"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this hook do?"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hookType">Hook Type</Label>
              <Select
                value={hookType}
                onValueChange={(v: any) => setHookType(v)}
              >
                <SelectTrigger id="hookType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre">Pre-hook (before request)</SelectItem>
                  <SelectItem value="post">
                    Post-hook (after response)
                  </SelectItem>
                  <SelectItem value="both">Both (pre and post)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Write JavaScript code that will be executed in a sandboxed
                environment. The script should return an object with `continue`
                (boolean) and optionally `context` or `error`. All filtering (by
                request type, server, tool name) should be done within the
                script.
              </AlertDescription>
            </Alert>

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
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : hook ? "Update Hook" : "Create Hook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
