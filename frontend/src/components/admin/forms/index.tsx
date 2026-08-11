"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { Plus, FileText, Search } from "lucide-react";

const TEMPLATES = [
  { id: "tmpl_1", name: "Contact Us", desc: "Basic contact form with name, email, and message." },
  { id: "tmpl_2", name: "Lead Capture", desc: "Collect lead data for your marketing campaigns." },
  { id: "tmpl_3", name: "Customer Feedback", desc: "Gather insights from your recent customers." }
];

export function AdminForms() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: async () => {
      const res = await apiClient.get("/api/forms/");
      // Assuming paginated response with .results or direct array
      return res.data.results || res.data;
    }
  });

  const myForms = data || [];
  const filteredForms = myForms.filter((f: any) => f.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Forms Dashboard</h1>
        <p className="text-slate-500 mt-1">Create and manage your lead generation forms.</p>
      </div>

      <div className="mb-12">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Start a New Form</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <button 
            onClick={() => router.push("/admin/forms/new")}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all text-blue-600 min-h-[160px] group"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-semibold">Create Blank Form</span>
          </button>

          {TEMPLATES.map(tmpl => (
            <button 
              key={tmpl.id}
              onClick={() => router.push(`/admin/forms/${tmpl.id}`)}
              className="flex flex-col items-start p-6 border border-slate-200 rounded-xl bg-white hover:border-slate-300 hover:shadow-md transition-all min-h-[160px] text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4 text-slate-500">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-800">{tmpl.name}</h3>
              <p className="text-sm text-slate-500 mt-2 line-clamp-2">{tmpl.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-800">My Forms</h2>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Form Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Responses</th>
                <th className="px-6 py-4 font-medium">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Loading forms...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-red-500">
                    Error loading forms.
                  </td>
                </tr>
              ) : filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No forms found.
                  </td>
                </tr>
              ) : (
                filteredForms.map((form: any) => (
                  <tr 
                    key={form.id} 
                    onClick={() => router.push(`/admin/forms/${form.id}`)}
                    className="group cursor-pointer hover:bg-blue-50/50 hover:shadow-[inset_4px_0_0_0_#2563eb] transition-all duration-200 ease-in-out"
                  >
                    <td className="px-6 py-4 font-medium text-slate-800 group-hover:text-blue-700 transition-colors">
                      {form.title}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        form.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {form.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{form.total_responses || 0}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(form.updated_at || form.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
