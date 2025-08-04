import React, { useState } from "react";
import { MCPHook, HookContext, HookResult } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { CodeEditor } from "@/renderer/components/common/CodeEditor";
import { useHookStore } from "@/renderer/stores/hook-store";
import { Alert, AlertDescription } from "@mcp_router/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mcp_router/ui";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface HookTestDialogProps {
  hook: MCPHook;
  isOpen: boolean;
  onClose: () => void;
}

const REQUEST_TYPES = [
  "CallTool",
  "ListTools",
  "ReadResource",
  "ListResources",
  "GetPrompt",
  "ListPrompts",
] as const;

const DEFAULT_CONTEXT = {
  requestType: "CallTool" as const,
  serverName: "test-server",
  serverId: "test-server-id",
  clientId: "test-client",
  token: "test-token",
  request: {
    method: "tools/call",
    params: {
      name: "test-tool",
      arguments: {
        input: "test input",
      },
    },
  },
  metadata: {},
  startTime: Date.now(),
};

export function HookTestDialog({ hook, isOpen, onClose }: HookTestDialogProps) {
  const { testHook, testResult, testing, clearTestResult } = useHookStore();
  
  const [requestType, setRequestType] = useState<typeof REQUEST_TYPES[number]>("CallTool");
  const [serverName, setServerName] = useState("test-server");
  const [serverId, setServerId] = useState("test-server-id");
  const [clientId, setClientId] = useState("test-client");
  const [token, setToken] = useState("test-token");
  const [requestParams, setRequestParams] = useState(
    JSON.stringify(DEFAULT_CONTEXT.request.params, null, 2)
  );
  const [response, setResponse] = useState(
    JSON.stringify({ content: "Test response" }, null, 2)
  );
  const [metadata, setMetadata] = useState("{}");
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setError(null);
    
    try {
      const parsedParams = JSON.parse(requestParams);
      const parsedMetadata = JSON.parse(metadata);
      const parsedResponse = hook.hookType !== "pre" ? JSON.parse(response) : undefined;
      
      const context: HookContext = {
        requestType,
        serverName,
        serverId,
        clientId,
        token,
        request: {
          method: getMethodForRequestType(requestType),
          params: parsedParams,
        },
        metadata: parsedMetadata,
        startTime: Date.now(),
        ...(hook.hookType !== "pre" && {
          response: parsedResponse,
          duration: 100, // Mock duration
        }),
      };
      
      await testHook(hook.id, context);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON in request params, response, or metadata");
      } else {
        setError(err instanceof Error ? err.message : "Failed to test hook");
      }
    }
  };

  const getMethodForRequestType = (type: string): string => {
    switch (type) {
      case "CallTool":
        return "tools/call";
      case "ListTools":
        return "tools/list";
      case "ReadResource":
        return "resources/read";
      case "ListResources":
        return "resources/list";
      case "GetPrompt":
        return "prompts/get";
      case "ListPrompts":
        return "prompts/list";
      default:
        return "unknown";
    }
  };

  const getResultIcon = () => {
    if (!testResult) return null;
    
    if (testResult.continue) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const handleClose = () => {
    clearTestResult();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Hook: {hook.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="context" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="context">Test Context</TabsTrigger>
              <TabsTrigger value="result">Test Result</TabsTrigger>
            </TabsList>

            <TabsContent value="context" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requestType">Request Type</Label>
                  <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                    <SelectTrigger id="requestType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serverName">Server Name</Label>
                  <Input
                    id="serverName"
                    value={serverName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serverId">Server ID</Label>
                  <Input
                    id="serverId"
                    value={serverId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={clientId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token">Token (optional)</Label>
                  <Input
                    id="token"
                    value={token}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Request Parameters (JSON)</Label>
                <div className="h-32">
                  <CodeEditor
                    value={requestParams}
                    onChange={setRequestParams}
                    language="json"
                  />
                </div>
              </div>

              {hook.hookType !== "pre" && (
                <div className="space-y-2">
                  <Label>Response (JSON - for post-hooks)</Label>
                  <div className="h-32">
                    <CodeEditor
                      value={response}
                      onChange={setResponse}
                      language="json"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Metadata (JSON)</Label>
                <div className="h-24">
                  <CodeEditor
                    value={metadata}
                    onChange={setMetadata}
                    language="json"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="result" className="space-y-4">
              {testing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : testResult ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {getResultIcon()}
                    <span className="font-medium">
                      {testResult.continue ? "Hook continued execution" : "Hook blocked execution"}
                    </span>
                  </div>

                  {testResult.error && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <strong>Error Code:</strong> {testResult.error.code}
                        <br />
                        <strong>Message:</strong> {testResult.error.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {testResult.context && (
                    <div className="space-y-2">
                      <Label>Modified Context</Label>
                      <div className="h-64">
                        <CodeEditor
                          value={JSON.stringify(testResult.context, null, 2)}
                          onChange={() => {}}
                          language="json"
                          readOnly
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Click "Run Test" to test the hook with the configured context.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handleTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Run Test"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}