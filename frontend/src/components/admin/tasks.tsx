"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckSquare, ChevronDown, Eye, Mail, MessageCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";

type Assignment = { id: number; user: number; user_name: string; status: string };
type Task = {
  id: number;
  title: string;
  description?: string | null;
  instructions?: string | null;
  audience: number;
  audience_name: string;
  channels: number[];
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  assignments: Assignment[];
};
type User = { id: number; full_name?: string; first_name?: string; last_name?: string; email: string };
type Audience = { id: number; name: string };
type Channel = { id: number; name: string; code: string };
type Form = { title: string; description: string; user: string; priority: string; audience: string; due_date: string; channels: number[] };

const emptyForm: Form = { title: "", description: "", user: "", priority: "MEDIUM", audience: "", due_date: "", channels: [] };
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const statuses = ["All", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "PENDING_APPROVAL", "APPROVED", "COMPLETED", "REJECTED", "OVERDUE", "CANCELLED"];
const pretty = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const priorityStyle: Record<string, string> = { LOW: "bg-emerald-50 text-emerald-700 border-emerald-200", MEDIUM: "bg-amber-50 text-amber-700 border-amber-200", HIGH: "bg-red-50 text-red-600 border-red-200", URGENT: "bg-rose-100 text-rose-700 border-rose-200" };
const statusStyle: Record<string, string> = { ASSIGNED: "bg-slate-100 text-slate-600", IN_PROGRESS: "bg-blue-50 text-blue-700", PENDING_APPROVAL: "bg-amber-50 text-amber-700", APPROVED: "bg-indigo-50 text-indigo-700", COMPLETED: "bg-emerald-50 text-emerald-700", CANCELLED: "bg-red-50 text-red-700", SUBMITTED: "bg-violet-50 text-violet-700", REJECTED: "bg-red-50 text-red-700" };

export function AdminTasks() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [status, setStatus] = useState("All");
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const tasks = useQuery({ queryKey: ["admin-tasks"], queryFn: async () => (await apiClient.get<Task[]>("/api/tasks/team/")).data });
  const users = useQuery({ queryKey: ["task-users"], queryFn: async () => (await apiClient.get<{ results: User[] }>("/api/users/", { params: { page_size: 100 } })).data.results, enabled: drawer });
  const audiences = useQuery({ queryKey: ["task-audiences"], queryFn: async () => (await apiClient.get<Audience[]>("/api/audiences/")).data, enabled: drawer });
  const channels = useQuery({ queryKey: ["task-channels"], queryFn: async () => (await apiClient.get<Channel[]>("/api/channels/")).data, enabled: drawer });

  const rows = useMemo(() => (tasks.data ?? []).filter((task) => {
    const assignmentStatus = task.assignments[0]?.status || task.status;
    return (!search.trim() || [task.title, task.assignments[0]?.user_name].join(" ").toLowerCase().includes(search.toLowerCase()))
      && (priority === "All" || task.priority === priority)
      && (status === "All" || task.status === status || assignmentStatus === status);
  }), [tasks.data, search, priority, status]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { title: form.title, description: form.description, users: [Number(form.user)], priority: form.priority, audience: Number(form.audience), due_date: new Date(form.due_date).toISOString(), channels: form.channels };
      return editing ? apiClient.patch(`/api/tasks/${editing}/`, payload) : apiClient.post("/api/tasks/", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Task updated successfully" : "Task created successfully");
      closeDrawer();
      void client.invalidateQueries({ queryKey: ["admin-tasks"] });
      void client.invalidateQueries({ queryKey: ["admin-team-tasks"] });
    },
    onError: (error) => toast.error(parseApiError(error)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/tasks/${id}/`),
    onSuccess: () => { toast.success("Task deleted"); void client.invalidateQueries({ queryKey: ["admin-tasks"] }); },
    onError: (error) => toast.error(parseApiError(error)),
  });

  function closeDrawer() { setDrawer(false); setEditing(null); setForm(emptyForm); }
  function beginCreate() { setEditing(null); setForm(emptyForm); setDrawer(true); }
  function beginEdit(task: Task) {
    setViewing(null);
    setEditing(task.id);
    setForm({ title: task.title, description: task.description ?? "", user: String(task.assignments[0]?.user ?? ""), priority: task.priority, audience: String(task.audience), due_date: task.due_date.slice(0, 16), channels: task.channels });
    setDrawer(true);
  }

  return <div>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title mt-2">Tasks</h1>
        <p className="page-subtitle">Manage your tasks</p>
      </div>
      <button className="primary-button min-h-12 px-5" onClick={beginCreate}><Plus size={19} />Create Task</button>
    </div>

    <section className="sa-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-5"><label className="relative min-w-64 flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input className="h-12 w-full rounded-xl border border-slate-200 pl-12 pr-4 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Search tasks..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><FilterSelect label="Priority" value={priority} values={["All", ...priorities]} onChange={setPriority} /><FilterSelect label="Status" value={status} values={statuses} onChange={setStatus} /></div>
      {tasks.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((item) => <div className="h-16 animate-pulse rounded-xl bg-slate-100" key={item} />)}</div> : tasks.isError ? <div className="p-12 text-center text-red-600">{parseApiError(tasks.error)}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-800"><tr><th className="px-6 py-5">Title</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Created At</th><th className="text-center">Actions</th></tr></thead><tbody>{rows.map((task) => { const assignment = task.assignments[0]; const currentStatus = assignment?.status || task.status; const assignee = assignment?.user_name || "Unassigned"; return <tr className="border-b border-slate-100 transition last:border-0 hover:bg-blue-50/35" key={task.id}><td className="px-6 py-5 font-medium text-slate-800">{task.title}</td><td><span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${priorityStyle[task.priority] ?? "bg-slate-50"}`}>{pretty(task.priority)}</span></td><td><span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusStyle[currentStatus] ?? "bg-slate-100 text-slate-600"}`}>{pretty(currentStatus)}</span></td><td><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{assignee.slice(0, 2).toUpperCase()}</span><span>{assignee}</span></div></td><td className="text-slate-600">{new Date(task.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td><div className="flex justify-center gap-2"><button className="icon-button !border !border-slate-200 !text-blue-600" title="View task" onClick={() => setViewing(task)}><Eye size={17} /></button><button className="icon-button !border !border-slate-200 !text-orange-500" title="Edit task" onClick={() => beginEdit(task)}><Pencil size={17} /></button><button className="icon-button !border !border-slate-200 !text-red-500" title="Delete task" onClick={() => { if (confirm(`Delete ${task.title}?`)) remove.mutate(task.id); }}><Trash2 size={17} /></button></div></td></tr>; })}</tbody></table>{!rows.length && <div className="p-14 text-center text-slate-500">No tasks match your filters.</div>}</div>}
    </section>

    <AnimatePresence>
      {drawer && <TaskDrawer editing={editing !== null} form={form} setForm={setForm} users={users.data ?? []} audiences={audiences.data ?? []} channels={channels.data ?? []} loading={users.isLoading || audiences.isLoading || channels.isLoading} pending={save.isPending} onClose={closeDrawer} onSubmit={() => save.mutate()} />}
      {viewing && <TaskDetails task={viewing} onClose={() => setViewing(null)} onEdit={() => beginEdit(viewing)} />}
    </AnimatePresence>
  </div>;
}

function FilterSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="relative min-w-44"><span className="sr-only">{label}</span><select className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none" value={value} onChange={(event) => onChange(event.target.value)}><option value="All">{label}</option>{values.filter((item) => item !== "All").map((item) => <option value={item} key={item}>{pretty(item)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={17} /></label>;
}

function TaskDrawer({ editing, form, setForm, users, audiences, channels, loading, pending, onClose, onSubmit }: { editing: boolean; form: Form; setForm: (form: Form) => void; users: User[]; audiences: Audience[]; channels: Channel[]; loading: boolean; pending: boolean; onClose: () => void; onSubmit: () => void }) {
  const channelIcon = (channel: Channel) => channel.code?.toUpperCase().includes("EMAIL") ? Mail : channel.code?.toUpperCase().includes("SMS") || channel.name.toUpperCase().includes("SMS") ? MessageCircle : CheckSquare;
  return <div className="fixed inset-0 z-50 bg-slate-950/15 backdrop-blur-[1px]"><motion.form initial={{ x: 540 }} animate={{ x: 0 }} exit={{ x: 540 }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="ml-auto flex h-full w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-[-20px_0_60px_rgba(15,23,42,.14)]" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="flex items-start justify-between border-b border-slate-100 px-6 py-6"><div><h2 className="text-2xl font-black text-slate-950">{editing ? "Edit" : "Create"} Task</h2><p className="mt-1 text-sm text-slate-500">Fill in the details to {editing ? "update" : "create"} a task.</p></div><button aria-label="Close" type="button" className="icon-button" onClick={onClose}><X /></button></div><div className="flex-1 space-y-5 overflow-y-auto p-6"><label className="field"><span>Title *</span><input required placeholder="Enter task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field"><span>Note (Optional)</span><textarea rows={4} placeholder="Enter note (optional)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="field"><span>Assign To *</span><select required value={form.user} onChange={(event) => setForm({ ...form, user: event.target.value })}><option value="">Select user</option>{users.map((user) => <option value={user.id} key={user.id}>{user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}</option>)}</select></label><label className="field"><span>Priority *</span><select required value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{priorities.map((item) => <option value={item} key={item}>{pretty(item)}</option>)}</select></label></div><label className="field"><span>Select Audience *</span><select required value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="">Select audience</option>{audiences.map((audience) => <option value={audience.id} key={audience.id}>{audience.name}</option>)}</select></label><label className="field"><span>Deadline *</span><div className="relative"><input required className="!pr-11" type="datetime-local" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /><CalendarDays className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} /></div></label><fieldset><legend className="mb-2 text-sm font-semibold text-slate-800">Channels *</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{channels.map((channel) => { const Icon = channelIcon(channel); const checked = form.channels.includes(channel.id); return <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition ${checked ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-blue-200"}`} key={channel.id}><input className="accent-blue-600" type="checkbox" checked={checked} onChange={() => setForm({ ...form, channels: checked ? form.channels.filter((id) => id !== channel.id) : [...form.channels, channel.id] })} /><Icon size={17} />{channel.name}</label>; })}</div>{!loading && !channels.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">No active channels are available.</p>}</fieldset></div><div className="border-t border-slate-100 p-6"><button className="primary-button w-full" disabled={pending || loading || !form.title.trim() || !form.user || !form.audience || !form.due_date || !form.channels.length}>{pending ? "Saving..." : editing ? "Save Task" : "Create Task"}</button></div></motion.form></div>;
}

function TaskDetails({ task, onClose, onEdit }: { task: Task; onClose: () => void; onEdit: () => void }) {
  const assignee = task.assignments[0]?.user_name || "Unassigned";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .97 }} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 p-6"><div><span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${priorityStyle[task.priority]}`}>{pretty(task.priority)}</span><h2 className="mt-3 text-2xl font-black">{task.title}</h2><p className="mt-1 text-sm text-slate-500">{task.description || "No note added"}</p></div><button className="icon-button" onClick={onClose}><X /></button></div><dl className="grid grid-cols-2 gap-5 p-6"><Detail label="Status" value={pretty(task.assignments[0]?.status || task.status)} /><Detail label="Assigned to" value={assignee} /><Detail label="Audience" value={task.audience_name} /><Detail label="Deadline" value={new Date(task.due_date).toLocaleString()} /></dl><div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4"><button className="secondary-button" onClick={onClose}>Close</button><button className="primary-button min-h-10 px-5" onClick={onEdit}><Pencil size={16} />Edit task</button></div></motion.div></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 font-semibold text-slate-800">{value}</dd></div>; }
