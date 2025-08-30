import React, { useState, useEffect } from "react";
import { WorkflowDefinition, HookModule } from "@mcp_router/shared";
import WorkflowEditor from "./WorkflowEditor";
import { Button, Input, Label, Textarea } from "@mcp_router/ui";
import { Card } from "@mcp_router/ui";
import {
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Save,
  X,
  Package,
  GitBranch,
} from "lucide-react";
import {
  getUserHookModules,
  createHookModule,
  updateHookModule,
  deleteHookModule,
} from "../../lib/hook-modules";

export default function WorkflowManager() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<WorkflowDefinition | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"workflows" | "modules">(
    "workflows",
  );

  // Hook Module states
  const [modules, setModules] = useState<HookModule[]>([]);
  const [editingModule, setEditingModule] = useState<HookModule | null>(null);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [moduleFormData, setModuleFormData] = useState<Partial<HookModule>>({
    name: "",
    script: "",
  });

  useEffect(() => {
    // TODO: Fetch workflows from backend
    loadWorkflows();
    if (activeTab === "modules") {
      loadModules();
    }
  }, [activeTab]);

  const loadWorkflows = () => {
    // TODO: Load from backend
  };

  const loadModules = async () => {
    const userModules = await getUserHookModules();
    setModules(userModules);
  };

  const handleSaveWorkflow = (workflow: WorkflowDefinition) => {
    const updatedWorkflows = selectedWorkflow
      ? workflows.map((w) => (w.id === workflow.id ? workflow : w))
      : [...workflows, workflow];

    setWorkflows(updatedWorkflows);
    setIsEditing(false);
    setSelectedWorkflow(null);
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    const updatedWorkflows = workflows.filter((w) => w.id !== workflowId);
    setWorkflows(updatedWorkflows);
  };

  const handleToggleWorkflow = (workflow: WorkflowDefinition) => {
    const updatedWorkflow = { ...workflow, enabled: !workflow.enabled };
    handleSaveWorkflow(updatedWorkflow);
  };

  const handleExecuteWorkflow = (workflow: WorkflowDefinition) => {
    // TODO: Implement workflow execution
    console.log("Executing workflow:", workflow);
  };

  const handleCreateWorkflow = () => {
    setSelectedWorkflow(null);
    setIsEditing(true);
  };

  const handleEditWorkflow = (workflow: WorkflowDefinition) => {
    setSelectedWorkflow(workflow);
    setIsEditing(true);
  };

  // Hook Module handlers
  const handleCreateModule = async () => {
    if (!moduleFormData.name || !moduleFormData.script) return;

    await createHookModule({
      name: moduleFormData.name,
      script: moduleFormData.script,
    });

    setIsCreatingModule(false);
    setModuleFormData({ name: "", script: "" });
    loadModules();
  };

  const handleUpdateModule = async () => {
    if (!editingModule || !moduleFormData.name || !moduleFormData.script)
      return;

    await updateHookModule(editingModule.id, moduleFormData);

    setEditingModule(null);
    setModuleFormData({ name: "", script: "" });
    loadModules();
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this module?")) return;

    await deleteHookModule(id);
    loadModules();
  };

  const startEditModule = (module: HookModule) => {
    setEditingModule(module);
    setModuleFormData({
      name: module.name,
      script: module.script,
    });
    setIsCreatingModule(false);
  };

  const startCreateModule = () => {
    setIsCreatingModule(true);
    setEditingModule(null);
    setModuleFormData({ name: "", script: "" });
  };

  const cancelEditModule = () => {
    setIsCreatingModule(false);
    setEditingModule(null);
    setModuleFormData({ name: "", script: "" });
  };

  if (isEditing) {
    return (
      <div className="h-full">
        <WorkflowEditor
          workflow={selectedWorkflow || undefined}
          onSave={handleSaveWorkflow}
          onExecute={handleExecuteWorkflow}
        />
        <Button
          onClick={() => setIsEditing(false)}
          variant="ghost"
          className="absolute top-4 left-4 z-10"
        >
          ← Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Hook Studio</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Design workflows and reusable modules to intercept and modify MCP operations
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 -mb-px font-medium transition-colors ${
            activeTab === "workflows"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("workflows")}
        >
          <GitBranch className="w-4 h-4 inline mr-2" />
          Workflows
        </button>
        <button
          className={`px-4 py-2 -mb-px font-medium transition-colors ml-4 ${
            activeTab === "modules"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("modules")}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Hook Modules
        </button>
      </div>

      {/* Workflows Tab */}
      {activeTab === "workflows" && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={handleCreateWorkflow}>
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </div>

          {workflows.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500 mb-4">No workflows created yet</p>
              <Button onClick={handleCreateWorkflow}>
                Create Your First Workflow
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {workflow.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {workflow.nodes.length} nodes, {workflow.edges.length}{" "}
                        connections
                      </p>
                      {workflow.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleToggleWorkflow(workflow)}
                        variant="ghost"
                        size="sm"
                      >
                        {workflow.enabled ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        onClick={() => handleEditWorkflow(workflow)}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modules Tab */}
      {activeTab === "modules" && (
        <div>
          {/* Module Create/Edit Form */}
          {isCreatingModule || editingModule ? (
            <Card className="p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {isCreatingModule ? "Create New Module" : "Edit Module"}
              </h3>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="module-name">Name</Label>
                  <Input
                    id="module-name"
                    value={moduleFormData.name}
                    onChange={(e) =>
                      setModuleFormData({
                        ...moduleFormData,
                        name: e.target.value,
                      })
                    }
                    placeholder="Module name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="module-script">Script</Label>
                  <Textarea
                    id="module-script"
                    value={moduleFormData.script}
                    onChange={(e) =>
                      setModuleFormData({
                        ...moduleFormData,
                        script: e.target.value,
                      })
                    }
                    placeholder="// Enter JavaScript code here
// context object is available with request and response data"
                    className="h-64 font-mono text-sm mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelEditModule}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    onClick={
                      isCreatingModule ? handleCreateModule : handleUpdateModule
                    }
                    disabled={!moduleFormData.name || !moduleFormData.script}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {isCreatingModule ? "Create" : "Update"}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex justify-end mb-4">
              <Button onClick={startCreateModule}>
                <Plus className="w-4 h-4 mr-2" />
                New Module
              </Button>
            </div>
          )}

          {/* Module List */}
          {modules.length === 0 && !isCreatingModule && !editingModule ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500 mb-4">No modules created yet</p>
              <Button onClick={startCreateModule}>
                Create Your First Module
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {modules.map((module) => (
                <Card key={module.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{module.name}</h3>
                      <pre className="text-xs text-gray-500 mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto max-h-20">
                        <code>
                          {module.script.substring(0, 200)}
                          {module.script.length > 200 ? "..." : ""}
                        </code>
                      </pre>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => startEditModule(module)}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteModule(module.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}