import { PlayCircle, Mail, MessageSquare, Tag, Clock, Globe, Target, UserPlus, FileText } from "lucide-react";

export function AutomationSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, actionName: string, label: string) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify({ nodeType, actionName, label }));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-full overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <input type="text" placeholder="Search nodes..." className="sa-input w-full text-sm py-2" />
      </div>

      <div className="p-4 space-y-6">
        
        {/* Triggers */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Triggers</h3>
          <div className="space-y-2">
            <div 
              className="flex items-center gap-3 p-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg cursor-grab hover:bg-emerald-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "triggerNode", "ContactAdded", "New Contact Added")}
              draggable
            >
              <UserPlus size={16} /> New Contact Added
            </div>
            <div 
              className="flex items-center gap-3 p-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg cursor-grab hover:bg-emerald-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "triggerNode", "FormSubmitted", "Form Submitted")}
              draggable
            >
              <FileText size={16} /> Form Submitted
            </div>
          </div>
        </div>

        {/* Actions */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Actions</h3>
          <div className="space-y-2">
            <div 
              className="flex items-center gap-3 p-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg cursor-grab hover:bg-indigo-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "actionNode", "SendEmail", "Send Email")}
              draggable
            >
              <Mail size={16} /> Send Email
            </div>
            <div 
              className="flex items-center gap-3 p-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg cursor-grab hover:bg-indigo-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "actionNode", "SendSMS", "Send SMS")}
              draggable
            >
              <MessageSquare size={16} /> Send SMS
            </div>
            <div 
              className="flex items-center gap-3 p-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg cursor-grab hover:bg-indigo-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "actionNode", "SendWhatsApp", "Send WhatsApp")}
              draggable
            >
              <MessageSquare size={16} /> Send WhatsApp
            </div>
            <div 
              className="flex items-center gap-3 p-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg cursor-grab hover:bg-indigo-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "actionNode", "UpdateContact", "Update Contact")}
              draggable
            >
              <Target size={16} /> Update Contact
            </div>
          </div>
        </div>

        {/* Utilities */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Utilities</h3>
          <div className="space-y-2">
            <div 
              className="flex items-center gap-3 p-2 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg cursor-grab hover:bg-amber-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "utilityNode", "Delay", "Wait for X Days")}
              draggable
            >
              <Clock size={16} /> Delay
            </div>
            <div 
              className="flex items-center gap-3 p-2 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg cursor-grab hover:bg-amber-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "utilityNode", "SendToCRM", "Push to CRM")}
              draggable
            >
              <Globe size={16} /> Push to CRM
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Conditions</h3>
          <div className="space-y-2">
            <div 
              className="flex items-center gap-3 p-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg cursor-grab hover:bg-blue-100 transition text-sm font-semibold"
              onDragStart={(event) => onDragStart(event, "conditionNode", "ConditionSplit", "Condition Split")}
              draggable
            >
              <PlayCircle size={16} /> Condition Split
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
}
