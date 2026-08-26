import { useQuery } from "@tanstack/react-query";
import { X, Search, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { apiClient } from "@/services/api-client";

type Template = {
  id: number;
  name: string;
  channel: number;
  channel_name: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
};

export function TemplatePickerModal({
  channelId,
  onClose,
  onSelect,
}: {
  channelId: number;
  onClose: () => void;
  onSelect: (template: Template) => void;
}) {
  const [search, setSearch] = useState("");

  const templates = useQuery({
    queryKey: ["templates-list"],
    queryFn: async () => (await apiClient.get<Template[]>("/api/templates")).data,
  });

  const filtered = (templates.data ?? []).filter((tpl) => 
    tpl.channel === channelId &&
    tpl.status === "ACTIVE" &&
    (!search || tpl.name.toLowerCase().includes(search.toLowerCase()) || (tpl.subject ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h2 className="text-2xl font-black">Select a Template</h2>
            <p className="mt-1 text-sm text-slate-500">Pick a pre-saved template to load into your campaign.</p>
          </div>
          <button aria-label="Close" className="icon-button" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-slate-100 p-4 bg-slate-50/50">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            <input
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Search by template name or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {templates.isLoading ? (
            <div className="flex h-full items-center justify-center p-12">
              <span className="text-slate-500 font-semibold animate-pulse">Loading templates...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-12 text-center text-slate-500">
              <FileText size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-bold text-slate-700">No templates found.</p>
              <p className="mt-1 text-sm">You haven't saved any active templates for this channel yet.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tpl) => (
                <div key={tpl.id} className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg">
                  <div className="p-5">
                    <h3 className="font-bold text-slate-900 truncate" title={tpl.name}>{tpl.name}</h3>
                    {tpl.subject && (
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate" title={tpl.subject}>Subj: <span className="text-slate-700 capitalize">{tpl.subject}</span></p>
                    )}
                    <div className="mt-3 text-xs leading-relaxed text-slate-600 line-clamp-4 overflow-hidden text-ellipsis whitespace-normal"
                         dangerouslySetInnerHTML={{ __html: tpl.body.replace(/<[^>]*>?/gm, " ").trim() || "No content." }}
                    />
                  </div>
                  <div className="border-t border-slate-50 bg-slate-50 p-4">
                    <button
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                      onClick={() => onSelect(tpl)}
                    >
                      Use This Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
