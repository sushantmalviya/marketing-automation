"use client";

import { useQueries } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, CalendarDays, CheckCircle2, Download,
  Facebook, Instagram, Linkedin, Mail, Megaphone,
  MessageSquare, Send, TrendingDown, TrendingUp,
  Twitter, UsersRound, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  Cell, Legend, Line, LineChart, Pie, PieChart,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useMemo, useRef, useEffect, useState } from "react";
import { apiClient, parseApiError } from "@/services/api-client";
import { superAdminService, type AnalyticsData } from "@/services/super-admin.service";
import { useDateRange } from "@/components/ui/date-range-picker";

/* ─── Types ─────────────────────────────────────────────── */
type SocialPlatform = "INSTAGRAM" | "X" | "FACEBOOK" | "LINKEDIN";
type CampaignChannel = "EMAIL" | "WHATSAPP" | "SMS";
type Platform = { platform: SocialPlatform; status: string; scheduled_datetime: string | null; published_datetime: string | null };
type Draft = { id: string; workflow_state: string; platforms: Platform[]; created_at: string };
type Campaign = { id: number; campaign_name: string; status: string; contacts: number; sent: number; delivered: number; opened: number; clicked: number; created_at: string };
type CampaignResponse = { count: number; results: Campaign[] };

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = (n: number) => Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
const pct = (n: number) => `${n}%`;
const sameDay = (v: string | null | undefined, d: Date) => !!v && new Date(v).toDateString() === d.toDateString();
const shortTitle = (s: string) => s.length > 14 ? `${s.slice(0, 13)}…` : s;

const SOCIAL_META: Record<SocialPlatform, { label: string; Icon: typeof Instagram; color: string; bg: string; stroke: string }> = {
  INSTAGRAM: { label: "Instagram", Icon: Instagram, color: "text-pink-500",  bg: "bg-pink-50",   stroke: "#ec4899" },
  X:         { label: "X (Twitter)", Icon: Twitter, color: "text-slate-800", bg: "bg-slate-100", stroke: "#1e293b" },
  FACEBOOK:  { label: "Facebook",  Icon: Facebook, color: "text-blue-600",  bg: "bg-blue-50",   stroke: "#2563eb" },
  LINKEDIN:  { label: "LinkedIn",  Icon: Linkedin, color: "text-sky-700",   bg: "bg-sky-50",    stroke: "#0369a1" },
};
const CHANNEL_META: Record<CampaignChannel, { label: string; color: string; stroke: string }> = {
  EMAIL:    { label: "Email",    color: "text-blue-600",   stroke: "#2563eb" },
  WHATSAPP: { label: "WhatsApp", color: "text-emerald-600",stroke: "#16a34a" },
  SMS:      { label: "SMS",      color: "text-orange-500", stroke: "#f97316" },
};
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "#10b981", SENDING: "#3b82f6", SCHEDULED: "#8b5cf6",
  APPROVED: "#06b6d4", PENDING_APPROVAL: "#f59e0b", DRAFT: "#94a3b8",
  FAILED: "#ef4444", REJECTED: "#6b7280",
};
const PIE_COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#94a3b8","#ec4899"];

/* ─── Sub-components ─────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, tone, delta, delay = 0 }:
  { label: string; value: string | number; sub?: string; icon: React.ElementType; tone: string; delta?: number; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="sa-card relative overflow-hidden p-5">
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 ${tone.replace("text-","bg-")}`} />
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone.replace("text-","bg-").replace("-600","-50").replace("-500","-50")} ${tone}`}>
        <Icon size={20} />
      </div>
      <strong className="mt-4 block text-2xl font-black tracking-tight text-slate-900">{typeof value === "number" ? fmt(value) : value}</strong>
      <p className="mt-0.5 text-sm font-semibold text-slate-600">{label}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
      {delta !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta)}% vs prev period
        </div>
      )}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-slate-100 px-6 py-4">
      <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ label = "No data in this range" }: { label?: string }) {
  return (
    <div className="grid h-full min-h-[160px] place-items-center text-center text-slate-400">
      <div><BarChart3 className="mx-auto opacity-40" size={32} /><p className="mt-2 text-xs">{label}</p></div>
    </div>
  );
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-800">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="h-full rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export function AdminAnalytics() {
  const { startDate, endDate, picker } = useDateRange();
  const [socialTab, setSocialTab] = useState<SocialPlatform>("INSTAGRAM");
  const [channelTab, setChannelTab] = useState<CampaignChannel>("EMAIL");

  const [analyticsQ, draftsQ, campaignsQ] = useQueries({ queries: [
    {
      queryKey: ["admin-analytics", startDate, endDate],
      queryFn: () => superAdminService.analyticsWithRange(startDate, endDate),
    },
    {
      queryKey: ["analytics-drafts", startDate, endDate],
      queryFn: async () => (await apiClient.get<Draft[]>(`/api/content/content-drafts/?date_from=${startDate}&date_to=${endDate}`)).data,
    },
    {
      queryKey: ["analytics-campaigns", startDate, endDate],
      queryFn: async () => (await apiClient.get<CampaignResponse>("/api/campaigns/my/", { params: { page_size: 200, date_from: startDate, date_to: endDate } })).data,
    },
  ]});

  const loading = [analyticsQ, draftsQ, campaignsQ].some(q => q.isLoading);
  const err = [analyticsQ, draftsQ, campaignsQ].find(q => q.error)?.error;

  /* ── Derived data ── */
  const analytics = analyticsQ.data;
  const drafts = draftsQ.data ?? [];
  const campaigns = campaignsQ.data?.results ?? [];

  const platformRows = useMemo(() =>
    drafts.flatMap(d => d.platforms.map(p => ({ draft: d, platform: p }))),
    [drafts]);
  const socialRows = useMemo(() =>
    platformRows.filter(({ platform: p }) => p.platform === socialTab),
    [platformRows, socialTab]);

  // Social stats
  const socialPublished = socialRows.filter(({ platform: p }) => p.status === "POSTED").length;
  const socialScheduled = socialRows.filter(({ platform: p }) => p.scheduled_datetime && p.status !== "POSTED").length;
  const socialPending   = platformRows.filter(({ draft: d }) => d.workflow_state === "IN_REVIEW").length;
  const socialTotal     = platformRows.length;

  // Daily series for the selected social platform (last 14 days within range)
  const socialDailySeries = useMemo(() => {
    const days: { day: string; date: Date; published: number; scheduled: number }[] = [];
    const end = new Date(endDate + "T23:59:59");
    const start = new Date(endDate + "T00:00:00");
    start.setDate(start.getDate() - 13);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const snap = new Date(d);
      days.push({
        date: snap,
        day: snap.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        published: socialRows.filter(({ platform: p }) => sameDay(p.published_datetime, snap)).length,
        scheduled: socialRows.filter(({ platform: p }) => sameDay(p.scheduled_datetime, snap)).length,
      });
    }
    return days;
  }, [socialRows, endDate]);

  // Platform breakdown (all 4 social platforms)
  const platformBreakdown = useMemo(() =>
    (["INSTAGRAM", "X", "FACEBOOK", "LINKEDIN"] as SocialPlatform[]).map(pl => ({
      name: SOCIAL_META[pl].label,
      value: platformRows.filter(({ platform: p }) => p.platform === pl).length,
      color: SOCIAL_META[pl].stroke,
    })).filter(r => r.value > 0),
    [platformRows]);

  // Campaign stats
  const totalCampaigns  = campaignsQ.data?.count ?? 0;
  const activeCampaigns = campaigns.filter(c => ["SENDING","SCHEDULED","APPROVED"].includes(c.status)).length;
  const completedCampaigns = campaigns.filter(c => c.status === "COMPLETED").length;
  const totalLeads      = campaigns.reduce((s, c) => s + c.contacts, 0);
  const totalSent       = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalDelivered  = campaigns.reduce((s, c) => s + c.delivered, 0);
  const totalOpened     = campaigns.reduce((s, c) => s + c.opened, 0);
  const totalClicked    = campaigns.reduce((s, c) => s + c.clicked, 0);
  const deliveryRate    = totalSent ? +((totalDelivered / totalSent) * 100).toFixed(1) : 0;
  const openRate        = totalSent ? +((totalOpened / totalSent) * 100).toFixed(1) : 0;
  const clickRate       = totalSent ? +((totalClicked / totalSent) * 100).toFixed(1) : 0;

  // Campaign status breakdown for donut
  const campaignStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach(c => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] ?? "#94a3b8" }));
  }, [campaigns]);

  // Top campaigns bar chart
  const topCampaigns = useMemo(() =>
    [...campaigns]
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 6)
      .reverse()
      .map(c => ({ name: shortTitle(c.campaign_name), sent: c.sent, delivered: c.delivered, opened: c.opened, clicked: c.clicked })),
    [campaigns]);

  // Lead growth line chart (by campaign created_at grouped by date)
  const leadGrowth = useMemo(() => {
    const grouped: Record<string, number> = {};
    campaigns.forEach(c => {
      const d = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      grouped[d] = (grouped[d] ?? 0) + c.contacts;
    });
    return Object.entries(grouped).slice(-10).map(([name, contacts]) => ({ name, contacts }));
  }, [campaigns]);

  // Channel-specific analytics from API
  const emailData    = analytics?.email;
  const smsData      = analytics?.sms;
  const waData       = analytics?.whatsapp;
  const workflowData = analytics?.workflow;

  // Channel stats per selected tab
  const channelPanel = useMemo(() => {
    if (channelTab === "EMAIL") return {
      sent: emailData?.sent ?? 0,
      rates: [
        { label: "Open rate",         value: emailData?.open_rate ?? 0,        color: "#2563eb" },
        { label: "Click rate",        value: emailData?.click_rate ?? 0,       color: "#7c3aed" },
        { label: "Bounce rate",       value: emailData?.bounce_rate ?? 0,      color: "#ef4444" },
        { label: "Unsubscribe rate",  value: emailData?.unsubscribe_rate ?? 0, color: "#f97316" },
      ],
    };
    if (channelTab === "WHATSAPP") return {
      sent: waData?.sent ?? 0,
      rates: [
        { label: "Read rate",  value: waData?.read_rate ?? 0,  color: "#16a34a" },
        { label: "Reply rate", value: waData?.reply_rate ?? 0, color: "#0891b2" },
      ],
    };
    return {
      sent: smsData?.sent ?? 0,
      rates: [
        { label: "Delivery rate", value: smsData?.delivery_rate ?? 0, color: "#f97316" },
      ],
    };
  }, [channelTab, emailData, smsData, waData]);

  /* ── Export ── */
  function exportCsv() {
    const rows = [
      ["Campaign", "Status", "Contacts", "Sent", "Delivered", "Opened", "Clicked"],
      ...campaigns.map(c => [c.campaign_name, c.status, c.contacts, c.sent, c.delivered, c.opened, c.clicked]),
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "analytics.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Loading / error states ── */
  if (loading) return (
    <div className="space-y-4">
      <div className="h-16 w-96 animate-pulse rounded-xl bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-[480px] animate-pulse rounded-2xl bg-white" />
        <div className="h-[480px] animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
  if (err) return <div className="sa-card p-10 text-red-600">{parseApiError(err)}</div>;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title mt-2">Analytics</h1>
          <p className="page-subtitle">View marketing metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {picker}
          <button onClick={exportCsv} aria-label="Export CSV"
            className="secondary-button grid min-h-11 place-items-center px-3 text-slate-500 hover:text-blue-600">
            <Download size={17} />
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <StatCard label="Social Posts" value={socialTotal}   icon={Instagram}  tone="text-pink-500"    sub={`${socialPublished} published`} delay={0}   />
        <StatCard label="Total Campaigns" value={totalCampaigns} icon={Megaphone} tone="text-blue-600"  sub={`${activeCampaigns} active`}    delay={0.04}/>
        <StatCard label="Messages Sent"   value={analytics ? (emailData?.sent??0)+(smsData?.sent??0)+(waData?.sent??0) : 0} icon={Send} tone="text-violet-600" sub="Email + SMS + WhatsApp" delay={0.08}/>
        <StatCard label="Leads Generated" value={totalLeads} icon={UsersRound}  tone="text-emerald-600" sub={`${completedCampaigns} campaigns done`} delay={0.12}/>
      </div>

      {/* ── Social Media + Campaign panels ── */}
      <div className="grid items-start gap-5 xl:grid-cols-2">

        {/* ═══ SOCIAL MEDIA ═══ */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="sa-card overflow-hidden">
          <SectionHeader title="Social Media" subtitle="Content drafts across all social platforms" />

          {/* Platform tabs */}
          <div className="flex border-b border-slate-100">
            {(["INSTAGRAM","X","FACEBOOK","LINKEDIN"] as SocialPlatform[]).map(pl => {
              const m = SOCIAL_META[pl];
              return (
                <button key={pl} onClick={() => setSocialTab(pl)}
                  className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-bold transition-colors
                    ${socialTab === pl ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                  <m.Icon className={socialTab === pl ? "text-blue-500" : m.color} size={14} />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Social KPI tiles */}
          <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            {[
              { label: "Published",  value: socialPublished, color: "text-blue-600" },
              { label: "Scheduled",  value: socialScheduled, color: "text-orange-500" },
              { label: "Total Posts",value: socialRows.length, color: "text-pink-600" },
              { label: "Pending",    value: socialPending,   color: "text-emerald-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-4 text-center">
                <strong className={`block text-xl font-black ${color}`}>{fmt(value)}</strong>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Trend area chart */}
          <div className="p-4">
            <p className="mb-2 text-xs font-bold text-slate-600">Activity — last 14 days</p>
            <div className="h-44">
              {socialDailySeries.some(d => d.published + d.scheduled > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={socialDailySeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="pubGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="schGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" fontSize={9} tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis fontSize={9} tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }} />
                    <Area type="monotone" dataKey="published" stroke="#2563eb" strokeWidth={2} fill="url(#pubGrad)" dot={false} name="Published" />
                    <Area type="monotone" dataKey="scheduled" stroke="#16a34a" strokeWidth={2} fill="url(#schGrad)" dot={false} name="Scheduled" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>
          </div>

          {/* Platform breakdown donut */}
          <div className="border-t border-slate-100 p-4">
            <p className="mb-3 text-xs font-bold text-slate-600">Platform distribution</p>
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 shrink-0">
                {platformBreakdown.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={platformBreakdown} dataKey="value" innerRadius={28} outerRadius={50} paddingAngle={2}>
                        {platformBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState label="No posts" />}
              </div>
              <div className="flex-1 space-y-1.5">
                {(["INSTAGRAM","X","FACEBOOK","LINKEDIN"] as SocialPlatform[]).map(pl => {
                  const m = SOCIAL_META[pl];
                  const count = platformRows.filter(({ platform: p }) => p.platform === pl).length;
                  const total = platformRows.length || 1;
                  return (
                    <div key={pl} className="flex items-center gap-2 text-xs">
                      <m.Icon className={m.color} size={12} />
                      <span className="w-20 text-slate-600">{m.label}</span>
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(count / total) * 100}%`, background: m.stroke }} />
                      </div>
                      <span className="w-5 text-right font-bold text-slate-700">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ CAMPAIGNS ═══ */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="sa-card overflow-hidden">
          <SectionHeader title="Campaigns" subtitle="Performance across all campaign channels" />

          {/* Channel tabs */}
          <div className="flex border-b border-slate-100">
            {(["EMAIL","WHATSAPP","SMS"] as CampaignChannel[]).map(ch => (
              <button key={ch} onClick={() => setChannelTab(ch)}
                className={`flex-1 border-b-2 py-3 text-xs font-bold transition-colors
                  ${channelTab === ch ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {CHANNEL_META[ch].label}
              </button>
            ))}
          </div>

          {/* Campaign KPI tiles */}
          <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            {[
              { label: "Campaigns", value: totalCampaigns },
              { label: "Active",    value: activeCampaigns },
              { label: "Completed", value: completedCampaigns },
              { label: "Leads",     value: totalLeads },
            ].map(({ label, value }) => (
              <div key={label} className="px-3 py-4 text-center">
                <strong className="block text-xl font-black text-slate-900">{fmt(value)}</strong>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Channel-specific rates */}
          <div className="border-b border-slate-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600">{CHANNEL_META[channelTab].label} — {fmt(channelPanel.sent)} sent</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Live API data</span>
            </div>
            <div className="space-y-3">
              {channelPanel.rates.map(r => <RateBar key={r.label} {...r} />)}
              {channelPanel.rates.length === 0 && <p className="text-xs text-slate-400">No rate data available</p>}
            </div>
          </div>

          {/* Delivery funnel */}
          <div className="border-b border-slate-100 p-4">
            <p className="mb-3 text-xs font-bold text-slate-600">Overall delivery funnel</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Sent",      value: totalSent,      color: "#2563eb" },
                { label: "Delivered", value: totalDelivered, color: "#10b981" },
                { label: "Opened",    value: totalOpened,    color: "#8b5cf6" },
                { label: "Clicked",   value: totalClicked,   color: "#f59e0b" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 py-3">
                  <strong className="block text-base font-black" style={{ color }}>{fmt(value)}</strong>
                  <p className="mt-0.5 text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Delivery rate", value: deliveryRate },
                { label: "Open rate",     value: openRate     },
                { label: "Click rate",    value: clickRate    },
              ].map(({ label, value }) => (
                <div key={label} className="text-center text-xs">
                  <strong className="block text-sm font-black text-slate-800">{value}%</strong>
                  <span className="text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status donut */}
          <div className="p-4">
            <p className="mb-2 text-xs font-bold text-slate-600">Campaign status distribution</p>
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 shrink-0">
                {campaignStatusData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={campaignStatusData} dataKey="value" innerRadius={28} outerRadius={50} paddingAngle={2}>
                        {campaignStatusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState label="No campaigns" />}
              </div>
              <div className="flex-1 space-y-1.5">
                {campaignStatusData.map(({ name, value, fill }) => (
                  <div key={name} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: fill }} />
                    <span className="flex-1 capitalize text-slate-600">{name.toLowerCase().replace(/_/g," ")}</span>
                    <span className="font-bold text-slate-700">{value}</span>
                  </div>
                ))}
                {!campaignStatusData.length && <p className="text-xs text-slate-400">No campaign data</p>}
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* ── Bottom charts row ── */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">

        {/* Campaign performance bar chart */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="sa-card overflow-hidden">
          <SectionHeader title="Campaign Performance" subtitle="Top campaigns by messages sent" />
          <div className="p-4">
            <div className="h-64">
              {topCampaigns.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCampaigns} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" fontSize={9} tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={80} fontSize={9} tick={{ fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="sent"      fill="#1e293b" radius={[0, 4, 4, 0]} maxBarSize={12} />
                    <Bar dataKey="delivered" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={12} />
                    <Bar dataKey="opened"    fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={12} />
                    <Bar dataKey="clicked"   fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>
          </div>
        </motion.section>

        {/* Lead growth + workflow */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          className="sa-card overflow-hidden">
          <SectionHeader title="Lead Growth" subtitle="Audience contacts from campaigns" />
          <div className="p-4">
            <div className="h-44">
              {leadGrowth.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={leadGrowth} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={9} tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis fontSize={9} tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }} />
                    <Area type="monotone" dataKey="contacts" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#leadGrad)" dot={{ r: 3, fill: "#8b5cf6" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>
          </div>

          {/* Workflow metrics */}
          {workflowData && (
            <div className="border-t border-slate-100 p-4">
              <p className="mb-3 text-xs font-bold text-slate-600">Automation workflow</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Executions",    value: fmt(workflowData.execution_count),        color: "text-blue-600"   },
                  { label: "Success rate",  value: pct(workflowData.success_rate),            color: "text-emerald-600"},
                  { label: "Failure rate",  value: pct(workflowData.failure_rate),            color: "text-red-500"   },
                  { label: "Avg duration",  value: `${Math.round(workflowData.average_duration)}s`, color: "text-slate-700" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <strong className={`block text-base font-black ${color}`}>{value}</strong>
                    <p className="mt-0.5 text-[10px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.section>
      </div>

      {/* ── Channel summary strip ── */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="sa-card overflow-hidden">
        <SectionHeader title="Channel Overview" subtitle="All communication channels at a glance" />
        <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {/* Email */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><Mail size={18} /></span>
              <div><p className="text-xs font-bold text-slate-700">Email</p><p className="text-[10px] text-slate-400">{fmt(emailData?.sent ?? 0)} sent</p></div>
            </div>
            <div className="space-y-2">
              <RateBar label="Open rate"        value={emailData?.open_rate ?? 0}        color="#2563eb" />
              <RateBar label="Click rate"       value={emailData?.click_rate ?? 0}       color="#7c3aed" />
              <RateBar label="Bounce rate"      value={emailData?.bounce_rate ?? 0}      color="#ef4444" />
              <RateBar label="Unsubscribe rate" value={emailData?.unsubscribe_rate ?? 0} color="#f97316" />
            </div>
          </div>
          {/* WhatsApp */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <MessageSquare size={18} />
              </span>
              <div><p className="text-xs font-bold text-slate-700">WhatsApp</p><p className="text-[10px] text-slate-400">{fmt(waData?.sent ?? 0)} sent</p></div>
            </div>
            <div className="space-y-2">
              <RateBar label="Read rate"  value={waData?.read_rate ?? 0}  color="#16a34a" />
              <RateBar label="Reply rate" value={waData?.reply_rate ?? 0} color="#0891b2" />
            </div>
          </div>
          {/* SMS */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-500"><Send size={18} /></span>
              <div><p className="text-xs font-bold text-slate-700">SMS</p><p className="text-[10px] text-slate-400">{fmt(smsData?.sent ?? 0)} sent</p></div>
            </div>
            <div className="space-y-2">
              <RateBar label="Delivery rate" value={smsData?.delivery_rate ?? 0} color="#f97316" />
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
