"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText, Plus, Search, Trash2, Pencil, MoreVertical, X, Share2, Mail, MessageCircle
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";
import { Pagination } from "@/components/ui/pagination";

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

type Channel = {
  id: number;
  name: string;
  code: string;
};

const pageSize = 12;

function ChannelGlyph({ name, className }: { name: string; className?: string }) {
  const upper = name.toUpperCase();
  if (upper.includes("WHATS")) return <MessageCircle className={className} />;
  if (upper.includes("EMAIL")) return <Mail className={className} />;
  return <Share2 className={className} />;
}

export function TemplatesManagement() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);

  const [isEditing, setIsEditing] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await apiClient.get<Template[]>("/api/templates/")).data
  });

  const channelsQuery = useQuery({
    queryKey: ["channels"],
    queryFn: async () => (await apiClient.get<Channel[]>("/api/channels/")).data
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/api/templates/${id}/delete/`),
    onSuccess: () => {
      toast.success("Template deleted successfully");
      client.invalidateQueries({ queryKey: ["templates"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      // If error contains "assigned to campaigns", show it nicely
      const msg = parseApiError(err);
      toast.error(msg || "Failed to delete template");
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Template> & { isNew?: boolean }) => {
      if (data.isNew) {
        return apiClient.post("/api/templates/create/", {
          name: data.name,
          channel: data.channel,
          subject: data.subject || "",
          body: data.body,
          status: "ACTIVE"
        });
      } else {
        return apiClient.patch(`/api/templates/${data.id}/`, {
          name: data.name,
          subject: data.subject || "",
          body: data.body,
        });
      }
    },
    onSuccess: () => {
      toast.success(isCreating ? "Template created" : "Template updated");
      client.invalidateQueries({ queryKey: ["templates"] });
      setIsEditing(null);
      setIsCreating(false);
    },
    onError: (err) => {
      toast.error(parseApiError(err) || "Failed to save template");
    }
  });

  const rows = (templatesQuery.data ?? []).filter(t =>
    (!search || `${t.name} ${t.subject} ${t.body}`.toLowerCase().includes(search.toLowerCase())) &&
    (!channelFilter || String(t.channel) === channelFilter)
  );


  const shown = rows.slice((page - 1) * pageSize, page * pageSize);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Templates</h1>
          <p className="text-slate-500 mt-1">Manage reusable message templates for all channels.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          New Template
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition"
          />
        </div>
        <select
          className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 min-w-[200px]"
          value={channelFilter}
          onChange={e => { setChannelFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Channels</option>
          {channelsQuery.data?.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {templatesQuery.isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No templates found</h3>
          <p className="text-slate-500 mt-1">Create a new template to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {shown.map((template, idx) => {
            const isWhatsapp = template.channel_name.toUpperCase().includes("WHATSAPP");
            return (
              <motion.article
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={template.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-lg transition flex flex-col group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${isWhatsapp ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <ChannelGlyph name={template.channel_name} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => setIsEditing(template)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(template)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 truncate">{template.name}</h3>
                <span className={`text-xs font-semibold mt-1 w-max px-2 py-0.5 rounded ${isWhatsapp ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {template.channel_name}
                </span>
                {template.subject && <p className="text-sm text-slate-600 mt-3 truncate font-medium">Subj: {template.subject}</p>}
                <p className="text-sm text-slate-500 mt-2 line-clamp-3 flex-1">{template.body}</p>

                <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
                  Created {formatDate(template.created_at)}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {rows.length > pageSize && (
        <div className="mt-8">
          <Pagination page={page} count={rows.length} pageSize={pageSize} setPage={setPage} />
        </div>
      )}

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={28} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Template?</h2>
                <p className="text-slate-500 text-sm">
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
                  If it is currently being used in any campaign, this action will fail.
                </p>
              </div>
              <div className="flex border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-4 font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-4 font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit / Create Modal */}
      <AnimatePresence>
        {(isEditing || isCreating) && (
          <TemplateEditor
            template={isEditing}
            channels={channelsQuery.data ?? []}
            onClose={() => { setIsEditing(null); setIsCreating(false); }}
            onSave={(data) => saveMutation.mutate({ ...data, isNew: isCreating })}
            isSaving={saveMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TemplateEditor({
  template,
  channels,
  onClose,
  onSave,
  isSaving
}: {
  template: Template | null;
  channels: Channel[];
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(template?.name || "");
  const [channelId, setChannelId] = useState(template?.channel || (channels[0]?.id ?? ""));
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");

  const selectedChannel = channels.find(c => String(c.id) === String(channelId));
  const isEmail = selectedChannel?.name.toUpperCase().includes("EMAIL");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">
            {template ? "Edit Template" : "Create New Template"}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
              placeholder="e.g. Welcome Email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Channel *</label>
            <select
              value={channelId}
              onChange={e => setChannelId(Number(e.target.value))}
              disabled={!!template} // Cannot change channel of existing template
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {(isEmail || (template && template.channel_name.toUpperCase().includes("EMAIL"))) && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                placeholder="Email subject..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Message Body *</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full h-40 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none"
              placeholder="Type your message here..."
            />
            <p className="text-xs text-slate-500 mt-2">You can use variables like {'{{first_name}}'} if supported by the provider.</p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ id: template?.id, name, channel: channelId, subject, body })}
            disabled={!name || !body || isSaving}
            className="px-6 py-2.5 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
