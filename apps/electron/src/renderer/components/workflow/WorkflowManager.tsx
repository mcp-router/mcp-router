import React, { useState, useEffect } from "react";
import { useHookStore } from "@/renderer/stores";
import { WorkflowDefinition } from "@mcp_router/shared";
import WorkflowEditor from "./WorkflowEditor";
import { Button } from "@mcp_router/ui";
import { Card } from "@mcp_router/ui";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export default function WorkflowManager() {
  const { hooks, fetchHooks } = useHookStore();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<WorkflowDefinition | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchHooks();
    // TODO: Fetch workflows from backend
    loadWorkflows();
  }, [fetchHooks]);

  const loadWorkflows = () => {
    // TODO: Load from backend
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Workflow Manager</h1>
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
                  <h3 className="text-lg font-semibold">{workflow.name}</h3>
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
  );
}
