import React, { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@mcp_router/ui";
import PageLayout from "@/renderer/components/layout/PageLayout";
import { useHookStore } from "@/renderer/stores";
import { MCPHook } from "@mcp_router/shared";
import { useNavigate } from "react-router-dom";
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
import { useTranslation } from "react-i18next";

export default function HookManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    hooks,
    loading,
    error,
    fetchHooks,
    reorderHooks,
    setHookEnabled,
    deleteHook,
  } = useHookStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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
    navigate("/hooks/new");
  };

  const handleEdit = (hook: MCPHook) => {
    navigate(`/hooks/edit/${hook.id}`);
  };

  const handleToggleEnabled = async (hook: MCPHook) => {
    await setHookEnabled(hook.id, !hook.enabled);
  };

  const handleDelete = async (hook: MCPHook) => {
    if (confirm(t("hooks.confirmDelete"))) {
      await deleteHook(hook.id);
    }
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
            <h1 className="text-3xl font-bold">{t("hooks.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("hooks.description")}
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t("hooks.new")}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {hooks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t("hooks.noHooks")}</p>
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
                    onToggleEnabled={handleToggleEnabled}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </PageLayout>
  );
}
