"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, FileText, Archive, CheckCircle2, AlertTriangle, LoaderCircle, Info, MoreVertical, Copy, Plus, Trash2, Edit } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { apiClient } from "@/services/api-client";

interface DashboardProps {
  onEdit: (id: string) => void;
  onCreateNew: () => void;
}

export function AutomationDashboard({ onEdit, onCreateNew }: DashboardProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-automations-list"],
    queryFn: async () => {
      const response = await apiClient.get("/api/automations/");
      return response.data;
    },
  });

  const workflows = Array.isArray(data) ? data : (data?.results || []);

  // Derived statistics (mocking some metrics for the dashboard feel)
  const activeCount = workflows.filter((w: any) => w.status === "PUBLISHED" || w.status === "VALIDATED").length;
  const draftCount = workflows.filter((w: any) => w.status === "DRAFT").length;
  const pausedCount = workflows.filter((w: any) => w.status === "PAUSED").length;
  const archivedCount = workflows.filter((w: any) => w.status === "ARCHIVED").length;

  const executionData = [
    { name: "Successful", value: 982, color: "#10b981" },
    { name: "Failed", value: 143, color: "#f43f5e" },
    { name: "In Progress", value: 120, color: "#f59e0b" }
  ];

  const successRateData = [
    { name: "May 6", rate: 70 },
    { name: "May 13", rate: 85 },
    { name: "May 20", rate: 82 },
    { name: "May 27", rate: 91 },
    { name: "Jun 3", rate: 92.4 }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Workflow Automation</h1>
          <p className="mt-1 text-sm text-slate-500">Create powerful workflows to automate your marketing and business processes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="secondary-button px-5">
            Import Workflow
          </button>
          <button onClick={onCreateNew} className="primary-button px-5 gap-2">
            <Plus size={16} /> Create Workflow
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="sa-card p-4 flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><CheckCircle2 size={24}/></div>
          <div><p className="text-sm font-semibold text-slate-500">Total Workflows</p><h2 className="text-2xl font-black">{workflows.length}</h2></div>
        </div>
        <div className="sa-card p-4 flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Play size={24}/></div>
          <div><p className="text-sm font-semibold text-slate-500">Active</p><h2 className="text-2xl font-black">{activeCount}</h2></div>
        </div>
        <div className="sa-card p-4 flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Pause size={24}/></div>
          <div><p className="text-sm font-semibold text-slate-500">Paused</p><h2 className="text-2xl font-black">{pausedCount}</h2></div>
        </div>
        <div className="sa-card p-4 flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={24}/></div>
          <div><p className="text-sm font-semibold text-slate-500">Draft</p><h2 className="text-2xl font-black">{draftCount}</h2></div>
        </div>
        <div className="sa-card p-4 flex items-start gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl"><Archive size={24}/></div>
          <div><p className="text-sm font-semibold text-slate-500">Archived</p><h2 className="text-2xl font-black">{archivedCount}</h2></div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="sa-card p-5">
          <h3 className="font-bold mb-4">Execution Summary (Today)</h3>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={executionData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {executionData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-2xl font-black">1,245</span>
              <span className="text-xs text-slate-500">Total</span>
            </div>
          </div>
        </div>
        
        <div className="sa-card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Success Rate</h3>
            <span className="text-2xl font-black">92.4% <span className="text-sm text-emerald-500 font-semibold">↑ 6.3%</span></span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={successRateData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={3} dot={{r: 4, fill: "#6366f1"}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Row */}
      <div className="sa-card">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold">All Workflows</h3>
        </div>
        
        {isLoading ? (
          <div className="p-10 flex justify-center"><LoaderCircle className="animate-spin text-blue-500" /></div>
        ) : workflows.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No workflows found. Create your first automation!
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last Edited</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workflows.map((wf: any) => (
                <tr key={wf.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onEdit(wf.id)}>
                  <td className="px-5 py-4 font-bold text-slate-900">{wf.name}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                      wf.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' :
                      wf.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {wf.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{new Date(wf.updated_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-indigo-600" title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(wf.id); }}>
                        <Edit size={16} />
                      </button>
                      {wf.status === 'PUBLISHED' ? (
                        <button className="p-2 hover:bg-amber-100 rounded-lg text-slate-400 hover:text-amber-600" title="Pause" onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await apiClient.post(`/api/automations/${wf.id}/pause/`);
                            queryClient.invalidateQueries({ queryKey: ["admin-automations-list"] });
                          } catch (err) { console.error(err); }
                        }}>
                          <Pause size={16} />
                        </button>
                      ) : (
                        <button className="p-2 hover:bg-emerald-100 rounded-lg text-slate-400 hover:text-emerald-600" title="Publish" onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await apiClient.post(`/api/automations/${wf.id}/publish/`);
                            queryClient.invalidateQueries({ queryKey: ["admin-automations-list"] });
                          } catch (err) { alert("Cannot publish invalid workflow."); }
                        }}>
                          <Play size={16} />
                        </button>
                      )}
                      <button className="p-2 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-600" title="Delete" onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this workflow?")) {
                          try {
                            await apiClient.delete(`/api/automations/${wf.id}/`);
                            queryClient.invalidateQueries({ queryKey: ["admin-automations-list"] });
                          } catch (err) { console.error(err); }
                        }
                      }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
