import React, { useState, useEffect } from "react";
import { HookModule } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@mcp_router/ui";
import { Button, Input, Label, Textarea } from "@mcp_router/ui";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
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
    if (!confirm("Are you sure you want to delete this module?")) return;

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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hook Module Manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Module List */}
          {!isCreating && !editingModule && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Your Modules</h3>
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
              <h3 className="text-lg font-semibold">
                {isCreating ? "Create New Module" : "Edit Module"}
              </h3>

              <div>
                <Label htmlFor="module-name">Name</Label>
                <Input
                  id="module-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Module name"
                />
              </div>

              <div>
                <Label htmlFor="module-script">Script</Label>
                <Textarea
                  id="module-script"
                  value={formData.script}
                  onChange={(e) =>
                    setFormData({ ...formData, script: e.target.value })
                  }
                  placeholder="// Enter JavaScript code here
// context object is available with request and response data"
                  className="h-64 font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={isCreating ? handleCreate : handleUpdate}
                  disabled={!formData.name || !formData.script}
                >
                  <Save className="w-4 h-4 mr-1" />
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
