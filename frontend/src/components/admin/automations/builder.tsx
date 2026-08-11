"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  useOnSelectionChange,
  Controls,
  Background,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Save, Play } from "lucide-react";
import { AutomationSidebar } from "./sidebar";
import { TriggerNode, ActionNode, ConditionNode, UtilityNode } from "./custom-nodes";
import { NodeConfigPanel } from "./node-config";

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  utilityNode: UtilityNode,
};

export function AutomationBuilder({ automationId }: { automationId: string }) {
  return (
    <ReactFlowProvider>
      <AutomationBuilderContent automationId={automationId} />
    </ReactFlowProvider>
  );
}

function AutomationBuilderContent({ automationId }: { automationId: string }) {
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(320); // 320px = w-80

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // delta is startX - currentX because sidebar is on the right
      // moving mouse left (smaller X) means wider sidebar
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 250), 800);
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.classList.remove('select-none'); // Optional: re-enable text selection
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.classList.add('select-none'); // Prevent text selection while dragging
  }, [sidebarWidth]);

  useOnSelectionChange({
    onChange: ({ nodes }) => {
      setSelectedNode(nodes.length === 1 ? nodes[0] : null);
    },
  });

  const handleUpdateNode = useCallback((id: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          node.data = { ...node.data, ...data };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowInstance) return;

      const typeData = event.dataTransfer.getData("application/reactflow");
      if (!typeData) return;

      const { nodeType, actionName, label } = JSON.parse(typeData);
      
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: nodeType,
        position,
        data: { actionName, label },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  return (
    <div className="h-[calc(100vh-80px)] -m-6 bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/admin/automations")} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="font-bold text-slate-900">
              {automationId === "new" ? "New Automation Workflow" : "Edit Workflow"}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="secondary-button gap-2">
            <Play size={16} /> Test Workflow
          </button>
          <button className="primary-button gap-2">
            <Save size={16} /> Save & Publish
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        <AutomationSidebar />
        <div className="flex-1 relative h-full" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              proOptions={{ hideAttribution: true }}
              fitView
            >
              <Background gap={16} size={1} />
              <Controls />
            </ReactFlow>
          </div>
          <div 
            className="flex-shrink-0 relative bg-white border-l border-slate-200 shadow-lg z-10 flex flex-col h-full"
            style={{ width: sidebarWidth }}
          >
            {/* Resizer Handle */}
            <div 
              onMouseDown={startResizing}
              className="absolute left-0 top-0 bottom-0 w-1.5 -ml-[0.75px] cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-20 group"
              title="Drag to resize"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-col gap-0.5">
                  <div className="w-0.5 h-1 bg-white rounded-full"></div>
                  <div className="w-0.5 h-1 bg-white rounded-full"></div>
                  <div className="w-0.5 h-1 bg-white rounded-full"></div>
                </div>
              </div>
            </div>

            {selectedNode ? (
              <NodeConfigPanel 
                selectedNode={selectedNode} 
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onClose={() => setSelectedNode(null)}
              />
            ) : (
              <div className="p-4">
                <h3 className="font-bold text-sm text-slate-900 mb-4">Node Configuration</h3>
                <p className="text-sm text-slate-500">Select a node on the canvas to configure its settings.</p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
