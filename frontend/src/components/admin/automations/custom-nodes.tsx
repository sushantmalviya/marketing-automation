import { Handle, Position } from "@xyflow/react";
import { PlayCircle, Mail, MessageSquare, Tag, Clock, Zap, Target, GitBranch } from "lucide-react";

// Helper to pick icons based on the node action name
const getIcon = (actionName: string) => {
  if (actionName.includes("Email")) return <Mail size={16} />;
  if (actionName.includes("WhatsApp") || actionName.includes("SMS")) return <MessageSquare size={16} />;
  if (actionName.includes("Wait") || actionName.includes("Delay")) return <Clock size={16} />;
  if (actionName.includes("Tag")) return <Tag size={16} />;
  if (actionName.includes("Condition")) return <GitBranch size={16} />;
  if (actionName.includes("Trigger")) return <PlayCircle size={16} />;
  return <Zap size={16} />;
};

export function TriggerNode({ data }: { data: any }) {
  return (
    <div className="w-64 bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
      <div className="bg-emerald-50 p-3 flex items-center gap-3 border-b border-emerald-100">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
          {getIcon(data.action_name || "Trigger")}
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-800">{data.label}</h4>
          <p className="text-xs text-slate-500">Trigger</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-white" />
    </div>
  );
}

export function ActionNode({ data }: { data: any }) {
  return (
    <div className="w-64 bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500 border-2 border-white" />
      <div className="bg-indigo-50 p-3 flex items-center gap-3 border-b border-indigo-100">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
          {getIcon(data.action_name || "Action")}
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-800">{data.label}</h4>
          <p className="text-xs text-slate-500">Action</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-white" />
    </div>
  );
}

export function ConditionNode({ data }: { data: any }) {
  return (
    <div className="w-64 bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white" />
      <div className="bg-blue-50 p-3 flex items-center gap-3 border-b border-blue-100">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          <GitBranch size={16} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-800">{data.label}</h4>
          <p className="text-xs text-slate-500">Condition</p>
        </div>
      </div>
      {/* For conditions, we typically have a YES and NO path. */}
      <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-emerald-500 border-2 border-white -ml-8" />
      <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-rose-500 border-2 border-white ml-8" />
    </div>
  );
}

export function UtilityNode({ data }: { data: any }) {
  return (
    <div className="w-64 bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-white" />
      <div className="bg-amber-50 p-3 flex items-center gap-3 border-b border-amber-100">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
          {getIcon(data.action_name || "Utility")}
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-800">{data.label}</h4>
          <p className="text-xs text-slate-500">Utility</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500 border-2 border-white" />
    </div>
  );
}
