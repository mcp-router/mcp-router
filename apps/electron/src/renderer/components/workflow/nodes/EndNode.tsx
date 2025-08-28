import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { StopCircle } from "lucide-react";

const EndNode = memo(({ data, selected }: NodeProps<any>) => {
  return (
    <div
      className={`px-4 py-2 shadow-md rounded-full border-2 ${
        selected
          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
          : "border-red-400 bg-white dark:bg-gray-800"
      } min-w-[100px] text-center`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-red-400 border-2 border-white"
      />

      <div className="flex items-center justify-center gap-2">
        <StopCircle className="w-5 h-5 text-red-500" />
        <div className="text-sm font-bold">{String(data?.label || "End")}</div>
      </div>
    </div>
  );
});

EndNode.displayName = "EndNode";

export default EndNode;
