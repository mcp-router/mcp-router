import React, { useEffect, useState } from "react";
import { Plus, Play, Edit, Trash2, GripVertical } from "lucide-react";
import { Button } from "@mcp_router/ui";
import PageLayout from "@/renderer/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { useHookStore } from "@/renderer/stores/hook-store";
import { HookEditDialog } from "./HookEditDialog";
import { HookTestDialog } from "./HookTestDialog";
import { MCPHook } from "@mcp_router/shared";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { HookListItem } from "./HookListItem";
import { Alert, AlertDescription } from "@mcp_router/ui";
import { Loader2 } from "lucide-react";

export default function HookManager() {
  const {
    hooks,
    loading,
    error,
    fetchHooks,
    reorderHooks,
    setHookEnabled,
    deleteHook,
    clearError,
  } = useHookStore();

  const [editingHook, setEditingHook] = useState<MCPHook | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [testingHook, setTestingHook] = useState<MCPHook | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = hooks.findIndex((h: MCPHook) => h.id === active.id);
      const newIndex = hooks.findIndex((h: MCPHook) => h.id === over.id);

      const newHooks = arrayMove(hooks, oldIndex, newIndex);
      const hookIds = newHooks.map((h: MCPHook) => h.id);
      
      await reorderHooks(hookIds);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingHook(null);
  };

  const handleEdit = (hook: MCPHook) => {
    setEditingHook(hook);
    setIsCreating(false);
  };

  const handleTest = (hook: MCPHook) => {
    setTestingHook(hook);
  };

  const handleToggleEnabled = async (hook: MCPHook) => {
    await setHookEnabled(hook.id, !hook.enabled);
  };

  const handleDelete = async (hook: MCPHook) => {
    if (confirm(`Are you sure you want to delete the hook "${hook.name}"?`)) {
      await deleteHook(hook.id);
    }
  };

  const handleCloseEditDialog = () => {
    setEditingHook(null);
    setIsCreating(false);
  };

  const handleCloseTestDialog = () => {
    setTestingHook(null);
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Hooks</h1>
            <p className="text-muted-foreground mt-1">
              Configure pre and post hooks for MCP requests
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Hook
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Hook Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {hooks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No hooks configured yet.</p>
                <p className="mt-2">Create your first hook to get started.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={hooks.map((h: MCPHook) => h.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {hooks.map((hook) => (
                      <HookListItem
                        key={hook.id}
                        hook={hook}
                        onEdit={handleEdit}
                        onTest={handleTest}
                        onToggleEnabled={handleToggleEnabled}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {(editingHook || isCreating) && (
        <HookEditDialog
          hook={editingHook}
          isOpen={true}
          onClose={handleCloseEditDialog}
        />
      )}

      {testingHook && (
        <HookTestDialog
          hook={testingHook}
          isOpen={true}
          onClose={handleCloseTestDialog}
        />
      )}
    </PageLayout>
  );
}