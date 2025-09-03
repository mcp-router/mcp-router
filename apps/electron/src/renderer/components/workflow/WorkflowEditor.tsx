import React, { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
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
  HookModule,
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

  const [localNodes, , onNodesChange] = useNodesState(nodes as Node[]);
  const [localEdges, , onEdgesChange] = useEdgesState(edges as Edge[]);

  // Sync local React Flow state with Zustand store
  useEffect(() => {
    setNodes(localNodes as WorkflowNode[]);
  }, [localNodes, setNodes]);

  useEffect(() => {
    setEdges(localEdges as WorkflowEdge[]);
  }, [localEdges, setEdges]);

  const validateConnection = useCallback(
    (params: Connection): boolean => {
      const sourceNode = nodes.find((n) => n.id === params.source);
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
      // ノードのラベルを設定
      const label = node.data?.label;
      setNodeLabel(typeof label === "string" ? label : "");
      // Hookノードの場合、hookオブジェクトから設定を読み込む
      if (node.type === "hook") {
        const hook = node.data?.hook as WorkflowHook | undefined;
        if (hook && typeof hook === "object") {
          if (hook.hookModuleId) {
            // HookModuleを参照している場合
            setSelectedModuleId(hook.hookModuleId);
            // モジュールからスクリプトを取得
            platformAPI.workflows.hooks
              .get(hook.hookModuleId)
              .then((module) => {
                if (module) {
                  setNodeScript(module.script);
                }
              });
          } else if (hook.script) {
            // Inline Scriptの場合
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
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {workflow?.name || "New Workflow"}
          </h2>
          <select
            className="px-3 py-1 border rounded-md dark:bg-gray-800 dark:border-gray-700"
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
          <Button onClick={handleSave} variant="default" size="sm">
            <Save className="w-4 h-4 mr-1" />
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
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={defaultEdgeOptions}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

          <Panel
            position="top-left"
            className="flex gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
          >
            <Button
              onClick={() => addHookNode(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Synchronous Hook
            </Button>
            <Button
              onClick={() => addHookNode(false)}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Fire-and-Forget Hook
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && selectedNode.type === "hook" && (
        <div className="p-4 border-t bg-gray-50 dark:bg-gray-900">
          {/* ヘッダーとボタン */}
          <div className="flex justify-between items-center mb-4">
            <Input
              value={nodeLabel}
              onChange={(e) => setNodeLabel(e.target.value)}
              className="w-64"
              placeholder="Enter hook name"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // 元の値に戻す
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
                  // 編集領域を閉じる
                  setSelectedNode(null);
                  setSelectedModuleId("");
                }}
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  // 現在の編集内容を適用
                  const updatedNodes = nodes.map((node: WorkflowNode) => {
                    if (node.id === selectedNode.id) {
                      let updatedHook = node.data?.hook;
                      if (updatedHook) {
                        if (selectedModuleId === "custom") {
                          // Inline Scriptの場合
                          updatedHook = {
                            ...updatedHook,
                            hookModuleId: undefined,
                            script: nodeScript,
                          };
                        } else if (
                          selectedModuleId &&
                          selectedModuleId !== "manage"
                        ) {
                          // HookModuleを参照する場合
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
                  // 編集領域を閉じる
                  setSelectedNode(null);
                  setSelectedModuleId("");
                }}
              >
                <Check className="w-3 h-3 mr-1" />
                Apply
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* モジュール選択 */}
            <div>
              <Label htmlFor="hook-module" className="text-sm font-medium">
                Hook Module
              </Label>
              <div className="flex gap-2">
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
                      // Inline Scriptモードに切り替え
                      setNodeScript("");
                    } else if (value === "manage") {
                      setModuleManagerOpen(true);
                      // Reset to previous value
                      setSelectedModuleId(selectedModuleId);
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a hook module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Inline Script</SelectItem>
                    {userModules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        <div className="font-medium">{module.name}</div>
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="manage"
                      className="font-semibold text-blue-600"
                    >
                      <Plus className="w-3 h-3 inline mr-1" />
                      Manage Modules...
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* カスタムスクリプト編集（カスタムが選択された場合のみ表示） */}
            {selectedModuleId === "custom" && (
              <div>
                <Label htmlFor="hook-script" className="text-sm font-medium">
                  Inline Script
                </Label>
                <div className="mt-1">
                  <HookModuleEditor
                    value={nodeScript}
                    onChange={(value) => setNodeScript(value)}
                    height="200px"
                    placeholder="// Enter JavaScript code here
// context object is available with request and response data"
                  />
                </div>
              </div>
            )}
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
