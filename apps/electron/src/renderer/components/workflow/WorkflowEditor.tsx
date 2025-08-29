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
  MCPHook,
} from "@mcp_router/shared";
import { Button } from "@mcp_router/ui";
import { Plus, Save, Play } from "lucide-react";
import HookNode from "./nodes/HookNode";
import StartNode from "./nodes/StartNode";
import EndNode from "./nodes/EndNode";

interface WorkflowEditorProps {
  workflow?: WorkflowDefinition;
  hooks?: MCPHook[];
  onSave: (workflow: WorkflowDefinition) => void;
  onExecute?: (workflow: WorkflowDefinition) => void;
}

const nodeTypes: NodeTypes = {
  hook: HookNode as any,
  start: StartNode as any,
  end: EndNode as any,
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
  onExecute,
}: WorkflowEditorProps) {
  const [workflowType, setWorkflowType] = useState<"tools/list" | "tools/call">(
    workflow?.workflowType || "tools/list"
  );
  
  const initialNodes: Node[] = workflow?.nodes || [
    {
      id: "start",
      type: "start",
      position: { x: 100, y: 200 },
      data: { label: "Start" },
    },
    {
      id: "end",
      type: "end",
      position: { x: 600, y: 200 },
      data: { label: "End" },
    },
  ];

  const initialEdges: Edge[] = workflow?.edges || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const validateConnection = useCallback(
    (params: Connection): boolean => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      // Fire-and-forget hooks cannot have outgoing connections
      if (sourceNode?.type === "hook" && sourceNode.data?.blocking === false) {
        return false;
      }

      // Check if target is Sync Hook or End Node - they can only have one incoming edge
      if (targetNode?.type === "end" || 
          (targetNode?.type === "hook" && targetNode.data?.blocking === true)) {
        // Count existing incoming edges to this target
        const incomingEdges = edges.filter(edge => edge.target === params.target);
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
  }, []);

  const addHookNode = useCallback(
    (blocking: boolean) => {
      const newNode: Node = {
        id: `hook-${Date.now()}`,
        type: "hook",
        position: { x: 300, y: 100 + nodes.length * 50 },
        data: {
          label: blocking ? "Synchronous Hook" : "Fire-and-Forget Hook",
          blocking,
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

  const handleExecute = useCallback(() => {
    if (!onExecute) return;
    onExecute(createWorkflowDefinition(true));
  }, [createWorkflowDefinition, onExecute]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Workflow Editor</h2>
          <select
            className="px-3 py-1 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            value={workflowType}
            onChange={(e) => setWorkflowType(e.target.value as "tools/list" | "tools/call")}
          >
            <option value="tools/list">Tools List</option>
            <option value="tools/call">Tools Call</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} variant="outline" size="sm">
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          {onExecute && (
            <Button onClick={handleExecute} variant="default" size="sm">
              <Play className="w-4 h-4 mr-1" />
              Execute
            </Button>
          )}
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

      {selectedNode && (
        <div className="p-4 border-t bg-gray-50 dark:bg-gray-900">
          <h3 className="text-sm font-semibold mb-2">Node Properties</h3>
          <div className="text-sm">
            <p>
              <strong>ID:</strong> {selectedNode.id}
            </p>
            <p>
              <strong>Type:</strong> {selectedNode.type}
            </p>
            <p>
              <strong>Label:</strong> {String(selectedNode.data?.label || "")}
            </p>
            {selectedNode.data?.blocking !== undefined && (
              <p>
                <strong>Blocking:</strong>{" "}
                {selectedNode.data?.blocking ? "Yes" : "No"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
