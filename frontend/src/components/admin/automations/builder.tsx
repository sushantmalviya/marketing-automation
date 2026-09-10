"use client";

import { useCallback, useRef, useState, useEffect } from "react";
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
import { ArrowLeft, Save, Play, Pause } from "lucide-react";
import { AutomationSidebar } from "./sidebar";
import { TriggerNode, ActionNode, ConditionNode, UtilityNode } from "./custom-nodes";
import { NodeConfigPanel } from "./node-config";
import { apiClient } from "@/services/api-client";

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
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [workflowName, setWorkflowName] = useState(automationId === "new" ? "New Automation Workflow" : "Loading...");
  const [workflowStatus, setWorkflowStatus] = useState<string>("DRAFT");

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

  useEffect(() => {
    if (automationId && automationId !== "new") {
      apiClient.get(`/api/automations/${automationId}/`)
        .then((res) => {
          if (res.data.name) {
            setWorkflowName(res.data.name);
          }
          if (res.data.status) {
            setWorkflowStatus(res.data.status);
          }
          const graph = res.data.workflow_graph;
          if (graph) {
            setNodes(graph.nodes || []);
            setEdges(graph.edges || []);
          }
        })
        .catch((err) => {
          console.error("Failed to load workflow graph", err);
        });
    }
  }, [automationId, setNodes, setEdges]);

  const handleSaveDraft = async () => {
    try {
      if (automationId === "new") {
        const res = await apiClient.post(`/api/automations/`, {
          name: workflowName,
          workflow_graph: { nodes, edges }
        });
        alert("Draft saved successfully!");
        router.push(`/admin/automations/${res.data.id}`);
      } else {
        await apiClient.patch(`/api/automations/${automationId}/`, {
          name: workflowName,
          workflow_graph: { nodes, edges }
        });
        alert("Draft saved successfully!");
      }
    } catch (err) {
      console.error("Failed to save workflow graph", err);
      alert("Failed to save workflow.");
    }
  };

  const handleTest = async () => {
    if (automationId === "new") {
      alert("Please save the workflow first before testing.");
      return;
    }
    setShowTestModal(true);
  };

  const executeTest = async () => {
    try {
      await apiClient.post(`/api/automations/${automationId}/execute/`, {
        context: {
          contact: {
            email: testEmail,
            phone_no: testPhone,
          }
        }
      });
      alert("Test execution started successfully!");
      setShowTestModal(false);
    } catch (err) {
      console.error("Failed to execute test", err);
      alert("Failed to execute test.");
    }
  };

  const handlePublish = async () => {
    if (automationId === "new") return;
    try {
      await apiClient.patch(`/api/automations/${automationId}/`, {
        name: workflowName,
        workflow_graph: { nodes, edges }
      });
      await apiClient.post(`/api/automations/${automationId}/publish/`);
      setWorkflowStatus("PUBLISHED");
      alert("Workflow published successfully! Triggers are now Live.");
    } catch (err: any) {
      console.error("Failed to publish workflow", err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to publish workflow. Ensure your workflow has valid trigger and action nodes.";
      alert(msg);
    }
  };

  const handlePause = async () => {
    if (automationId === "new") return;
    try {
      await apiClient.post(`/api/automations/${automationId}/pause/`);
      setWorkflowStatus("PAUSED");
      alert("Workflow paused. Triggers will not run while paused.");
    } catch (err: any) {
      console.error("Failed to pause workflow", err);
      alert("Failed to pause workflow.");
    }
  };

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
          <div className="flex items-center gap-3">
            <input 
              type="text" 
              className="font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors px-1 py-0.5"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow Name"
            />
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              workflowStatus === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" :
              workflowStatus === "PAUSED" ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-700"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                workflowStatus === "PUBLISHED" ? "bg-emerald-500 animate-pulse" :
                workflowStatus === "PAUSED" ? "bg-amber-500" :
                "bg-slate-400"
              }`} />
              {workflowStatus === "PUBLISHED" ? "Live / Active" : workflowStatus === "PAUSED" ? "Off / Paused" : "Draft"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="secondary-button gap-2" onClick={handleTest}>
            <Play size={16} /> Test
          </button>
          <button className="secondary-button gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent" onClick={handleSaveDraft}>
            <Save size={16} /> Save Draft
          </button>
          {workflowStatus === "PUBLISHED" ? (
            <button className="secondary-button gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200" onClick={handlePause}>
              <Pause size={16} /> Pause (Turn Off)
            </button>
          ) : (
            <button className="primary-button gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handlePublish}>
              <Save size={16} /> Publish (Turn Live)
            </button>
          )}
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
      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Execute Test Run</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test Email Address</label>
                <input 
                  type="email" 
                  className="sa-input w-full"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test Phone Number</label>
                <input 
                  type="text" 
                  className="sa-input w-full"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button className="secondary-button" onClick={() => setShowTestModal(false)}>Cancel</button>
              <button className="primary-button bg-indigo-600 text-white" onClick={executeTest}>Run Test</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
