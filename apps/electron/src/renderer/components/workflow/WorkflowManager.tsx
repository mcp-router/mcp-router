import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WorkflowDefinition } from "@mcp_router/shared";
import WorkflowEditor from "./WorkflowEditor";
import {
  Button,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Badge,
} from "@mcp_router/ui";
import { Card } from "@mcp_router/ui";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Package,
  GitBranch,
  AlertCircle,
} from "lucide-react";
import { usePlatformAPI } from "../../platform-api/hooks/use-platform-api";
import HookModuleEditor from "./HookModuleEditor";
import { useWorkflowStore } from "../../stores/workflow-store";
import { useHookStore } from "../../stores/hook-store";

export default function WorkflowManager() {
  const platformAPI = usePlatformAPI();
  const navigate = useNavigate();
  const { workflowId } = useParams<{ workflowId?: string }>();

  // Use Zustand store for workflow state
  const {
    workflows,
    selectedWorkflow,
    isEditing,
    activeTab,
    setWorkflows,
    setSelectedWorkflow,
    setIsEditing,
    setActiveTab,
    updateWorkflow,
    setIsLoading,
    setError,
  } = useWorkflowStore();

  // Use Zustand store for hook modules
  const {
    modules,
    editingModule,
    isCreating: isCreatingModule,
    formData: moduleFormData,
    setFormData: setModuleFormData,
    loadModules,
    handleCreate: handleCreateModule,
    handleUpdate: handleUpdateModule,
    handleDelete: handleDeleteModule,
    startEdit: startEditModule,
    startCreate: startCreateModule,
    resetForm: cancelEditModule,
  } = useHookStore();

  useEffect(() => {
    loadWorkflows();
    if (activeTab === "modules") {
      loadModules(platformAPI);
    }
  }, [activeTab, loadModules, platformAPI]);

  // URLパラメータからワークフローIDを取得して選択
  useEffect(() => {
    if (workflowId && workflows.length > 0) {
      const workflow = workflows.find((w) => w.id === workflowId);
      if (workflow) {
        setSelectedWorkflow(workflow);
        setIsEditing(true);
      }
    }
  }, [workflowId, workflows, setSelectedWorkflow, setIsEditing]);

  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const data = await platformAPI.workflows.workflows.list();
      setWorkflows(data);
      setError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load workflows";
      setError(errorMessage);
      console.error("Failed to load workflows:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ワークフローの妥当性チェック関数
  const checkWorkflowValidity = (
    workflow: WorkflowDefinition,
  ): { isValid: boolean; reason?: string } => {
    const nodes = workflow.nodes;
    const edges = workflow.edges;

    // 必須ノードの存在確認
    const startNode = nodes.find((n) => n.type === "start");
    const endNode = nodes.find((n) => n.type === "end");
    const mcpCallNode = nodes.find((n) => n.type === "mcp-call");

    if (!startNode) {
      return { isValid: false, reason: "Start node is missing" };
    }
    if (!mcpCallNode) {
      return { isValid: false, reason: "MCP Call node is missing" };
    }
    if (!endNode) {
      return { isValid: false, reason: "End node is missing" };
    }

    // パスの存在確認用ヘルパー関数
    const hasPath = (from: string, to: string): boolean => {
      const visited = new Set<string>();
      const queue = [from];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === to) return true;
        if (visited.has(current)) continue;
        visited.add(current);

        const nextNodes = edges
          .filter((e) => e.source === current)
          .map((e) => e.target);
        queue.push(...nextNodes);
      }
      return false;
    };

    // Start -> MCP Call のパス確認
    if (!hasPath(startNode.id, mcpCallNode.id)) {
      return { isValid: false, reason: "No path from Start to MCP Call" };
    }

    // MCP Call -> End のパス確認
    if (!hasPath(mcpCallNode.id, endNode.id)) {
      return { isValid: false, reason: "No path from MCP Call to End" };
    }

    return { isValid: true };
  };

  const handleSaveWorkflow = async (workflow: WorkflowDefinition) => {
    setIsLoading(true);
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
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save workflow";
      setError(errorMessage);
      console.error("Failed to save workflow:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    setIsLoading(true);
    try {
      await platformAPI.workflows.workflows.delete(workflowId);
      await loadWorkflows();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete workflow";
      setError(errorMessage);
      console.error("Failed to delete workflow:", error);
    } finally {
      setIsLoading(false);
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
      workflows.forEach((w) => {
        if (w.workflowType === workflowType) {
          updateWorkflow(w.id, { enabled: w.id === workflowId });
        }
      });
    } catch (error: any) {
      console.error("Failed to set active workflow:", error);

      // エラーメッセージを表示
      const errorMessage = error?.message || "Failed to set active workflow";

      // ユーザーにエラーを通知（簡易的なアラート）
      if (errorMessage.includes("not valid")) {
        alert(
          `⚠️ Workflow validation failed:\n\n${errorMessage}\n\n` +
            `Please edit the workflow to ensure it has the required structure.`,
        );
      } else {
        alert(`Error: ${errorMessage}`);
      }

      // エラー時は元の状態を再取得
      await loadWorkflows();
    }
  };

  const handleExecuteWorkflow = async (workflow: WorkflowDefinition) => {
    setIsLoading(true);
    try {
      const result = await platformAPI.workflows.workflows.execute(workflow.id);
      console.log("Workflow executed:", result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to execute workflow";
      setError(errorMessage);
      console.error("Failed to execute workflow:", error);
    } finally {
      setIsLoading(false);
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
      <div className="flex bg-muted/30 p-1 rounded-full w-fit mb-8">
        <button
          className={`px-6 py-2 rounded-full font-medium transition-all ${
            activeTab === "workflows"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("workflows")}
        >
          <GitBranch className="w-4 h-4 inline mr-2" />
          Workflows
        </button>
        <button
          className={`px-6 py-2 rounded-full font-medium transition-all ${
            activeTab === "modules"
              ? "bg-background shadow-sm text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("modules")}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Hook Modules
        </button>
      </div>

      {/* Workflows Tab */}
      {activeTab === "workflows" && (
        <div className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button
              onClick={handleCreateWorkflow}
              className="rounded-full shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </div>

          {workflows.length === 0 ? (
            <Card className="p-12 text-center rounded-2xl border-dashed bg-background/50">
              <p className="text-muted-foreground mb-6">
                No workflows created yet
              </p>
              <Button onClick={handleCreateWorkflow} className="rounded-full">
                Create Your First Workflow
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6">
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
                <Card
                  key={workflowType}
                  className="p-6 rounded-2xl bg-background/50 shadow-sm border-muted/20"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      Type: {workflowType}
                    </h3>
                  </div>
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
                      <div className="flex items-center space-x-3 p-3 rounded-xl transition-colors hover:bg-muted/30">
                        <RadioGroupItem
                          value="none"
                          id={`${workflowType}-none`}
                        />
                        <Label
                          htmlFor={`${workflowType}-none`}
                          className="flex-1 cursor-pointer font-medium text-muted-foreground"
                        >
                          Disabled
                        </Label>
                      </div>

                      {/* Workflows */}
                      {typeWorkflows.map((workflow) => {
                        const validity = checkWorkflowValidity(workflow);
                        const isDisabled = !validity.isValid;

                        return (
                          <div
                            key={workflow.id}
                            className={`flex items-center space-x-3 p-4 rounded-xl border transition-all ${
                              isDisabled
                                ? "bg-muted/50 opacity-60 grayscale"
                                : "hover:bg-muted/30 hover:shadow-sm border-transparent hover:border-muted/20"
                            }`}
                          >
                            <RadioGroupItem
                              value={workflow.id}
                              id={workflow.id}
                              disabled={isDisabled}
                            />
                            <Label
                              htmlFor={workflow.id}
                              className={`flex-1 ${isDisabled ? "" : "cursor-pointer"}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-semibold ${isDisabled ? "text-muted-foreground" : ""}`}
                                    >
                                      {workflow.name}
                                    </span>
                                    {isDisabled && (
                                      <Badge
                                        variant="outline"
                                        className="rounded-full border-orange-200 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:border-orange-900/30"
                                      >
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Invalid
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {workflow.nodes.length} nodes ·{" "}
                                    {workflow.edges.length} connections
                                  </p>
                                  {isDisabled && validity.reason && (
                                    <p className="text-xs text-destructive mt-1 font-medium">
                                      {validity.reason}
                                    </p>
                                  )}
                                  {workflow.description && (
                                    <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
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
                                    variant="secondary"
                                    size="sm"
                                    className="rounded-full h-8 px-4"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteWorkflow(workflow.id);
                                    }}
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </Label>
                          </div>
                        );
                      })}
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
        <div className="space-y-6">
          {/* Module Create/Edit Form */}
          {isCreatingModule || editingModule ? (
            <Card className="p-8 rounded-2xl bg-background/50 shadow-md border-primary/10">
              <h3 className="text-lg font-semibold mb-6">
                {isCreatingModule ? "Create New Module" : "Edit Module"}
              </h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="module-name" className="ml-1">
                    Name
                  </Label>
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
                    className="rounded-full px-5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="module-script" className="ml-1">
                    Script
                  </Label>
                  <div className="mt-1 rounded-2xl overflow-hidden border">
                    <HookModuleEditor
                      value={moduleFormData.script || ""}
                      onChange={(value) =>
                        setModuleFormData({
                          ...moduleFormData,
                          script: value,
                        })
                      }
                      height="400px"
                      placeholder="// Enter JavaScript code here\n// context object is available with request and response data"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="ghost"
                    onClick={cancelEditModule}
                    className="rounded-full"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    className="rounded-full px-8 shadow-sm"
                    onClick={() => {
                      if (isCreatingModule) {
                        handleCreateModule(platformAPI);
                      } else {
                        handleUpdateModule(platformAPI);
                      }
                    }}
                    disabled={!moduleFormData.name || !moduleFormData.script}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isCreatingModule ? "Create" : "Update"}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex justify-end mb-4">
              <Button
                onClick={startCreateModule}
                className="rounded-full shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Module
              </Button>
            </div>
          )}

          {/* Module List - 編集中は表示しない */}
          {!isCreatingModule &&
            !editingModule &&
            (modules.length === 0 ? (
              <Card className="p-12 text-center rounded-2xl border-dashed bg-background/50">
                <p className="text-muted-foreground mb-6">
                  No modules created yet
                </p>
                <Button onClick={startCreateModule} className="rounded-full">
                  Create Your First Module
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {modules.map((module) => (
                  <Card
                    key={module.id}
                    className="p-4 rounded-2xl bg-background/50 hover:bg-background transition-colors shadow-sm group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 px-2">
                        <h3 className="font-semibold">{module.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => startEditModule(module)}
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-8 w-8 text-muted-foreground"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() =>
                            handleDeleteModule(platformAPI, module.id)
                          }
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
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
