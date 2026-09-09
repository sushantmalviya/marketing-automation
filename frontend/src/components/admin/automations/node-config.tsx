import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { Trash2, X, Plus, Settings2, Tag, FileText, RefreshCw, GripVertical, User, Mail, Phone, Info, ChevronDown } from "lucide-react";
import { TemplatePickerModal } from "@/components/modules/template-picker";
import { AnimatePresence } from "framer-motion";

interface NodeConfigProps {
  selectedNode: any;
  onUpdateNode: (id: string, data: any) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ selectedNode, onUpdateNode, onDeleteNode, onClose }: NodeConfigProps) {
  const [formData, setFormData] = useState<any>(selectedNode.data || {});

  useEffect(() => {
    setFormData(selectedNode.data || {});
  }, [selectedNode]);

  const handleChange = (key: string, value: any) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    onUpdateNode(selectedNode.id, updated);
  };

  const handleBatchChange = (updates: any) => {
    const updated = { ...formData, ...updates };
    setFormData(updated);
    onUpdateNode(selectedNode.id, updated);
  };

  const renderConfig = () => {
    const actionName = selectedNode.data?.actionName;

    if (actionName === "Delay") {
      return (
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Delay Amount</label>
            <input 
              type="number" 
              className="sa-input w-full"
              value={formData.delayAmount || 1}
              onChange={(e) => handleChange("delayAmount", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Time Unit</label>
            <select 
              className="sa-input w-full"
              value={formData.timeUnit || "Days"}
              onChange={(e) => handleChange("timeUnit", e.target.value)}
            >
              <option value="Minutes">Minutes</option>
              <option value="Hours">Hours</option>
              <option value="Days">Days</option>
              <option value="Weeks">Weeks</option>
            </select>
          </div>
        </div>
      );
    }

    if (actionName === "SendEmail") {
      return <SendEmailConfig formData={formData} onChange={handleChange} />;
    }

    if (actionName === "SendSMS") {
      return <SendSMSConfig formData={formData} onChange={handleChange} />;
    }

    if (actionName === "SendWhatsApp") {
      return <SendWhatsAppConfig formData={formData} onChange={handleChange} />;
    }

    if (actionName === "SendToCRM") {
      return (
        <div className="space-y-4 mt-4">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700">
            <p className="font-semibold mb-1">Automatic CRM Sync</p>
            <p>This node automatically pushes the contact's details (Name, Email, Phone, Tags) to our internal CRM as a new Lead.</p>
            <p className="mt-2 text-xs opacity-80">No further technical configuration is required.</p>
          </div>
        </div>
      );
    }

    if (actionName === "UpdateContact") {
      return (
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Add Tag</label>
            <input 
              type="text" 
              placeholder="e.g. interested, lead"
              className="sa-input w-full"
              value={formData.addTag || ""}
              onChange={(e) => handleChange("addTag", e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">Type a new tag or select an existing one.</p>
          </div>
        </div>
      );
    }

    if (actionName === "ContactAdded") {
      return <ContactTriggerConfig formData={formData} onChange={handleChange} onBatchChange={handleBatchChange} />;
    }

    if (actionName === "FormSubmitted") {
      return <FormTriggerConfig formData={formData} onChange={handleChange} onBatchChange={handleBatchChange} />;
    }

    if (actionName === "ConditionSplit") {
      return (
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
            <select className="sa-input w-full" value={formData.channel || "email"} onChange={(e) => handleChange("channel", e.target.value)}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
            <select className="sa-input w-full" value={formData.eventType || "opened"} onChange={(e) => handleChange("eventType", e.target.value)}>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened / Read</option>
              <option value="clicked">Clicked</option>
              <option value="replied">Replied</option>
              <option value="bounced">Bounced / Failed</option>
            </select>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="block text-sm font-medium text-slate-700 mb-1">Wait up to (Days)</label>
            <input 
              type="number" 
              className="sa-input w-full"
              min="0"
              value={formData.waitDays ?? 2}
              onChange={(e) => handleChange("waitDays", e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-2">The automation will wait up to this many days for the event to happen before proceeding down the "No" path. Enter 0 to check instantly.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 mt-4 bg-slate-50 rounded-lg text-sm text-slate-500">
        No configuration available for this node type yet.
      </div>
    );
  };

  return (
    <div className="w-full bg-white flex flex-col h-full relative">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Settings2 size={16} />
          </div>
          <h3 className="font-bold text-lg text-slate-900">Node Configuration</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg bg-white">
          <X size={16} />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Node Label</label>
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 pointer-events-none">
              <Tag size={16} />
            </div>
            <input 
              type="text" 
              readOnly
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-14 pr-4 py-3 text-sm font-medium text-slate-500 cursor-not-allowed transition-all shadow-sm focus:outline-none"
              value={(formData.actionName === "SendToCRM" || formData.action_name === "SendToCRM" || selectedNode.data?.actionName === "SendToCRM" || selectedNode.data?.action_name === "SendToCRM") ? "Send to CRM" : (formData.label || "")}
            />
          </div>
        </div>

        {renderConfig()}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <button 
          onClick={() => onDeleteNode(selectedNode.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-xl transition"
        >
          <Trash2 size={16} /> Delete Node
        </button>
      </div>
    </div>
  );
}


// --- Specific Component for Email to fetch from backend ---

function SendEmailConfig({ formData, onChange }: { formData: any, onChange: (k: string, v: any) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      // Actually fetch templates from the backend API
      const response = await apiClient.get("/api/templates");
      return response.data;
    },
  });

  const templates = (data?.results || data || []).filter((t: any) => !t.channel_name || String(t.channel_name).toUpperCase().includes("EMAIL"));
  const mode = formData.mode || "select";
  const [showPicker, setShowPicker] = useState(false);
  
  const selectedTemplate = templates.find((t: any) => String(t.id) === String(formData.templateId));

  return (
    <div className="space-y-4 mt-4">
      {/* Mode Toggle */}
      <div className="flex p-1 bg-slate-100 rounded-lg">
        <button
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${mode === "select" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => onChange("mode", "select")}
        >
          Select Template
        </button>
        <button
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${mode === "build" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => onChange("mode", "build")}
        >
          Build Email
        </button>
      </div>

      {mode === "select" ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email Template</label>
          {isLoading ? (
            <div className="h-10 bg-slate-100 animate-pulse rounded-md w-full"></div>
          ) : (
            <>
              <button 
                type="button"
                className="sa-input w-full text-left flex items-center justify-between"
                onClick={() => setShowPicker(true)}
              >
                <span className={selectedTemplate ? "text-slate-900" : "text-slate-500 truncate block pr-2"}>
                  {selectedTemplate ? (selectedTemplate.name || selectedTemplate.subject || `Template #${selectedTemplate.id}`) : "Select a template..."}
                </span>
                <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
              </button>
              
              <AnimatePresence>
                {showPicker && (
                  <TemplatePickerModal
                    channelId={1}
                    onClose={() => setShowPicker(false)}
                    onSelect={(tpl) => {
                      onChange("templateId", String(tpl.id));
                      setShowPicker(false);
                    }}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Subject Line</label>
            <input 
              type="text" 
              className="sa-input w-full text-sm"
              placeholder="e.g. Welcome to MARKETING-AUTOMATION!"
              value={formData.customSubject || ""}
              onChange={(e) => onChange("customSubject", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email Body</label>
            <textarea 
              className="sa-input w-full text-sm h-32 resize-none"
              placeholder="Type your email content here. You can use HTML and variables like {{ contact.first_name }}..."
              value={formData.customBody || ""}
              onChange={(e) => onChange("customBody", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Specific Component for Segments/Audiences to fetch from backend ---

function ContactTriggerConfig({ formData, onChange, onBatchChange }: { formData: any, onChange: (k: string, v: any) => void, onBatchChange?: (updates: any) => void }) {
  const { data: segmentsData, isLoading: isLoadingSegments } = useQuery({
    queryKey: ["audience-segments"],
    queryFn: async () => {
      const response = await apiClient.get("/api/audiences/");
      return response.data;
    },
  });

  const { data: tagsData, isLoading: isLoadingTags } = useQuery({
    queryKey: ["audience-tags"],
    queryFn: async () => {
      const response = await apiClient.get("/api/audiences/tags/");
      return response.data;
    },
  });

  const segments = segmentsData?.results || segmentsData || [];
  const tags = tagsData || [];

  const contactFields = [
    { id: "tags", label: "Tags" },
    { id: "name", label: "Name" },
    { id: "email", label: "Email" },
    { id: "phone_no", label: "Phone Number" }
  ];

  return (
    <div className="space-y-6 mt-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Contact Segment</label>
        {isLoadingSegments ? (
          <div className="h-12 bg-slate-100 animate-pulse rounded-xl w-full"></div>
        ) : (
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-50/80 group-focus-within:bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 transition-colors pointer-events-none z-10">
              <User size={16} />
            </div>
            <select 
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-14 pr-10 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer relative"
              value={formData.enrollmentList || ""}
              onChange={(e) => {
                if (onBatchChange) {
                  onBatchChange({ enrollmentList: e.target.value, conditions: null });
                } else {
                  onChange("enrollmentList", e.target.value);
                }
              }}
            >
              <option value="">Select a segment...</option>
              <option value="all_contacts">All Contacts (Unsegmented)</option>
              {segments.map((segment: any) => (
                <option key={segment.id} value={segment.id}>{segment.name || `Segment #${segment.id}`}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10">
              <ChevronDown size={16} />
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2 border-b border-slate-100 pb-6">Choose which segment triggers this automation.</p>
      </div>

      {formData.enrollmentList && (
        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Filter by Tag (Optional)</label>
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-50/80 group-focus-within:bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 transition-colors pointer-events-none z-10">
              <Tag size={16} />
            </div>
            {isLoadingTags ? (
              <div className="h-12 bg-slate-100 animate-pulse rounded-xl w-full"></div>
            ) : (
              <select 
                className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-14 pr-10 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer relative"
                value={formData.filterTag || ""}
                onChange={(e) => onChange("filterTag", e.target.value)}
              >
                <option value="">Any Tag (No Filter)</option>
                {tags.map((tag: string) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
            {!isLoadingTags && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10">
                <ChevronDown size={16} />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">Only trigger if the new contact has this exact tag.</p>
        </div>
      )}
    </div>
  );
}

// --- Specific Component for Forms to fetch from backend ---

function FormTriggerConfig({ formData, onChange, onBatchChange }: { formData: any, onChange: (k: string, v: any) => void, onBatchChange?: (updates: any) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-forms"], // Using the same queryKey as the dashboard for caching
    queryFn: async () => {
      const response = await apiClient.get("/api/forms/");
      return response.data.results || response.data;
    },
  });

  const forms = data || [];
  const selectedForm = forms.find((f: any) => String(f.id) === String(formData.form_id));
  const formFields = selectedForm?.fields || [];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Form</label>
        {isLoading ? (
          <div className="h-12 bg-slate-100 animate-pulse rounded-xl w-full"></div>
        ) : (
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-50/80 group-focus-within:bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 transition-colors pointer-events-none z-10">
              <FileText size={16} />
            </div>
            <select 
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-14 pr-10 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer relative"
              value={formData.form_id || ""}
              onChange={(e) => {
                if (onBatchChange) {
                  onBatchChange({ form_id: e.target.value, conditions: null });
                } else {
                  onChange("form_id", e.target.value);
                }
              }}
            >
              <option value="">Select a live form...</option>
              {forms.map((form: any) => (
                <option key={form.id} value={form.id}>
                  {form.title} {form.status !== 'published' ? '(Not Published)' : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10">
              <ChevronDown size={16} />
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">Select the form that will trigger this automation when submitted.</p>
      </div>

      {formData.form_id && (
        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Allow lead to enter again?</label>
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-50/80 group-focus-within:bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 transition-colors pointer-events-none z-10">
              <RefreshCw size={16} />
            </div>
            <select 
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-14 pr-10 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer relative"
              value={formData.reentry_rule || "every_time"}
              onChange={(e) => {
                if (onBatchChange) {
                  onBatchChange({ reentry_rule: e.target.value });
                } else {
                  onChange("reentry_rule", e.target.value);
                }
              }}
            >
              <option value="every_time">Every time they submit</option>
              <option value="only_once">Only once</option>
              <option value="custom_days">Once every X days</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10">
              <ChevronDown size={16} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 mb-6 border-b border-slate-100 pb-6">Choose how often a lead can re-submit this form.</p>

          {formData.reentry_rule === "custom_days" && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Days</label>
              <input 
                type="number"
                min="1"
                className="sa-input w-full rounded-xl"
                value={formData.reentry_days || 30}
                onChange={(e) => onChange("reentry_days", e.target.value)}
              />
            </div>
          )}

          {formData.reentry_rule && formData.reentry_rule !== "every_time" && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Unique Identifier</label>
              <select 
                className="sa-input w-full rounded-xl"
                value={formData.reentry_identifier_type || "email"}
                onChange={(e) => onChange("reentry_identifier_type", e.target.value)}
              >
                <option value="email">Email</option>
                <option value="phone">Phone Number</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">This field type on the form will be used to uniquely identify the lead.</p>
            </div>
          )}
        </div>
      )}

      {formData.form_id && formFields.length > 0 && (
        <ConditionBuilder 
          conditions={formData.conditions} 
          onChange={(newConditions) => onChange("conditions", newConditions)}
          fields={formFields}
        />
      )}
    </div>
  );
}

// --- Condition Builder ---

type Rule = { id: string; field_id: string; operator: string; value: string };
type Group = { id: string; operator: "AND" | "OR"; rules: Rule[] };
type Conditions = { root_operator: "AND" | "OR"; groups: Group[] };

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" }
];

function ConditionBuilder({ conditions, onChange, fields }: { conditions: Conditions | null, onChange: (c: Conditions) => void, fields: any[] }) {
  const data: Conditions = conditions || {
    root_operator: "OR",
    groups: [
      { id: Date.now().toString(), operator: "AND", rules: [] }
    ]
  };

  const updateData = (newData: Conditions) => {
    onChange(newData);
  };

  const addGroup = () => {
    updateData({
      ...data,
      groups: [...data.groups, { id: Date.now().toString(), operator: "AND", rules: [] }]
    });
  };

  const updateGroup = (groupId: string, updates: Partial<Group>) => {
    updateData({
      ...data,
      groups: data.groups.map(g => g.id === groupId ? { ...g, ...updates } : g)
    });
  };

  const removeGroup = (groupId: string) => {
    updateData({
      ...data,
      groups: data.groups.filter(g => g.id !== groupId)
    });
  };

  const addRule = (groupId: string) => {
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return;
    
    updateGroup(groupId, {
      rules: [...group.rules, { id: Date.now().toString(), field_id: "", operator: "equals", value: "" }]
    });
  };

  const updateRule = (groupId: string, ruleId: string, updates: Partial<Rule>) => {
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return;

    updateGroup(groupId, {
      rules: group.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r)
    });
  };

  const removeRule = (groupId: string, ruleId: string) => {
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return;

    updateGroup(groupId, {
      rules: group.rules.filter(r => r.id !== ruleId)
    });
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-100">
      <div className="mb-4 flex items-center gap-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trigger Conditions (Optional)</h4>
        <Info size={14} className="text-slate-400" />
      </div>
      <p className="text-sm text-slate-500 mb-6">Only trigger this automation if the form submission matches these rules.</p>

      <div className="space-y-6">
        {data.groups.map((group, groupIndex) => (
          <div key={group.id} className="relative">
            {groupIndex > 0 && (
              <div className="flex items-center justify-center my-4 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative bg-purple-50 text-purple-600 text-xs font-bold px-4 py-1 rounded-full border border-purple-100">
                  {data.root_operator}
                </div>
              </div>
            )}
            
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] mb-4">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select 
                      value={group.operator}
                      onChange={(e) => updateGroup(group.id, { operator: e.target.value as "AND" | "OR" })}
                      className="appearance-none bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold pl-3 pr-7 py-1.5 rounded-md outline-none cursor-pointer transition-colors"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none" />
                  </div>
                  <span className="text-sm text-slate-500">
                    {group.operator === "AND" ? "All of the following must be true" : "Any of the following must be true"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => addRule(group.id)}
                    className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Condition
                  </button>
                  {data.groups.length > 1 && (
                    <button onClick={() => removeGroup(group.id)} className="text-red-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {group.rules.length === 0 ? (
                <div className="text-center py-4 text-sm text-slate-400 italic">
                  No conditions added. This group will be ignored.
                </div>
              ) : (
                <div className="space-y-3">
                  {group.rules.map(rule => (
                    <div key={rule.id} className="flex items-center gap-3 py-1 group/rule">
                      <div className="text-slate-300 cursor-grab hover:text-slate-500 px-1">
                        <GripVertical size={16} />
                      </div>
                      
                      <div className="relative flex-[2]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">
                          <User size={14} />
                        </div>
                        <select 
                          value={rule.field_id}
                          onChange={(e) => updateRule(group.id, rule.id, { field_id: e.target.value })}
                          className="w-full appearance-none bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="">Select field...</option>
                          {fields.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>

                      <div className="relative flex-[1.5]">
                        <select 
                          value={rule.operator}
                          onChange={(e) => updateRule(group.id, rule.id, { operator: e.target.value })}
                          className="w-full appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>

                      <input 
                        type="text" 
                        value={rule.value}
                        onChange={(e) => updateRule(group.id, rule.id, { value: e.target.value })}
                        disabled={rule.operator === "is_empty" || rule.operator === "is_not_empty"}
                        placeholder={rule.operator === "is_empty" || rule.operator === "is_not_empty" ? "N/A" : "Enter value"}
                        className="flex-[2] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                      />

                      <button onClick={() => removeRule(group.id, rule.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors shrink-0 opacity-0 group-hover/rule:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <button 
          onClick={addGroup}
          className="bg-white border border-indigo-200 text-indigo-600 font-medium text-sm px-4 py-2 rounded-lg hover:bg-indigo-50 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Group
        </button>
      </div>
    </div>
  );
}

// --- Specific Component for SMS to fetch from backend ---

function SendSMSConfig({ formData, onChange }: { formData: any, onChange: (k: string, v: any) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sms-templates"],
    queryFn: async () => {
      const response = await apiClient.get("/api/templates");
      return response.data.results || response.data;
    },
  });

  const templates = (data?.results || data || []).filter((t: any) => !t.channel_name || String(t.channel_name).toUpperCase().includes("SMS"));
  const mode = formData.mode || "select";
  const [showPicker, setShowPicker] = useState(false);
  
  const selectedTemplate = templates.find((t: any) => String(t.id) === String(formData.templateId));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex p-1 bg-slate-100 rounded-lg">
        <button
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${mode === "select" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => onChange("mode", "select")}
        >
          Select Template
        </button>
        <button
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${mode === "build" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => onChange("mode", "build")}
        >
          Build SMS
        </button>
      </div>

      {mode === "select" ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">SMS Template</label>
          {isLoading ? (
            <div className="h-10 bg-slate-100 animate-pulse rounded-md w-full"></div>
          ) : (
            <>
              <button 
                type="button"
                className="sa-input w-full text-left flex items-center justify-between"
                onClick={() => setShowPicker(true)}
              >
                <span className={selectedTemplate ? "text-slate-900" : "text-slate-500 truncate block pr-2"}>
                  {selectedTemplate ? (selectedTemplate.name || `Template #${selectedTemplate.id}`) : "Select a template..."}
                </span>
                <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
              </button>
              
              <AnimatePresence>
                {showPicker && (
                  <TemplatePickerModal
                    channelId={3}
                    onClose={() => setShowPicker(false)}
                    onSelect={(tpl) => {
                      onChange("templateId", String(tpl.id));
                      setShowPicker(false);
                    }}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">SMS Body</label>
            <textarea 
              className="sa-input w-full text-sm h-32 resize-none"
              placeholder="Type your SMS content here. Use variables like {{ contact.first_name }}..."
              value={formData.customBody || ""}
              onChange={(e) => onChange("customBody", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Specific Component for WhatsApp to fetch from backend ---

function SendWhatsAppConfig({ formData, onChange }: { formData: any, onChange: (k: string, v: any) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const response = await apiClient.get("/api/templates");
      return response.data.results || response.data;
    },
  });

  const templates = (data?.results || data || []).filter((t: any) => !t.channel_name || String(t.channel_name).toUpperCase().includes("WHATSAPP"));
  const mode = formData.mode || "select";
  const [showPicker, setShowPicker] = useState(false);
  
  const selectedTemplate = templates.find((t: any) => String(t.id) === String(formData.templateId));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex p-1 bg-slate-100 rounded-lg">
        <button
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${mode === "select" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => onChange("mode", "select")}
        >
          Select Template
        </button>
        <button
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition ${mode === "build" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => onChange("mode", "build")}
        >
          Build WhatsApp
        </button>
      </div>

      {mode === "select" ? (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Template</label>
          {isLoading ? (
            <div className="h-10 bg-slate-100 animate-pulse rounded-md w-full"></div>
          ) : (
            <>
              <button 
                type="button"
                className="sa-input w-full text-left flex items-center justify-between"
                onClick={() => setShowPicker(true)}
              >
                <span className={selectedTemplate ? "text-slate-900" : "text-slate-500 truncate block pr-2"}>
                  {selectedTemplate ? (selectedTemplate.name || `Template #${selectedTemplate.id}`) : "Select a template..."}
                </span>
                <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
              </button>
              
              <AnimatePresence>
                {showPicker && (
                  <TemplatePickerModal
                    channelId={2}
                    onClose={() => setShowPicker(false)}
                    onSelect={(tpl) => {
                      onChange("templateId", String(tpl.id));
                      setShowPicker(false);
                    }}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">WhatsApp Body</label>
            <textarea 
              className="sa-input w-full text-sm h-32 resize-none"
              placeholder="Type your WhatsApp content here..."
              value={formData.customBody || ""}
              onChange={(e) => onChange("customBody", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
