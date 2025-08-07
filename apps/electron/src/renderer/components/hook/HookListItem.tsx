import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MCPHook } from "@mcp_router/shared";
import { Badge } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { GripVertical, Play, Edit, Trash2 } from "lucide-react";
import { cn } from "@mcp_router/ui";

interface HookListItemProps {
  hook: MCPHook;
  onEdit: (hook: MCPHook) => void;
  onToggleEnabled: (hook: MCPHook) => void;
  onDelete: (hook: MCPHook) => void;
}

export function HookListItem({
  hook,
  onEdit,
  onToggleEnabled,
  onDelete,
}: HookListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: hook.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getHookTypeBadge = () => {
    switch (hook.hookType) {
      case "pre":
        return <Badge variant="secondary">Pre-hook</Badge>;
      case "post":
        return <Badge variant="secondary">Post-hook</Badge>;
      case "both":
        return <Badge variant="secondary">Pre & Post</Badge>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 p-4 bg-background border rounded-lg",
        isDragging && "opacity-50",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:bg-muted p-1 rounded"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{hook.name}</h3>
          {getHookTypeBadge()}
          {!hook.enabled && (
            <Badge variant="outline" className="text-muted-foreground">
              Disabled
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={hook.enabled}
          onCheckedChange={() => onToggleEnabled(hook)}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(hook)}
          title="Edit hook"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(hook)}
          title="Delete hook"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
