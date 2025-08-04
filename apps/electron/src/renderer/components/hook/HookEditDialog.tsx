import React, { useState, useEffect } from "react";
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
import { useHookStore } from "@/renderer/stores/hook-store";
import { CodeEditor } from "@/renderer/components/common/CodeEditor";
import { Alert, AlertDescription } from "@mcp_router/ui";
import { InfoIcon } from "lucide-react";

interface HookEditDialogProps {
  hook: MCPHook | null;
  isOpen: boolean;
  onClose: () => void;
}


const DEFAULT_SCRIPT = `// Hook script example
// Available globals: context, console, sleep, validateToken, getServerInfo

// Apply filtering based on your conditions
if (context.requestType === 'CallTool') {
  // Filter by tool name
  if (context.toolName === 'specific-tool') {
    console.log('Specific tool called:', context.toolName);
  }
}

// Filter by server
if (context.serverName === 'specific-server') {
  console.log('Request to specific server');
}

// Modify request parameters
// context.request.params.someParam = 'modified value';

// For post-hooks, you can access the response
if (context.response) {
  console.log('Response received in', context.duration, 'ms');
}

// Continue with the request
return { continue: true, context };

// To block the request:
// return { 
//   continue: false, 
//   error: { 
//     code: 'BLOCKED', 
//     message: 'Request blocked by hook' 
//   } 
// };`;

export function HookEditDialog({ hook, isOpen, onClose }: HookEditDialogProps) {
  const { createHook, updateHook } = useHookStore();
  
  const [name, setName] = useState(hook?.name || "");
  const [description, setDescription] = useState(hook?.description || "");
  const [hookType, setHookType] = useState<"pre" | "post" | "both">(
    hook?.hookType || "pre"
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {hook ? "Edit Hook" : "Create New Hook"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
              <Select value={hookType} onValueChange={(v: any) => setHookType(v)}>
                <SelectTrigger id="hookType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre">Pre-hook (before request)</SelectItem>
                  <SelectItem value="post">Post-hook (after response)</SelectItem>
                  <SelectItem value="both">Both (pre and post)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Write JavaScript code that will be executed in a sandboxed environment.
                The script should return an object with `continue` (boolean) and optionally `context` or `error`.
                All filtering (by request type, server, tool name) should be done within the script.
              </AlertDescription>
            </Alert>
            
            <div className="h-96">
              <CodeEditor
                value={script}
                onChange={setScript}
                language="javascript"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
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