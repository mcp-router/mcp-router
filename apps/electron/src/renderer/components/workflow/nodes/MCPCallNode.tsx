import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Send } from "lucide-react";

const MCPCallNode = memo(({ data, selected }: NodeProps<any>) => {
  return (
    <div
      className={`px-4 py-2 shadow-md rounded-lg border-2 ${
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-blue-400 bg-white dark:bg-gray-800"
      } min-w-[120px] text-center`}
    >
      <div className="flex items-center justify-center gap-2">
        <Send className="w-5 h-5 text-blue-500" />
        <div className="text-sm font-bold">
          {String(data?.label || "MCP Call")}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-400 border-2 border-white"
      />
    </div>
  );
});

MCPCallNode.displayName = "MCPCallNode";

export default MCPCallNode;
