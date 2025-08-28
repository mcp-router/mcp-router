import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { PlayCircle } from "lucide-react";

const StartNode = memo(({ data, selected }: NodeProps<any>) => {
  return (
    <div
      className={`px-4 py-2 shadow-md rounded-full border-2 ${
        selected
          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
          : "border-green-400 bg-white dark:bg-gray-800"
      } min-w-[100px] text-center`}
    >
      <div className="flex items-center justify-center gap-2">
        <PlayCircle className="w-5 h-5 text-green-500" />
        <div className="text-sm font-bold">
          {String(data?.label || "Start")}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-400 border-2 border-white"
      />
    </div>
  );
});

StartNode.displayName = "StartNode";

export default StartNode;
