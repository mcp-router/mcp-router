import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

interface HookModuleEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
  readOnly?: boolean;
}

export default function HookModuleEditor({
  value,
  onChange,
  placeholder = "// Write your hook module code here...",
  height = "400px",
  readOnly = false,
}: HookModuleEditorProps) {
  const extensions = [
    javascript({ typescript: true }),
    EditorView.theme({
      "&": {
        fontSize: "14px",
      },
      ".cm-content": {
        padding: "10px",
      },
      ".cm-focused .cm-cursor": {
        borderLeftColor: "#528bff",
      },
      ".cm-line": {
        padding: "0 2px",
      },
    }),
    EditorView.lineWrapping,
  ];

  const handleChange = (val: string) => {
    if (!readOnly) {
      onChange(val);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <CodeMirror
        value={value}
        height={height}
        theme={oneDark}
        extensions={extensions}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          highlightSelectionMatches: true,
          searchKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
}
