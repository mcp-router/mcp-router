import { create } from "zustand";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from "@mcp_router/shared";

export interface WorkflowStoreState {
  // Workflow state
  workflows: WorkflowDefinition[];
  selectedWorkflow: WorkflowDefinition | null;
  isEditing: boolean;
  activeTab: "workflows" | "modules";

  // Workflow Editor state
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNode: WorkflowNode | null;
  nodeScript: string;
  nodeLabel: string;
  selectedModuleId: string;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

export interface WorkflowStoreActions {
  // Workflow management actions
  setWorkflows: (workflows: WorkflowDefinition[]) => void;
  setSelectedWorkflow: (workflow: WorkflowDefinition | null) => void;
  setIsEditing: (isEditing: boolean) => void;
  setActiveTab: (tab: "workflows" | "modules") => void;
  addWorkflow: (workflow: WorkflowDefinition) => void;
  updateWorkflow: (id: string, updates: Partial<WorkflowDefinition>) => void;
  removeWorkflow: (id: string) => void;

  // Workflow Editor actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  setSelectedNode: (node: WorkflowNode | null) => void;
  setNodeScript: (script: string) => void;
  setNodeLabel: (label: string) => void;
  setSelectedModuleId: (moduleId: string) => void;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;

  // Loading and error actions
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Utility actions
  resetEditorState: () => void;
  resetStore: () => void;
}

export type WorkflowStore = WorkflowStoreState & WorkflowStoreActions;

const initialState: WorkflowStoreState = {
  workflows: [],
  selectedWorkflow: null,
  isEditing: false,
  activeTab: "workflows",
  nodes: [],
  edges: [],
  selectedNode: null,
  nodeScript: "",
  nodeLabel: "",
  selectedModuleId: "",
  isLoading: false,
  error: null,
};

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  ...initialState,

  // Workflow management actions
  setWorkflows: (workflows) => set({ workflows }),
  setSelectedWorkflow: (workflow) => set({ selectedWorkflow: workflow }),
  setIsEditing: (isEditing) => set({ isEditing }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  addWorkflow: (workflow) =>
    set((state) => ({
      workflows: [...state.workflows, workflow],
    })),

  updateWorkflow: (id, updates) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
      selectedWorkflow:
        state.selectedWorkflow?.id === id
          ? { ...state.selectedWorkflow, ...updates }
          : state.selectedWorkflow,
    })),

  removeWorkflow: (id) =>
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
      selectedWorkflow:
        state.selectedWorkflow?.id === id ? null : state.selectedWorkflow,
    })),

  // Workflow Editor actions
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setNodeScript: (script) => set({ nodeScript: script }),
  setNodeLabel: (label) => set({ nodeLabel: label }),
  setSelectedModuleId: (moduleId) => set({ selectedModuleId: moduleId }),

  updateNode: (nodeId, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n,
      ),
      selectedNode:
        state.selectedNode?.id === nodeId
          ? { ...state.selectedNode, ...updates }
          : state.selectedNode,
    })),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      selectedNode:
        state.selectedNode?.id === nodeId ? null : state.selectedNode,
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  removeEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    })),

  // Loading and error actions
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Utility actions
  resetEditorState: () =>
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
      nodeScript: "",
      nodeLabel: "",
      selectedModuleId: "",
    }),

  resetStore: () => set(initialState),
}));
