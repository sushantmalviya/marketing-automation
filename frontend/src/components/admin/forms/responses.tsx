import React, { useState } from "react";
import { Search, Download, Filter, Eye, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";

export function FormResponses({ formId }: { formId: string }) {
  const [search, setSearch] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<any>(null);
  const [responseToDelete, setResponseToDelete] = useState<any>(null);
  
  const queryClient = useQueryClient();

  const { data: formData } = useQuery({
    queryKey: ["admin-form", formId],
    enabled: formId !== "new" && !formId.startsWith("tmpl_")
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["form-responses", formId],
    queryFn: async () => {
      if (formId === "new" || formId.startsWith("tmpl_")) return [];
      const res = await apiClient.get(`/api/forms/${formId}/responses/`);
      return res.data.results || res.data;
    },
    enabled: formId !== "new" && !formId.startsWith("tmpl_")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/forms/responses/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-responses", formId] });
      queryClient.invalidateQueries({ queryKey: ["customer-records"] });
      queryClient.invalidateQueries({ queryKey: ["admin-form", formId] });
      setResponseToDelete(null);
    },
    onError: () => {
      alert("Failed to delete response. Please try again.");
    }
  });

  const responses = data || [];
  const fields = (formData as any)?.fields_schema || [];

  const handleExportCSV = () => {
    if (!responses.length) return;

    const headers = ["S.no", ...fields.map((f: any) => f.label), "Submission Date"];
    const csvRows = [headers.join(",")];

    responses.forEach((res: any, index: number) => {
      const row = [
        index + 1,
        ...fields.map((f: any) => {
          let text = res.answers?.[f.id] || "";
          if (text.includes(",") || text.includes('"') || text.includes('\n')) {
            text = `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        }),
        `"${new Date(res.submitted_at).toLocaleString()}"`
      ];
      csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `form_${formId}_responses.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-full overflow-y-auto p-8 max-w-7xl mx-auto font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Form Responses</h2>
          <p className="text-sm text-slate-500 mt-1">Viewing submissions for this form.</p>
        </div>
        <button 
          onClick={handleExportCSV}
          disabled={!responses.length}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search responses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">S.no</th>
                {fields.map((f: any) => (
                  <th key={f.id} className="px-6 py-4 font-medium">{f.label}</th>
                ))}
                <th className="px-6 py-4 font-medium">Submission Date</th>
                <th className="px-6 py-4 font-medium text-right sticky right-0 bg-slate-50 border-l border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={fields.length + 3} className="px-6 py-8 text-center text-slate-500">
                    Loading responses...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={fields.length + 3} className="px-6 py-8 text-center text-red-500">
                    Error loading responses.
                  </td>
                </tr>
              ) : responses.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 3} className="px-6 py-8 text-center text-slate-500">
                    No responses yet.
                  </td>
                </tr>
              ) : (
                responses.map((res: any, index: number) => (
                  <tr key={res.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{index + 1}</td>
                    
                    {fields.map((f: any) => {
                      const answerText = res.answers?.[f.id];
                      return (
                        <td key={f.id} className="px-6 py-4 text-slate-700 max-w-xs truncate">
                          {answerText ? answerText : <span className="text-slate-300">-</span>}
                        </td>
                      );
                    })}

                    <td className="px-6 py-4 text-slate-500">
                      {new Date(res.submitted_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right sticky right-0 bg-white border-l border-slate-100 group-hover:bg-slate-50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setSelectedResponse(res)} 
                          title="View Details"
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setResponseToDelete(res)} 
                          title="Delete Response"
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedResponse && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">Submission Details</h3>
              <button 
                onClick={() => setSelectedResponse(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-6 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Submitted At</p>
                  <p className="text-sm font-medium text-slate-800">{new Date(selectedResponse.submitted_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">IP Address</p>
                  <p className="text-sm font-medium text-slate-800">{selectedResponse.ip_address || "Unknown"}</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {fields.map((f: any) => {
                  const answerText = selectedResponse.answers?.[f.id];
                  return (
                    <div key={f.id} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">{f.label}</h4>
                      <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                        {answerText ? answerText : <span className="text-slate-400 italic">No answer provided</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedResponse(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {responseToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Response?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete this form response? This will also remove the lead from your Contacts list. This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setResponseToDelete(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(responseToDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleteMutation.isPending ? "Deleting..." : "Delete Response"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
