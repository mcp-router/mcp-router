import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { FileCode } from "lucide-react";

const HookNode = memo(({ data, selected }: NodeProps<any>) => {
  return (
    <div
      className={`px-4 py-2 shadow-md rounded-md border-2 ${
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-300 bg-white dark:bg-gray-800"
      } min-w-[150px]`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white -left-1.5"
        style={{ background: "#3b82f6", border: "2px solid white" }}
      />

      <div className="flex items-center gap-2">
        <FileCode className="w-4 h-4 text-blue-500" />
        <div>
          <div className="text-sm font-bold">
            {String(data?.label || "Hook")}
          </div>
          {data?.hookId && (
            <div className="text-xs text-gray-500">
              ID: {String(data?.hookId)}
            </div>
          )}
        </div>
      </div>

      {data?.hook?.blocking === true && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-blue-500 border-2 border-white -right-1.5"
          style={{ background: "#3b82f6", border: "2px solid white" }}
        />
      )}
    </div>
  );
});

HookNode.displayName = "HookNode";

export default HookNode;
