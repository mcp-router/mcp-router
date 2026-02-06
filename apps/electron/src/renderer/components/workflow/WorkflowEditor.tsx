import React, { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  ConnectionMode,
  MarkerType,
  Panel,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  WorkflowNode,
  WorkflowEdge,
  WorkflowDefinition,
  WorkflowHook,
} from "@mcp_router/shared";
import { Button } from "@mcp_router/ui";
import { Plus, Save, X, Check } from "lucide-react";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { usePlatformAPI } from "../../platform-api/hooks/use-platform-api";
import HookModuleManager from "./HookModuleManager";
import HookModuleEditor from "./HookModuleEditor";
import StartNode from "./nodes/StartNode";
import EndNode from "./nodes/EndNode";
import MCPCallNode from "./nodes/MCPCallNode";
import HookNode from "./nodes/HookNode";

interface WorkflowEditorProps {
  workflow?: WorkflowDefinition;
  onSave: (workflow: WorkflowDefinition) => void;
  onExecute?: (workflow: WorkflowDefinition) => void;
}

const nodeTypes: NodeTypes = {
  hook: HookNode as unknown as NodeTypes["hook"],
  start: StartNode as unknown as NodeTypes["start"],
  end: EndNode as unknown as NodeTypes["end"],
  "mcp-call": MCPCallNode as unknown as NodeTypes["mcp-call"],
};

const defaultEdgeOptions = {
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
  },
};

import { useWorkflowStore } from "../../stores/workflow-store";
import { useHookStore } from "../../stores/hook-store";

export default function WorkflowEditor({
  workflow,
  onSave,
}: WorkflowEditorProps) {
  const platformAPI = usePlatformAPI();

  // Use Zustand store for workflow state
  const {
    nodes,
    edges,
    selectedNode,
    nodeScript,
    nodeLabel,
    selectedModuleId,
    setNodes,
    setEdges,
    setSelectedNode,
    setNodeScript,
    setNodeLabel,
    setSelectedModuleId,
    addNode,
    addEdge,
    resetEditorState,
  } = useWorkflowStore();

  // Use Zustand store for hook modules
  const {
    modules: userModules,
    moduleManagerOpen,
    setModules: setUserModules,
    setModuleManagerOpen,
  } = useHookStore();

  const [workflowType, setWorkflowType] = useState<"tools/list" | "tools/call">(
    workflow?.workflowType || "tools/list",
  );

  // Initialize nodes and edges when workflow prop changes
  useEffect(() => {
    if (workflow) {
      const initialNodes: WorkflowNode[] = workflow.nodes || [
        {
          id: "start",
          type: "start",
          position: { x: 100, y: 200 },
          data: { label: "Start" },
          deletable: false,
        },
        {
          id: "mcp-call",
          type: "mcp-call",
          position: { x: 350, y: 200 },
          data: { label: "MCP Call" },
          deletable: false,
        },
        {
          id: "end",
          type: "end",
          position: { x: 600, y: 200 },
          data: { label: "End" },
          deletable: false,
        },
      ];

      const initialEdges: Edge[] = (workflow.edges || []).map((edge) => ({
        id: edge.id || `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: edge.type || "default",
        animated: edge.animated,
        markerEnd: edge.markerEnd
          ? {
              type: MarkerType.ArrowClosed,
              width: edge.markerEnd.width,
              height: edge.markerEnd.height,
            }
          : undefined,
      }));

      setNodes(initialNodes);
      setEdges(initialEdges as WorkflowEdge[]);
    } else {
      // New workflow - set default nodes
      const defaultNodes: WorkflowNode[] = [
        {
          id: "start",
          type: "start",
          position: { x: 100, y: 200 },
          data: { label: "Start" },
          deletable: false,
        },
        {
          id: "mcp-call",
          type: "mcp-call",
          position: { x: 350, y: 200 },
          data: { label: "MCP Call" },
          deletable: false,
        },
        {
          id: "end",
          type: "end",
          position: { x: 600, y: 200 },
          data: { label: "End" },
          deletable: false,
        },
      ];
      setNodes(defaultNodes);
      setEdges([]);
    }
  }, [workflow, setNodes, setEdges]);

  // Clean up editor state when unmounting
  useEffect(() => {
    return () => {
      resetEditorState();
    };
  }, [resetEditorState]);

  // React Flow change handlers (controlled by Zustand store)
  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => {
      setNodes(applyNodeChanges(changes, nodes as Node[]) as WorkflowNode[]);
    },
    [nodes, setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => {
      setEdges(applyEdgeChanges(changes, edges as Edge[]) as WorkflowEdge[]);
    },
    [edges, setEdges],
  );

  const validateConnection = useCallback(
    (params: Connection): boolean => {
      const _sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      // Hook validation removed - Fire-and-forget hooks no longer have source handles

      // Check if target is Sync Hook or End Node - they can only have one incoming edge
      if (targetNode?.type === "end") {
        // End node can only have one incoming edge
      } else if (targetNode?.type === "hook") {
        const hook = targetNode.data?.hook as WorkflowHook | undefined;
        if (!hook || typeof hook !== "object" || hook.blocking !== false) {
          // Sync hook can only have one incoming edge
        } else {
          return true; // Fire-and-forget can have multiple
        }
      } else {
        return true;
      }

      // Actually check for the incoming edge
      if (
        targetNode?.type === "end" ||
        (targetNode?.type === "hook" &&
          (targetNode.data?.hook as WorkflowHook | undefined)?.blocking !==
            false)
      ) {
        // Count existing incoming edges to this target
        const incomingEdges = edges.filter(
          (edge) => edge.target === params.target,
        );
        if (incomingEdges.length > 0) {
          return false; // Already has an incoming edge
        }
      }

      return true;
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!validateConnection(params)) return;

      const newEdge = {
        ...params,
        id: `${params.source}-${params.target}`,
        type: "default",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
      } as WorkflowEdge;
      addEdge(newEdge);
    },
    [validateConnection, addEdge],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node as WorkflowNode);
      // Set node label
      const label = node.data?.label;
      setNodeLabel(typeof label === "string" ? label : "");
      // For Hook nodes, load settings from the hook object
      if (node.type === "hook") {
        const hook = node.data?.hook as WorkflowHook | undefined;
        if (hook && typeof hook === "object") {
          if (hook.hookModuleId) {
            // Referencing a HookModule
            setSelectedModuleId(hook.hookModuleId);
            // Get script from module
            platformAPI.workflows.hooks
              .get(hook.hookModuleId)
              .then((module) => {
                if (module) {
                  setNodeScript(module.script);
                }
              });
          } else if (hook.script) {
            // Inline Script case
            setSelectedModuleId("custom");
            setNodeScript(hook.script);
          } else {
            setSelectedModuleId("");
            setNodeScript("");
          }
        }
      }
    },
    [
      platformAPI,
      setSelectedNode,
      setNodeLabel,
      setSelectedModuleId,
      setNodeScript,
    ],
  );

  const addHookNode = useCallback(
    (blocking: boolean) => {
      const newNode: WorkflowNode = {
        id: `hook-${Date.now()}`,
        type: "hook",
        position: { x: 300, y: 100 + nodes.length * 50 },
        data: {
          label: blocking ? "Synchronous Hook" : "Fire-and-Forget Hook",
          hook: {
            id: `hook-${Date.now()}`,
            blocking,
          },
        },
      };
      addNode(newNode);
    },
    [nodes.length, addNode],
  );

  const createWorkflowDefinition = useCallback(
    (enabled = true): WorkflowDefinition => ({
      id: workflow?.id || `workflow-${Date.now()}`,
      name: workflow?.name || "New Workflow",
      description: workflow?.description,
      workflowType,
      nodes: nodes as WorkflowNode[],
      edges: edges as WorkflowEdge[],
      enabled,
      createdAt: workflow?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }),
    [nodes, edges, workflow, workflowType],
  );

  const handleSave = useCallback(() => {
    onSave(createWorkflowDefinition(workflow?.enabled ?? true));
  }, [createWorkflowDefinition, workflow?.enabled, onSave]);

  // Load user modules when component mounts or when module manager closes
  React.useEffect(() => {
    platformAPI.workflows.hooks.list().then(setUserModules);
  }, [moduleManagerOpen, platformAPI, setUserModules]);

  return (
    <div className="h-full w-full flex flex-col bg-muted/20">
      <div className="flex items-center justify-between p-4 px-6 border-b bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-bold">
            {workflow?.name || "New Workflow"}
          </h2>
          <select
            className="px-4 py-1.5 border rounded-full text-sm font-medium bg-background border-muted hover:border-primary/30 transition-all outline-none"
            value={workflowType}
            onChange={(e) =>
              setWorkflowType(e.target.value as "tools/list" | "tools/call")
            }
          >
            <option value="tools/list">Tools List</option>
            <option value="tools/call">Tools Call</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            variant="default"
            size="sm"
            className="rounded-full px-6 shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes as Node[]}
          edges={edges as Edge[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Strict}
          defaultEdgeOptions={defaultEdgeOptions}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="#cbd5e1"
          />

          <Panel
            position="top-left"
            className="flex gap-3 p-3 bg-background/80 backdrop-blur-md rounded-2xl shadow-xl border border-primary/10"
          >
            <Button
              onClick={() => addHookNode(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 rounded-full border-muted-foreground/20 hover:border-primary/50 transition-all"
            >
              <Plus className="w-4 h-4" />
              Synchronous Hook
            </Button>
            <Button
              onClick={() => addHookNode(false)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 rounded-full border-muted-foreground/20 hover:border-primary/50 transition-all"
            >
              <Plus className="w-4 h-4" />
              Fire-and-Forget Hook
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && selectedNode.type === "hook" && (
        <div className="p-6 border-t bg-background/80 backdrop-blur-xl rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-primary/5 z-20">
          {/* Header and buttons */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Plus className="w-6 h-6" />
              </div>
              <Input
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                className="w-80 rounded-full px-6 border-transparent bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Enter hook name"
              />
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full px-6"
                onClick={() => {
                  // Revert to original values
                  if (selectedNode) {
                    const label = selectedNode.data?.label;
                    setNodeLabel(typeof label === "string" ? label : "");
                    const hook = selectedNode.data?.hook as
                      | WorkflowHook
                      | undefined;
                    if (
                      hook &&
                      typeof hook === "object" &&
                      hook.script !== undefined
                    ) {
                      const script = hook.script;
                      setNodeScript(typeof script === "string" ? script : "");
                    }
                  }
                  // Close editing area
                  setSelectedNode(null);
                  setSelectedModuleId("");
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                className="rounded-full px-8 shadow-md shadow-primary/20"
                onClick={() => {
                  // Apply current edits
                  const updatedNodes = nodes.map((node: WorkflowNode) => {
                    if (node.id === selectedNode.id) {
                      let updatedHook = node.data?.hook;
                      if (updatedHook) {
                        if (selectedModuleId === "custom") {
                          // Inline Script case
                          updatedHook = {
                            ...updatedHook,
                            hookModuleId: undefined,
                            script: nodeScript,
                          };
                        } else if (
                          selectedModuleId &&
                          selectedModuleId !== "manage"
                        ) {
                          // Referencing a HookModule
                          updatedHook = {
                            ...updatedHook,
                            hookModuleId: selectedModuleId,
                            script: undefined,
                          };
                        }
                      }

                      return {
                        ...node,
                        data: {
                          ...node.data,
                          label: nodeLabel,
                          hook: updatedHook,
                        },
                      };
                    }
                    return node;
                  });
                  setNodes(updatedNodes);
                  // Close editing area
                  setSelectedNode(null);
                  setSelectedModuleId("");
                }}
              >
                <Check className="w-4 h-4 mr-2" />
                Apply
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Module selection */}
            <div className="md:col-span-4 space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="hook-module"
                  className="text-sm font-bold ml-2 text-muted-foreground uppercase tracking-wider"
                >
                  Hook Module
                </Label>
                <Select
                  value={selectedModuleId}
                  onValueChange={(value) => {
                    setSelectedModuleId(value);
                    if (value !== "custom" && value !== "manage") {
                      const module = userModules.find((m) => m.id === value);
                      if (module) {
                        setNodeScript(module.script);
                        setNodeLabel(module.name);
                      }
                    } else if (value === "custom") {
                      // Switch to Inline Script mode
                      setNodeScript("");
                    } else if (value === "manage") {
                      setModuleManagerOpen(true);
                      // Reset to previous value
                      setSelectedModuleId(selectedModuleId);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-full h-12 px-6 bg-muted/30 border-transparent">
                    <SelectValue placeholder="Select a hook module" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="custom" className="rounded-lg">
                      Inline Script
                    </SelectItem>
                    {userModules.map((module) => (
                      <SelectItem
                        key={module.id}
                        value={module.id}
                        className="rounded-lg"
                      >
                        <div className="font-medium">{module.name}</div>
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="manage"
                      className="font-bold text-primary rounded-lg"
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Manage Modules
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hooks allow you to intercept and modify MCP requests and
                  responses using custom JavaScript logic.
                </p>
              </div>
            </div>

            {/* Custom script editing */}
            <div className="md:col-span-8 space-y-2">
              <Label
                htmlFor="hook-script"
                className="text-sm font-bold ml-2 text-muted-foreground uppercase tracking-wider"
              >
                {selectedModuleId === "custom"
                  ? "Inline Script"
                  : "Module Preview"}
              </Label>
              <div className="rounded-2xl overflow-hidden border border-muted shadow-inner bg-muted/20">
                <HookModuleEditor
                  value={nodeScript}
                  onChange={(value) => setNodeScript(value)}
                  height="300px"
                  placeholder="// Enter JavaScript code here\n// context object is available with request and response data"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hook Module Manager Dialog */}
      <HookModuleManager
        open={moduleManagerOpen}
        onOpenChange={setModuleManagerOpen}
        onModuleSelect={(moduleId) => {
          setSelectedModuleId(moduleId);
          const module = userModules.find((m) => m.id === moduleId);
          if (module) {
            setNodeScript(module.script);
            setNodeLabel(module.name);
          }
        }}
      />
    </div>
  );
}
