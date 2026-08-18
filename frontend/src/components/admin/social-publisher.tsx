"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Eye, Facebook, Instagram, Linkedin, Plus, Send, Twitter, UserPlus, X, XCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiClient, parseApiError } from "@/services/api-client";

type PlatformName = "INSTAGRAM" | "X" | "FACEBOOK" | "LINKEDIN";
type Platform = { id: string; platform: PlatformName; status: string; approval_status: string; scheduled_datetime: string | null; published_datetime: string | null; caption_text?: string; hashtags?: string; cta?: string; is_manually_edited?: boolean; images: Array<{ asset_url?: string; asset_name?: string }> };
type Draft = { id: string; owner: number; owner_name: string; original_prompt: string; enhanced_prompt: string; workflow_state: string; platforms: Platform[]; approvals: Array<{ status: string; created_at: string }>; created_at: string; updated_at: string };
type CreateForm = { prompt: string; platforms: PlatformName[]; schedule: string };

const platformMeta: Record<PlatformName, { label: string; icon: typeof Instagram; color: string }> = {
  INSTAGRAM: { label: "Instagram", icon: Instagram, color: "text-pink-600" }, X: { label: "X (Twitter)", icon: Twitter, color: "text-slate-900" },
  FACEBOOK: { label: "Facebook", icon: Facebook, color: "text-blue-600" }, LINKEDIN: { label: "LinkedIn", icon: Linkedin, color: "text-sky-700" },
};
const platforms = Object.keys(platformMeta) as PlatformName[];
const initialForm: CreateForm = { prompt: "", platforms: ["INSTAGRAM"], schedule: "" };

/** Return today's date as yyyy-mm-dd */
function toInputDate(d: Date) { return d.toISOString().slice(0, 10); }
/** Format a yyyy-mm-dd string for display */
function fmtRange(iso: string) { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29); // default: last 30 days
  return { start: toInputDate(start), end: toInputDate(end) };
}

export function AdminSocialPublisher() {
  const client = useQueryClient();
  const [active, setActive] = useState<PlatformName>("INSTAGRAM");
  const [month, setMonth] = useState(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Draft | null>(null);
  const [form, setForm] = useState<CreateForm>(initialForm);

  // Date range filter state
  const defaults = useMemo(getDefaultRange, []);
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!rangeOpen) return;
    const handler = (e: MouseEvent) => {
      if (rangeRef.current && !rangeRef.current.contains(e.target as Node)) setRangeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [rangeOpen]);

  const draftsQuery = useQuery({
    queryKey: ["social-drafts", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ date_from: startDate, date_to: endDate });
      return (await apiClient.get<Draft[]>(`/api/content/content-drafts/?${params}`)).data;
    },
  });
  const drafts = useMemo(() => draftsQuery.data ?? [], [draftsQuery.data]);

  const activeDrafts = useMemo(() => drafts.filter((draft) => draft.platforms.some((platform) => platform.platform === active)), [drafts, active]);
  const pending = drafts.filter((draft) => draft.workflow_state === "IN_REVIEW");
  const allPlatformRows = drafts.flatMap((draft) => draft.platforms.map((platform) => ({ draft, platform })));
  const activeRows = allPlatformRows.filter(({ platform }) => platform.platform === active);
  const stats = {
    published: activeRows.filter(({ platform }) => platform.status === "POSTED").length,
    scheduled: activeRows.filter(({ platform }) => platform.scheduled_datetime && platform.status !== "POSTED").length,
    pending: activeRows.filter(({ platform }) => platform.approval_status === "REQUESTED").length,
    failed: activeRows.filter(({ platform }) => platform.status === "FAILED").length,
  };
  const metricCards = [
    { label: "Published", value: stats.published, icon: Send, tone: "text-blue-600" },
    { label: "Scheduled", value: stats.scheduled, icon: CalendarDays, tone: "text-orange-500" },
    { label: "Pending", value: stats.pending, icon: UserPlus, tone: "text-emerald-600" },
    { label: "Failed", value: stats.failed, icon: XCircle, tone: "text-red-500" },
    { label: "Total Posts", value: activeRows.length, icon: Instagram, tone: "text-violet-600" },
  ];

  const action = useMutation({
    mutationFn: ({ id, name }: { id: string; name: "approve" | "reject" | "publish" }) => apiClient.post(`/api/content/content-drafts/${id}/${name}/`, {}),
    onSuccess: (_, variables) => { toast.success(variables.name === "approve" ? "Post approved" : variables.name === "reject" ? "Post rejected" : "Post published"); setViewing(null); void client.invalidateQueries({ queryKey: ["social-drafts"] }); },
    onError: (error) => toast.error(parseApiError(error)),
  });
  const create = useMutation({
    mutationFn: async () => {
      const created = (await apiClient.post<Draft>("/api/content/content-drafts/", { original_prompt: form.prompt, platforms: form.platforms })).data;
      if (form.schedule) {
        const scheduled = new Date(form.schedule).toISOString();
        await apiClient.post(`/api/content/content-drafts/${created.id}/schedule/`, { schedules: Object.fromEntries(form.platforms.map((platform) => [platform, scheduled])) });
      }
      return created;
    },
    onSuccess: () => { toast.success(form.schedule ? "Post created and scheduled" : "Post draft created"); setCreateOpen(false); setForm(initialForm); void client.invalidateQueries({ queryKey: ["social-drafts"] }); },
    onError: (error) => toast.error(parseApiError(error)),
  });

  const calendar = useMemo(() => buildCalendar(month, activeDrafts, active), [month, activeDrafts, active]);
  if (draftsQuery.isError) return <div className="sa-card p-10 text-red-600">{parseApiError(draftsQuery.error)}</div>;
  return <div><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><h1 className="sa-title normal-case">Social Publisher</h1><p className="sa-subtitle">Manage and publish content across all your social media channels.</p></div><div className="flex gap-3">
    {/* Date range picker */}
    <div className="relative" ref={rangeRef}>
      <button className="secondary-button flex min-h-12 items-center gap-2 px-5" onClick={() => setRangeOpen((v) => !v)}>
        <CalendarDays size={17} />
        {fmtRange(startDate)} – {fmtRange(endDate)}
      </button>
      {rangeOpen && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Filter by Date Range</h3>
          <label className="field mb-3">
            <span className="text-xs">Start Date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate} />
          </label>
          <label className="field">
            <span className="text-xs">End Date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button className="secondary-button text-xs" onClick={() => { setStartDate(defaults.start); setEndDate(defaults.end); }}>Reset</button>
            <button className="primary-button text-xs" onClick={() => setRangeOpen(false)}>Apply</button>
          </div>
        </div>
      )}
    </div>
    <button className="primary-button min-h-12 px-5" onClick={() => setCreateOpen(true)}><Plus size={18} />Create Post</button></div></div>
    <div className="sa-card mb-6 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">{platforms.map((name) => { const meta = platformMeta[name]; const Icon = meta.icon; return <button className={`flex min-h-16 items-center justify-center gap-3 border-b border-slate-200 px-4 font-bold transition sm:border-r ${active === name ? "bg-blue-50/60 text-blue-700 shadow-[inset_0_-3px_#2563eb]" : "hover:bg-slate-50"}`} key={name} onClick={() => setActive(name)}><Icon className={meta.color} size={20} />{meta.label}</button>; })}</div>
    <section className="sa-card mb-6 grid divide-y divide-slate-200 p-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">{metricCards.map(({label,value,icon:Icon,tone}) => <div className="px-6 py-3" key={label}><div className="flex items-center gap-3 text-sm font-bold text-slate-600"><Icon className={tone} size={21} />{label}</div><strong className="mt-4 block text-3xl text-slate-950">{value.toLocaleString()}</strong><span className="mt-2 block text-xs text-emerald-600">Live platform data</span></div>)}</section>
    <section className="sa-card mb-6 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-6"><h2 className="text-lg font-black">Pending Approvals <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">{pending.length}</span></h2></div>{draftsQuery.isLoading ? <div className="space-y-3 p-5">{[1,2,3].map((item) => <div className="h-16 animate-pulse rounded-xl bg-slate-100" key={item} />)}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Post</th><th>Requested By</th><th>Requested On</th><th className="text-center">Actions</th></tr></thead><tbody>{pending.map((draft) => <tr className="border-t border-slate-100" key={draft.id}><td className="px-6 py-4"><div className="flex items-center gap-3"><Thumb draft={draft} /><div><p className="font-bold">{postTitle(draft)}</p><p className="max-w-72 truncate text-xs text-slate-500">{draft.enhanced_prompt || draft.original_prompt}</p></div></div></td><td><p className="font-semibold">{draft.owner_name}</p><p className="text-xs text-slate-500">Marketing Team</p></td><td>{formatDate(draft.approvals[0]?.created_at || draft.updated_at)}</td><td><div className="flex justify-center gap-2"><button className="icon-button !border !border-slate-200 !text-blue-600" onClick={() => setViewing(draft)}><Eye size={17} /></button><button className="icon-button !border !border-slate-200 !text-emerald-600" onClick={() => action.mutate({ id: draft.id, name: "approve" })}><Check size={17} /></button><button className="icon-button !border !border-slate-200 !text-red-500" onClick={() => action.mutate({ id: draft.id, name: "reject" })}><X size={17} /></button></div></td></tr>)}</tbody></table>{!pending.length && <div className="p-12 text-center text-slate-500">No posts are waiting for approval.</div>}</div>}</section>
    <section className="sa-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6"><h2 className="text-lg font-black">Content Calendar</h2><div className="flex items-center gap-2"><button className="secondary-button" onClick={() => setMonth(new Date())}>Today</button><button className="icon-button !border !border-slate-200" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}><ChevronLeft size={18} /></button><button className="icon-button !border !border-slate-200" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}><ChevronRight size={18} /></button><span className="secondary-button px-4">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span></div></div><div className="grid min-w-[900px] grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold uppercase">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div className="p-3" key={day}>{day}</div>)}</div><div className="grid min-w-[900px] grid-cols-7">{calendar.map((day) => <div className={`min-h-36 border-b border-r border-slate-100 p-2 ${day.current ? "bg-white" : "bg-slate-50/60 text-slate-400"}`} key={day.key}><span className="text-xs font-semibold">{day.date.getDate()}</span><div className="mt-2 space-y-1.5">{day.posts.slice(0,3).map(({ draft, platform }) => <button className="block w-full rounded-lg bg-blue-50 p-2 text-left text-[11px] text-blue-900 hover:bg-blue-100" key={platform.id} onClick={() => setViewing(draft)}><span className="font-bold">{new Date(platform.scheduled_datetime || platform.published_datetime || draft.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span><span className="mt-1 block truncate">{postTitle(draft)}</span></button>)}</div></div>)}</div><p className="p-5 text-xs text-slate-500">All times are shown in your local timezone.</p></section>
    <AnimatePresence>{createOpen && <CreatePost form={form} setForm={setForm} pending={create.isPending} onClose={() => setCreateOpen(false)} onSubmit={() => create.mutate()} />}{viewing && <PostDetails draft={viewing} pending={action.isPending} onClose={() => setViewing(null)} onAction={(name) => action.mutate({ id:viewing.id, name })} />}</AnimatePresence></div>;
}

function CreatePost({ form, setForm, pending, onClose, onSubmit }: { form: CreateForm; setForm: (form: CreateForm) => void; pending: boolean; onClose: () => void; onSubmit: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.form initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.97}} className="w-full max-w-xl rounded-3xl bg-white shadow-2xl" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="flex justify-between border-b border-slate-100 p-6"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-600">Social Publisher</p><h2 className="mt-1 text-2xl font-black">Create Post</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></div><div className="space-y-5 p-6"><label className="field"><span>Post content *</span><textarea required rows={6} placeholder="What would you like to share?" value={form.prompt} onChange={(event) => setForm({...form,prompt:event.target.value})} /></label><fieldset><legend className="mb-2 text-sm font-semibold">Channels *</legend><div className="grid grid-cols-2 gap-2">{platforms.map((name) => <label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${form.platforms.includes(name)?"border-blue-400 bg-blue-50 text-blue-700":"border-slate-200"}`} key={name}><input className="mr-2 accent-blue-600" type="checkbox" checked={form.platforms.includes(name)} onChange={() => setForm({...form,platforms:form.platforms.includes(name)?form.platforms.filter((item)=>item!==name):[...form.platforms,name]})} />{platformMeta[name].label}</label>)}</div></fieldset><label className="field"><span>Schedule (Optional)</span><input type="datetime-local" value={form.schedule} onChange={(event) => setForm({...form,schedule:event.target.value})} /></label></div><div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button px-6" disabled={pending||!form.platforms.length}>{pending?"Creating...":"Create Post"}</button></div></motion.form></div>; }
function PostDetails({ draft, pending, onClose, onAction }: { draft: Draft; pending: boolean; onClose: () => void; onAction: (name:"approve"|"reject"|"publish") => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.div initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.97}} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex justify-between border-b border-slate-100 p-6"><div><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{draft.workflow_state.replaceAll("_"," ")}</span><h2 className="mt-3 text-2xl font-black">{postTitle(draft)}</h2><p className="mt-1 text-sm text-slate-500">by {draft.owner_name}</p></div><button className="icon-button" onClick={onClose}><X /></button></div><div className="p-6"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{draft.enhanced_prompt||draft.original_prompt}</p><div className="mt-5 flex flex-wrap gap-2">{draft.platforms.map((platform) => <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold" key={platform.id}>{platformMeta[platform.platform].label}</span>)}</div></div><div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4">{draft.workflow_state==="IN_REVIEW"&&<><button className="secondary-button text-red-600" disabled={pending} onClick={()=>onAction("reject")}>Reject</button><button className="secondary-button text-emerald-600" disabled={pending} onClick={()=>onAction("approve")}>Approve</button></>}<button className="primary-button min-h-10 px-5" disabled={pending} onClick={()=>onAction("publish")}><Send size={16}/>Publish</button></div></motion.div></div>; }
function Thumb({ draft }: { draft: Draft }) { const image=draft.platforms.flatMap((platform)=>platform.images).find((item)=>item.asset_url)?.asset_url; return image?<Image unoptimized alt="Post thumbnail" className="h-12 w-12 rounded-lg object-cover" height={48} src={image} width={48}/>:<span className="grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-white"><Instagram size={20}/></span>; }
function buildCalendar(month: Date, drafts: Draft[], active: PlatformName) { const first=new Date(month.getFullYear(),month.getMonth(),1); const start=new Date(first);start.setDate(1-first.getDay());return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);const posts=drafts.flatMap((draft)=>draft.platforms.filter((platform)=>{const value=platform.scheduled_datetime||platform.published_datetime;return platform.platform===active&&value&&new Date(value).toDateString()===date.toDateString();}).map((platform)=>({draft,platform})));return{key:date.toISOString(),date,current:date.getMonth()===month.getMonth(),posts};}); }
function postTitle(draft: Draft){return (draft.original_prompt||draft.enhanced_prompt||"Untitled post").split(/[.!?\n]/)[0].slice(0,55);}
function formatDate(value:string){return new Date(value).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}