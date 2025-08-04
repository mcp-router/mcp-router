import React from "react";
import { Textarea } from "@mcp_router/ui";
import { cn } from "@mcp_router/ui";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
}: CodeEditorProps) {
  // Simple code editor using textarea with monospace font
  // In a production app, you would use Monaco Editor or CodeMirror
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className={cn(
        "font-mono text-sm resize-none h-full",
        "bg-zinc-950 text-zinc-50",
        "dark:bg-zinc-950 dark:text-zinc-50",
        className
      )}
      spellCheck={false}
      placeholder={`// Enter ${language || "code"} here...`}
    />
  );
}