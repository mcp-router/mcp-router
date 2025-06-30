import React, { FC, FormEvent, useState, useMemo, useCallback } from "react";
import { Message } from "ai";
import { useTranslation } from "react-i18next";
import { Textarea } from "@mcp-router/ui";
import { Button } from "@mcp-router/ui";
import {
  Send,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Square,
} from "lucide-react";
import { Alert, AlertDescription } from "@mcp-router/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@mcp-router/ui";
import { AgentConfig, MCPServerConfig } from "@mcp-router/shared";
import { extractServerVariables } from "@/lib/utils/server-variable-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@mcp-router/ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@mcp-router/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

// Helper functions
const formatImageData = (data: string, mimeType?: string) =>
  data.startsWith("data:")
    ? data
    : `data:${mimeType || "image/png"};base64,${data}`;

const renderImage = (
  data: string,
  alt?: string,
  mimeType?: string,
  index?: number,
) => (
  <div className="space-y-2">
    <img
      src={formatImageData(data, mimeType)}
      alt={
        alt || `Tool result image${index !== undefined ? ` ${index + 1}` : ""}`
      }
      className="max-w-full h-auto rounded border"
      style={{ maxHeight: "400px" }}
    />
    {alt && <div className="text-xs text-muted-foreground">{alt}</div>}
  </div>
);

const renderResultContent = (result: any) => {
  if (Array.isArray(result?.content)) {
    return (
      <div className="space-y-2">
        {result.content.map((item: any, index: number) => {
          if (item.type === "image") {
            return (
              <div key={index}>
                {renderImage(item.data, item.alt, item.mimeType, index)}
              </div>
            );
          }
          if (item.type === "text") {
            return (
              <pre
                key={index}
                className="whitespace-pre-wrap break-words text-sm"
              >
                {item.text}
              </pre>
            );
          }
          return (
            <pre
              key={index}
              className="whitespace-pre-wrap break-words text-sm"
            >
              {JSON.stringify(item, null, 2)}
            </pre>
          );
        })}
      </div>
    );
  }

  if (result?.type === "image") {
    return renderImage(result.data, result.alt, result.mimeType);
  }

  return (
    <pre className="whitespace-pre-wrap break-words text-sm">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
};

// Tool Result Collapsible Component
interface ToolResultCollapsibleProps {
  toolName: string;
  toolCallId: string;
  messageId: string;
  args: any;
  result: any;
  isError: boolean;
  isOpen: boolean;
  onToggle: (toolCallId: string) => void;
}

const ToolResultCollapsible: FC<ToolResultCollapsibleProps> = React.memo(
  ({
    toolName,
    toolCallId,
    messageId,
    args,
    result,
    isError,
    isOpen,
    onToggle,
  }) => {
    const { t } = useTranslation();

    const handleToggle = useCallback(() => {
      onToggle(toolCallId);
    }, [onToggle, toolCallId]);

    return (
      <Collapsible
        key={`${messageId}-tool-result-${toolCallId}`}
        className="w-full"
        open={isOpen}
        onOpenChange={handleToggle}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer">
            <div
              className={`text-sm flex items-center ${isError ? "text-red-600 font-medium" : "text-muted-foreground"}`}
            >
              {isError && <AlertCircle className="h-4 w-4 mr-1" />}
              {isError
                ? t("agents.chat.toolExecutionFailed", { toolName })
                : t("agents.chat.toolResult", { toolName })}
            </div>
            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle</span>
            </Button>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 mt-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("agents.chat.query")}
              </div>
              <div className="bg-muted p-3 rounded-md">
                <pre className="whitespace-pre-wrap break-words text-sm">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            </div>
            <div>
              <div
                className={`text-xs mb-1 ${isError ? "text-red-600" : "text-muted-foreground"}`}
              >
                {isError ? t("agents.chat.error") : t("agents.chat.result")}
              </div>
              <div
                className={`p-3 rounded-md ${isError ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" : "bg-muted"}`}
              >
                {isError ? (
                  <pre className="whitespace-pre-wrap break-words text-sm text-red-600">
                    {result.error || t("agents.chat.errorOccurred")}
                  </pre>
                ) : (
                  renderResultContent(result)
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  },
);

ToolResultCollapsible.displayName = "ToolResultCollapsible";

// Individual Message Components - React.memoで最適化
const UserMessage: FC<{ message: Message }> = React.memo(({ message }) => (
  <div className="p-4 rounded-lg max-w-[80%] ml-auto bg-blue-500 text-white">
    <div className="whitespace-pre-wrap break-words">
      {typeof message.content === "string"
        ? message.content
        : message.parts?.map((part, idx) =>
            part.type === "text" ? <span key={idx}>{part.text}</span> : null,
          ) || null}
    </div>
  </div>
));

UserMessage.displayName = "UserMessage";

const ToolConfirmationCard: FC<{
  message: Message;
  toolInvocation: any;
  callId: string;
  toolName: string;
  onToolConfirmation: (
    toolCallId: string,
    toolName: string,
    args: any,
    confirmed: boolean,
  ) => void;
}> = React.memo(
  ({ message, toolInvocation, callId, toolName, onToolConfirmation }) => {
    const { t } = useTranslation();

    const handleApprove = useCallback(() => {
      onToolConfirmation(callId, toolName, toolInvocation.args, true);
    }, [onToolConfirmation, callId, toolName, toolInvocation.args]);

    const handleDeny = useCallback(() => {
      onToolConfirmation(callId, toolName, toolInvocation.args, false);
    }, [onToolConfirmation, callId, toolName, toolInvocation.args]);

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("agents.chat.toolExecutionRequest")}</CardTitle>
          <CardDescription>
            {t("agents.chat.executeToolConfirm", { toolName })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded-md">
            <pre className="whitespace-pre-wrap break-words text-sm">
              {JSON.stringify(toolInvocation.args, null, 2)}
            </pre>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleDeny}>
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.deny")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="default" size="sm" onClick={handleApprove}>
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.approve")}</TooltipContent>
          </Tooltip>
        </CardFooter>
      </Card>
    );
  },
);

ToolConfirmationCard.displayName = "ToolConfirmationCard";

// ReactMarkdownコンポーネントの設定を外部に定義
const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-xl font-bold mb-2 text-foreground">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-lg font-semibold mb-2 text-foreground">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-md font-medium mb-1 text-foreground">{children}</h3>
  ),
  p: ({ children }: any) => (
    <p className="mb-2 text-foreground leading-relaxed">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
  ),
  li: ({ children }: any) => <li className="text-foreground">{children}</li>,
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: any) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  code: ({ children, className }: any) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono text-foreground">
        {children}
      </code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }: any) => (
    <pre className="bg-muted border border-border p-3 rounded-lg overflow-x-auto text-sm text-foreground">
      {children}
    </pre>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mb-2">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <table className="border-collapse border border-border mb-2">
      {children}
    </table>
  ),
  th: ({ children }: any) => (
    <th className="border border-border px-2 py-1 bg-muted font-semibold text-left text-foreground">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="border border-border px-2 py-1 text-foreground">
      {children}
    </td>
  ),
  a: ({ children, href }: any) => (
    <a
      href={href}
      className="text-primary hover:text-primary/80 underline cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        window.open(href, "_blank");
      }}
    >
      {children}
    </a>
  ),
};

const AssistantMessage: FC<{
  message: Message;
  agent: AgentConfig;
  openToolResults: Record<string, boolean>;
  onToggleToolResult: (toolCallId: string) => void;
  onToolConfirmation?: (
    toolCallId: string,
    toolName: string,
    args: any,
    confirmed: boolean,
  ) => void;
}> = React.memo(
  ({
    message,
    agent,
    openToolResults,
    onToggleToolResult,
    onToolConfirmation,
  }) => {
    if (!message.parts?.length) return null;

    return (
      <div className="space-y-3">
        {message.parts.map((part, idx) => {
          if (part.type === "text") {
            return (
              <div
                key={`${message.id}-part-${idx}`}
                className="w-full prose prose-sm max-w-none break-words"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={markdownComponents}
                >
                  {part.text}
                </ReactMarkdown>
              </div>
            );
          }

          if (part.type === "tool-invocation") {
            const { toolInvocation } = part;
            const { toolName, toolCallId: callId, state } = toolInvocation;

            if (
              state === "call" &&
              onToolConfirmation &&
              !agent.autoExecuteTool
            ) {
              return (
                <ToolConfirmationCard
                  key={`${message.id}-tool-${callId}`}
                  message={message}
                  toolInvocation={toolInvocation}
                  callId={callId}
                  toolName={toolName}
                  onToolConfirmation={onToolConfirmation}
                />
              );
            }

            if (state === "result") {
              const isError =
                toolInvocation.result &&
                typeof toolInvocation.result === "object" &&
                "error" in toolInvocation.result;
              return (
                <ToolResultCollapsible
                  key={`${message.id}-tool-${callId}`}
                  toolName={toolName}
                  toolCallId={callId}
                  messageId={message.id}
                  args={toolInvocation.args}
                  result={toolInvocation.result}
                  isError={isError}
                  isOpen={openToolResults[callId] || false}
                  onToggle={onToggleToolResult}
                />
              );
            }
          }

          return null;
        })}
      </div>
    );
  },
);

AssistantMessage.displayName = "AssistantMessage";

// Message Display Component - 最適化版
interface MessageDisplayProps {
  agent: AgentConfig;
  messages: Message[];
  servers: MCPServerConfig[];
  enabledTools: { name: string; description?: string; inputSchema?: any }[];
  onToolConfirmation?: (
    toolCallId: string,
    toolName: string,
    args: any,
    confirmed: boolean,
  ) => void;
}

const MessageDisplay: FC<MessageDisplayProps> = React.memo(
  ({ agent, messages, servers, enabledTools, onToolConfirmation }) => {
    const { t } = useTranslation();
    const [openToolResults, setOpenToolResults] = useState<
      Record<string, boolean>
    >({});

    // メモ化された計算値
    const chatHasStarted = useMemo(
      () => messages.some((message) => message.role === "user"),
      [messages],
    );

    const hasServerVariables = useMemo(
      () => servers.some((server) => extractServerVariables(server).length > 0),
      [servers],
    );

    const toggleToolResult = useCallback((toolCallId: string) => {
      setOpenToolResults((prev) => ({
        ...prev,
        [toolCallId]: !prev[toolCallId],
      }));
    }, []);

    const renderMessage = useCallback(
      (message: Message) => {
        if (message.role === "user") {
          return <UserMessage key={message.id} message={message} />;
        }
        if (message.role === "assistant") {
          return (
            <AssistantMessage
              key={message.id}
              message={message}
              agent={agent}
              openToolResults={openToolResults}
              onToggleToolResult={toggleToolResult}
              onToolConfirmation={onToolConfirmation}
            />
          );
        }
        return null;
      },
      [agent, openToolResults, toggleToolResult, onToolConfirmation],
    );

    return (
      <div className="overflow-y-auto absolute inset-0">
        {!chatHasStarted && (
          <div className="p-6">
            {enabledTools.length > 0 && (
              <div className="border-b mb-4 pb-4">
                <Collapsible className="w-full">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer">
                      <h3 className="font-medium">
                        {t("agents.chat.availableTools")} ({enabledTools.length}
                        )
                      </h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-6 w-6"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("agents.chat.showTools")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-3">
                      {enabledTools.map((tool, index) => (
                        <div key={index} className="p-3 bg-muted rounded-md">
                          <div className="font-medium">{tool.name}</div>
                          {tool.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {tool.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        )}

        <div className="p-6 space-y-4">{messages.map(renderMessage)}</div>
      </div>
    );
  },
);

MessageDisplay.displayName = "MessageDisplay";

// Message Input Component - 最適化版
interface MessageInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  isLoading: boolean;
  stop: () => void;
}

const MessageInput: FC<MessageInputProps> = React.memo(
  ({
    input,
    handleInputChange,
    handleSubmit,
    placeholder,
    isLoading,
    stop,
  }: MessageInputProps) => {
    const { t } = useTranslation();

    const submitHandler = useCallback(
      (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isLoading && input.trim()) {
          handleSubmit(e);
        }
      },
      [handleSubmit, isLoading, input],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!isLoading && input.trim()) {
            const syntheticEvent = {
              preventDefault: () => {
                /* synthetic event */
              },
              currentTarget: e.currentTarget.form,
            } as FormEvent<HTMLFormElement>;
            handleSubmit(syntheticEvent);
          }
        }
      },
      [handleSubmit, isLoading, input],
    );

    const handleStopClick = useCallback(() => {
      stop();
    }, [stop]);

    return (
      <div className="p-4 border-t bg-background">
        <form onSubmit={submitHandler} className="flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 min-h-10 max-h-40 resize-none overflow-y-auto"
            rows={1}
          />
          {isLoading ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  onClick={handleStopClick}
                  variant="destructive"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.stop")}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.send")}</TooltipContent>
            </Tooltip>
          )}
        </form>
      </div>
    );
  },
);

MessageInput.displayName = "MessageInput";
// メインのChatInterfaceコンポーネント - 最適化版
interface ChatInterfaceProps {
  agent: AgentConfig;
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  placeholder?: string;
  servers?: MCPServerConfig[];
  enabledTools?: { name: string; description?: string; inputSchema?: any }[];
  onToolConfirmation?: (
    toolCallId: string,
    toolName: string,
    args: any,
    confirmed: boolean,
  ) => void;
  stop: () => void;
  isLoading?: boolean;
  isCallingTool?: boolean;
  error?: Error;
}

const ChatInterface: FC<ChatInterfaceProps> = React.memo(
  ({
    agent,
    messages,
    input,
    handleInputChange,
    handleSubmit,
    placeholder,
    servers = [],
    enabledTools = [],
    onToolConfirmation,
    stop,
    isLoading = false,
    isCallingTool = false,
    error,
  }) => {
    const { t } = useTranslation();

    const effectivePlaceholder = useMemo(
      () => placeholder || t("agents.chat.enterMessage"),
      [placeholder, t],
    );

    // Generate a stable tool message that doesn't change during the tool call
    const toolMessage = useMemo(() => {
      const messages = [
        "🔧 Calling tool...",
        "🛠️ Tool time!",
        "⚙️ Cranking the gears...",
        "🔩 Mechanical magic in progress...",
        "🎯 Hitting the tool shed...",
        "🚀 Tool deployment sequence initiated...",
        "⚡ Tool power activated!",
        "🎪 Tool circus in action...",
        "🎸 Playing the tool solo...",
        "🍕 Serving up some tool goodness...",
        "🐈 Running the tool catwalk...",
      ];
      const randomIndex = Math.floor(Math.random() * messages.length);
      return messages[randomIndex];
    }, [isCallingTool]);

    return (
      <TooltipProvider>
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-hidden relative">
            <MessageDisplay
              agent={agent}
              messages={messages}
              servers={servers}
              enabledTools={enabledTools}
              onToolConfirmation={onToolConfirmation}
            />
            {isCallingTool && (
              <div className="absolute bottom-4 right-4 bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md border shadow-sm">
                {toolMessage}
              </div>
            )}
            {error && (
              <div className="absolute bottom-4 left-4 right-4">
                <Alert variant="destructive">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <AlertDescription>
                        {error.message || "An error occurred"}
                      </AlertDescription>
                      {(error as any).isPaymentError &&
                        (error as any).purchaseUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => {
                              window.open((error as any).purchaseUrl, "_blank");
                            }}
                          >
                            Purchase Credits
                          </Button>
                        )}
                    </div>
                  </div>
                </Alert>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <MessageInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              placeholder={effectivePlaceholder}
              isLoading={isLoading}
              stop={stop}
            />
          </div>
        </div>
      </TooltipProvider>
    );
  },
);

ChatInterface.displayName = "ChatInterface";

export default ChatInterface;
