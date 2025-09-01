import React, { useCallback, useState } from "react";
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
  Textarea,
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

export default function WorkflowEditor({
  workflow,
  onSave,
}: WorkflowEditorProps) {
  const platformAPI = usePlatformAPI();
  const [workflowType, setWorkflowType] = useState<"tools/list" | "tools/call">(
    workflow?.workflowType || "tools/list",
  );

  const initialNodes: Node[] = workflow?.nodes || [
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

  const initialEdges: Edge[] = (workflow?.edges || []).map((edge) => ({
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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeScript, setNodeScript] = useState<string>("");
  const [nodeLabel, setNodeLabel] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("custom");
  const [userModules, setUserModules] = useState<HookModule[]>([]);
  const [moduleManagerOpen, setModuleManagerOpen] = useState(false);

  const validateConnection = useCallback(
    (params: Connection): boolean => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      // Fire-and-forget hooks cannot have outgoing connections
      if (sourceNode?.type === "hook") {
        const hook = sourceNode.data?.hook as WorkflowHook | undefined;
        if (hook && typeof hook === "object" && hook.blocking === false) {
          return false;
        }
      }

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
        type: "default",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [validateConnection, setEdges],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    // ノードのラベルを設定
    const label = node.data?.label;
    setNodeLabel(typeof label === "string" ? label : "");
    // Hookノードの場合、hookオブジェクトからスクリプトを設定
    if (node.type === "hook") {
      const hook = node.data?.hook as WorkflowHook | undefined;
      if (hook && typeof hook === "object" && hook.script !== undefined) {
        const script = hook.script;
        setNodeScript(typeof script === "string" ? script : "");

        // Check if script matches any user module
        platformAPI.workflows.hooks.list().then((modules: HookModule[]) => {
          const matchedModule = modules.find(
            (module: HookModule) => module.script === script,
          );
          setSelectedModuleId(matchedModule ? matchedModule.id : "custom");
        });
      }
    }
  }, []);

  const addHookNode = useCallback(
    (blocking: boolean) => {
      const newNode: Node = {
        id: `hook-${Date.now()}`,
        type: "hook",
        position: { x: 300, y: 100 + nodes.length * 50 },
        data: {
          label: blocking ? "Synchronous Hook" : "Fire-and-Forget Hook",
          hook: {
            id: `hook-${Date.now()}`,
            script: "",
            blocking,
          },
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes.length, setNodes],
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
  }, [moduleManagerOpen]);

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
          nodes={nodes}
          edges={edges}
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
                  setSelectedModuleId("custom");
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
                  setNodes((nds) =>
                    nds.map((node) => {
                      if (node.id === selectedNode.id) {
                        const updatedHook = node.data?.hook
                          ? {
                              ...node.data.hook,
                              script: nodeScript,
                            }
                          : undefined;

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
                    }),
                  );
                  // 編集領域を閉じる
                  setSelectedNode(null);
                  setSelectedModuleId("custom");
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
                    <SelectItem value="custom">
                      Custom Script (Inline)
                    </SelectItem>
                    {userModules.length > 0 && (
                      <div className="px-2 py-1 text-xs text-gray-500 font-semibold">
                        Your Modules
                      </div>
                    )}
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
                  Custom Script
                </Label>
                <Textarea
                  id="hook-script"
                  value={nodeScript}
                  onChange={(e) => setNodeScript(e.target.value)}
                  placeholder="// Enter JavaScript code here\n// context object is available with request and response data"
                  className="mt-1 w-full h-40 font-mono text-xs"
                />
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
