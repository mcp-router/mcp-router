import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WorkflowDefinition, HookModule } from "@mcp_router/shared";
import WorkflowEditor from "./WorkflowEditor";
import {
  Button,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
} from "@mcp_router/ui";
import { Card } from "@mcp_router/ui";
import { Plus, Trash2, Edit2, Save, X, Package, GitBranch } from "lucide-react";
import { usePlatformAPI } from "../../platform-api/hooks/use-platform-api";
import HookModuleEditor from "./HookModuleEditor";

export default function WorkflowManager() {
  const platformAPI = usePlatformAPI();
  const navigate = useNavigate();
  const { workflowId } = useParams<{ workflowId?: string }>();
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
    loadWorkflows();
    if (activeTab === "modules") {
      loadModules();
    }
  }, [activeTab]);

  // URLパラメータからワークフローIDを取得して選択
  useEffect(() => {
    if (workflowId && workflows.length > 0) {
      const workflow = workflows.find((w) => w.id === workflowId);
      if (workflow) {
        setSelectedWorkflow(workflow);
        setIsEditing(true);
      }
    }
  }, [workflowId, workflows]);

  const loadWorkflows = async () => {
    try {
      const data = await platformAPI.workflows.workflows.list();
      setWorkflows(data);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    }
  };

  const loadModules = async () => {
    const userModules = await platformAPI.workflows.hooks.list();
    setModules(userModules);
  };

  const handleSaveWorkflow = async (workflow: WorkflowDefinition) => {
    try {
      if (selectedWorkflow) {
        await platformAPI.workflows.workflows.update(workflow.id, workflow);
      } else {
        await platformAPI.workflows.workflows.create(workflow);
      }
      await loadWorkflows();
      setIsEditing(false);
      setSelectedWorkflow(null);
      navigate("/workflows"); // URLをワークフロー一覧に戻す
    } catch (error) {
      console.error("Failed to save workflow:", error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      await platformAPI.workflows.workflows.delete(workflowId);
      await loadWorkflows();
    } catch (error) {
      console.error("Failed to delete workflow:", error);
    }
  };

  const handleSetActiveWorkflow = async (
    workflowId: string | null,
    workflowType: string,
  ) => {
    try {
      if (workflowId) {
        await platformAPI.workflows.workflows.setActive(workflowId);
      } else {
        // 指定されたタイプの全てのワークフローを無効化
        const activeWorkflow = workflows.find(
          (w) => w.workflowType === workflowType && w.enabled,
        );
        if (activeWorkflow) {
          await platformAPI.workflows.workflows.disable(activeWorkflow.id);
        }
      }
      // ローカルのstateを直接更新して再レンダリングを最小限にする
      setWorkflows((prevWorkflows) =>
        prevWorkflows.map((w) => {
          if (w.workflowType === workflowType) {
            return { ...w, enabled: w.id === workflowId };
          }
          return w;
        }),
      );
    } catch (error) {
      console.error("Failed to set active workflow:", error);
      // エラー時は元の状態を再取得
      await loadWorkflows();
    }
  };

  const handleExecuteWorkflow = async (workflow: WorkflowDefinition) => {
    try {
      const result = await platformAPI.workflows.workflows.execute(workflow.id);
      console.log("Workflow executed:", result);
    } catch (error) {
      console.error("Failed to execute workflow:", error);
    }
  };

  const handleCreateWorkflow = () => {
    setSelectedWorkflow(null);
    setIsEditing(true);
    navigate("/workflows/new"); // 新規作成時のURL
  };

  const handleEditWorkflow = (workflow: WorkflowDefinition) => {
    setSelectedWorkflow(workflow);
    setIsEditing(true);
    navigate(`/workflows/${workflow.id}`); // ワークフローIDをURLに反映
  };

  // Hook Module handlers
  const handleCreateModule = async () => {
    if (!moduleFormData.name || !moduleFormData.script) return;

    await platformAPI.workflows.hooks.create({
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

    await platformAPI.workflows.hooks.update(editingModule.id, moduleFormData);

    setEditingModule(null);
    setModuleFormData({ name: "", script: "" });
    loadModules();
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this module?")) return;

    await platformAPI.workflows.hooks.delete(id);
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
          Design workflows and reusable modules to intercept and modify MCP
          operations
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
            <div className="space-y-6">
              {/* Group workflows by type */}
              {Object.entries(
                workflows.reduce(
                  (acc, workflow) => {
                    const type = workflow.workflowType;
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(workflow);
                    return acc;
                  },
                  {} as Record<string, typeof workflows>,
                ),
              ).map(([workflowType, typeWorkflows]) => (
                <Card key={workflowType} className="p-4">
                  <h3 className="text-lg font-semibold mb-3">
                    Type: {workflowType}
                  </h3>
                  <RadioGroup
                    value={typeWorkflows.find((w) => w.enabled)?.id || "none"}
                    onValueChange={(value) =>
                      handleSetActiveWorkflow(
                        value === "none" ? null : value,
                        workflowType,
                      )
                    }
                  >
                    <div className="space-y-3">
                      {/* None option */}
                      <div className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900">
                        <RadioGroupItem
                          value="none"
                          id={`${workflowType}-none`}
                        />
                        <Label
                          htmlFor={`${workflowType}-none`}
                          className="flex-1 cursor-pointer"
                        >
                          <span className="text-gray-500">無効化</span>
                        </Label>
                      </div>

                      {/* Workflows */}
                      {typeWorkflows.map((workflow) => (
                        <div
                          key={workflow.id}
                          className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-900"
                        >
                          <RadioGroupItem
                            value={workflow.id}
                            id={workflow.id}
                          />
                          <Label
                            htmlFor={workflow.id}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">
                                  {workflow.name}
                                </span>
                                <p className="text-sm text-gray-500">
                                  {workflow.nodes.length} nodes,{" "}
                                  {workflow.edges.length} connections
                                </p>
                                {workflow.description && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {workflow.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditWorkflow(workflow);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                >
                                  編集
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWorkflow(workflow.id);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
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
                  <div className="mt-1">
                    <HookModuleEditor
                      value={moduleFormData.script || ""}
                      onChange={(value) =>
                        setModuleFormData({
                          ...moduleFormData,
                          script: value,
                        })
                      }
                      height="400px"
                      placeholder="// Enter JavaScript code here
// context object is available with request and response data"
                    />
                  </div>
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

          {/* Module List - 編集中は表示しない */}
          {!isCreatingModule &&
            !editingModule &&
            (modules.length === 0 ? (
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
            ))}
        </div>
      )}
    </div>
  );
}
