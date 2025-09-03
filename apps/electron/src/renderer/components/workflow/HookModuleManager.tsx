import React, { useState, useEffect } from "react";
import { HookModule } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@mcp_router/ui";
import { Button, Input, Label } from "@mcp_router/ui";
import { Plus, Edit2, Trash2 } from "lucide-react";
import HookModuleEditor from "./HookModuleEditor";
import { useHookStore } from "../../stores/hook-store";
import { usePlatformAPI } from "../../platform-api/hooks/use-platform-api";

interface HookModuleManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModuleSelect?: (moduleId: string) => void;
}

export default function HookModuleManager({
  open,
  onOpenChange,
  onModuleSelect,
}: HookModuleManagerProps) {
  const platformAPI = usePlatformAPI();
  const {
    modules,
    editingModule,
    isCreating,
    formData,
    setFormData,
    loadModules,
    handleCreate,
    handleUpdate,
    handleDelete,
    startEdit,
    startCreate,
    resetForm,
  } = useHookStore();

  useEffect(() => {
    if (open) {
      loadModules(platformAPI);
    }
  }, [open, loadModules, platformAPI]);

  const cancelEdit = resetForm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your Hook Modules</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Module List */}
          {!isCreating && !editingModule && (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={startCreate} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  New Module
                </Button>
              </div>

              <div className="space-y-2">
                {modules.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No modules yet. Create your first module!
                  </p>
                ) : (
                  modules.map((module: HookModule) => (
                    <div
                      key={module.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{module.name}</div>
                      </div>
                      <div className="flex gap-2">
                        {onModuleSelect && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onModuleSelect(module.id);
                              onOpenChange(false);
                            }}
                          >
                            Select
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(module)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(platformAPI, module.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Create/Edit Form */}
          {(isCreating || editingModule) && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Module Name</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Rate Limit Handler"
                />
              </div>

              <div>
                <Label>Module Code</Label>
                <HookModuleEditor
                  value={formData.script || ""}
                  onChange={(value) =>
                    setFormData({ ...formData, script: value })
                  }
                  height="300px"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingModule) {
                      handleUpdate(platformAPI);
                    } else {
                      handleCreate(platformAPI);
                    }
                  }}
                >
                  {editingModule ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
