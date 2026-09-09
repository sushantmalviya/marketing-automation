"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BarChart3, Bold, Bookmark, Braces, CalendarClock, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDot, Clock3, Copy, Download, Eye, Facebook, FileText, Heart, Image as ImageIcon, Instagram, Italic, Link2, Linkedin, List, ListChecks, ListOrdered, LoaderCircle, Mail, Megaphone, MessageCircle, MessageSquare, Mic, MoreVertical, Pencil, Plus, RefreshCw, Repeat2, Save, Search, Send, Share2, ShieldCheck, Sparkles, Target, ThumbsUp, Trash2, Underline, User, UserRound, Users, WandSparkles, X, Info as InfoIcon } from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { apiClient, parseApiError, resolveApiUrl } from "@/services/api-client";
import { authService } from "@/services/auth.service";
import { useDateRange } from "@/components/ui/date-range-picker";
import { useAuth } from "@/providers/auth-provider";
import { PromptEnhancerModal } from "@/components/user/prompt-enhancer-modal";
import { TemplatePickerModal } from "@/components/modules/template-picker";

type TaskInfo = { id: number; title: string; description: string; instructions: string; audience: number; audience_name: string; channels: number[]; priority: string; status: string; due_date: string; created_at?: string };
type Assignment = { id: number; task: TaskInfo; status: string; remarks: string; created_at: string; updated_at: string; submitted_at: string | null };
type Campaign = { id: number; campaign_name: string; task_id: number; task_name: string; audience_name: string; channels: string[]; status: string; scheduled_at: string | null; contacts: number; sent: number; delivered: number; opened: number; clicked: number; created_at: string; available_actions: string[]; rejection_reason: string | null; review_comments: string | null };
type CampaignPage = { count: number; next: string | null; previous: string | null; results: Campaign[] };
type Channel = { id: number; name: string };
type Template = { id: number; name: string; channel: number; channel_name: string; subject: string; body: string; status: string; created_at: string };
type ChannelTemplate = { template_id: string; template_name: string; subject: string; body: string };
type DashboardSummary = { campaigns: { total: number; draft: number; scheduled: number; sending: number; completed: number }; deliveries?: { total: number; sent: number; failed: number; pending: number; delivered: number; success_rate: number }; recent_campaigns?: { id: number; name: string; status: string; created_at: string; scheduled_at: string | null; completed_at: string | null }[] };
type AudiencePreviewPage = { audience: { id: number; name: string }; total_customers: number; page: number; pages: number; preview: { id: number; data: Record<string, unknown> }[] };
type CampaignDraft = { task: string; name: string; description: string; template_id: string; template_name: string; channel: string; subject: string; body: string; scheduled_at: string; channelTemplates: Record<string, ChannelTemplate> };
type GeneratedContent = { id: string; content_type: string; platform: string; status: string; created_at: string; versions: { id: string; version_number: number; prompt: string; text_content: string; image_url: string | null; created_at: string }[] };
type ContentPlatformData = { id: string; platform: string; status: string; approval_status: string; error_message?: string; scheduled_datetime: string | null; published_datetime: string | null; caption: { caption_text: string; hashtags: string; cta: string } | null; images: { asset_url?: string; asset_name?: string }[] };
type ContentDraftData = { id: string; original_prompt: string; enhanced_prompt: string; workflow_state: string; platforms: ContentPlatformData[]; created_at: string; updated_at: string };

const campaignTone: Record<string, string> = { DRAFT: "bg-slate-100 text-slate-700", PENDING_APPROVAL: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", SCHEDULED: "bg-blue-50 text-blue-700 ring-1 ring-blue-200", SENDING: "bg-violet-50 text-violet-700 ring-1 ring-violet-200", COMPLETED: "bg-green-50 text-green-700 ring-1 ring-green-200", FAILED: "bg-red-50 text-red-600 ring-1 ring-red-200", REJECTED: "bg-slate-100 text-slate-500" };
const taskTone: Record<string, string> = { ASSIGNED: "bg-violet-50 text-violet-700", PENDING: "bg-amber-50 text-amber-700", IN_PROGRESS: "bg-blue-50 text-blue-700", SUBMITTED: "bg-cyan-50 text-cyan-700", APPROVED: "bg-emerald-50 text-emerald-700", COMPLETED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-600" };
const priorityTone: Record<string, string> = { HIGH: "bg-red-50 text-red-600 ring-1 ring-red-200", MEDIUM: "bg-amber-50 text-amber-600 ring-1 ring-amber-200", LOW: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" };
const pieColors = ["#3b82f6", "#f59e0b", "#10b981", "#6366f1", "#a855f7", "#22c55e", "#f43f5e", "#94a3b8"];
const editorTools = [{ label: "Bold", icon: Bold, cmd: "bold" }, { label: "Italic", icon: Italic, cmd: "italic" }, { label: "Underline", icon: Underline, cmd: "underline" }, { label: "Bulleted list", icon: List, cmd: "insertUnorderedList" }, { label: "Numbered list", icon: ListOrdered, cmd: "insertOrderedList" }, { label: "Link", icon: Link2, cmd: "createLink" }, { label: "Image", icon: ImageIcon, cmd: "insertImage" }, { label: "Variable", icon: Braces, cmd: "insertVariable" }] as const;
const campaignDraftKey = "auto_market_campaign_draft";
const emptyCampaignDraft: CampaignDraft = { task: "", name: "", description: "", template_id: "", template_name: "", channel: "", subject: "", body: "", scheduled_at: "", channelTemplates: {} };
const contentPlatforms = [{ value: "INSTAGRAM", label: "Instagram", icon: Instagram, tone: "text-pink-600" }, { value: "FACEBOOK", label: "Facebook", icon: Facebook, tone: "text-blue-600" }, { value: "LINKEDIN", label: "LinkedIn", icon: Linkedin, tone: "text-sky-700" }, { value: "X", label: "X", icon: null, tone: "text-slate-950" }] as const;
const readCampaignDraft = () => { if (typeof window === "undefined") return null; try { return JSON.parse(sessionStorage.getItem(campaignDraftKey) || "null") as CampaignDraft | null } catch { return null } };
const storeCampaignDraft = (draft: CampaignDraft | null) => { if (typeof window === "undefined") return; if (draft) sessionStorage.setItem(campaignDraftKey, JSON.stringify(draft)); else sessionStorage.removeItem(campaignDraftKey) };
const pretty = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const formatDate = (value: string) => new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const compactNumber = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const customerValue = (data: Record<string, unknown>, ...keys: string[]) => { const normalized = Object.fromEntries(Object.entries(data).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value])); for (const key of keys) { const value = normalized[key.toLowerCase().replace(/[^a-z0-9]/g, "")]; if (value !== undefined && value !== null && String(value).trim()) return String(value) } return "" };
const customerName = (data: Record<string, unknown>) => customerValue(data, "name", "full_name", "customer_name") || [customerValue(data, "first_name", "firstname"), customerValue(data, "last_name", "lastname")].filter(Boolean).join(" ") || "Customer";
const renderCustomerText = (text: string, data: Record<string, unknown>) => text.replace(/\{\{(.*?)\}\}/g, (_, field: string) => customerValue(data, field.trim()));

// Dummy trend data for sparklines
const generateTrend = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 40) + 10);
const sparklineData1 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData2 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData3 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData4 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData5 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData6 = generateTrend().map((v, i) => ({ i, v }));

function useWorkspaceData(dateFrom?: string, dateTo?: string) {
  const dateParams = dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : {};
  const tasks = useQuery({
    queryKey: ["user-tasks", dateFrom, dateTo],
    queryFn: async () => (await apiClient.get<Assignment[]>("/api/tasks/my/", { params: dateParams })).data,
  });
  const campaigns = useQuery({
    queryKey: ["user-campaigns-dashboard", dateFrom, dateTo],
    queryFn: async () => (await apiClient.get<CampaignPage>("/api/campaigns/my/", { params: { size: 100, ...dateParams } })).data,
  });
  const dashboard = useQuery({
    queryKey: ["user-dashboard-summary", dateFrom, dateTo],
    queryFn: async () => (await apiClient.get<DashboardSummary>("/api/dashboard/", { params: dateParams })).data,
  });
  return { tasks, campaigns, dashboard };
}

export function UserDashboard() {
  const { startDate, endDate, picker } = useDateRange();
  const { user } = useAuth();
  const { tasks, campaigns, dashboard } = useWorkspaceData(startDate, endDate);
  const taskRows = useMemo(() => tasks.data ?? [], [tasks.data]); const campaignRows = useMemo(() => campaigns.data?.results ?? [], [campaigns.data]);
  const pendingTasks = taskRows.filter(row => !["APPROVED", "COMPLETED"].includes(row.status)).length;
  const cards = [
    ["Assigned Tasks", taskRows.length, ListChecks, "from-sky-500 to-blue-600", "Tasks assigned to you"],
    ["Pending Tasks", pendingTasks, Clock3, "from-amber-400 to-orange-500", "Awaiting your action"],
    ["Total Campaigns", dashboard.data?.campaigns.total ?? campaigns.data?.count ?? campaignRows.length, Megaphone, "from-violet-500 to-purple-600", "All campaigns created"],
    ["Completed Campaigns", dashboard.data?.campaigns.completed ?? campaignRows.filter(row => row.status === "COMPLETED").length, CheckCircle2, "from-emerald-500 to-teal-600", "Successfully completed"],
    ["Scheduled Campaigns", dashboard.data?.campaigns.scheduled ?? campaignRows.filter(row => row.status === "SCHEDULED").length, CalendarDays, "from-blue-500 to-indigo-600", "Upcoming scheduled"],
    ["Pending Approval", campaignRows.filter(row => row.status === "PENDING_APPROVAL").length, Send, "from-orange-500 to-rose-500", "Awaiting admin approval"],
  ] as const;
  const monthly = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (6 - index)); const total = campaignRows.filter(row => { const created = new Date(row.created_at); return row.status === "COMPLETED" && created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear() }).length; return { month: date.toLocaleDateString("en-US", { month: "short" }), total }; }), [campaignRows]);
  const statusData = useMemo(() => Object.entries(campaignRows.reduce<Record<string, number>>((result, row) => ({ ...result, [row.status]: (result[row.status] ?? 0) + 1 }), {})).map(([name, value]) => ({ name: pretty(name), value })), [campaignRows]);
  const loading = tasks.isLoading || campaigns.isLoading || dashboard.isLoading; const error = tasks.error || campaigns.error || dashboard.error;
  if (error) return <ErrorState error={error} />;

  const adminCards = [
    { label: "Assigned Tasks", value: taskRows.length, icon: ListChecks, bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400", note: "Tasks assigned to you", sparklineColor: "#3b82f6", sparkData: sparklineData1 },
    { label: "Pending Tasks", value: pendingTasks, icon: Clock3, bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-600 dark:text-orange-400", note: "Awaiting your action", sparklineColor: "#f97316", sparkData: sparklineData2 },
    { label: "Total Campaigns", value: dashboard.data?.campaigns.total ?? campaigns.data?.count ?? campaignRows.length, icon: Megaphone, bg: "bg-indigo-100 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", note: "All campaigns created", sparklineColor: "#6366f1", sparkData: sparklineData3 },
    { label: "Completed Campaigns", value: dashboard.data?.campaigns.completed ?? campaignRows.filter(row => row.status === "COMPLETED").length, icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", note: "Successfully completed", sparklineColor: "#10b981", sparkData: sparklineData4 },
    { label: "Scheduled Campaigns", value: dashboard.data?.campaigns.scheduled ?? campaignRows.filter(row => row.status === "SCHEDULED").length, icon: CalendarDays, bg: "bg-violet-100 dark:bg-violet-500/20", text: "text-violet-600 dark:text-violet-400", note: "Upcoming scheduled", sparklineColor: "#8b5cf6", sparkData: sparklineData5 },
    { label: "Pending Approval", value: campaignRows.filter(row => row.status === "PENDING_APPROVAL").length, icon: Send, bg: "bg-rose-100 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400", note: "Awaiting admin approval", sparklineColor: "#f43f5e", sparkData: sparklineData6 },
  ];

  return <div className="mx-auto max-w-7xl">
    {/* ── Heading ── */}
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5
          text-[10px] font-bold uppercase tracking-wider text-emerald-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          LIVE WORKSPACE
        </span>
        <h1 className="page-title mt-2">
          Welcome back, <span className="text-indigo-600 dark:text-indigo-400 mx-1.5">{user?.first_name || "User"}</span>! 👋
        </h1>
        <p className="page-subtitle">Track your tasks, campaigns and performance in one place.</p>
      </div>
      <div className="bg-white dark:bg-[#0c1222] rounded-lg shadow-sm border border-slate-200 dark:border-white/10 p-1">
        {picker}
      </div>
    </div>

    {/* ── Stat cards ── */}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {adminCards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_20px_rgb(0,0,0,0.06)] dark:bg-[#0c1222] dark:border-white/5"
        >
          <div className="flex items-start justify-between">
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${card.bg} ${card.text}`}>
              <card.icon size={20} />
            </div>
          </div>
          <strong className="mt-4 block text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
            {loading ? "—" : card.value}
          </strong>
          <p className="mt-0.5 text-[14px] font-semibold text-slate-800 dark:text-slate-200">{card.label}</p>
          <div className="flex items-end justify-between mt-1">
            <p className="text-[12px] text-slate-500 dark:text-slate-400">{card.note}</p>
            <div className="h-8 w-20">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={card.sparkData}>
                  <Line type="monotone" dataKey="v" stroke={card.sparklineColor} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      ))}
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:bg-[#0c1222] dark:border-white/5"><div className="mb-5"><h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Completed campaigns per month</h2><p className="text-[12px] text-slate-500 font-medium">Overview of completed campaigns over time</p></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly}><defs><linearGradient id="userLine" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={.25} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: "white", strokeWidth: 3 }} /></LineChart></ResponsiveContainer></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:bg-[#0c1222] dark:border-white/5"><h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Campaign status overview</h2><p className="text-[12px] text-slate-500 font-medium">Distribution of your campaigns by status</p><div className="mt-4 grid items-center md:grid-cols-[1fr_1fr]"><div className="relative h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData.length ? statusData : [{ name: "No campaigns", value: 1 }]} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={2}>{(statusData.length ? statusData : [{ name: "No campaigns", value: 1 }]).map((_, index) => <Cell fill={statusData.length ? pieColors[index % pieColors.length] : "#e2e8f0"} key={index} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><b className="block text-2xl dark:text-white">{campaigns.data?.count ?? 0}</b><span className="text-xs text-slate-500">Total</span></div></div></div><div className="space-y-2">{statusData.map((row, index) => <div className="flex items-center gap-2 text-xs" key={row.name}><span className="h-2.5 w-2.5 rounded-full" style={{ background: pieColors[index % pieColors.length] }} /><span className="flex-1 text-slate-600 dark:text-slate-400">{row.name}</span><b className="dark:text-slate-300">{row.value}</b></div>)}</div></div></section></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><DashboardTable title="My Tasks" href="/user/tasks" headers={["Task Title", "Priority", "Due Date", "Status"]} rows={taskRows.slice(0, 4).map(row => [row.task.title, <Badge key="p" className={priorityTone[row.task.priority]}>{pretty(row.task.priority)}</Badge>, new Date(row.task.due_date).toLocaleDateString(), <Badge key="s" className={taskTone[row.status]}>{pretty(row.status)}</Badge>])} /><DashboardTable title="Recent Campaigns" href="/user/campaigns" headers={["Campaign Name", "Audience", "Status", "Created"]} rows={campaignRows.slice(0, 4).map(row => [row.campaign_name, row.audience_name || "—", <Badge key="s" className={campaignTone[row.status]}>{pretty(row.status)}</Badge>, new Date(row.created_at).toLocaleDateString()])} /></div>
  </div>;
}

export function UserPerformance() {
  const { startDate, endDate, picker } = useDateRange();
  const { tasks, campaigns, dashboard } = useWorkspaceData(startDate, endDate); const taskRows = useMemo(() => tasks.data ?? [], [tasks.data]); const campaignRows = useMemo(() => campaigns.data?.results ?? [], [campaigns.data]); const delivery = dashboard.data?.deliveries;
  const completedTasks = taskRows.filter(row => ["APPROVED", "COMPLETED"].includes(row.status)).length; const pendingTasks = taskRows.filter(row => !["APPROVED", "COMPLETED"].includes(row.status)).length; const overdueTasks = taskRows.filter(row => new Date(row.task.due_date) < new Date() && !["APPROVED", "COMPLETED"].includes(row.status)).length;
  const approvedCampaigns = campaignRows.filter(row => ["APPROVED", "SCHEDULED", "SENDING", "COMPLETED"].includes(row.status)).length; const submittedCampaigns = campaignRows.filter(row => row.status !== "DRAFT").length; const approvalRate = submittedCampaigns ? Math.round(approvedCampaigns / submittedCampaigns * 100) : 0; const audienceReached = campaignRows.reduce((sum, row) => sum + (row.contacts || 0), 0); const successRate = delivery?.success_rate ?? (campaignRows.reduce((sum, row) => sum + row.sent, 0) ? Math.round(campaignRows.reduce((sum, row) => sum + row.delivered, 0) / campaignRows.reduce((sum, row) => sum + row.sent, 0) * 100) : 0);
  const completedBeforeDeadline = taskRows.filter(row => ["APPROVED", "COMPLETED"].includes(row.status)); const deadlineRate = completedBeforeDeadline.length ? Math.round(completedBeforeDeadline.filter(row => new Date(row.updated_at) <= new Date(row.task.due_date)).length / completedBeforeDeadline.length * 100) : 0;
  const months = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (6 - index)); const inMonth = (value: string) => { const item = new Date(value); return item.getMonth() === date.getMonth() && item.getFullYear() === date.getFullYear() }; return { month: date.toLocaleDateString("en-US", { month: "short" }), reach: campaignRows.filter(row => inMonth(row.created_at)).reduce((sum, row) => sum + (row.contacts || 0), 0), campaigns: campaignRows.filter(row => inMonth(row.created_at) && !["DRAFT", "REJECTED", "CANCELLED"].includes(row.status)).length } }), [campaignRows]);
  const activity = useMemo(() => [...campaignRows.map(row => ({ id: `campaign-${row.id}`, title: `Campaign “${row.campaign_name}” ${pretty(row.status).toLowerCase()}`, date: row.created_at, icon: Megaphone, tone: "bg-violet-500" })), ...taskRows.map(row => ({ id: `task-${row.id}`, title: `Task “${row.task.title}” ${pretty(row.status).toLowerCase()}`, date: row.updated_at || row.created_at, icon: ListChecks, tone: "bg-blue-500" }))].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5), [campaignRows, taskRows]);
  const statCards = [
    ["Completed Tasks", completedTasks, CheckCircle2, "bg-emerald-50 text-emerald-600"],
    ["Campaigns Created", campaigns.data?.count ?? campaignRows.length, Megaphone, "bg-violet-50 text-violet-600"],
    ["Campaigns Completed", campaignRows.filter(row => row.status === "COMPLETED").length, Send, "bg-blue-50 text-blue-600"],
    ["Approval Rate", `${approvalRate}%`, ShieldCheck, "bg-orange-50 text-orange-500"],
    ["Audience Reached", compactNumber(audienceReached), Users, "bg-teal-50 text-teal-600"],
    ["Success Rate", `${successRate}%`, Target, "bg-rose-50 text-rose-600"],
  ] as const;
  if (tasks.isError || campaigns.isError || dashboard.isError) return <ErrorState error={tasks.error || campaigns.error || dashboard.error} />;
  return <div><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><PageHeading title="My Performance" subtitle="Track your productivity and campaign performance over time." />{picker}</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{statCards.map(([label, value, Icon, tone], index) => <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className="sa-card p-5" key={label}><span className={`grid h-11 w-11 place-items-center rounded-full ${tone}`}><Icon size={22} /></span><strong className="mt-4 block text-2xl text-slate-950">{tasks.isLoading || campaigns.isLoading ? "—" : value}</strong><p className="mt-1 text-sm font-bold">{label}</p><p className="mt-3 text-xs font-semibold text-emerald-600">Live account data</p></motion.article>)}</div>
    <div className="mt-5 grid gap-4 xl:grid-cols-3"><PerformanceChart title="Task Productivity"><BarChart data={[{ name: "Assigned", value: taskRows.length, fill: "#22c55e" }, { name: "Completed", value: completedTasks, fill: "#3b82f6" }, { name: "Pending", value: pendingTasks, fill: "#f59e0b" }, { name: "Overdue", value: overdueTasks, fill: "#ef4444" }]}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="value" radius={[7, 7, 0, 0]}>{[{ fill: "#22c55e" }, { fill: "#3b82f6" }, { fill: "#f59e0b" }, { fill: "#ef4444" }].map((entry, index) => <Cell fill={entry.fill} key={index} />)}</Bar></BarChart></PerformanceChart><PerformanceChart title="Audience Reached Over Time"><AreaChart data={months}><defs><linearGradient id="reachArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} tickFormatter={compactNumber} /><Tooltip formatter={(value) => compactNumber(Number(value))} /><Area type="monotone" dataKey="reach" stroke="#16a34a" fill="url(#reachArea)" strokeWidth={3} /></AreaChart></PerformanceChart><PerformanceChart title="Campaigns Sent Over Time"><BarChart data={months}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="campaigns" fill="#8b5cf6" radius={[7, 7, 0, 0]} /></BarChart></PerformanceChart></div>
    <section className="sa-card mt-5 p-5"><h2 className="font-black">Performance Metrics</h2><div className="mt-5 grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">{[[Send, "Messages Sent", compactNumber(delivery?.sent ?? campaignRows.reduce((sum, row) => sum + row.sent, 0)), "bg-blue-50 text-blue-600"], [CheckCircle2, "Delivery Success Rate", `${successRate}%`, "bg-emerald-50 text-emerald-600"], [CalendarDays, "Completed Before Deadline", `${deadlineRate}%`, "bg-blue-50 text-blue-600"], [AlertTriangle, "Delivery Failures", compactNumber(delivery?.failed ?? 0), "bg-rose-50 text-rose-500"]].map(([Icon, label, value, tone]) => <div className="flex items-center gap-4 px-5 py-4 first:pl-0" key={String(label)}><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${tone}`}><Icon size={22} /></span><div><p className="text-xs text-slate-500">{String(label)}</p><strong className="mt-1 block text-xl">{String(value)}</strong></div></div>)}</div></section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_1fr]"><section className="sa-card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-black">Recent Campaign Performance</h2><Link className="text-xs font-semibold text-blue-600" href="/user/campaigns">View All</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50"><tr><th className="px-5 py-3">Campaign Name</th><th>Audience</th><th>Status</th><th>Delivery Rate</th><th>Created</th></tr></thead><tbody>{campaignRows.slice(0, 5).map(row => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4 font-semibold">{row.campaign_name}</td><td>{compactNumber(row.contacts)}</td><td><Badge className={campaignTone[row.status]}>{pretty(row.status)}</Badge></td><td>{row.sent ? `${Math.round(row.delivered / row.sent * 100)}%` : "—"}</td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{!campaignRows.length && <Empty message="No campaign performance yet." />}</div></section><section className="sa-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Recent Activity</h2></div><div className="p-5">{activity.map((item, index) => <div className="relative flex gap-4 pb-5 last:pb-0" key={item.id}>{index < activity.length - 1 && <span className="absolute left-4 top-8 h-full w-px bg-slate-200" />}<span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${item.tone}`}><item.icon size={15} /></span><div className="flex min-w-0 flex-1 flex-wrap justify-between gap-2 text-xs"><p className="font-medium text-slate-700">{item.title}</p><time className="text-slate-500">{formatDate(item.date)}</time></div></div>)}{!activity.length && <Empty message="No recent activity yet." />}</div></section></div></div>;
}

function PerformanceChart({ title, children }: { title: string; children: React.ReactElement }) { return <section className="sa-card p-5"><h2 className="font-black">{title}</h2><div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></section> }

function ContentDraftCard({ draft, index, onClick, onDelete }: { draft: ContentDraftData; index: number; onClick: () => void; onDelete: () => void }) {
  const platform = draft.platforms[0];
  const item = contentPlatforms.find(entry => entry.value === platform?.platform);
  const Icon = item?.icon;
  const image = platform?.images?.[0]?.asset_url;
  return <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col h-full" onClick={onClick}><div className="relative grid h-36 shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-50 to-violet-200">{image ? <NextImage unoptimized alt="Generated content" className="h-full w-full object-cover" height={300} src={resolveApiUrl(image) || ""} width={500} /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/80 text-blue-600 shadow-lg">{Icon ? <Icon size={32} /> : <b className="text-3xl">𝕏</b>}</span>}<span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold shadow">{draft.platforms.map(p => pretty(p.platform)).join(", ") || "Draft"}</span><span className="absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold shadow">{pretty(draft.workflow_state)}</span></div><div className="p-4 flex flex-col flex-1"><h3 className="line-clamp-2 min-h-10 font-black text-slate-950">{draft.original_prompt.split(/[.!?]/)[0] || "Draft Content"}</h3><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">{draft.original_prompt}</p><div className="mt-auto pt-3 flex items-center justify-between"><p className="text-xs text-slate-500">{formatDate(draft.created_at)}</p><button aria-label="Delete draft" className="icon-button h-7 w-7 !border !border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50" onClick={e => { e.stopPropagation(); onDelete() }}><Trash2 size={13} /></button></div></div></motion.article>
}

export function UserContentStudio() {
  const searchParams = useSearchParams();
  const assetId = searchParams?.get("assetId");
  const client = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>(contentPlatforms.map(item => item.value));
  const [current, setCurrent] = useState<ContentDraftData | null>(null);
  const [enhancerOpen, setEnhancerOpen] = useState(false);
  // draftId is set after a draft is first created, so enhance_prompt can be called on it
  const [draftId, setDraftId] = useState<string | null>(null);
  const [includeCaption, setIncludeCaption] = useState(true);
  const [activeTab, setActiveTab] = useState<"DRAFTS" | "PUBLISHED">("DRAFTS");

  const history = useQuery({ queryKey: ["user-content-history"], queryFn: async () => (await apiClient.get<GeneratedContent[]>("/api/content/history/")).data });
  const draftsQuery = useQuery({
    queryKey: ["user-content-drafts"], queryFn: async () => {
      const res = await apiClient.get<any>("/api/content/content-drafts/");
      const all = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
      return (all as ContentDraftData[]).filter(d => d.workflow_state !== "PUBLISHED");
    }
  });

  const router = useRouter();
  const hasInitializedAsset = useRef(false);
  const urlChannels = searchParams?.get("channels");
  const platformsToUse = urlChannels ? urlChannels.split(',') : selected;

  useEffect(() => {
    if (assetId && !hasInitializedAsset.current) {
      hasInitializedAsset.current = true;
      const payload: any = { original_prompt: "Custom Post with Preset Media", platforms: platformsToUse, preset_image_id: assetId };
      apiClient.post<ContentDraftData>("/api/content/content-drafts/", payload, { timeout: 60000 })
        .then(res => {
          setDraftId(res.data.id);
          setCurrent(res.data);
          toast.success("Draft created with preset asset");
        })
        .catch(err => {
          toast.error(parseApiError(err));
          router.replace('/user/content');
        });
    }
  }, [assetId, platformsToUse, router]);

  const generate = useMutation({
    mutationFn: async () => {
      const payload: any = { original_prompt: prompt.trim(), platforms: selected };
      if (assetId) payload.preset_image_id = assetId;
      const created = (await apiClient.post<ContentDraftData>("/api/content/content-drafts/", payload, { timeout: 60000 })).data;
      setDraftId(created.id); setCurrent(created);
      try {
        await apiClient.patch(`/api/content/content-drafts/${created.id}/`, { enhanced_prompt: prompt.trim() }, { timeout: 60000 });
        await apiClient.post(`/api/content/content-drafts/${created.id}/regenerate/`, { reason: "Initial content generation", generate_images: !assetId, generate_captions: includeCaption }, { timeout: 240000 });
        return (await apiClient.get<ContentDraftData>(`/api/content/content-drafts/${created.id}/`, { timeout: 60000 })).data
      } catch (error) { try { setCurrent((await apiClient.get<ContentDraftData>(`/api/content/content-drafts/${created.id}/`, { timeout: 60000 })).data) } catch { } throw error }
    }, onSuccess: draft => { setCurrent(draft); toast.success("Prompt-based content generated"); void client.invalidateQueries({ queryKey: ["user-content-history"] }); void client.invalidateQueries({ queryKey: ["user-content-drafts"] }); }, onError: error => toast.error(parseApiError(error))
  });
  const save = useMutation({ mutationFn: (id: string) => apiClient.post(`/api/content/${id}/action/`, { action: "save_to_library" }), onSuccess: () => toast.success("Saved to Asset Library"), onError: error => toast.error(parseApiError(error)) });
  const removeDraft = useMutation({ mutationFn: (id: string) => apiClient.delete(`/api/content/content-drafts/${id}/`), onSuccess: () => { toast.success("Draft deleted"); void client.invalidateQueries({ queryKey: ["user-content-drafts"] }) }, onError: error => toast.error(parseApiError(error)) });
  const toggle = (platform: string) => setSelected(value => value.includes(platform) ? value.filter(item => item !== platform) : [...value, platform]);
  const copy = async (text: string) => { await navigator.clipboard.writeText(text); toast.success("Content copied") };
  const download = (item: GeneratedContent) => { const text = item.versions[0]?.text_content || ""; const url = URL.createObjectURL(new Blob([text], { type: "text/plain" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${item.platform.toLowerCase()}-content.txt`; anchor.click(); URL.revokeObjectURL(url) };

  if (current) return <ContentPreviewCustomize draft={current} generating={generate.isPending} onChange={setCurrent} onBack={() => { setCurrent(null); if (assetId) router.replace('/user/content'); }} onGenerateNew={() => { setCurrent(null); setPrompt(""); setDraftId(null); if (assetId) router.replace('/user/content'); }} />;
  if (assetId) return <div className="flex flex-col items-center justify-center gap-4 py-32"><LoaderCircle className="animate-spin text-blue-600" size={40} /><p className="font-semibold text-slate-600">Preparing your Content Studio...</p></div>;
  return <div>
    {enhancerOpen && <AnimatePresence><PromptEnhancerModal
      prompt={prompt}
      draftId={draftId}
      onClose={() => setEnhancerOpen(false)}
      onEnhanced={(enhanced) => { setPrompt(enhanced); setEnhancerOpen(false); }}
    /></AnimatePresence>}
    <PageHeading title="Content Studio" subtitle="Create AI-powered content for all your marketing channels." /><section className="sa-card mt-6 p-6"><div className="flex items-center gap-2"><h2 className="font-black">Your Prompt</h2><CircleDot size={15} className="text-slate-400" />{assetId && <span className="ml-2 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><ImageIcon size={12} />Preset Asset Attached</span>}<div className="ml-auto flex items-center gap-2">{assetId && <Link href="/user/content" className="text-xs text-red-500 hover:underline">Remove Asset</Link>}<Link href="/user/assets" className="secondary-button flex items-center gap-2 px-5 text-sm"><ImageIcon size={15} />{assetId ? "Change Asset" : "Add from Asset Library"}</Link></div></div><div className="relative mt-4"><textarea maxLength={2000} rows={6} className="w-full resize-y rounded-xl border border-slate-200 bg-white p-4 pb-9 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Example: Write a LinkedIn post about the benefits of email marketing for small businesses..." value={prompt} onChange={event => setPrompt(event.target.value)} /><span className="absolute bottom-3 right-4 text-xs text-slate-400">{prompt.length} / 2000</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" className="secondary-button flex items-center gap-2 px-5 text-blue-600" disabled={!prompt.trim()} onClick={() => setEnhancerOpen(true)}><WandSparkles size={17} />Enhance Prompt</button><div className="flex items-center gap-3"><button type="button" className="secondary-button flex items-center gap-2 px-5" disabled={!prompt} onClick={() => setPrompt("")}><Trash2 size={17} />Clear</button><label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={includeCaption} onChange={event => setIncludeCaption(event.target.checked)} />Caption</label><button type="button" className="primary-button px-6" disabled={!prompt.trim() || !selected.length || generate.isPending} onClick={() => generate.mutate()}><Sparkles size={17} />{generate.isPending ? "Generating..." : "Generate Content"}</button></div></div></section>
    <section className="sa-card mt-5 p-6"><h2 className="font-black">Channels</h2><div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">{contentPlatforms.map(platform => { const Icon = platform.icon; const checked = selected.includes(platform.value); return <button type="button" role="checkbox" aria-checked={checked} className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={platform.value} onClick={() => toggle(platform.value)}><span className={`grid h-5 w-5 place-items-center rounded border text-xs ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{checked ? "✓" : ""}</span>{Icon ? <Icon className={platform.tone} size={20} /> : <b className="text-xl text-slate-950">𝕏</b>}{platform.label}</button> })}</div></section>
    <section className="mt-12"><div className="mb-4 flex items-center gap-6 border-b border-slate-200">
      <button
        className={`pb-2 text-lg font-black transition ${activeTab === "DRAFTS" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        onClick={() => setActiveTab("DRAFTS")}
      >
        Drafts <span className="ml-1 text-xs font-semibold rounded-full bg-slate-100 px-2 py-0.5">{draftsQuery.data?.length ?? 0}</span>
      </button>
      <button
        className={`pb-2 text-lg font-black transition ${activeTab === "PUBLISHED" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        onClick={() => setActiveTab("PUBLISHED")}
      >
        Recent Posts <span className="ml-1 text-xs font-semibold rounded-full bg-slate-100 px-2 py-0.5">{history.data?.length ?? 0}</span>
      </button>
    </div>
      {activeTab === "DRAFTS" ? (
        draftsQuery.isError ? <ErrorState error={draftsQuery.error} /> : draftsQuery.isLoading ? <Skeleton /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {(draftsQuery.data ?? []).slice(0, 10).map((item, index) => <ContentDraftCard draft={item} index={index} key={item.id} onClick={() => setCurrent(item)} onDelete={() => removeDraft.mutate(item.id)} />)}
            </div>
            {!draftsQuery.isLoading && !draftsQuery.data?.length && <Empty message="No active drafts. Work you leave in the middle will appear here." />}
          </>
        )
      ) : (
        history.isError ? <ErrorState error={history.error} /> : history.isLoading ? <Skeleton /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {(history.data ?? []).slice(0, 10).map((item, index) => <ContentPostCard item={item} index={index} key={item.id} onCopy={() => void copy(item.versions[0]?.text_content || "")} onDownload={() => download(item)} onSave={() => save.mutate(item.id)} />)}
            </div>
            {!history.isLoading && !history.data?.length && <Empty message="Generate your first post to see it here." />}
          </>
        )
      )}
    </section>
    <section className="sa-card mt-8 grid divide-y divide-slate-100 bg-indigo-50/40 p-5 md:grid-cols-3 md:divide-x md:divide-y-0">{[[ShieldCheck, "Brand Safe Content", "AI generation follows your configured brand voice."], [Sparkles, "Save Time", "Create channel-ready content in seconds."], [Target, "Multi-Channel Ready", "Generate tailored content for every selected channel."]].map(([Icon, title, description]) => <div className="flex items-center gap-4 px-5 py-3 first:pl-0" key={String(title)}><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-700"><Icon size={23} /></span><div><h3 className="font-bold">{String(title)}</h3><p className="mt-1 text-xs text-slate-500">{String(description)}</p></div></div>)}</section></div>;
}

function ContentPreviewCustomize({ draft, generating, onChange, onBack, onGenerateNew }: { draft: ContentDraftData; generating: boolean; onChange: (draft: ContentDraftData) => void; onBack: () => void; onGenerateNew: () => void }) {
  const client = useQueryClient();
  const [activeId, setActiveId] = useState(draft.platforms[0]?.id ?? ""); const [edits, setEdits] = useState<Record<string, string>>({}); const [scheduleAt, setScheduleAt] = useState(""); const [firstComment, setFirstComment] = useState(""); const [location, setLocation] = useState("Mumbai, India"); const [publishAs, setPublishAs] = useState("Feed Post"); const [busy, setBusy] = useState("");
  const active = draft.platforms.find(item => item.id === activeId) ?? draft.platforms[0]; const caption = active ? (edits[active.id] ?? [active.caption?.caption_text, active.caption?.hashtags, active.caption?.cta].filter(Boolean).join("\n\n")) : ""; const image = resolveApiUrl(active?.images[0]?.asset_url); const meta = contentPlatforms.find(item => item.value === active?.platform); const ActiveIcon = meta?.icon; const isFacebook = active?.platform === "FACEBOOK"; const isInstagram = active?.platform === "INSTAGRAM"; const isLinkedIn = active?.platform === "LINKEDIN"; const isX = active?.platform === "X"; const contentLimit = isX ? 280 : isLinkedIn ? 3000 : 2200; const firstCommentLimit = isFacebook ? 800 : 300;
  const refresh = async () => { const updated = (await apiClient.get<ContentDraftData>(`/api/content/content-drafts/${draft.id}/`, { timeout: 60000 })).data; onChange(updated); return updated };
  const run = async (label: string, operation: () => Promise<void>) => { setBusy(label); try { await operation() } catch (error) { toast.error(parseApiError(error)) } finally { setBusy("") } };
  const persist = async (showToast = true) => { if (!active) return; await apiClient.patch(`/api/content/content-drafts/${draft.id}/platforms/${active.id}/`, { caption_text: caption, hashtags: "", cta: "" }, { timeout: 60000 }); await refresh(); if (showToast) toast.success("Draft saved") };
  const regenerate = async (images: boolean, captions: boolean) => run(images ? "image" : "caption", async () => { await apiClient.post(`/api/content/content-drafts/${draft.id}/regenerate/`, { reason: images ? "Replace post image" : "Improve caption", generate_images: images, generate_captions: captions }, { timeout: 180000 }); await refresh(); if (captions) { setEdits({}); } toast.success(images ? "Post image regenerated" : "Caption regenerated") });
  const schedule = () => run("schedule", async () => { if (!scheduleAt) throw new Error("Select a future date and time."); await persist(false); await apiClient.post(`/api/content/content-drafts/${draft.id}/schedule/`, { schedules: Object.fromEntries(draft.platforms.map(item => [item.platform, new Date(scheduleAt).toISOString()])) }, { timeout: 60000 }); await refresh(); toast.success("Content scheduled") });
  const approval = () => run("approval", async () => { await persist(false); await apiClient.post(`/api/content/content-drafts/${draft.id}/request_approval/`, {}, { timeout: 60000 }); await refresh(); toast.success("Sent to Admin for approval") });
  const publish = () => run("publish", async () => { 
    await persist(false); 
    await apiClient.post(`/api/content/content-drafts/${draft.id}/publish/`, {}, { timeout: 60000 }); 
    
    let updated = await refresh(); 
    let retries = 0;
    // Poll until no platforms are PENDING (max 45 seconds)
    while (updated.platforms.some((p: any) => p.status === "PENDING") && retries < 15) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        updated = await refresh();
        retries++;
    }

    if (updated.workflow_state === "PUBLISHED") { 
        toast.success("Content published to all selected channels!"); 
        client.invalidateQueries({ queryKey: ["user-content-history"] }); 
        client.invalidateQueries({ queryKey: ["user-content-drafts"] }); 
        onBack(); 
    } else { 
        const failedPlatforms = updated.platforms.filter((p: any) => p.status === "FAILED").map((p: any) => p.platform); 
        if (updated.platforms.some((p: any) => p.status === "PENDING")) {
            toast.error("Publishing is taking longer than expected. It will continue in the background.");
            onBack();
        } else {
            toast.error(failedPlatforms.length > 0 ? `Publishing failed on: ${failedPlatforms.join(", ")}` : "Publishing failed on one or more channels."); 
        }
    } 
  });
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><button className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-700" onClick={onBack}><ChevronLeft size={17} />Back to Content Studio</button><div className="flex flex-wrap items-start justify-between gap-4"><PageHeading title="Preview & Customize" subtitle="Review and refine your content before publishing." /><div className="flex gap-3"><button className="secondary-button px-5" disabled={generating || !!busy} onClick={() => void run("save", () => persist())}><Save size={17} />{busy === "save" ? "Saving..." : "Save to Drafts"}</button></div></div>{generating && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-800 shadow-sm"><LoaderCircle className="animate-spin" size={20} /><div><p>Generating your prompt-based image and captions…</p><p className="mt-1 text-xs font-normal text-blue-600">The preview is open. It will update automatically when AI generation finishes.</p></div></div>}
    <div className="mt-6 grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4">{draft.platforms.map(platform => { const item = contentPlatforms.find(entry => entry.value === platform.platform); const Icon = item?.icon; const isFailed = platform.status === "FAILED"; return <button className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-sm font-bold transition ${active?.id === platform.id ? "border-blue-600 bg-blue-50/40 text-blue-700" : "border-transparent hover:bg-slate-50"} ${isFailed ? "text-red-600" : ""}`} key={platform.id} onClick={() => setActiveId(platform.id)}>{Icon ? <Icon className={isFailed ? "text-red-600" : item?.tone} size={19} /> : <b>𝕏</b>}{item?.label}{isFailed && <span title={platform.error_message || "Publish failed"}><InfoIcon size={15} className="ml-1 text-red-500" /></span>}</button> })}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.02fr_.98fr]"><section><h2 className="mb-1 flex items-center gap-2 text-lg font-black">{ActiveIcon ? <ActiveIcon className={meta?.tone} size={20} /> : <b>𝕏</b>}{isFacebook ? "Facebook Post Preview" : isInstagram ? "Instagram Feed Preview" : isLinkedIn ? "LinkedIn Post Preview" : isX ? "X (Twitter) Post Preview" : `${meta?.label} Post Preview`}</h2>{(isFacebook || isLinkedIn || isX) && <p className="mb-4 text-sm text-slate-500">{isFacebook ? "This is how your post will appear in the Facebook feed." : isLinkedIn ? "This is how your post will appear on LinkedIn." : "This is how your post will appear on X."}</p>}<SocialContentPreview platform={active?.platform ?? "INSTAGRAM"} caption={caption} image={image} location={location} /></section><div className="space-y-4"><section className="sa-card p-5"><h2 className="font-black">{isFacebook || isLinkedIn || isX ? "Post Content" : "Caption"}</h2><label className="field mt-4">{isX && <span>Content</span>}{isLinkedIn && <span>Caption</span>}<textarea maxLength={contentLimit} rows={9} value={caption} onChange={event => active && setEdits(value => ({ ...value, [active.id]: event.target.value }))} /><small className="text-right">{caption.length} / {contentLimit}</small></label><div className="mt-4 flex flex-wrap justify-between gap-3"><button className="secondary-button px-4" disabled={!!busy} onClick={() => void regenerate(false, true)}><RefreshCw size={16} />{busy === "caption" ? "Regenerating..." : "Regenerate"}</button><button className="primary-button px-4" disabled={!!busy} onClick={() => void run("improve", () => persist())}><Sparkles size={16} />{isX ? "Improve Content" : "Improve Caption"}</button></div></section>
      <section className="sa-card p-5"><h2 className="font-black">Post Settings</h2>{isX ? <><label className="field mt-4"><span>Who can reply?</span><select defaultValue="Everyone"><option>Everyone</option><option>Accounts you follow</option><option>Verified accounts</option><option>Only accounts you mention</option></select></label><div className="mt-4 space-y-3 text-sm"><p className="font-semibold">Add to your post</p><label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Allow replies</label><label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Allow reposts</label><label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Show engagement metrics</label></div></> : isLinkedIn ? <><label className="field mt-4"><span>Who can see this post?</span><select defaultValue="Anyone"><option>Anyone</option><option>Connections only</option><option>Group members</option></select></label><div className="mt-4 space-y-3 text-sm"><p className="font-semibold">Add to</p><label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Notify connections</label><label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Allow comments</label><label className="flex items-center gap-2"><input defaultChecked type="checkbox" />Allow reposts</label></div></> : <><div className="mt-4 flex flex-wrap gap-5 text-sm">{isFacebook ? <><label className="flex items-center gap-2"><input checked={publishAs !== "Your Page and Groups"} name="publishAs" type="radio" onChange={() => setPublishAs("Your Page")} />Your Page</label><label className="flex items-center gap-2"><input checked={publishAs === "Your Page and Groups"} name="publishAs" type="radio" onChange={() => setPublishAs("Your Page and Groups")} />Your Page and Groups</label></> : <><label className="flex items-center gap-2"><input checked={publishAs !== "Reel"} name="publishAs" type="radio" onChange={() => setPublishAs("Feed Post")} />Feed Post</label><label className="flex items-center gap-2"><input checked={publishAs === "Reel"} name="publishAs" type="radio" onChange={() => setPublishAs("Reel")} />Reel</label></>}</div><label className="field mt-4"><span>First Comment (Optional)</span><textarea maxLength={firstCommentLimit} rows={3} value={firstComment} onChange={event => setFirstComment(event.target.value)} /><small className="text-right">{firstComment.length} / {firstCommentLimit}</small></label>{isFacebook ? <label className="field mt-4"><span>Audience</span><select defaultValue="Public"><option>Public</option><option>Friends</option><option>Only me</option></select></label> : <label className="field mt-4"><span>Location (Optional)</span><input value={location} onChange={event => setLocation(event.target.value)} /></label>}</>}{!isLinkedIn && <label className="field mt-4"><span>{isX ? "Schedule (Optional)" : "Schedule"}</span><input min={new Date().toISOString().slice(0, 16)} type="datetime-local" value={scheduleAt} onChange={event => setScheduleAt(event.target.value)} /></label>}</section></div></div>
    <div className="sa-card sticky bottom-3 mt-6 flex flex-wrap justify-between gap-3 p-4"><div className="flex gap-3"><button className="secondary-button px-5" onClick={() => document.querySelector<HTMLTextAreaElement>("textarea[maxlength]")?.focus()}><FileText size={16} />Edit Content</button><button className="secondary-button px-5" onClick={onGenerateNew}><Sparkles size={16} />Generate New</button></div><div className="flex gap-3">{draft.workflow_state === "DRAFT" && <button className="primary-button px-7" disabled={!!busy} onClick={approval}><Users size={17} />{busy === "approval" ? "Submitting..." : "Ask for Approval"}</button>}{draft.workflow_state === "IN_REVIEW" && <button className="primary-button px-7 opacity-80" disabled><Clock3 size={17} />Pending Approval</button>}{draft.workflow_state === "APPROVED" && <><button className="primary-button px-7" disabled={!!busy} onClick={publish}><Send size={17} />{busy === "publish" ? "Publishing..." : "Publish Now"}</button><button className="primary-button px-7" disabled={!!busy} onClick={schedule}><CalendarClock size={17} />{busy === "schedule" ? "Scheduling..." : "Schedule"}</button></>}</div></div></motion.div>;
}

function SocialContentPreview({ platform, caption, image, location }: { platform: string; caption: string; image?: string; location: string }) {
  const isFacebook = platform === "FACEBOOK"; const isLinkedIn = platform === "LINKEDIN"; const isX = platform === "X";
  const media = image ? <NextImage unoptimized alt="Generated post" className="max-h-[520px] w-full object-cover" height={520} src={image} width={720} /> : <div className="grid h-80 place-items-center bg-gradient-to-br from-amber-50 via-orange-50 to-indigo-100 text-center text-slate-400"><div><ImageIcon className="mx-auto" size={52} /><p className="mt-3 text-sm">Generate or add a post image</p></div></div>;
  if (isX) return <article className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><header className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-violet-700 font-black text-white">M</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-1"><b className="text-lg">Your Brand</b><span className="grid h-4 w-4 place-items-center rounded-full bg-blue-500 text-[9px] font-black text-white">✓</span></div><p className="text-sm text-slate-500">@yourbrand · Now</p></div><MoreVertical className="ml-auto" /></header><p className="whitespace-pre-wrap px-1 py-5 text-xl leading-7 text-slate-950">{caption}</p><div className="overflow-hidden rounded-2xl border border-slate-200">{media}</div><div className="mt-5 grid grid-cols-6 text-slate-600"><span className="flex items-center gap-1"><MessageCircle size={19} />2</span><span className="flex items-center gap-1"><Repeat2 size={19} />13</span><span className="flex items-center gap-1"><Heart size={19} />60</span><span className="flex items-center gap-1"><BarChart3 size={19} />8.3K</span><span className="flex justify-center"><Bookmark size={19} /></span><span className="flex justify-end"><Share2 size={19} /></span></div></article>;
  if (isLinkedIn) return <article className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-start gap-3 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-700 to-pink-600 font-black text-white">M</span><div><b className="text-lg">Your Brand</b><p className="text-sm text-slate-500">1,234 followers</p><p className="text-xs text-slate-500">now · 🌐</p></div><MoreVertical className="ml-auto" /></header><p className="whitespace-pre-wrap px-5 pb-5 text-sm leading-6 text-slate-950">{caption}</p>{media}<div className="grid grid-cols-4 px-5 py-4 text-slate-700"><span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white"><ThumbsUp size={14} /></span>186</span><span className="flex items-center justify-center gap-2"><MessageCircle size={21} />24</span><span className="flex items-center justify-center gap-2"><Repeat2 size={21} />7</span><span className="flex items-center justify-end gap-2"><Send size={21} />12</span></div></article>;
  return <article className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-3 p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 font-black text-white">M</span><div><b>{platform === "INSTAGRAM" ? "yourbrand_official" : "Your Brand"}</b><p className="text-xs text-slate-500">{isFacebook ? "Just now · Public" : location || "Just now"}</p></div><MoreVertical className="ml-auto" /></header>{platform !== "INSTAGRAM" && <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-6">{caption}</p>}{media}<div className="flex items-center justify-between px-4 py-3 text-sm text-slate-600"><span className="flex gap-1"><Heart className="text-rose-500" size={19} />{isFacebook ? "1.2K" : "1,245 likes"}</span><span>32 Comments · 89 Shares</span></div><div className="grid grid-cols-3 border-t border-slate-100 py-3 text-sm"><span className="flex justify-center gap-2"><ThumbsUp size={18} />Like</span><span className="flex justify-center gap-2"><MessageCircle size={18} />Comment</span><span className="flex justify-center gap-2"><Share2 size={18} />Share</span></div>{platform === "INSTAGRAM" && <p className="whitespace-pre-wrap px-4 pb-5 text-sm leading-6"><b>yourbrand_official </b>{caption}</p>}</article>
}

function ContentPostCard({ item, index, onCopy, onDownload, onSave }: { item: GeneratedContent; index: number; onCopy: () => void; onDownload: () => void; onSave: () => void }) { const version = item.versions[0]; const platform = contentPlatforms.find(entry => entry.value === item.platform); const Icon = platform?.icon; return <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="relative grid h-36 place-items-center overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-50 to-violet-200">{version?.image_url ? <NextImage unoptimized alt="Generated content" className="h-full w-full object-cover" height={300} src={version.image_url} width={500} /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/80 text-blue-600 shadow-lg">{Icon ? <Icon size={32} /> : <b className="text-3xl">𝕏</b>}</span>}<span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold shadow">{Icon ? <Icon className={platform?.tone} size={13} /> : "𝕏"}{platform?.label || pretty(item.platform)}</span></div><div className="p-4"><h3 className="line-clamp-2 min-h-10 font-black text-slate-950">{version?.text_content?.split(/[.!?]/)[0] || `${pretty(item.platform)} Content`}</h3><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">{version?.text_content || version?.prompt || "Generated marketing content"}</p><p className="mt-3 text-xs text-slate-500">{formatDate(item.created_at)}</p><div className="mt-4 flex gap-2"><button aria-label="Copy content" className="icon-button !border !border-slate-200" onClick={onCopy}><Copy size={15} /></button><button aria-label="Download content" className="icon-button !border !border-slate-200" onClick={onDownload}><Download size={15} /></button><button aria-label="Save to asset library" className="icon-button !border !border-slate-200" disabled={false} onClick={onSave}><MoreVertical size={15} /></button></div></div></motion.article> }

export function UserTasks() {
  const { startDate, endDate, picker } = useDateRange();
  const client = useQueryClient();
  const tasks = useQuery({
    queryKey: ["user-tasks", startDate, endDate],
    queryFn: async () => (await apiClient.get<Assignment[]>("/api/tasks/my/", { params: { date_from: startDate, date_to: endDate } })).data,
  });
  const channels = useQuery({ queryKey: ["channels"], queryFn: async () => (await apiClient.get<Channel[]>("/api/channels/")).data });
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [priority, setPriority] = useState(""); const [due, setDue] = useState(""); const [page, setPage] = useState(1); const [viewing, setViewing] = useState<Assignment | null>(null);
  const update = useMutation({ mutationFn: ({ id, next }: { id: number; next: "IN_PROGRESS" | "SUBMITTED" }) => apiClient.patch(`/api/tasks/assignment/${id}/`, { status: next }), onSuccess: () => { toast.success("Task status updated"); setViewing(null); void client.invalidateQueries({ queryKey: ["user-tasks"] }) }, onError: error => toast.error(parseApiError(error)) });
  const channelMap = Object.fromEntries((channels.data ?? []).map(channel => [channel.id, channel.name]));
  const filtered = (tasks.data ?? []).filter(row => (!search || `${row.task.title} ${row.task.audience_name}`.toLowerCase().includes(search.toLowerCase())) && (!status || row.status === status) && (!priority || row.task.priority === priority) && (!due || row.task.due_date.slice(0, 10) === due)); const pageSize = 7; const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  if (tasks.isError) return <ErrorState error={tasks.error} />;
  return <div><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><PageHeading title="My Tasks" subtitle="View and manage tasks assigned to you." />{picker}</div><section className="sa-card mb-5 grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_.8fr_.8fr_.9fr]"><SearchInput value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder="Search tasks by title or audience..." /><Select value={status} onChange={setStatus} label="All Status" options={["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"]} /><Select value={priority} onChange={setPriority} label="All Priority" options={["HIGH", "MEDIUM", "LOW"]} /><label className="relative"><input aria-label="Due date" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" type="date" value={due} onChange={event => setDue(event.target.value)} /></label></section>
    <section className="sa-card overflow-hidden">{tasks.isLoading ? <Skeleton /> : <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-6 py-5">Title</th><th>Audience Name</th><th>Channel</th><th>Priority</th><th>Due Date</th><th>Created At</th><th>Status</th><th /></tr></thead><tbody>{rows.map((row, index) => <motion.tr initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .03 }} className="border-t border-slate-100 hover:bg-blue-50/30" key={row.id}><td className="px-6 py-5 font-semibold">{row.task.title}</td><td>{row.task.audience_name || "—"}</td><td><div className="flex gap-2">{row.task.channels.map(id => <ChannelIcon name={channelMap[id] ?? String(id)} key={id} />)}</div></td><td><Badge className={priorityTone[row.task.priority]}>{pretty(row.task.priority)}</Badge></td><td className={new Date(row.task.due_date) < new Date() && !["APPROVED", "COMPLETED"].includes(row.status) ? "font-semibold text-red-500" : "text-slate-600"}>{new Date(row.task.due_date).toLocaleDateString()}</td><td className="text-slate-600">{formatDate(row.created_at)}</td><td><Badge className={taskTone[row.status]}>{pretty(row.status)}</Badge></td><td><button aria-label={`View ${row.task.title}`} className="icon-button" onClick={() => setViewing(row)}><MoreVertical size={18} /></button></td></motion.tr>)}</tbody></table>{!rows.length && <Empty message="No tasks match your filters." />}</div>}<Pagination page={page} count={filtered.length} pageSize={pageSize} setPage={setPage} /></section>
    <AnimatePresence>{viewing && <DetailsModal title={viewing.task.title} onClose={() => setViewing(null)}><p className="text-sm leading-6 text-slate-600">{viewing.task.description || "No task description was provided."}</p><dl className="mt-5 grid grid-cols-2 gap-4"><Info label="Audience" value={viewing.task.audience_name || "—"} /><Info label="Priority" value={pretty(viewing.task.priority)} /><Info label="Due date" value={formatDate(viewing.task.due_date)} /><Info label="Status" value={pretty(viewing.status)} /></dl><div className="mt-6 flex justify-end gap-3">{!["IN_PROGRESS", "SUBMITTED", "APPROVED"].includes(viewing.status) && <button className="secondary-button" disabled={update.isPending} onClick={() => update.mutate({ id: viewing.id, next: "IN_PROGRESS" })}>Start task</button>}{viewing.status === "IN_PROGRESS" && <button className="primary-button px-5" disabled={update.isPending} onClick={() => update.mutate({ id: viewing.id, next: "SUBMITTED" })}>Submit for approval</button>}</div></DetailsModal>}</AnimatePresence></div>;
}

export function UserCampaigns() {
  const client = useQueryClient(); const [page, setPage] = useState(1); const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [createOpen, setCreateOpen] = useState(false); const [resumeDraft, setResumeDraft] = useState(false); const [viewing, setViewing] = useState<Campaign | null>(null); const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null); const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null); const [form, setForm] = useState({ task: "", name: "", description: "" }); const [scheduleOpen, setScheduleOpen] = useState(false); const [scheduleDate, setScheduleDate] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { if (new URLSearchParams(window.location.search).has("resume") && readCampaignDraft()) { setResumeDraft(true); setCreateOpen(true); window.history.replaceState(null, "", "/user/campaigns") } }, 0); return () => window.clearTimeout(timer) }, []);
  const campaigns = useQuery({ queryKey: ["user-campaigns", page, search, status], queryFn: async () => (await apiClient.get<CampaignPage>("/api/campaigns/my/", { params: { page, search, status: status || undefined } })).data }); const tasks = useQuery({ queryKey: ["user-tasks"], queryFn: async () => (await apiClient.get<Assignment[]>("/api/tasks/my/")).data });
  const create = useMutation({ mutationFn: () => apiClient.post("/api/campaigns/create/", { task: Number(form.task), name: form.name, description: form.description }), onSuccess: () => { toast.success("Campaign created"); setCreateOpen(false); setForm({ task: "", name: "", description: "" }); void client.invalidateQueries({ queryKey: ["user-campaigns"] }) }, onError: error => toast.error(parseApiError(error)) });
  const submit = useMutation({ mutationFn: (id: number) => apiClient.post(`/api/campaigns/${id}/submit/`, {}), onSuccess: () => { toast.success("Campaign submitted for approval"); setViewing(null); void client.invalidateQueries({ queryKey: ["user-campaigns"] }) }, onError: error => toast.error(parseApiError(error)) });
  const send = useMutation({ mutationFn: (id: number) => apiClient.post("/api/campaigns/send/", { campaign: id }), onSuccess: () => { toast.success("Campaign sent successfully!"); setViewing(null); void client.invalidateQueries({ queryKey: ["user-campaigns"] }); void client.invalidateQueries({ queryKey: ["user-campaigns-dashboard"] }) }, onError: error => toast.error(parseApiError(error)) });
  const schedule = useMutation({ mutationFn: ({ id, at }: { id: number; at: string }) => apiClient.post("/api/campaigns/schedule/", { campaign: id, scheduled_at: new Date(at).toISOString() }), onSuccess: () => { toast.success("Campaign scheduled!"); setViewing(null); setScheduleOpen(false); setScheduleDate(""); void client.invalidateQueries({ queryKey: ["user-campaigns"] }); void client.invalidateQueries({ queryKey: ["user-campaigns-dashboard"] }) }, onError: error => toast.error(parseApiError(error)) });
  const remove = useMutation({ mutationFn: (id: number) => apiClient.delete(`/api/campaigns/${id}/delete/`), onSuccess: () => { toast.success("Campaign deleted"); setDeleteTarget(null); void client.invalidateQueries({ queryKey: ["user-campaigns"] }); void client.invalidateQueries({ queryKey: ["user-campaigns-dashboard"] }) }, onError: error => toast.error(parseApiError(error)) });

  // Fetch full campaign details for editing
  const loadCampaignForEdit = async (campaign: Campaign) => {
    try {
      // Fetch full campaign details from API
      const response = await apiClient.get(`/api/campaigns/${campaign.id}/detail/`);
      const fullData = response.data;

      // Build the draft object with all campaign data
      const editDraft: CampaignDraft = {
        task: String(campaign.task_id),
        name: campaign.campaign_name,
        description: fullData.description || "",
        template_id: fullData.template_id || "",
        template_name: fullData.template_name || "",
        channel: fullData.channels?.[0]?.channel || "",
        subject: fullData.channels?.[0]?.subject || "",
        body: fullData.channels?.[0]?.body || "",
        scheduled_at: campaign.scheduled_at || "",
        channelTemplates: {}
      };

      // Populate channel templates if available
      if (fullData.channels && Array.isArray(fullData.channels)) {
        fullData.channels.forEach((ch: any) => {
          editDraft.channelTemplates[ch.channel] = {
            template_id: ch.template_id || "",
            template_name: ch.template_name || "",
            subject: ch.subject || "",
            body: ch.body || ""
          };
        });
      }

      storeCampaignDraft(editDraft);
      setEditingCampaign(campaign);
      setResumeDraft(true);
      setCreateOpen(true);
    } catch (error) {
      toast.error("Failed to load campaign details");
      console.error(error);
    }
  };
  if (campaigns.isError) return <ErrorState error={campaigns.error} />; const rows = campaigns.data?.results ?? [];
  if (createOpen) return <CampaignWizard assignments={tasks.data ?? []} initialDraft={resumeDraft ? readCampaignDraft() : null} onCancel={() => { storeCampaignDraft(null); setResumeDraft(false); setCreateOpen(false) }} onCreated={() => { storeCampaignDraft(null); setResumeDraft(false); setCreateOpen(false); void client.invalidateQueries({ queryKey: ["user-campaigns"] }); void client.invalidateQueries({ queryKey: ["user-campaigns-dashboard"] }) }} />;
  return <div><div className="mb-7 flex items-end justify-between gap-4"><PageHeading title="Campaigns" subtitle="Create and manage your marketing campaigns" /><button className="primary-button px-6" onClick={() => { storeCampaignDraft(null); setResumeDraft(false); setCreateOpen(true) }}><Plus size={18} />Create Campaign</button></div><section className="sa-card overflow-hidden"><div className="grid gap-3 border-b border-slate-100 p-5 md:grid-cols-[1fr_220px]"><SearchInput value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder="Search campaigns..." /><Select value={status} onChange={value => { setStatus(value); setPage(1) }} label="All Status" options={["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "SENDING", "COMPLETED", "FAILED", "REJECTED"]} /></div>{campaigns.isLoading ? <Skeleton /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-6 py-5">Campaign Name</th><th>Audience Name</th><th>Channel</th><th>Created At</th><th>Status</th><th className="text-center">Actions</th></tr></thead><tbody>{rows.map((row, index) => <motion.tr initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .03 }} className="border-t border-slate-100 hover:bg-blue-50/30" key={row.id}><td className="px-6 py-5 font-semibold">{row.campaign_name}</td><td>{row.audience_name || "—"}</td><td><div className="flex flex-wrap gap-2">{row.channels.length ? row.channels.map(name => <ChannelIcon name={name} key={name} />) : "—"}</div></td><td>{formatDate(row.created_at)}</td><td><Badge className={campaignTone[row.status]}>{pretty(row.status)}</Badge></td><td className="text-center"><div className="inline-flex items-center gap-2"><button aria-label="Edit" title="Edit campaign" className="icon-button !border !border-slate-200 !text-orange-500" onClick={() => loadCampaignForEdit(row)}><Pencil size={16} /></button><button aria-label="View" title="View campaign" className="icon-button !border !border-slate-200 !text-blue-600" onClick={() => setViewing(row)}><Eye size={17} /></button><button aria-label="Delete" title="Delete campaign" className="icon-button !border !border-slate-200 !text-red-500" onClick={() => setDeleteTarget(row)}><Trash2 size={16} /></button></div></td></motion.tr>)}</tbody></table>{!rows.length && <Empty message="No campaigns found." />}</div>}<Pagination page={page} count={campaigns.data?.count ?? 0} pageSize={10} setPage={setPage} /></section>
    <AnimatePresence>{createOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.form initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl" onSubmit={event => { event.preventDefault(); create.mutate() }}><ModalHeader title="Create Campaign" onClose={() => setCreateOpen(false)} /><div className="space-y-5 p-6"><label className="field"><span>Assigned task *</span><select required value={form.task} onChange={event => setForm({ ...form, task: event.target.value })}><option value="">Select task</option>{(tasks.data ?? []).map(row => <option value={row.task.id} key={row.id}>{row.task.title}</option>)}</select></label><label className="field"><span>Campaign name *</span><input required minLength={3} placeholder="Enter campaign name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>Description</span><textarea rows={4} placeholder="Describe this campaign" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label></div><div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5"><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary-button px-6" disabled={create.isPending}>{create.isPending ? "Creating..." : "Create Campaign"}</button></div></motion.form></div>}{viewing && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: .96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><button aria-label="Close" className="absolute right-4 top-4 icon-button z-10" type="button" onClick={() => { setViewing(null); setScheduleOpen(false); setScheduleDate("") }}><X size={20} /></button><div className="flex flex-col items-center gap-2 border-b border-slate-100 px-6 pb-5 pt-7 text-center"><span className={`grid h-14 w-14 place-items-center rounded-full ${viewing.status === "REJECTED" ? "bg-red-50 text-red-500" : viewing.status === "APPROVED" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-500"}`}><Megaphone size={24} /></span><h2 className="text-xl font-black text-slate-900">Campaign Details</h2></div><div className="p-6 space-y-4"><div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600"><Megaphone size={17} /></span><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Campaign Name</p><p className="text-sm font-semibold text-slate-800">{viewing.campaign_name}</p></div></div><div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${viewing.status === "APPROVED" ? "bg-emerald-100 text-emerald-600" : viewing.status === "REJECTED" ? "bg-red-100 text-red-500" : "bg-slate-200 text-slate-500"}`}><CheckCircle2 size={17} /></span><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</p><Badge className={campaignTone[viewing.status]}>{pretty(viewing.status)}</Badge></div></div>{viewing.status === "REJECTED" && <div className="rounded-2xl border border-red-100 bg-red-50 p-4"><div className="flex items-center gap-2 mb-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-red-100 text-red-500"><X size={13} /></span><p className="text-sm font-black text-red-700">Rejected by Admin</p></div>{viewing.rejection_reason && <div className="mb-3"><p className="text-xs font-bold uppercase tracking-wide text-red-400">Rejected Reason</p><p className="mt-1 text-sm text-red-800">{viewing.rejection_reason}</p></div>}{viewing.review_comments && <div><p className="text-xs font-bold uppercase tracking-wide text-red-400">Description</p><p className="mt-1 text-sm text-red-800">{viewing.review_comments}</p></div>}</div>}{viewing.status === "APPROVED" && !scheduleOpen && <div className="grid grid-cols-2 gap-3 pt-1"><button disabled={send.isPending} onClick={() => send.mutate(viewing.id)} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-5 text-center transition hover:border-blue-400 hover:bg-blue-100 disabled:opacity-60"><span className="grid h-11 w-11 place-items-center rounded-full bg-white text-blue-600 shadow-sm"><Send size={20} /></span><span className="text-sm font-black text-blue-700">{send.isPending ? "Sending…" : "Send Now"}</span><span className="text-[11px] text-slate-500">Send campaign immediately</span></button><button onClick={() => setScheduleOpen(true)} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-5 text-center transition hover:border-indigo-400 hover:bg-indigo-100"><span className="grid h-11 w-11 place-items-center rounded-full bg-white text-indigo-600 shadow-sm"><CalendarClock size={20} /></span><span className="text-sm font-black text-indigo-700">Schedule</span><span className="text-[11px] text-slate-500">Schedule for later</span></button></div>}{viewing.status === "APPROVED" && scheduleOpen && <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 space-y-3"><p className="text-sm font-black text-indigo-700 flex items-center gap-2"><CalendarClock size={16} />Pick a date &amp; time</p><input type="datetime-local" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="h-11 w-full rounded-xl border border-indigo-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /><div className="flex gap-2"><button className="secondary-button flex-1" onClick={() => { setScheduleOpen(false); setScheduleDate("") }}>Cancel</button><button disabled={!scheduleDate || schedule.isPending} onClick={() => { if (viewing && scheduleDate) schedule.mutate({ id: viewing.id, at: scheduleDate }) }} className="primary-button flex-1 justify-center disabled:opacity-60">{schedule.isPending ? "Scheduling…" : "Confirm"}</button></div></div>}<div className="grid grid-cols-2 gap-3"><Info label="Task" value={viewing.task_name || "—"} /><Info label="Audience" value={viewing.audience_name || "—"} /></div></div><div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">{viewing.status === "REJECTED" && <button className="secondary-button flex items-center gap-2 px-5 text-blue-600 border-blue-300" onClick={() => { storeCampaignDraft(null); setViewing(null); setCreateOpen(true) }}><Pencil size={15} />Edit Campaign</button>}<button className="secondary-button px-5" onClick={() => { setViewing(null); setScheduleOpen(false); setScheduleDate("") }}>Close</button>{viewing.available_actions.includes("submit") && <button className="primary-button px-5" disabled={submit.isPending} onClick={() => submit.mutate(viewing.id)}>Submit for approval</button>}</div></motion.div></div>}{deleteTarget && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: .95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex flex-col items-center gap-3 p-8 text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-red-50"><Trash2 size={28} className="text-red-500" /></span><h2 className="text-xl font-black text-slate-900">Delete Campaign?</h2><p className="text-sm text-slate-500">Are you sure you want to delete <strong>&quot;{deleteTarget.campaign_name}&quot;</strong>? This action cannot be undone.</p></div><div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button className="secondary-button px-6" onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>Cancel</button><button className="flex min-h-10 items-center gap-2 rounded-xl bg-red-500 px-6 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50" onClick={() => remove.mutate(deleteTarget.id)} disabled={remove.isPending}>{remove.isPending ? "Deleting..." : "Delete"}</button></div></motion.div></motion.div>}</AnimatePresence></div>;
}


function CampaignWizard({ assignments, initialDraft, onCancel, onCreated }: { assignments: Assignment[]; initialDraft: CampaignDraft | null; onCancel: () => void; onCreated: () => void }) {
  const user = useQuery({ queryKey: ["auth-profile"], queryFn: authService.profile });
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const router = useRouter();
  const [step, setStep] = useState(initialDraft?.task ? 2 : 1);
  const [channelIndex, setChannelIndex] = useState(0);
  const [form, setForm] = useState<CampaignDraft>(() => initialDraft ? { ...emptyCampaignDraft, ...initialDraft } : { ...emptyCampaignDraft });
  const [previewPage, setPreviewPage] = useState(1);
  const [previewSearch, setPreviewSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewChannelIdx, setPreviewChannelIdx] = useState(0);
  const [previewCustomerIdx, setPreviewCustomerIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const channels = useQuery({ queryKey: ["channels"], queryFn: async () => (await apiClient.get<Channel[]>("/api/channels/")).data });
  const selectedAssignment = assignments.find(row => String(row.task.id) === form.task);
  const audiencePreview = useQuery({ queryKey: ["task-audience-preview", selectedAssignment?.task.id, previewPage, previewSearch], queryFn: async () => (await apiClient.get<AudiencePreviewPage>(`/api/tasks/${selectedAssignment?.task.id}/audience-preview/`, { params: { page: previewPage, page_size: 5, search: previewSearch || undefined } })).data, enabled: step === 3 && Boolean(selectedAssignment?.task.id), placeholderData: previous => previous });

  // All channels assigned to the selected task
  const taskChannels = (selectedAssignment?.task.channels ?? []).map(id => (channels.data ?? []).find(ch => ch.id === id) ?? { id, name: `Channel ${id}` });
  // Current channel being templated
  const currentChannel = taskChannels[channelIndex];
  // Current channel template draft
  const currentCT: ChannelTemplate = form.channelTemplates[String(currentChannel?.id ?? "")] ?? { template_id: "", template_name: "", subject: "", body: "" };
  const setCurrentCT = (patch: Partial<ChannelTemplate>) => setForm(f => {
    const channelId = String(currentChannel?.id ?? "");
    const existing = f.channelTemplates[channelId] || { template_id: "", template_name: "", subject: "", body: "" };
    return { ...f, channelTemplates: { ...f.channelTemplates, [channelId]: { ...existing, ...patch } } };
  });
  const isEmail = (name: string) => name.toUpperCase().includes("EMAIL");

  // Save all templates + create campaign
  const doSave = async (submitForApproval: boolean) => {
    setSaving(true);
    try {
      const created = (await apiClient.post<{ campaign: { id: number } }>("/api/campaigns/create/", { task: Number(form.task), name: form.name.trim(), description: form.description.trim() })).data.campaign;
      // Assign all task channels to campaign
      await apiClient.post(`/api/channels/${created.id}/`, { channels: taskChannels.map(c => c.id) });
      // Create/assign template for each channel
      for (const ch of taskChannels) {
        const ct = form.channelTemplates[String(ch.id)];
        if (!ct?.body?.trim()) continue;
        const templateId = ct.template_id ? Number(ct.template_id) : (await apiClient.post<Template>("/api/templates/create/", { name: ct.template_name.trim() || `${form.name} - ${ch.name}`, channel: ch.id, subject: ct.subject?.trim() || "", body: ct.body, status: "ACTIVE" })).data.id;
        await apiClient.post("/api/campaigns/templates/assign/", { campaign: created.id, channel: ch.id, template: templateId });
      }
      if (form.scheduled_at) await apiClient.patch(`/api/campaigns/${created.id}/schedule/`, { scheduled_at: new Date(form.scheduled_at).toISOString() });
      if (submitForApproval) await apiClient.post(`/api/campaigns/${created.id}/submit/`, {});
      toast.success(submitForApproval ? "Campaign submitted for approval" : "Campaign saved as draft");
      onCreated();
    } catch (err) { toast.error(parseApiError(err)); }
    finally { setSaving(false); }
  };

  const goNext = async () => {
    if (step === 1) {
      if (!form.task) { toast.error("Please select an assigned task."); return; }
      if (form.name.trim().length < 3) { toast.error("Campaign name must be at least 3 characters."); return; }
      if (channels.isLoading) { toast.info("Channels are still loading. Please wait."); return; }
      setStep(2); setChannelIndex(0);
      return;
    }
    if (step === 2) {
      if (!currentChannel) { toast.error("No channel available."); return; }
      if (!currentCT.template_name.trim()) { toast.error("Enter a template name."); return; }
      if (isEmail(currentChannel.name) && (currentCT.subject?.length ?? 0) > 255) { toast.error("Email subject must be 255 characters or less."); return; }
      if (!currentCT.body.trim()) { toast.error("Enter the template body."); return; }
      // Auto-save template if new
      if (!currentCT.template_id) {
        try {
          const saved = await apiClient.post<Template>("/api/templates/create/", { name: currentCT.template_name.trim(), channel: currentChannel.id, subject: currentCT.subject?.trim() || "", body: currentCT.body, status: "ACTIVE" });
          setCurrentCT({ template_id: String(saved.data.id) });
          toast.success(`"${currentChannel.name}" template saved to My Templates`);
        } catch (err) { toast.error("Could not save template: " + parseApiError(err)); return; }
      }
      // More channels left? Advance to next channel
      if (channelIndex < taskChannels.length - 1) { setChannelIndex(i => i + 1); return; }
      // All channels done → preview
      setStep(3);
      return;
    }
  };

  const goBack = () => {
    if (step === 3) { setStep(2); setChannelIndex(taskChannels.length - 1); return; }
    if (step === 2 && channelIndex > 0) { setChannelIndex(i => i - 1); return; }
    if (step === 2) { setStep(1); return; }
  };

  // Step indicator: step 1 = Campaign Details, step 2.N = Template (channel N of M), step 3 = Preview
  const totalSteps = 1 + taskChannels.length + 1;
  const currentStepNum = step === 1 ? 1 : step === 2 ? 1 + channelIndex + 1 : totalSteps;

  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="flex items-center justify-between gap-4">
      <h1 className="sa-title normal-case">Create Campaign</h1>
      <span className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">Step {currentStepNum} of {totalSteps}</span>
    </div>
    <button className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-600" onClick={onCancel}><ChevronLeft size={17} />Back to Campaigns</button>

    <section className="sa-card mt-5 overflow-hidden p-6 sm:p-8">
      {/* Progress bar */}
      <div className="mt-2 flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < currentStepNum ? "bg-blue-600" : i === currentStepNum - 1 ? "bg-blue-400" : "bg-slate-200"}`} />)}
      </div>
      <div className="mt-3 flex justify-between text-xs text-slate-500 font-semibold">
        <span className={step === 1 ? "text-blue-600" : ""}>Campaign Details</span>
        {taskChannels.map((ch, i) => <span key={ch.id} className={step === 2 && channelIndex === i ? "text-blue-600" : ""}>{ch.name} Template</span>)}
        <span className={step === 3 ? "text-blue-600" : ""}>Preview</span>
      </div>

      <div className="mt-10 min-h-[440px]">
        {/* ── Step 1: Campaign Details ── */}
        {step === 1 && <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <h2 className="text-2xl font-black">Campaign Details</h2>
          <label className="field"><span>Select Task <b className="text-red-500">*</b></span><select required value={form.task} onChange={event => setForm({ ...form, task: event.target.value, channelTemplates: {} })}><option value="">Select a task</option>{assignments.map(row => <option value={row.task.id} key={row.id}>{row.task.title} — {row.task.audience_name}</option>)}</select></label>
          <label className="field"><span>Campaign Name <b className="text-red-500">*</b></span><input minLength={3} placeholder="Enter campaign name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field"><span>Campaign Description</span><textarea rows={4} placeholder="Optional" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
          {selectedAssignment && taskChannels.length > 0 && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <strong>{taskChannels.length} channel{taskChannels.length > 1 ? "s" : ""}</strong> assigned to this task: {taskChannels.map(c => c.name).join(", ")}. You'll create a template for each one.
          </div>}
        </motion.div>}

        {/* ── Step 2: Template per channel ── */}
        {step === 2 && currentChannel && <motion.div key={`ch-${channelIndex}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${isEmail(currentChannel.name) ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{channelIndex + 1}</span>
                <h2 className="text-2xl font-black">{currentChannel.name} Template</h2>
              </div>
              <p className="text-sm text-slate-500 ml-10">Template {channelIndex + 1} of {taskChannels.length} — auto-saved to My Templates on Next</p>
            </div>
            <button type="button" className="secondary-button flex items-center gap-2 border-blue-300 px-5 text-blue-600" onClick={() => setPickerOpen(true)}><FileText size={17} />My Templates</button>
          </div>
          <div className="mt-7 space-y-5">
            <label className="field"><span>Template Name <b className="text-red-500">*</b></span><input placeholder={`${form.name} - ${currentChannel.name}`} value={currentCT.template_name} onChange={e => setCurrentCT({ template_name: e.target.value, template_id: "" })} /></label>
            {isEmail(currentChannel.name) && <label className="field"><span>Subject <span className="ml-1 text-[10px] font-normal text-slate-400">(max 255 characters)</span></span><input placeholder="Email subject line" maxLength={255} value={currentCT.subject ?? ""} onChange={e => setCurrentCT({ subject: e.target.value, template_id: "" })} /><span className={`mt-1 block text-right text-[11px] font-semibold ${(currentCT.subject?.length ?? 0) > 220 ? "text-red-500" : (currentCT.subject?.length ?? 0) > 180 ? "text-amber-500" : "text-slate-400"}`}>{currentCT.subject?.length ?? 0}/255</span></label>}
            <label className="field"><span>Body <b className="text-red-500">*</b></span>
              <RichBodyEditor
                value={currentCT.body}
                onChange={(body: string) => setCurrentCT({ body, template_id: "" })}
                placeholder={`Enter ${currentChannel.name} message body...`}
              />
            </label>
          </div>
        </motion.div>}

        {/* ── Step 3: Preview ── */}
        {step === 3 && <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">

          {/* Campaign Summary */}
          <div>
            <h2 className="text-2xl font-black">Campaign Summary</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {/* Campaign Name */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><Target size={16} /></span>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Campaign Name</p><p className="mt-0.5 truncate text-sm font-bold text-slate-800" title={form.name}>{form.name || "—"}</p></div>
              </div>
              {/* Audience */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600"><Users size={16} /></span>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Audience</p><p className="mt-0.5 truncate text-sm font-bold text-slate-800" title={selectedAssignment?.task.audience_name}>{selectedAssignment?.task.audience_name || "—"}</p></div>
              </div>
              {/* Total Recipients */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-50 text-orange-500"><UserRound size={16} /></span>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Recipients</p><p className="mt-0.5 text-sm font-bold text-slate-800">{audiencePreview.isLoading ? "…" : compactNumber(audiencePreview.data?.total_customers ?? 0)}</p></div>
              </div>
              {/* Channels */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><Mail size={16} /></span>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Channels</p><p className="mt-0.5 truncate text-sm font-bold text-slate-800">{taskChannels.map(c => c.name).join(", ") || "—"}</p></div>
              </div>
              {/* Status */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-500"><ShieldCheck size={16} /></span>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p><span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Pending Approval</span></div>
              </div>
            </div>
          </div>

          {/* Template Preview */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Header row: title + channel tabs */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900">Campaign Preview</h3>
                <p className="mt-0.5 text-xs text-slate-500">Test your message appearance and personalization.</p>
              </div>
              {/* Channel tabs */}
              <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
                {taskChannels.map((ch, i) => {
                  const active = previewChannelIdx === i;
                  const normalized = ch.name.toUpperCase();
                  const Icon = normalized.includes("WHATS") ? MessageCircle : normalized.includes("SMS") ? MessageCircle : Mail;
                  return (
                    <button key={ch.id} type="button"
                      onClick={() => setPreviewChannelIdx(i)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${active ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                      <Icon size={13} />{ch.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview body: left panel + right panel */}
            <div className="grid lg:grid-cols-[280px_1fr]">
              {/* ── Left panel ── */}
              {(() => {
                const activeChId = taskChannels[previewChannelIdx]?.id;
                const activeCT = form.channelTemplates[String(activeChId ?? "")] ?? { template_id: "", template_name: "", subject: "", body: "" };
                const combinedText = (activeCT.subject || "") + (activeCT.body || "");
                const usedVars = Array.from(new Set([...combinedText.matchAll(/\{\{(.*?)\}\}/g)].map((m: RegExpMatchArray) => m[1].trim())));

                return (
                  <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r bg-white">
                    <div>
                      <p className="mb-2 text-sm font-black text-slate-900">Test Variables</p>
                      <p className="mb-4 text-xs text-slate-500">Fill in sample data to see how personalization looks.</p>

                      <div className="space-y-4">
                        {usedVars.length === 0 ? (
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                            <span className="text-xs font-semibold text-slate-400">No variables used</span>
                          </div>
                        ) : (
                          usedVars.map((v: string) => (
                            <label key={v} className="block">
                              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">{v}</span>
                              <input
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                value={testVariables[v] !== undefined ? testVariables[v] : (v === 'name' ? ((user.data as any)?.name || user.data?.first_name || "John Doe") : "")}
                                onChange={e => setTestVariables(prev => ({ ...prev, [v]: e.target.value }))}
                                placeholder={`Enter ${v}...`}
                              />
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Right panel: rendered message ── */}
              {(() => {
                const activeCh = taskChannels[previewChannelIdx];
                const channelName = activeCh?.name || "";
                const isWhatsapp = channelName.toUpperCase().includes("WHATS");
                const isSms = channelName.toUpperCase().includes("SMS");
                const isEmail = !isWhatsapp && !isSms;

                const activeChId = activeCh?.id;
                const activeCT = form.channelTemplates[String(activeChId ?? "")] ?? { template_id: "", template_name: "", subject: "", body: "" };

                // Helper to resolve variables
                const resolveText = (text?: string | null) => {
                  if (!text || typeof text !== "string") return "";
                  return text.replace(/\{\{(.*?)\}\}/g, (match, v) => {
                    const cleanV = v.trim();
                    const val = testVariables[cleanV] !== undefined ? testVariables[cleanV] : (cleanV === 'name' ? ((user.data as any)?.name || user.data?.first_name || "John Doe") : "");
                    return val || `{{${cleanV}}}`;
                  });
                };

                const resolvedSubject = resolveText(activeCT.subject ?? "");
                const resolvedBody = resolveText(activeCT.body);

                return (
                  <div className="p-8 flex items-center justify-center bg-slate-50/50">

                    {/* EMAIL MOCKUP */}
                    {isEmail && (
                      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="border-b border-slate-100 bg-slate-50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Subject:</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{resolvedSubject || <span className="italic text-slate-400">No subject</span>}</p>
                        </div>
                        <div className="p-6">
                          <div
                            className="text-sm leading-relaxed text-slate-800 [&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg"
                            dangerouslySetInnerHTML={{ __html: resolvedBody || "<span style='color:#94a3b8'>No message body.</span>" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* WHATSAPP MOCKUP */}
                    {isWhatsapp && (
                      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-[#efeae2] shadow-sm overflow-hidden relative h-[600px] flex flex-col">
                        <div className="bg-[#075e54] px-4 py-3 text-white flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-300 overflow-hidden"><User size={24} className="text-[#075e54]" /></span>
                          <div>
                            <p className="font-bold">Your Brand</p>
                            <p className="text-[10px] text-white/80">Business Account</p>
                          </div>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'cover', backgroundBlendMode: 'overlay', backgroundColor: 'rgba(239, 234, 226, 0.9)' }}>
                          <div className="bg-white rounded-tr-xl rounded-b-xl p-3 shadow-sm text-[15px] leading-snug text-slate-900 w-[90%] whitespace-pre-wrap float-left">
                            <div dangerouslySetInnerHTML={{ __html: resolvedBody.replace(/\n/g, "<br/>") || "<span style='color:#94a3b8'>No message...</span>" }} />
                            <p className="text-[10px] text-right text-slate-400 mt-2">11:30 AM</p>
                          </div>
                        </div>
                        <div className="bg-[#f0f0f0] p-2 flex gap-2 items-center">
                          <div className="bg-white rounded-full flex-1 px-4 py-2.5 text-sm text-slate-400">Message</div>
                          <div className="bg-[#00a884] rounded-full h-10 w-10 flex items-center justify-center text-white"><Mic size={18} /></div>
                        </div>
                      </div>
                    )}

                    {/* SMS MOCKUP */}
                    {isSms && (
                      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative h-[600px] flex flex-col">
                        <div className="bg-white border-b border-slate-100 px-4 py-3 flex flex-col items-center">
                          <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-200 text-slate-400 mb-2"><User size={32} /></span>
                          <p className="text-xs font-medium text-slate-900">+1 (800) 555-0199</p>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto bg-white flex flex-col">
                          <p className="text-center text-[10px] font-semibold text-slate-400 mb-4">Text Message<br />Today 11:30 AM</p>
                          <div className="bg-[#e9e9eb] rounded-2xl rounded-bl-sm p-3 shadow-sm text-[15px] leading-snug text-black w-fit max-w-[85%] whitespace-pre-wrap">
                            <div dangerouslySetInnerHTML={{ __html: resolvedBody.replace(/\n/g, "<br/>") || "<span style='color:#94a3b8'>No message...</span>" }} />
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}
            </div>
          </div>

        </motion.div>}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-6">
        <div>{(step > 1 || (step === 2 && channelIndex > 0)) && <button type="button" className="secondary-button flex items-center gap-2 px-5" onClick={goBack}><ChevronLeft size={17} />Back</button>}</div>
        <div className="flex gap-3">
          {step < 3 && <button type="button" className="primary-button px-7" onClick={() => void goNext()}>
            {step === 2 && channelIndex < taskChannels.length - 1 ? `Next: ${taskChannels[channelIndex + 1]?.name} Template` : "Next"}<ChevronRight size={17} />
          </button>}
          {step === 3 && <>
            <button type="button" className="secondary-button px-5" disabled={saving || audiencePreview.isLoading} onClick={() => void doSave(false)}>{saving ? "Saving..." : "Save as Draft"}</button>
            <button type="button" className="primary-button px-6" disabled={saving || audiencePreview.isLoading || audiencePreview.isError} onClick={() => void doSave(true)}>{saving ? "Submitting..." : "Submit for Approval"}<ChevronRight size={17} /></button>
          </>}
        </div>
      </div>
      {pickerOpen && currentChannel && (
        <TemplatePickerModal
          channelId={currentChannel.id}
          onClose={() => setPickerOpen(false)}
          onSelect={(template) => {
            setCurrentCT({
              template_id: String(template.id),
              template_name: template.name,
              subject: template.subject,
              body: template.body,
            });
            setPickerOpen(false);
          }}
        />
      )}
    </section>
  </motion.div>;
}
function RichBodyEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [showLink, setShowLink] = useState(false); const [linkUrl, setLinkUrl] = useState("");
  const [showImg, setShowImg] = useState(false); const [imgUrl, setImgUrl] = useState("");
  const [showVar, setShowVar] = useState(false); const [varInput, setVarInput] = useState("");

  // Init and update editor HTML from value prop
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const emit = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const checkFormats = () => {
    const active = new Set<string>();
    try {
      if (document.queryCommandState("bold")) active.add("bold");
      if (document.queryCommandState("italic")) active.add("italic");
      if (document.queryCommandState("underline")) active.add("underline");
      if (document.queryCommandState("insertOrderedList")) active.add("ol");
      if (document.queryCommandState("insertUnorderedList")) active.add("ul");
    } catch { }
    setActiveFormats(active);
  };

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val ?? "");
    emit(); checkFormats();
  };

  const insertAtCursor = (html: string) => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    emit();
  };

  const applyLink = () => {
    if (!linkUrl.trim()) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, linkUrl.trim());
    // Make link open in new tab
    editorRef.current?.querySelectorAll("a:not([target])").forEach(a => a.setAttribute("target", "_blank"));
    emit(); setShowLink(false); setLinkUrl("");
  };

  const applyImg = () => {
    if (!imgUrl.trim()) return;
    insertAtCursor(`<img src="${imgUrl.trim()}" alt="image" style="max-width:100%;border-radius:6px;margin:4px 0;display:block"/>`);
    setShowImg(false); setImgUrl("");
  };

  const applyVar = (v: string) => {
    insertAtCursor(`<span style="background:#ede9fe;color:#6d28d9;border-radius:4px;padding:1px 7px;font-family:monospace;font-size:12px;font-weight:600">{{${v}}}</span>&nbsp;`);
    setShowVar(false); setVarInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "b") { e.preventDefault(); exec("bold"); }
    if (e.ctrlKey && e.key === "i") { e.preventDefault(); exec("italic"); }
    if (e.ctrlKey && e.key === "u") { e.preventDefault(); exec("underline"); }
    if (e.key === "Tab") { e.preventDefault(); exec("insertHTML", "&nbsp;&nbsp;"); }
  };

  const tools = [
    { id: "bold", label: "Bold (Ctrl+B)", icon: Bold, act: () => exec("bold") },
    { id: "italic", label: "Italic (Ctrl+I)", icon: Italic, act: () => exec("italic") },
    { id: "underline", label: "Underline (Ctrl+U)", icon: Underline, act: () => exec("underline") },
    { id: "ul", label: "Bullet list", icon: List, act: () => exec("insertUnorderedList") },
    { id: "ol", label: "Numbered list", icon: ListOrdered, act: () => exec("insertOrderedList") },
    { id: "link", label: "Insert link", icon: Link2, act: () => { editorRef.current?.focus(); setShowLink(v => !v); setShowImg(false); setShowVar(false); } },
    { id: "image", label: "Insert image", icon: ImageIcon, act: () => { editorRef.current?.focus(); setShowImg(v => !v); setShowLink(false); setShowVar(false); } },
    { id: "variable", label: "Insert variable", icon: Braces, act: () => { editorRef.current?.focus(); setShowVar(v => !v); setShowLink(false); setShowImg(false); } },
  ] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5">
        {tools.map(({ id, label, icon: Icon, act }) => (
          <button key={id} type="button" title={label}
            onMouseDown={e => {
              // preventDefault keeps focus in editor, then we manually run the command
              e.preventDefault();
              act();
            }}
            className={`grid h-9 w-9 place-items-center rounded-lg transition hover:bg-blue-50 hover:text-blue-600 ${activeFormats.has(id) ? "bg-blue-100 text-blue-700" : "text-slate-500"}`}>
            <Icon size={17} />
          </button>
        ))}
      </div>

      {/* ── Link bar ── */}
      {showLink && (
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-3 py-2">
          <Link2 size={14} className="shrink-0 text-blue-600" />
          <input autoFocus className="h-8 flex-1 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" placeholder="https://example.com" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setShowLink(false); }} />
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700" onClick={applyLink}>Insert Link</button>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setShowLink(false)}><X size={15} /></button>
        </div>
      )}

      {/* ── Image bar ── */}
      {showImg && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2">
          <ImageIcon size={14} className="shrink-0 text-amber-600" />
          <input autoFocus className="h-8 flex-1 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" placeholder="https://example.com/image.png" value={imgUrl} onChange={e => setImgUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyImg(); } if (e.key === "Escape") setShowImg(false); }} />
          <button type="button" className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600" onClick={applyImg}>Insert Image</button>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setShowImg(false)}><X size={15} /></button>
        </div>
      )}

      {/* ── Variable bar ── */}
      {showVar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-violet-100 bg-violet-50 px-3 py-2">
          <Braces size={14} className="shrink-0 text-violet-600" />
          <input autoFocus className="h-8 w-28 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" placeholder="field name" value={varInput} onChange={e => setVarInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyVar(varInput || "name"); } if (e.key === "Escape") setShowVar(false); }} />
          <div className="flex flex-wrap gap-1.5">
            {["name", "email", "phone", "city", "company"].map(v => (
              <button key={v} type="button" className="rounded-full bg-violet-200 px-2.5 py-1 text-xs font-bold text-violet-800 hover:bg-violet-300" onClick={() => applyVar(v)}>{`{{${v}}}`}</button>
            ))}
          </div>
          {varInput.trim() && <button type="button" className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => applyVar(varInput)}>Insert</button>}
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setShowVar(false)}><X size={15} /></button>
        </div>
      )}

      {/* ── Rich editor (contenteditable) ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyDown={handleKeyDown}
        onMouseUp={checkFormats}
        onKeyUp={checkFormats}
        data-placeholder={placeholder}
        className="min-h-[160px] p-4 text-sm font-normal leading-7 text-slate-800 outline-none [&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none"
      />
    </div>
  );
}

function WizardProgress({ step }: { step: number }) { const stages = ["Campaign Details", "Template & Audience", "Review & Schedule"]; return <div className="mt-9 grid grid-cols-3">{stages.map((label, index) => { const number = index + 1; const active = number <= step; return <div className="relative text-center" key={label}>{index > 0 && <span className={`absolute right-1/2 top-3 h-px w-full ${number <= step ? "bg-blue-500" : "bg-slate-200"}`} />}<span className={`relative z-10 mx-auto grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-bold transition ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-500"}`}>{number < step ? "✓" : number}</span><p className={`mt-3 text-xs font-semibold sm:text-sm ${number === step ? "text-slate-950" : "text-slate-500"}`}>{label}</p></div> })}</div> }

function PreviewStat({ icon: Icon, label, value, tone = "blue" }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; tone?: "blue" | "orange" }) { return <div className="flex min-h-20 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone === "orange" ? "bg-orange-50 text-orange-500" : "bg-blue-50 text-blue-600"}`}><Icon size={21} /></span><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block truncate text-sm text-slate-950" title={value}>{value}</strong></div></div> }

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />LIVE WORKSPACE</span><h1 className="sa-title mt-2 normal-case">{title}</h1><p className="sa-subtitle">{subtitle}</p></div> }
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} /></label> }
function Select({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: string[] }) { return <select className="h-12 rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" value={value} onChange={event => onChange(event.target.value)}><option value="">{label}</option>{options.map(option => <option value={option} key={option}>{pretty(option)}</option>)}</select> }
function Badge({ className = "", children }: { className?: string; children: React.ReactNode }) { return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span> }
function ChannelGlyph({ name }: { name: string }) { const normalized = name.toUpperCase(); const Icon = normalized.includes("WHATS") || normalized.includes("SMS") ? MessageCircle : Mail; return <Icon size={19} /> }
function ChannelIcon({ name }: { name: string }) {
  const n = name.toUpperCase();
  if (n.includes("WHATS")) return (
    <span title={name} className="grid h-8 w-8 place-items-center text-emerald-500">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.121 1.534 5.857L0 24l6.335-1.521A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.783 9.783 0 01-5.013-1.38l-.36-.214-3.733.897.933-3.621-.235-.372A9.784 9.784 0 012.182 12C2.182 6.573 6.573 2.182 12 2.182S21.818 6.573 21.818 12 17.427 21.818 12 21.818z" />
      </svg>
    </span>
  );
  if (n.includes("SMS")) return (
    <span title={name} className="grid h-8 w-8 place-items-center text-orange-400">
      <MessageSquare size={18} strokeWidth={2} />
    </span>
  );
  return (
    <span title={name} className="grid h-8 w-8 place-items-center text-blue-600">
      <Mail size={18} strokeWidth={2} />
    </span>
  );
}
function Pagination({ page, count, pageSize, setPage }: { page: number; count: number; pageSize: number; setPage: (page: number) => void }) { const pages = Math.max(1, Math.ceil(count / pageSize)); return <div className="flex items-center justify-between border-t border-slate-100 p-4"><span className="text-sm text-slate-500">Showing {count ? ((page - 1) * pageSize) + 1 : 0} to {Math.min(page * pageSize, count)} of {count}</span><div className="flex gap-2"><button aria-label="Previous page" className="icon-button !border !border-slate-200" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span className="grid h-8 min-w-8 place-items-center rounded-lg border border-blue-500 px-2 text-sm font-bold text-blue-600">{page}</span><button aria-label="Next page" className="icon-button !border !border-slate-200" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></div> }
function DashboardTable({ title, href, headers, rows }: { title: string; href: string; headers: string[]; rows: React.ReactNode[][] }) { return <section className="sa-card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-black">{title}</h2><Link className="text-xs font-semibold text-blue-600 hover:underline" href={href}>View All</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50"><tr>{headers.map(header => <th className="px-5 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-slate-100" key={index}>{row.map((cell, cellIndex) => <td className="px-5 py-3" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <Empty message={`No ${title.toLowerCase()} yet.`} />}</div></section> }
function DetailsModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: .96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"><ModalHeader title={title} onClose={onClose} /><div className="p-6">{children}</div></motion.div></div> }
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <div className="flex items-center justify-between border-b border-slate-100 p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">User workspace</p><h2 className="mt-1 text-2xl font-black">{title}</h2></div><button aria-label="Close" className="icon-button" type="button" onClick={onClose}><X size={20} /></button></div> }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd></div> }
function Empty({ message }: { message: string }) { return <div className="p-12 text-center text-sm text-slate-500"><CircleDot className="mx-auto mb-3 text-slate-300" />{message}</div> }
function Skeleton() { return <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map(item => <div className="h-14 animate-pulse rounded-xl bg-slate-100" key={item} />)}</div> }
function ErrorState({ error }: { error: unknown }) { return <div className="sa-card p-10 text-center text-red-600">{parseApiError(error)}</div> }
function weekRange() { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 6); return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` }
