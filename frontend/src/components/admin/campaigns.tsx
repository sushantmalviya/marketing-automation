"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2, Check, ChevronDown, ChevronLeft, ChevronRight,
  Eye, Mail, Megaphone, MessageCircle, Mic, Paperclip, Phone,
  Search, Send, Smile, Users, X,
} from "lucide-react";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { apiClient, parseApiError } from "@/services/api-client";
import { toast } from "sonner";

type Campaign = {
  id: number;
  campaign_name: string;
  task_id: number;
  task_name: string;
  audience_name: string;
  channels: string[];
  status: string;
  scheduled_at: string | null;
  created_at: string;
  submitted_at: string | null;
  contacts: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  submitted_by_name: string;
  approved_by: string | null;
  rejection_reason: string | null;
  review_comments: string | null;
  available_actions: string[];
};
type PageData = { count: number; results: Campaign[] };
type Summary = { total_campaigns: number; total_sent: number; delivered: number; opened: number; clicked: number };

type ChannelPreview = { channel: string; subject: string; body: string };
type CampaignDetail = {
  id: number;
  campaign_name: string;
  status: string;
  contacts: number;
  start_date: string;
  assigned_to: string;
  channels: ChannelPreview[];
  available_actions: string[];
};

type ChannelStats = {
  id: number; name: string;
  total: number; sent: number; failed: number; pending: number; delivered: number;
};
type DailySeries = { date: string; sent: number; delivered: number; failed: number };
type CampaignAnalytics = {
  campaign: { id: number; name: string; status: string; scheduled_at: string | null; started_at: string | null; completed_at: string | null };
  summary: { total: number; sent: number; failed: number; pending: number; delivered: number; success_rate: number };
  channels: ChannelStats[];
  daily_series: DailySeries[];
  recent_deliveries: unknown[];
};

const PAGE_SIZE = 10;
const statuses = ["All", "DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "SENDING", "COMPLETED", "PAUSED", "REJECTED", "FAILED"];
const fmt = (v: number) => new Intl.NumberFormat("en-IN").format(v || 0);
const rate = (part: number, total: number) => total ? `${((part / total) * 100).toFixed(2)}%` : "0.00%";
const pretty = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const avatarColor = (name: string) => {
  const colors = ["bg-indigo-100 text-indigo-700","bg-emerald-100 text-emerald-700","bg-blue-100 text-blue-700","bg-violet-100 text-violet-700","bg-orange-100 text-orange-700","bg-pink-100 text-pink-700"];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
};

const statusStyle: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border border-amber-200",
  APPROVED: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  SCHEDULED: "bg-orange-50 text-orange-700 border border-orange-200",
  SENDING: "bg-blue-50 text-blue-700 border border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PAUSED: "bg-violet-50 text-violet-700",
  REJECTED: "bg-red-50 text-red-700 border border-red-200",
  FAILED: "bg-red-50 text-red-700",
};

function ChannelIcon({ name }: { name: string }) {
  const n = name.toUpperCase();
  if (n.includes("WHATS")) return <span title={name} className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-emerald-600"><MessageCircle size={14} /></span>;
  if (n.includes("SMS")) return <span title={name} className="grid h-7 w-7 place-items-center rounded-full bg-amber-50 text-amber-600"><MessageCircle size={14} /></span>;
  return <span title={name} className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-blue-600"><Mail size={14} /></span>;
}

export function AdminCampaigns() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<Campaign | null>(null);
  const [analyticsId, setAnalyticsId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const campaigns = useQuery({
    queryKey: ["admin-campaigns", page, search, status],
    queryFn: async () => (await apiClient.get<PageData>("/api/campaigns/my/", {
      params: { page, search: search || undefined, status: status === "All" ? undefined : status },
    })).data,
  });

  const summary = useQuery({
    queryKey: ["admin-campaign-summary"],
    queryFn: async () => (await apiClient.get<Summary>("/api/campaigns/summary/")).data,
  });

  const approve = useMutation({
    mutationFn: (id: number) => apiClient.post(`/api/campaigns/${id}/approve/`, {}),
    onSuccess: () => { toast.success("Campaign approved"); void client.invalidateQueries({ queryKey: ["admin-campaigns"] }); },
    onError: (err) => toast.error(parseApiError(err)),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiClient.post(`/api/campaigns/${id}/reject/`, { rejection_reason: reason }),
    onSuccess: () => {
      toast.success("Campaign rejected");
      setRejectId(null); setRejectReason("");
      void client.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (err) => toast.error(parseApiError(err)),
  });

  const data = campaigns.data;
  const rows = data?.results ?? [];
  const totals = summary.data;
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  const statCards = [
    { title: "Total Campaigns", value: totals?.total_campaigns ?? 0, note: "All time",      icon: Megaphone, bg: "bg-blue-50",   iconColor: "text-blue-500"   },
    { title: "Total Sent",      value: totals?.total_sent ?? 0,       note: "All time",      icon: Send,      bg: "bg-emerald-50", iconColor: "text-emerald-500" },
    { title: "Delivered",       value: totals?.delivered ?? 0,        note: rate(totals?.delivered ?? 0, totals?.total_sent ?? 0), icon: Send, bg: "bg-violet-50", iconColor: "text-violet-500" },
    { title: "Opened",          value: totals?.opened ?? 0,           note: rate(totals?.opened ?? 0, totals?.total_sent ?? 0),    icon: Mail, bg: "bg-orange-50", iconColor: "text-orange-500" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title mt-2">Campaigns</h1>
        <p className="page-subtitle">Run marketing campaigns</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, i) => (
          <motion.article key={card.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
            className="sa-card flex items-center gap-5 p-5">
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${card.bg} ${card.iconColor}`}>
              <card.icon size={26} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-500">{card.title}</p>
              <strong className="mt-0.5 block text-2xl font-black tracking-tight text-slate-950">
                {summary.isLoading ? "—" : fmt(card.value)}
              </strong>
              <p className="mt-0.5 text-xs font-semibold text-blue-500">{card.note}</p>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Table card */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sa-card mt-6 overflow-visible">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
          <label className="relative flex-1 min-w-56 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              placeholder="Search campaigns..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </label>
          <div className="relative min-w-44">
            <span className="absolute left-4 top-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</span>
            <select
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pb-1 pl-4 pr-9 pt-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="All">All Status</option>
              {statuses.slice(1).map(s => <option key={s} value={s}>{pretty(s)}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          </div>
        </div>

        {/* Table */}
        {campaigns.isLoading ? (
          <div className="space-y-3 p-6">{[1,2,3,4,5].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : campaigns.isError ? (
          <div className="p-10 text-center text-red-600 text-sm">{parseApiError(campaigns.error)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Start Date</th>
                  <th className="px-4 py-3.5">Assigned To</th>
                  <th className="px-4 py-3.5">Channels</th>
                  <th className="px-4 py-3.5">Contacts</th>
                  <th className="px-4 py-3.5 w-40 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-t border-slate-100 transition last:border-0 hover:bg-blue-50/30">
                    {/* Title */}
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{row.campaign_name}</td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusStyle[row.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {pretty(row.status)}
                      </span>
                    </td>

                    {/* Start Date */}
                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400">📅</span>
                        {new Date(row.scheduled_at || row.submitted_at || row.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3.5">
                      {row.submitted_by_name ? (
                        <span className="flex items-center gap-2">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${avatarColor(row.submitted_by_name)}`}>
                            {initials(row.submitted_by_name)}
                          </span>
                          <span className="text-slate-700">{row.submitted_by_name}</span>
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>

                    {/* Channels */}
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1">
                        {row.channels.length ? row.channels.map(ch => <ChannelIcon key={ch} name={ch} />) : <span className="text-slate-400">—</span>}
                      </div>
                    </td>

                    {/* Contacts */}
                    <td className="px-4 py-3.5 font-semibold text-slate-700">{fmt(row.contacts)}</td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 w-40 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Approve */}
                        <button
                          title="Approve"
                          disabled={approve.isPending || !row.available_actions.includes("approve")}
                          onClick={() => approve.mutate(row.id)}
                          className={`tbl-action ${row.available_actions.includes("approve") ? "tbl-action-approve text-emerald-500" : "cursor-not-allowed text-slate-300 opacity-40"}`}>
                          <Check size={15} />
                        </button>
                        {/* Reject */}
                        <button
                          title="Reject"
                          disabled={!row.available_actions.includes("reject")}
                          onClick={() => { setRejectId(row.id); setRejectReason(""); }}
                          className={`tbl-action ${row.available_actions.includes("reject") ? "tbl-action-reject text-red-400" : "cursor-not-allowed text-slate-300 opacity-40"}`}>
                          <X size={15} />
                        </button>
                        {/* View */}
                        <button
                          title="View"
                          onClick={() => setDetails(row)}
                          className="tbl-action tbl-action-view text-slate-400">
                          <Eye size={15} />
                        </button>
                        {/* Analytics */}
                        <button
                          title="Analytics"
                          onClick={() => setAnalyticsId(row.id)}
                          className="tbl-action tbl-action-chart text-slate-400">
                          <BarChart2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="p-14 text-center text-sm text-slate-500">No campaigns match your filters.</div>
            )}
          </div>
        )}

        {/* Pagination */}
        {(data?.count ?? 0) > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <span className="text-xs text-slate-500">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, data?.count ?? 0)} to {Math.min(page * PAGE_SIZE, data?.count ?? 0)} of {data?.count ?? 0} campaigns
            </span>
            <div className="flex items-center gap-1">
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500
                  transition-all duration-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50
                  hover:shadow-[0_4px_12px_rgba(37,99,235,.15)] hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`grid h-8 w-8 place-items-center rounded-lg border text-xs font-bold
                      transition-all duration-200 hover:-translate-y-0.5
                      ${p === page
                        ? "border-blue-500 bg-blue-500 text-white shadow-[0_4px_12px_rgba(37,99,235,.35)]"
                        : "border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 hover:shadow-[0_4px_12px_rgba(37,99,235,.15)]"
                      }`}>
                    {p}
                  </button>
                );
              })}
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500
                  transition-all duration-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50
                  hover:shadow-[0_4px_12px_rgba(37,99,235,.15)] hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </motion.section>

      {/* Campaign detail modal */}
      <AnimatePresence>
        {details && (
          <CampaignDetailModal
            campaignId={details.id}
            onClose={() => setDetails(null)}
            onApprove={(id) => { approve.mutate(id); setDetails(null); }}
            onReject={(id) => { setDetails(null); setRejectId(id); setRejectReason(""); }}
            approving={approve.isPending}
          />
        )}
      </AnimatePresence>

      {/* Campaign analytics modal */}
      <AnimatePresence>
        {analyticsId !== null && (
          <CampaignAnalyticsModal
            campaignId={analyticsId}
            campaignRow={rows.find(r => r.id === analyticsId) ?? null}
            onClose={() => setAnalyticsId(null)}
          />
        )}
      </AnimatePresence>

      {/* Reject modal */}
      <AnimatePresence>
        {rejectId !== null && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .97 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-black text-slate-900">Reject Campaign</h2>
              <p className="mt-1 text-sm text-slate-500">Please provide a reason for rejection.</p>
              <textarea
                className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
                rows={3} placeholder="Rejection reason..."
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-3">
                <button className="secondary-button px-4" onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</button>
                <button
                  className="rounded-xl bg-red-500 px-5 py-2 text-sm font-bold text-white
                    transition-all duration-200
                    hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(239,68,68,.35)]
                    active:translate-y-0 active:shadow-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  disabled={!rejectReason.trim() || reject.isPending}
                  onClick={() => reject.mutate({ id: rejectId, reason: rejectReason })}>
                  {reject.isPending ? "Rejecting…" : "Confirm Reject"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Campaign Detail Modal ────────────────────────────────────────────────────

function CampaignDetailModal({
  campaignId,
  onClose,
  onApprove,
  onReject,
  approving,
}: {
  campaignId: number;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  approving: boolean;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaign-detail", campaignId],
    queryFn: async () =>
      (await apiClient.get<CampaignDetail>(`/api/campaigns/${campaignId}/detail/`)).data,
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-7 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-900">Campaign Details</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              View campaign content and details across all selected channels.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-7">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-52 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : isError ? (
            <div className="p-10 text-center text-sm text-red-600">{parseApiError(error)}</div>
          ) : data ? (
            <>
              {/* Campaign info row */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-7 py-5">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-500">
                    <Megaphone size={22} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-slate-900">{data.campaign_name}</span>
                      <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${statusStyle[data.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {pretty(data.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400">Start Date</span>
                        <span className="text-slate-400">📅</span>
                        <span>
                          {new Date(data.start_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                      {data.assigned_to && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-400">Assigned To</span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${avatarColor(data.assigned_to)}`}>
                            {initials(data.assigned_to)}
                          </span>
                          <span>{data.assigned_to}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Contacts</p>
                  <strong className="text-2xl font-black text-slate-900">{fmt(data.contacts)}</strong>
                </div>
              </div>

              {/* Channel Previews */}
              <div className="px-7 py-6">
                <h3 className="text-sm font-black text-slate-800">Channel Previews</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Below is how your campaign will appear on each selected channel.
                </p>

                {data.channels.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-400">No channel content available.</p>
                ) : (
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {data.channels.map((ch) => (
                      <ChannelPreviewCard key={ch.channel} preview={ch} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-7 py-4">
          {data?.available_actions.includes("approve") ? (
            <div className="flex gap-3">
              <button
                className="secondary-button px-4 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => onReject(campaignId)}
              >
                Reject
              </button>
              <button
                className="primary-button px-5"
                disabled={approving}
                onClick={() => onApprove(campaignId)}
              >
                <Check size={15} /> Approve
              </button>
            </div>
          ) : (
            <span />
          )}
          <button className="secondary-button px-5" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Channel Preview Cards ─────────────────────────────────────────────────────

function ChannelPreviewCard({ preview }: { preview: ChannelPreview }) {
  const code = preview.channel.toUpperCase();
  const isEmail = code.includes("EMAIL");
  const isWhatsApp = code.includes("WHATS") || code.includes("WHATSAPP");
  const isSms = code.includes("SMS");

  if (isEmail) return <EmailPreview subject={preview.subject} body={preview.body} />;
  if (isWhatsApp) return <WhatsAppPreview body={preview.body} />;
  if (isSms) return <SmsPreview body={preview.body} />;

  // Generic fallback
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-slate-600">
        <MessageCircle size={16} />
        <span className="text-sm font-bold">{preview.channel}</span>
      </div>
      <div className="flex-1 p-4 text-sm text-slate-700 whitespace-pre-wrap">{preview.body}</div>
    </div>
  );
}

function EmailPreview({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-100 text-blue-600">
          <Mail size={13} />
        </span>
        <span className="text-sm font-bold text-slate-700">Email</span>
      </div>
      {/* Subject line */}
      <div className="border-b border-slate-100 px-4 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Subject</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800 line-clamp-1">{subject || "—"}</p>
      </div>
      {/* Body */}
      <div className="flex-1 p-4">
        <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-[10]">{body}</p>
      </div>
    </div>
  );
}

function WhatsAppPreview({ body }: { body: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <MessageCircle size={13} />
        </span>
        <span className="text-sm font-bold text-emerald-700">WhatsApp</span>
      </div>
      {/* Chat area */}
      <div className="flex flex-1 flex-col bg-[#ece5dd] p-4">
        <div className="max-w-[90%] self-start rounded-b-2xl rounded-tr-2xl bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{body}</p>
          <p className="mt-1.5 text-right text-[10px] text-slate-400">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
      {/* Input bar */}
      <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <Smile size={18} className="text-slate-400" />
        <span className="flex-1 text-sm text-slate-400">Type a message</span>
        <Paperclip size={16} className="text-slate-400" />
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white">
          <Mic size={13} />
        </span>
      </div>
    </div>
  );
}

function SmsPreview({ body }: { body: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-amber-600">
          <MessageCircle size={13} />
        </span>
        <span className="text-sm font-bold text-amber-700">SMS</span>
      </div>
      {/* Phone mockup body */}
      <div className="flex flex-1 flex-col items-center bg-slate-100 p-4">
        <span className="mb-1 grid h-10 w-10 place-items-center rounded-full bg-slate-300 text-slate-500">
          <Phone size={16} />
        </span>
        <p className="text-xs font-semibold text-slate-600">Text Message</p>
        <p className="mb-3 text-[10px] text-slate-400">
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <div className="w-full rounded-2xl bg-slate-200 px-4 py-3">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{body}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Analytics Modal ─────────────────────────────────────────────────

const DONUT_COLORS = ["#22c55e", "#f97316", "#cbd5e1"]; // delivered, failed, not-sent

function CampaignAnalyticsModal({
  campaignId,
  campaignRow,
  onClose,
}: {
  campaignId: number;
  campaignRow: Campaign | null;
  onClose: () => void;
}) {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaign-analytics", campaignId],
    queryFn: async () =>
      (await apiClient.get<CampaignAnalytics>(`/api/campaigns/${campaignId}/analytics/`)).data,
  });

  // Select first channel tab once loaded
  const channels = data?.channels ?? [];
  const selectedChannel =
    activeChannel && channels.find((c) => c.name === activeChannel)
      ? activeChannel
      : channels[0]?.name ?? null;
  const ch = channels.find((c) => c.name === selectedChannel) ?? channels[0];

  const summary = data?.summary;
  const totalContacts = campaignRow?.contacts ?? summary?.total ?? 0;

  // Stat cards for the selected channel
  const pct = (n: number, d: number) =>
    d ? `(${((n / d) * 100).toFixed(2)}%)` : "(0.00%)";

  const chStats = ch
    ? [
        { label: "Total Contacts", value: totalContacts, note: "(100%)",           color: "text-blue-600",    bg: "bg-blue-50",    icon: Users   },
        { label: "Sent",           value: ch.sent,       note: pct(ch.sent, totalContacts),      color: "text-emerald-600", bg: "bg-emerald-50", icon: Send    },
        { label: "Failed",         value: ch.failed,     note: pct(ch.failed, totalContacts),    color: "text-red-500",     bg: "bg-red-50",     icon: X       },
        { label: "Delivered",      value: ch.delivered,  note: pct(ch.delivered, totalContacts), color: "text-violet-600",  bg: "bg-violet-50",  icon: Mail    },
      ]
    : [];

  // Donut chart data
  const notDelivered = ch ? Math.max(0, ch.sent - ch.delivered - ch.failed) : 0;
  const donutData = ch
    ? [
        { name: `Delivered`, value: ch.delivered },
        { name: `Failed`,    value: ch.failed    },
        { name: `Pending`,   value: notDelivered  },
      ]
    : [];

  // Format daily series dates
  const series = (data?.daily_series ?? []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-7 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-900">Campaign Performance</h2>
            <p className="mt-0.5 text-sm text-slate-500">Detailed performance metrics across all channels.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-7">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-10 text-center text-sm text-red-600">{parseApiError(error)}</div>
          ) : data ? (
            <>
              {/* Campaign info banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-7 py-4">
                <div className="flex items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-500">
                    <Megaphone size={20} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-900">{data.campaign.name}</span>
                      <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${statusStyle[data.campaign.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {pretty(data.campaign.status)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      {campaignRow?.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <span>📅</span>
                          <span className="font-semibold text-slate-400">Start Date:</span>
                          {new Date(campaignRow.scheduled_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                      {campaignRow?.submitted_by_name && (
                        <span className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-400">Assigned To:</span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${avatarColor(campaignRow.submitted_by_name)}`}>
                            {initials(campaignRow.submitted_by_name)}
                          </span>
                          <span>{campaignRow.submitted_by_name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <Users size={18} className="text-blue-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Contacts</p>
                    <strong className="text-lg font-black text-slate-900">{fmt(totalContacts)}</strong>
                  </div>
                </div>
              </div>

              {/* Channel tabs */}
              {channels.length > 0 && (
                <div className="border-b border-slate-100 px-7">
                  <div className="flex gap-1">
                    {channels.map((c) => {
                      const isActive = c.name === selectedChannel;
                      const n = c.name.toUpperCase();
                      const tabIcon = n.includes("EMAIL")
                        ? <Mail size={14} />
                        : n.includes("WHATS")
                        ? <MessageCircle size={14} className="text-emerald-500" />
                        : <MessageCircle size={14} className="text-amber-500" />;
                      return (
                        <button
                          key={c.name}
                          onClick={() => setActiveChannel(c.name)}
                          className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-bold transition ${
                            isActive
                              ? "border-blue-500 text-blue-600"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {tabIcon}
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stat cards */}
              {ch && (
                <div className="grid grid-cols-2 gap-3 px-7 py-5 sm:grid-cols-4">
                  {chStats.map((s) => (
                    <div key={s.label} className={`flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 ${s.bg} px-3 py-4`}>
                      <span className={`grid h-10 w-10 place-items-center rounded-full bg-white/70 ${s.color}`}>
                        <s.icon size={18} />
                      </span>
                      <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                      <strong className="text-xl font-black text-slate-900">{fmt(s.value)}</strong>
                      <p className="text-[11px] text-slate-400">{s.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Charts */}
              <div className="grid gap-6 px-7 pb-7 lg:grid-cols-5">
                {/* Line chart – Performance Overview */}
                <div className="lg:col-span-3">
                  <p className="mb-3 text-sm font-black text-slate-800">Performance Overview</p>
                  {series.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any, name: any) => [
                            fmt(typeof value === "number" ? value : Number(value) || 0),
                            String(name ?? "").replace(/^\w/, (c: string) => c.toUpperCase()),
                          ]}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="sent"      stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Sent"      />
                        <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Delivered" />
                        <Line type="monotone" dataKey="failed"    stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Failed"    />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
                      No delivery data yet
                    </div>
                  )}
                </div>

                {/* Donut chart – Delivery Distribution */}
                <div className="lg:col-span-2">
                  <p className="mb-3 text-sm font-black text-slate-800">Delivery Distribution</p>
                  {ch && ch.sent > 0 ? (
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <PieChart width={180} height={180}>
                          <Pie
                            data={donutData}
                            cx={85}
                            cy={85}
                            innerRadius={54}
                            outerRadius={80}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={2}
                          >
                            {donutData.map((_, i) => (
                              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                        {/* Center label */}
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <strong className="text-lg font-black text-slate-900">{fmt(ch.sent)}</strong>
                          <span className="text-[10px] font-semibold text-slate-400">Sent</span>
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="mt-3 space-y-1.5 w-full">
                        {donutData.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                              <span className="text-slate-600">{d.name}</span>
                            </span>
                            <span className="font-semibold text-slate-700">
                              {fmt(d.value)} {pct(d.value, ch.sent)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
                      No delivery data yet
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-7 py-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Metrics are updated in real-time
          </span>
          <button className="secondary-button px-5" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
