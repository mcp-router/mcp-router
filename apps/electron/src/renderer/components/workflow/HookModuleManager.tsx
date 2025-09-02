import React, { useState, useEffect } from "react";
import { HookModule } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@mcp_router/ui";
import { Button, Input, Label } from "@mcp_router/ui";
import { Plus, Edit2 as Edit, Trash2, X } from "lucide-react";
import HookModuleEditor from "./HookModuleEditor";
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
  const [modules, setModules] = useState<HookModule[]>([]);
  const [editingModule, setEditingModule] = useState<HookModule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<HookModule>>({
    name: "",
    script: "",
  });

  useEffect(() => {
    if (open) {
      loadModules();
    }
  }, [open]);

  const loadModules = async () => {
    const userModules = await platformAPI.workflows.hooks.list();
    setModules(userModules);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.script) return;

    await platformAPI.workflows.hooks.create({
      name: formData.name,
      script: formData.script,
    });

    setIsCreating(false);
    setFormData({
      name: "",
      script: "",
    });
    loadModules();
  };

  const handleUpdate = async () => {
    if (!editingModule || !formData.name || !formData.script) return;

    await platformAPI.workflows.hooks.update(editingModule.id, formData);

    setEditingModule(null);
    setFormData({
      name: "",
      script: "",
    });
    loadModules();
  };

  const handleDelete = async (id: string) => {
    await platformAPI.workflows.hooks.delete(id);
    loadModules();
  };

  const startEdit = (module: HookModule) => {
    setEditingModule(module);
    setFormData({
      name: module.name,
      script: module.script,
    });
    setIsCreating(false);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingModule(null);
    setFormData({
      name: "",
      script: "",
    });
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setEditingModule(null);
    setFormData({
      name: "",
      script: "",
    });
  };

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
                  modules.map((module) => (
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
                            Use
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(module)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(module.id)}
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
                  placeholder="Enter module name"
                />
              </div>

              <div>
                <Label htmlFor="script">Module Script</Label>
                <div className="mt-2">
                  <HookModuleEditor
                    value={formData.script || ""}
                    onChange={(value) =>
                      setFormData({ ...formData, script: value })
                    }
                    height="500px"
                    placeholder="// Write your hook module code here...
// Example:
// export function processData(data) {
//   // Your code here
//   return data;
// }"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button onClick={isCreating ? handleCreate : handleUpdate}>
                  {isCreating ? "Create" : "Update"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
