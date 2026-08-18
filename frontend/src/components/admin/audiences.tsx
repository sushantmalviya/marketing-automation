"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays, ChevronLeft, ChevronRight, Eye, GripVertical,
  Pencil, Plus, RefreshCw, Save, Search, Target, Trash2,
  UserRound, UsersRound, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { apiClient, parseApiError } from "@/services/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition  = { id: string; field: string; operator: string; value: string; value_to?: string };
type Group      = { id: string; operator: "AND" | "OR"; conditions: Condition[] };
type Definition = { type?: string; description?: string; operator?: string; conditions?: Condition[]; groups_operator?: string; groups?: Group[]; static_ids?: number[]; is_group?: boolean; base_group_ids?: number[] };
type Audience   = { id: number; name: string; customer_upload: number | null; customer_upload_name: string; definition: Definition; type: string; contacts_count: number; created_at: string; updated_at: string };
type SegmentForm = { name: string; description: string; type: "DYNAMIC" | "STATIC"; groups_operator: "AND" | "OR"; groups: Group[]; base_group_ids: number[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const pageSize = 8;

const FIXED_FIELDS = ["Name", "Email", "Phone", "City", "Country", "Age", "Source"];
const operators: [string, string][] = [
  ["contains", "contains"], ["is", "is"], ["!=", "is not"],
  ["startswith", "starts with"], ["endswith", "ends with"],
  ["greater_than", "greater than"], ["less_than", "less than"], ["between", "between"],
];

const uid = () => Math.random().toString(36).slice(2, 10);
const newCondition = (): Condition => ({ id: uid(), field: "Name", operator: "contains", value: "" });
const newGroup     = (): Group => ({ id: uid(), operator: "AND", conditions: [newCondition()] });
const blankForm    = (): SegmentForm => ({ name: "", description: "", type: "DYNAMIC", groups_operator: "OR", groups: [newGroup()], base_group_ids: [] });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid2 = uid;
function operatorLabel(v: string) { return operators.find(([k]) => k === v)?.[1] || v; }
function title(v: string) { return v.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); }
function formatDate(v: string) { return new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminAudiences() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Audience | null>(null);
  const [form, setForm] = useState<SegmentForm>(blankForm);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewContacts, setPreviewContacts] = useState<{ id: number; data: Record<string, unknown> }[]>([]);
  const [fullContactsOpen, setFullContactsOpen] = useState(false);
  const [fullContacts, setFullContacts] = useState<{ id: number; data: Record<string, unknown> }[]>([]);

  const audiences = useQuery({
    queryKey: ["admin-audiences"],
    queryFn: async () => (await apiClient.get<Audience[]>("/api/audiences/")).data,
  });

  const allGroups = useMemo(() => {
    const arr = Array.isArray(audiences.data) ? audiences.data : (audiences.data as any)?.results || [];
    return arr.filter((a: any) => a.definition?.is_group);
  }, [audiences.data]);

  // Fetch dynamic column names
  const columnsQuery = useQuery({
    queryKey: ["admin-contacts-cols", form.base_group_ids],
    queryFn: async () => (await apiClient.get<{ columns: string[] }>("/api/customers/", { params: { columns_only: true, audience_ids: form.base_group_ids.length > 0 ? form.base_group_ids.join(",") : undefined } })).data,
    enabled: building,
  });

  // Derive available field names from API response
  const availableFields = useMemo(() => {
    if (columnsQuery.data?.columns && columnsQuery.data.columns.length > 0) {
      return columnsQuery.data.columns;
    }
    return FIXED_FIELDS;
  }, [columnsQuery.data]);

  const definition = useMemo(() => ({
    type: form.type,
    description: form.description,
    base_group_ids: form.base_group_ids,
    groups_operator: form.groups_operator,
    groups: (form.type === "DYNAMIC" || form.type === "STATIC")
      ? form.groups.map(g => ({
          operator: g.operator,
          conditions: g.conditions.map(c => ({ field: c.field, operator: c.operator, value: c.value, ...(c.value_to ? { value_to: c.value_to } : {}) })),
        }))
      : [],
  }), [form]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (audiences.data ?? [])
      .filter(a => !a.definition?.is_group)
      .filter(a => !q || [a.name, a.type, a.customer_upload_name].join(" ").toLowerCase().includes(q));
  }, [audiences.data, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const preview = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ total_customers: number; preview: { id: number; data: Record<string, unknown> }[] }>("/api/audiences/preview/", { audience_definition: definition })).data,
    onSuccess: d => { setPreviewCount(d.total_customers); setPreviewContacts(d.preview ?? []); },
    onError: err => toast.error(parseApiError(err)),
  });

  const fetchFull = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ total_customers: number; preview: { id: number; data: Record<string, unknown> }[] }>("/api/audiences/preview/", { audience_definition: definition, full: true })).data,
    onSuccess: d => { setFullContacts(d.preview ?? []); setFullContactsOpen(true); },
    onError: err => toast.error(parseApiError(err)),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!form.name.trim()) throw new Error("Segment name is required.");
      const payload = { name: form.name.trim(), definition };
      return editing
        ? apiClient.patch(`/api/audiences/${editing}/`, payload)
        : apiClient.post("/api/audiences/create/", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Segment updated" : "Segment created");
      closeBuilder();
      void client.invalidateQueries({ queryKey: ["admin-audiences"] });
      void client.invalidateQueries({ queryKey: ["task-audiences"] });
    },
    onError: err => toast.error(parseApiError(err)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/audiences/${id}/`),
    onSuccess: () => { toast.success("Segment deleted"); void client.invalidateQueries({ queryKey: ["admin-audiences"] }); },
    onError: err => toast.error(parseApiError(err)),
  });

  function closeBuilder() { setBuilding(false); setEditing(null); setForm(blankForm()); setPreviewCount(null); setPreviewContacts([]); setFullContacts([]); setFullContactsOpen(false); }

  function createSegment() { setEditing(null); setForm(blankForm()); setPreviewCount(null); setBuilding(true); }

  function editSegment(item: Audience) {
    const legacy = item.definition?.conditions?.length
      ? [{ id: uid2(), operator: (item.definition.operator || "AND") as "AND" | "OR", conditions: item.definition.conditions.map(c => ({ ...c, id: uid2() })) }]
      : [];
    setViewing(null); setEditing(item.id); setPreviewCount(item.contacts_count);
    let base_group_ids: number[] = [];
    if (item.definition?.base_group_ids) {
        base_group_ids = item.definition.base_group_ids;
    }
    setForm({
      name: item.name,
      description: item.definition?.description || "",
      type: item.type === "STATIC" ? "STATIC" : "DYNAMIC",
      groups_operator: item.definition?.groups_operator === "AND" ? "AND" : "OR",
      base_group_ids: base_group_ids,
      groups: item.definition?.groups?.length
        ? item.definition.groups.map(g => ({ ...g, id: uid2(), conditions: g.conditions.map(c => ({ ...c, id: uid2() })) }))
        : legacy.length ? legacy : [newGroup()],
    });
    setBuilding(true);
  }

  if (building) return (
    <>
      <SegmentBuilder
        key={`${editing ?? "new"}-${form.type}`}
        editing={editing !== null}
        form={form}
        setForm={next => { setForm(next); setPreviewCount(null); setPreviewContacts([]); }}
        allGroups={allGroups}
        availableFields={availableFields}
        previewCount={previewCount}
        previewContacts={previewContacts}
        previewing={preview.isPending}
        fetchingFull={fetchFull.isPending}
        saving={save.isPending}
        onCancel={closeBuilder}
        onPreview={() => preview.mutate()}
        onFetchFull={() => fetchFull.mutate()}
        onSave={() => save.mutate()}
      />
      <AnimatePresence>
        {fullContactsOpen && (
          <FullContactsModal
            contacts={fullContacts}
            total={previewCount ?? fullContacts.length}
            conditions={form.groups.flatMap(g => g.conditions)}
            onClose={() => setFullContactsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="sa-title normal-case">Segmentation</h1><p className="sa-subtitle">Manage and organize your audience segments</p></div>
        <button className="primary-button min-h-12 px-5" onClick={createSegment}><Plus size={19} />Create Segment</button>
      </div>
      <section className="sa-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <label className="relative block max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            <input className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Search segments..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </label>
        </div>
        {audiences.isLoading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, i) => <div className="h-14 animate-pulse rounded-xl bg-slate-100" key={i} />)}</div>
        ) : audiences.isError ? (
          <div className="p-12 text-center text-red-600">{parseApiError(audiences.error)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-600">
                <tr><th className="px-6 py-5">Title</th><th>Type</th><th>Contacts</th><th>Created At</th><th className="text-center">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map(item => (
                  <tr className="border-b border-slate-100 transition last:border-0 hover:bg-blue-50/35" key={item.id}>
                    <td className="px-6 py-5 font-semibold text-slate-800">{item.name}</td>
                    <td><TypeBadge type={item.type} /></td>
                    <td className="font-medium text-slate-700">{item.contacts_count.toLocaleString()}</td>
                    <td className="text-slate-600">{formatDate(item.created_at)}</td>
                    <td>
                      <div className="flex justify-center gap-2">
                        <Action title="View" color="blue" onClick={() => setViewing(item)}><Eye size={17} /></Action>
                        {!["Imported contacts", "Form leads", "Meta leads"].includes(item.name) && (
                          <>
                            <Action title="Edit" color="orange" onClick={() => editSegment(item)}><Pencil size={17} /></Action>
                            <Action title="Delete" color="red" onClick={() => { if (confirm(`Delete "${item.name}"?`)) remove.mutate(item.id); }}><Trash2 size={17} /></Action>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <div className="p-14 text-center text-slate-500">No segments match your search.</div>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
          <span>Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1.5">
            <PageButton disabled={currentPage === 1} onClick={() => setPage(v => v - 1)}><ChevronLeft size={16} /></PageButton>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 5).map(n => <PageButton active={n === currentPage} key={n} onClick={() => setPage(n)}>{n}</PageButton>)}
            <PageButton disabled={currentPage === pages} onClick={() => setPage(v => v + 1)}><ChevronRight size={16} /></PageButton>
          </div>
        </div>
      </section>
      <AnimatePresence>{viewing && <SegmentDetails item={viewing} onClose={() => setViewing(null)} onEdit={() => editSegment(viewing)} />}</AnimatePresence>
    </div>
  );
}

// ─── Segment Builder ──────────────────────────────────────────────────────────

function SegmentBuilder({ editing, form, setForm, allGroups, availableFields, previewCount, previewContacts, previewing, fetchingFull, saving, onCancel, onPreview, onFetchFull, onSave }: {
  editing: boolean; form: SegmentForm; setForm: (f: SegmentForm) => void;
  allGroups: any[];
  availableFields: string[];
  previewCount: number | null;
  previewContacts: { id: number; data: Record<string, unknown> }[];
  previewing: boolean; fetchingFull: boolean; saving: boolean;
  onCancel: () => void; onPreview: () => void; onFetchFull: () => void; onSave: () => void;
}) {
  const { user } = useAuth();
  const count = previewCount ?? 0;
  const conditions = form.groups.flatMap(g => g.conditions);

  const updateGroup     = (gid: string, patch: Partial<Group>) => setForm({ ...form, groups: form.groups.map(g => g.id === gid ? { ...g, ...patch } : g) });
  const updateCondition = (gid: string, cid: string, patch: Partial<Condition>) => setForm({ ...form, groups: form.groups.map(g => g.id === gid ? { ...g, conditions: g.conditions.map(c => c.id === cid ? { ...c, ...patch } : c) } : g) });
  const removeCondition = (gid: string, cid: string) => setForm({ ...form, groups: form.groups.map(g => g.id === gid ? { ...g, conditions: g.conditions.filter(c => c.id !== cid) } : g).filter(g => g.conditions.length) });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <button className="text-blue-600 hover:underline" onClick={onCancel}>Segmentation</button>
            <ChevronRight size={15} className="text-slate-400" />
            <span>{editing ? "Edit" : "Create"} Segment</span>
          </div>
          <h1 className="sa-title normal-case">{editing ? "Edit" : "Create"} Segment</h1>
          <p className="sa-subtitle">Build a targeted audience by adding filters and conditions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="secondary-button min-h-12 px-5" onClick={onCancel}>Cancel</button>
          <button className="secondary-button flex min-h-12 items-center gap-2 border-blue-300 px-5 text-blue-600" disabled={previewing} onClick={onPreview}>
            <Eye size={18} />{previewing ? "Calculating…" : "Preview"}
          </button>
          <button className="primary-button min-h-12 px-6" disabled={saving} onClick={onSave}>
            <Save size={18} />{saving ? "Saving…" : "Save Segment"}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        {/* Left */}
        <div className="space-y-4">
          {/* Basic info + type toggle */}
          <section className="sa-card grid gap-5 p-6 md:grid-cols-2">
            <label className="field">
              <span>Segment Name <b className="text-red-500">*</b></span>
              <input placeholder="e.g. Football Campaign Audience" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Description (Optional)</span>
              <input placeholder="Describe this targeted audience" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-semibold text-slate-800">Segment Type</p>
              <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(["DYNAMIC", "STATIC"] as const).map(type => (
                  <button
                    key={type}
                    className={`rounded-lg px-5 py-2 text-sm font-bold transition ${form.type === type ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-300" : "text-slate-500 hover:text-slate-800"}`}
                    onClick={() => setForm({ ...form, type })}
                  >
                    {title(type)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {form.type === "DYNAMIC"
                  ? "Dynamic segments automatically include new contacts that match the conditions."
                  : "Static segments capture a fixed snapshot of contacts at the time of creation. New contacts are not included."}
              </p>
            </div>
          </section>

          {/* Base Groups Selection */}
          <section className="sa-card p-6 relative">
            <label className="block text-sm font-semibold text-slate-800 mb-3">Target Base Groups (Optional)</label>
            <div className="relative group">
              <div className="flex min-h-12 w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                {form.base_group_ids.length === 0 ? (
                  <span className="text-sm text-slate-500 pl-2">All Contacts</span>
                ) : (
                  form.base_group_ids.map(id => {
                    const group = allGroups.find(g => g.id === id);
                    if (!group) return null;
                    return (
                      <span key={id} className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">
                        {group.name}
                        <button className="ml-1 text-blue-500 hover:text-blue-700" onClick={() => setForm({ ...form, base_group_ids: form.base_group_ids.filter(gid => gid !== id) })}>
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
              <div className="absolute left-0 top-full z-10 mt-2 hidden w-full rounded-xl border border-slate-100 bg-white shadow-xl group-hover:block max-h-60 overflow-y-auto">
                <div className="p-2 space-y-1">
                  <button 
                    onClick={() => setForm({ ...form, base_group_ids: [] })}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${form.base_group_ids.length === 0 ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"}`}
                  >
                    All Contacts
                    {form.base_group_ids.length === 0 && <span className="text-slate-600 font-bold">✓</span>}
                  </button>
                  {allGroups.map(group => {
                    const isSelected = form.base_group_ids.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        onClick={() => {
                          const newIds = isSelected 
                            ? form.base_group_ids.filter(id => id !== group.id)
                            : [...form.base_group_ids, group.id];
                          setForm({ ...form, base_group_ids: newIds });
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${isSelected ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-slate-50"}`}
                      >
                        {group.name}
                        {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Select which groups to build this segment from. You can select multiple groups (OR logic). If none selected, it applies to all contacts.</p>
          </section>

          {/* Conditions — shown for both DYNAMIC and STATIC */}
          {(form.type === "DYNAMIC" || form.type === "STATIC") && (
            <div className="space-y-3">
              {form.type === "STATIC" && (
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <UsersRound size={18} className="shrink-0 text-blue-600" />
                  <p className="text-xs text-blue-700 font-medium">
                    Static: conditions are applied <strong>once at save time</strong>. Matched contacts are snapshotted — new contacts added later will <strong>not</strong> be included even if they match.
                  </p>
                </div>
              )}
              {form.groups.map((group, gi) => (
                <div key={group.id}>
                  {gi > 0 && (
                    <div className="relative my-3 flex justify-center">
                      <div className="absolute top-1/2 h-px w-full bg-slate-200" />
                      <button
                        className="dn-btn relative rounded-lg bg-violet-100 px-5 py-1 text-xs font-bold text-violet-700"
                        onClick={() => setForm({ ...form, groups_operator: form.groups_operator === "OR" ? "AND" : "OR" })}
                      >
                        {form.groups_operator}
                      </button>
                    </div>
                  )}
                  <section className="sa-card overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
                      <select
                        className="rounded-lg border border-blue-300 bg-blue-600 px-3 py-2 text-sm font-bold text-white"
                        value={group.operator}
                        onChange={e => updateGroup(group.id, { operator: e.target.value as "AND" | "OR" })}
                      >
                        <option>AND</option><option>OR</option>
                      </select>
                      <span className="mr-auto text-sm font-semibold text-slate-700">
                        {group.operator === "AND" ? "All" : "Any"} of the following must be true
                      </span>
                      <button className="flex items-center gap-1.5 text-sm font-bold text-blue-600" onClick={() => updateGroup(group.id, { conditions: [...group.conditions, newCondition()] })}>
                        <Plus size={16} />Add Condition
                      </button>
                      {form.groups.length > 1 && (
                        <button className="icon-button text-red-500" onClick={() => setForm({ ...form, groups: form.groups.filter(g => g.id !== group.id) })}>
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      {group.conditions.map(condition => (
                        <div className="grid items-center gap-2 md:grid-cols-[24px_1fr_1fr_1.7fr_36px]" key={condition.id}>
                          <GripVertical className="text-slate-400" size={18} />
                          <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={condition.field} onChange={e => updateCondition(group.id, condition.id, { field: e.target.value })}>
                            {availableFields.map(f => <option key={f}>{f}</option>)}
                          </select>
                          <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={condition.operator} onChange={e => updateCondition(group.id, condition.id, { operator: e.target.value })}>
                            {/* Source field: only equality operators */}
                            {(condition.field === "Source"
                              ? [["is", "is"], ["!=", "is not"]] as [string,string][]
                              : operators
                            ).map(([v, l]) => <option value={v} key={v}>{l}</option>)}
                          </select>
                          <div className="flex items-center gap-2">
                            {condition.field === "Source" ? (
                              <select className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={condition.value} onChange={e => updateCondition(group.id, condition.id, { value: e.target.value })}>
                                <option value="">Select source…</option>
                                <option value="imported">Imported</option>
                                <option value="created">Created</option>
                              </select>
                            ) : (
                              <input className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Enter value" value={condition.value} onChange={e => updateCondition(group.id, condition.id, { value: e.target.value })} />
                            )}
                            {condition.operator === "between" && (
                              <><span>–</span><input className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm" placeholder="To" value={condition.value_to || ""} onChange={e => updateCondition(group.id, condition.id, { value_to: e.target.value })} /></>
                            )}
                          </div>
                          <button className="icon-button text-red-500" onClick={() => removeCondition(group.id, condition.id)}><Trash2 size={18} /></button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ))}
              <button className="secondary-button flex items-center gap-2 border-blue-300 px-4 text-blue-600" onClick={() => setForm({ ...form, groups: [...form.groups, newGroup()] })}>
                <Plus size={17} />Add Group
              </button>
            </div>
          )}

        </div>

        {/* Sidebar preview */}
        <aside className="sa-card sticky top-24 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h2 className="text-lg font-black">Segment Preview</h2>
            {previewCount !== null && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                {count.toLocaleString()} matched
              </span>
            )}
          </div>

          {/* Count hero */}
          <div className="border-b border-slate-100 p-5">
            {previewing ? (
              <div className="flex items-center gap-3 text-slate-500">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <span className="text-sm font-semibold">Calculating…</span>
              </div>
            ) : previewCount === null ? (
              <div className="text-center py-4">
                <p className="text-3xl font-black text-slate-300">—</p>
                <p className="mt-1 text-xs text-slate-400">Click Preview to calculate</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Matching contacts</p>
                <p className="mt-1 text-4xl font-black text-emerald-600">{count.toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">out of all your contacts</p>
              </div>
            )}
          </div>

          {/* Active conditions summary */}
          {conditions.length > 0 && (
            <div className="border-b border-slate-100 p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Active Filters</p>
              <div className="space-y-1.5">
                {conditions.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs">
                    <span className="font-semibold text-slate-700">{c.field}</span>
                    <span className="text-slate-400">{operatorLabel(c.operator)}</span>
                    <span className="font-bold text-blue-700">"{c.value}"</span>
                    {c.value_to && <><span className="text-slate-400">–</span><span className="font-bold text-blue-700">"{c.value_to}"</span></>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact preview list */}
          {previewContacts.length > 0 && (
            <div className="border-b border-slate-100 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Sample contacts (first {previewContacts.length})
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {previewContacts.map(c => {
                  const d = c.data;
                  const name  = String(d.name ?? d.Name ?? d.full_name ?? "—");
                  const email = String(d.email ?? d.Email ?? "");
                  const extra = Object.entries(d)
                    .filter(([k]) => !["name","Name","email","Email","__col_order__","__source__"].includes(k))
                    .slice(0, 2)
                    .map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
                  return (
                    <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                      {email && <p className="text-xs text-slate-500 truncate">{email}</p>}
                      {extra && <p className="text-xs text-slate-400 truncate">{extra}</p>}
                    </div>
                  );
                })}
              </div>
              {count > previewContacts.length && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    + {(count - previewContacts.length).toLocaleString()} more contacts
                  </p>
                  <button
                    onClick={onFetchFull}
                    disabled={fetchingFull}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white dn-btn disabled:opacity-60"
                  >
                    <UsersRound size={13} />
                    {fetchingFull ? "Loading…" : "Full Contacts"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="space-y-3 p-5 text-sm">
            <Meta icon={<RefreshCw size={15} />} label="Type"         value={title(form.type)} />
            <Meta icon={<CalendarDays size={15} />} label="Updated"   value="Not saved yet" />
            <Meta icon={<UserRound size={15} />} label="Created By"   value={[user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Admin"} />
            <Meta icon={<Target size={15} />} label="Used In"         value={editing ? "Existing campaigns" : "0 Campaigns"} />
          </div>
        </aside>
      </div>
    </motion.div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SegmentDetails({ item, onClose, onEdit }: { item: Audience; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .97 }} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div><TypeBadge type={item.type} /><h2 className="mt-3 text-2xl font-black">{item.name}</h2></div>
          <button className="icon-button" onClick={onClose}><X /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 p-6">
          <div className="col-span-2 flex items-center gap-4 rounded-2xl bg-blue-50 p-5">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-blue-600 shadow-sm"><UsersRound /></span>
            <div><p className="text-2xl font-black text-slate-900">{item.contacts_count.toLocaleString()}</p><p className="text-sm text-slate-500">Matching contacts</p></div>
          </div>
          <Detail label="Type" value={title(item.type)} />
          <Detail label="Created" value={formatDate(item.created_at)} />
        </div>

      </motion.div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${type === "STATIC" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{title(type)}</span>;
}
function Action({ title: label, color, onClick, children }: { title: string; color: string; onClick: () => void; children: React.ReactNode }) {
  return <button className={`icon-button !border !border-slate-200 ${color === "red" ? "!text-red-500" : color === "orange" ? "!text-orange-500" : "!text-blue-600"}`} title={label} onClick={onClick}>{children}</button>;
}
function PageButton({ active, disabled, onClick, children }: { active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition ${active ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white hover:border-blue-300 hover:text-blue-600"}`} disabled={disabled} onClick={onClick}>{children}</button>;
}
function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="grid grid-cols-[20px_105px_1fr] items-center gap-2"><span className="text-slate-600">{icon}</span><span className="font-bold text-slate-700">{label}</span><span>{value}</span></div>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-800">{value}</p></div>;
}

// ─── Full Contacts Modal ───────────────────────────────────────────────────────

function FullContactsModal({ contacts, total, conditions, onClose }: {
  contacts: { id: number; data: Record<string, unknown> }[];
  total: number;
  conditions: Condition[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  // Derive columns from first contact
  const columns = useMemo(() => {
    const first = contacts[0];
    if (!first) return [];
    const order = first.data.__col_order__ as string[] | undefined;
    const keys = order ?? Object.keys(first.data);
    return keys.filter(k => !k.startsWith("__"));
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      Object.values(c.data).some(v => String(v ?? "").toLowerCase().includes(q))
    );
  }, [contacts, search]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900">Full Contact List</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {total.toLocaleString()} contacts match ·{" "}
            {conditions.map(c => `${c.field} ${operatorLabel(c.operator)} "${c.value}"`).join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search within results */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Search within results…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
            {filtered.length.toLocaleString()} shown
          </span>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-400">No contacts found.</div>
        ) : (
          <table className="w-full text-left text-sm" style={{ minWidth: Math.max(800, columns.length * 180) }}>
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-slate-400">#</th>
                {columns.map(col => (
                  <th key={col} className="px-4 py-3 whitespace-nowrap">
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 transition hover:bg-blue-50/40"
                >
                  <td className="px-5 py-3 text-xs text-slate-400">{idx + 1}</td>
                  {columns.map(col => {
                    const raw = c.data[col];
                    const isTags = col.toLowerCase() === "tags";
                    const tags = isTags
                      ? (Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(",").map(t => t.trim()).filter(Boolean))
                      : [];
                    return (
                      <td key={col} className="px-4 py-3 max-w-[220px]">
                        {isTags ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map(t => <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{t}</span>)}
                          </div>
                        ) : (
                          <span className="block truncate text-slate-700" title={String(raw ?? "")}>
                            {raw !== undefined && raw !== null && String(raw).trim() ? String(raw) : "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3 text-center text-xs text-slate-400">
        Showing {filtered.length.toLocaleString()} of {total.toLocaleString()} matched contacts
      </div>
    </motion.div>
  );
}
