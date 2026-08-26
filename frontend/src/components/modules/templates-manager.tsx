"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MoreVertical, FileText, ChevronLeft, Search, X, Trash2, CheckCircle2, Copy, MessageCircle, Mail } from "lucide-react";
import { useState } from "react";
import { apiClient, parseApiError } from "@/services/api-client";
import { toast } from "sonner";

interface Template {
  id: number;
  name: string;
  channel: number;
  channel_name: string;
  subject?: string;
  body: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  created_at: string;
}

interface Channel {
  id: number;
  name: string;
}

export function TemplatesManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const [form, setForm] = useState({ name: "", channel: "", subject: "", body: "" });

  const templates = useQuery({
    queryKey: ["templates-list"],
    queryFn: async () => (await apiClient.get<Template[]>("/api/templates")).data,
  });

  const channels = useQuery({
    queryKey: ["channels-list"],
    queryFn: async () => (await apiClient.get<Channel[]>("/api/channels")).data,
  });

  const rows = (templates.data ?? []).filter((tpl) => 
    (!search || `${tpl.name} ${tpl.subject || ""} ${tpl.body}`.toLowerCase().includes(search.toLowerCase())) &&
    (!channelFilter || String(tpl.channel) === channelFilter)
  );
  
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  const activeChannelName = form.channel ? (channels.data?.find(c => String(c.id) === form.channel)?.name || "") : "";
  const isEmail = activeChannelName.toUpperCase().includes("EMAIL");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        channel: Number(form.channel),
        subject: form.subject.trim(),
        body: form.body,
        status: "ACTIVE"
      };
      if (editTarget) {
        return apiClient.patch(`/api/templates/${editTarget.id}`, payload);
      } else {
        return apiClient.post("/api/templates/create", payload);
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? "Template updated" : "Template created");
      queryClient.invalidateQueries({ queryKey: ["templates-list"] });
      closeForm();
    },
    onError: (err) => {
      toast.error(parseApiError(err));
    }
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/api/templates/${id}/delete`);
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["templates-list"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(parseApiError(err));
    }
  });

  const openEdit = (tpl: Template) => {
    setEditTarget(tpl);
    setForm({
      name: tpl.name,
      channel: String(tpl.channel),
      subject: tpl.subject || "",
      body: tpl.body,
    });
    setCreateOpen(true);
  };

  const closeForm = () => {
    setCreateOpen(false);
    setEditTarget(null);
    setForm({ name: "", channel: "", subject: "", body: "" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="sa-title">Templates</h1>
          <p className="text-slate-500 mt-1">Manage reusable message templates for your campaigns and automations.</p>
        </div>
        <button className="primary-button" onClick={() => setCreateOpen(true)}>
          <Plus size={18} /> New Template
        </button>
      </header>

      <div className="sa-card p-6">
        <div className="flex flex-wrap gap-4 mb-6 md:flex-nowrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
              placeholder="Search templates..."
            />
          </div>
          <select
            className="sa-input md:w-48"
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Channels</option>
            {channels.data?.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>

        {templates.isError ? (
          <ErrorState error={templates.error} />
        ) : templates.isLoading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <Empty message="No templates found." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((tpl, i) => (
              <motion.article
                key={tpl.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      tpl.channel_name.toUpperCase().includes("WHATSAPP") ? "bg-emerald-100 text-emerald-600" :
                      tpl.channel_name.toUpperCase().includes("SMS") ? "bg-indigo-100 text-indigo-600" :
                      "bg-blue-100 text-blue-600"
                    }`}>
                      <ChannelGlyph name={tpl.channel_name} />
                    </span>
                    <Badge className={
                      tpl.channel_name.toUpperCase().includes("WHATSAPP") ? "bg-emerald-50 text-emerald-600" :
                      tpl.channel_name.toUpperCase().includes("SMS") ? "bg-indigo-50 text-indigo-600" :
                      "bg-blue-50 text-blue-600"
                    }>{tpl.channel_name}</Badge>
                  </div>
                  <h3 className="font-bold text-slate-900 line-clamp-1" title={tpl.name}>{tpl.name}</h3>
                  {tpl.subject && <p className="text-sm text-slate-500 line-clamp-1 mt-1 font-medium">{tpl.subject}</p>}
                  <p className="mt-3 text-sm text-slate-600 line-clamp-3 leading-relaxed">{tpl.body}</p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{formatDate(tpl.created_at)}</span>
                  <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button className="text-slate-400 hover:text-blue-600 p-1" onClick={() => openEdit(tpl)} title="Edit">
                      <FileText size={16} />
                    </button>
                    <button className="text-slate-400 hover:text-red-600 p-1" onClick={() => setDeleteTarget(tpl)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
        
        {rows.length > 0 && (
          <div className="mt-8">
            <Pagination page={page} count={rows.length} pageSize={pageSize} setPage={setPage} />
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <motion.form 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden"
              onSubmit={e => { e.preventDefault(); save.mutate(); }}
            >
              <ModalHeader title={editTarget ? "Edit Template" : "Create Template"} onClose={closeForm} />
              
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                <label className="field">
                  <span>Channel <b className="text-red-500">*</b></span>
                  <select required value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} disabled={!!editTarget} className="sa-input disabled:bg-slate-50">
                    <option value="">Select channel...</option>
                    {channels.data?.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Template Name <b className="text-red-500">*</b></span>
                  <input required placeholder="e.g. Welcome Series - Email 1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="sa-input" />
                </label>

                {isEmail && (
                  <label className="field">
                    <span>Email Subject <b className="text-red-500">*</b></span>
                    <input required={isEmail} placeholder="Subject line" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="sa-input" />
                  </label>
                )}

                <label className="field">
                  <span>Message Body <b className="text-red-500">*</b></span>
                  <textarea required rows={6} placeholder="Type your message content here..." value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="sa-input" />
                </label>
              </div>

              <div className="flex justify-end gap-3 p-5 bg-slate-50 border-t border-slate-100">
                <button type="button" className="secondary-button" onClick={closeForm}>Cancel</button>
                <button type="submit" className="primary-button" disabled={save.isPending}>
                  {save.isPending ? "Saving..." : "Save Template"}
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {/* Delete Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-red-50">
                  <Trash2 size={28} className="text-red-500" />
                </span>
                <h2 className="text-xl font-black text-slate-900">Delete Template?</h2>
                <p className="text-sm text-slate-500">
                  Are you sure you want to delete <strong>&quot;{deleteTarget.name}&quot;</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <button className="secondary-button px-6" onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>Cancel</button>
                <button className="flex min-h-10 items-center gap-2 rounded-xl bg-red-500 px-6 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50" onClick={() => remove.mutate(deleteTarget.id)} disabled={remove.isPending}>
                  {remove.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Local Shared Components ---
function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}
function ChannelGlyph({ name }: { name: string }) {
  const norm = name.toUpperCase();
  if (norm.includes("WHATS")) return <MessageCircle size={18} />;
  if (norm.includes("SMS")) return <MessageCircle size={18} />;
  return <Mail size={18} />;
}
function Empty({ message }: { message: string }) {
  return <div className="p-8 text-center text-slate-500">{message}</div>;
}
function ErrorState({ error }: { error: any }) {
  return <div className="p-8 text-center text-red-500 font-semibold">{error?.message || "An error occurred"}</div>;
}
function Pagination({ page, count, pageSize, setPage }: { page: number; count: number; pageSize: number; setPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-slate-100 p-4">
      <span className="text-sm text-slate-500">Showing {count ? ((page - 1) * pageSize) + 1 : 0} to {Math.min(page * pageSize, count)} of {count}</span>
      <div className="flex gap-2">
        <button aria-label="Previous page" className="icon-button !border !border-slate-200" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button>
        <span className="grid h-8 min-w-8 place-items-center rounded-lg border border-blue-500 px-2 text-sm font-bold text-blue-600">{page}</span>
        <button aria-label="Next page" className="icon-button !border !border-slate-200" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronLeft className="rotate-180" size={17} /></button>
      </div>
    </div>
  );
}
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
      <input className="sa-input w-full pl-11" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
function Skeleton() {
  return (
    <div className="space-y-3 p-5">
      {[1, 2, 3, 4, 5].map(item => <div className="h-14 animate-pulse rounded-xl bg-slate-100" key={item} />)}
    </div>
  );
}
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <button aria-label="Close" type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
    </div>
  );
}
const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

