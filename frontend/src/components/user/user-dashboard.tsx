"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  Workflow,
  Share2,
  Calendar,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Send,
  Target,
  Eye,
  MousePointerClick,
  XCircle,
  Users,
  UserCheck,
  Zap,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  ArrowUpRight,
  Plus,
  CalendarDays,
  Instagram,
  Facebook,
  Linkedin,
  BarChart3,
  X,
  FileText,
  Copy,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  Bot,
  RefreshCw,
  MoreVertical,
  Check,
  ChevronLeft
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";

// --- Types ---
export type GlobalDatePreset =
  | "Today"
  | "Yesterday"
  | "Last 7 Days"
  | "Last 30 Days"
  | "This Month"
  | "Last Month"
  | "Custom";

export type DashboardTab = "Overview" | "Campaigns" | "Automations" | "Content Studio";

// --- Sparkline Generator ---
const makeSpark = (base: number, variance = 15) =>
  Array.from({ length: 10 }, (_, i) => ({
    i,
    v: Math.max(5, base + Math.floor(Math.random() * variance * 2 - variance))
  }));

// --- Mock Datasets ---
const CAMPAIGNS_DATA = [
  { id: 1, name: "Festival Offer", channel: "WhatsApp", status: "Running", sent: 24520, delivered: 23840, opened: 18420, clicked: 8420, createdOn: "Jul 26, 2025" },
  { id: 2, name: "Product Launch", channel: "Email", status: "Running", sent: 18420, delivered: 17980, opened: 6420, clicked: 1380, createdOn: "Jul 25, 2025" },
  { id: 3, name: "Flash Sale Alert", channel: "SMS", status: "Completed", sent: 12680, delivered: 12120, opened: 0, clicked: 2450, createdOn: "Jul 20, 2025" },
  { id: 4, name: "Summer Collection Promo", channel: "Email", status: "Running", sent: 28140, delivered: 26990, opened: 8420, clicked: 2180, createdOn: "Jul 18, 2025" },
  { id: 5, name: "Re-engagement Push", channel: "WhatsApp", status: "Paused", sent: 8420, delivered: 7990, opened: 5120, clicked: 1240, createdOn: "Jul 15, 2025" },
  { id: 6, name: "VIP Webinar Invite", channel: "Email", status: "Scheduled", sent: 0, delivered: 0, opened: 0, clicked: 0, createdOn: "Jul 28, 2025" },
  { id: 7, name: "Weekend Special Discount", channel: "SMS", status: "Draft", sent: 0, delivered: 0, opened: 0, clicked: 0, createdOn: "Jul 29, 2025" },
];

const AUTOMATIONS_DATA = [
  { id: 1, name: "Welcome Series Flow", type: "Lead Generation", status: "Active", entered: 2450, inProgress: 840, completed: 2190, leads: 410, convRate: 16.7 },
  { id: 2, name: "Lead Nurturing Sequence", type: "Nurturing", status: "Active", entered: 4200, inProgress: 1840, completed: 2960, leads: 620, convRate: 14.8 },
  { id: 3, name: "Re-engagement Workflow", type: "Nurturing", status: "Paused", entered: 1850, inProgress: 320, completed: 1220, leads: 180, convRate: 9.7 },
  { id: 4, name: "Website Lead Capture", type: "Lead Generation", status: "Active", entered: 3120, inProgress: 640, completed: 2268, leads: 74, convRate: 2.4 },
  { id: 5, name: "Abandoned Cart Recovery", type: "Lead Generation", status: "Completed", entered: 1020, inProgress: 0, completed: 985, leads: 188, convRate: 18.4 },
];

const CONTENT_POSTS_DATA = [
  { id: 1, title: "Summer Collection Teaser", platform: "Instagram", status: "Scheduled", scheduledTime: "Today, 10:00 AM", engagements: 4850, impressions: 18200, date: "Jul 31, 2025", image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&auto=format&fit=crop&q=60" },
  { id: 2, title: "New Product Launch Feature", platform: "Email", status: "Scheduled", scheduledTime: "Today, 12:00 PM", engagements: 2140, impressions: 8400, date: "Jul 31, 2025", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60" },
  { id: 3, title: "Festival Offer Announcement", platform: "WhatsApp", status: "Scheduled", scheduledTime: "Today, 04:00 PM", engagements: 3400, impressions: 12100, date: "Jul 31, 2025", image: "https://images.unsplash.com/photo-1556742049-0a674719e7a4?w=500&auto=format&fit=crop&q=60" },
  { id: 4, title: "Industry Insights & AI Trends", platform: "LinkedIn", status: "Waiting Approval", scheduledTime: "Today, 06:00 PM", engagements: 1920, impressions: 6800, date: "Jul 31, 2025", image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&auto=format&fit=crop&q=60" },
  { id: 5, title: "Customer Success Spotlight", platform: "Facebook", status: "Scheduled", scheduledTime: "Tomorrow, 09:00 AM", engagements: 3820, impressions: 14200, date: "Aug 01, 2025", image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=500&auto=format&fit=crop&q=60" },
  { id: 6, title: "AI Automation Hacks for 2025", platform: "X", status: "Published", scheduledTime: "Yesterday, 03:00 PM", engagements: 6420, impressions: 24500, date: "Jul 30, 2025", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60" },
];

const NEEDS_ATTENTION_ITEMS = [
  { id: 1, title: "Instagram account needs reconnection", module: "Content Studio", time: "2 hours ago", severity: "high", actionLabel: "Reconnect" },
  { id: 2, title: "6 social posts waiting for approval", module: "Content Studio", time: "5 hours ago", severity: "warning", actionLabel: "Review Posts" },
  { id: 3, title: "Festival SMS campaign has high failure rate", module: "Campaigns", time: "6 hours ago", severity: "high", actionLabel: "Investigate" },
  { id: 4, title: "Lead Nurture automation has execution errors", module: "Automations", time: "1 day ago", severity: "warning", actionLabel: "Fix Flow" },
  { id: 5, title: "Only 18 AI image generations remaining", module: "Content Studio", time: "2 days ago", severity: "info", actionLabel: "Upgrade Quota" },
];

const RECENT_ACTIVITIES = [
  { id: 1, title: "Instagram post \"Summer Collection\" sent", time: "10 minutes ago", icon: Instagram, color: "text-pink-500 bg-pink-50 dark:bg-pink-950/40" },
  { id: 2, title: "42 contacts entered \"Lead Nurture\" automation", time: "25 minutes ago", icon: Workflow, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" },
  { id: 3, title: "LinkedIn post scheduled for 06:00 PM", time: "2 hours ago", icon: Linkedin, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  { id: 4, title: "WhatsApp campaign \"Festival Offer\" completed", time: "3 hours ago", icon: Megaphone, color: "text-green-600 bg-green-50 dark:bg-green-950/40" },
  { id: 5, title: "New lead converted via Welcome Series", time: "4 hours ago", icon: CheckCircle2, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
];

// Time series charts data
const PERFORMANCE_TIMESERIES = [
  { date: "Jul 01", Sent: 8000, Delivered: 7600, Opened: 2400, Clicked: 600, Instagram: 2100, Facebook: 1400, LinkedIn: 900, X: 600, Entries: 400, Completions: 280, Leads: 80 },
  { date: "Jul 05", Sent: 12000, Delivered: 11400, Opened: 3800, Clicked: 950, Instagram: 3200, Facebook: 2100, LinkedIn: 1300, X: 850, Entries: 650, Completions: 480, Leads: 130 },
  { date: "Jul 10", Sent: 9500, Delivered: 9100, Opened: 2900, Clicked: 780, Instagram: 2800, Facebook: 1800, LinkedIn: 1100, X: 700, Entries: 520, Completions: 390, Leads: 105 },
  { date: "Jul 15", Sent: 18500, Delivered: 17800, Opened: 5200, Clicked: 1420, Instagram: 4500, Facebook: 2900, LinkedIn: 1800, X: 1200, Entries: 890, Completions: 680, Leads: 190 },
  { date: "Jul 20", Sent: 22000, Delivered: 21000, Opened: 6800, Clicked: 1850, Instagram: 5400, Facebook: 3400, LinkedIn: 2200, X: 1450, Entries: 1120, Completions: 890, Leads: 240 },
  { date: "Jul 25", Sent: 26000, Delivered: 24800, Opened: 7900, Clicked: 2100, Instagram: 6200, Facebook: 3900, LinkedIn: 2600, X: 1680, Entries: 1350, Completions: 1050, Leads: 290 },
  { date: "Jul 31", Sent: 29430, Delivered: 27220, Opened: 8540, Clicked: 2320, Instagram: 7100, Facebook: 4200, LinkedIn: 2900, X: 1900, Entries: 1540, Completions: 1240, Leads: 340 },
];

export function UserDashboard() {
  const { user } = useAuth();

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState<DashboardTab>("Overview");

  // --- Date Range Picker State ---
  const [datePreset, setDatePreset] = useState<GlobalDatePreset>("This Month");
  const [customStartDate, setCustomStartDate] = useState("2025-07-01");
  const [customEndDate, setCustomEndDate] = useState("2025-07-31");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // --- Filter States ---
  // Overview tab filters
  const [needsAttentionFilter, setNeedsAttentionFilter] = useState<"All" | "Campaigns" | "Automations" | "Content Studio">("All");

  // Campaigns tab filters
  const [campaignChannelFilter, setCampaignChannelFilter] = useState<string>("All");
  const [campaignMetricFilter, setCampaignMetricFilter] = useState<string>("Sent");
  const [campaignGroupBy, setCampaignGroupBy] = useState<"Daily" | "Weekly" | "Monthly">("Daily");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("All");

  // Automations tab filters
  const [autoFilter, setAutoFilter] = useState("All Automations");
  const [autoMetric, setAutoMetric] = useState("Entries");
  const [autoGroupBy, setAutoGroupBy] = useState<"Daily" | "Weekly" | "Monthly">("Daily");
  const [autoTypeFilter, setAutoTypeFilter] = useState("All");
  const [autoStatusFilter, setAutoStatusFilter] = useState("All");
  const [autoSearch, setAutoSearch] = useState("");

  // Content Studio tab filters
  const [socialPlatformFilter, setSocialPlatformFilter] = useState("All");
  const [socialMetricFilter, setSocialMetricFilter] = useState("Engagements");
  const [socialGroupBy, setSocialGroupBy] = useState<"Daily" | "Weekly" | "Monthly">("Daily");
  const [upcomingTimeFilter, setUpcomingTimeFilter] = useState<"All" | "Today" | "Tomorrow">("All");
  const [upcomingPlatformFilter, setUpcomingPlatformFilter] = useState("All");
  const [topContentSearch, setTopContentSearch] = useState("");
  const [topContentSort, setTopContentSort] = useState("Engagements");

  // --- Modal Drill-Down States ---
  const [selectedCampaign, setSelectedCampaign] = useState<typeof CAMPAIGNS_DATA[0] | null>(null);
  const [selectedAutomation, setSelectedAutomation] = useState<typeof AUTOMATIONS_DATA[0] | null>(null);
  const [selectedPost, setSelectedPost] = useState<typeof CONTENT_POSTS_DATA[0] | null>(null);
  const [isCreateContentOpen, setIsCreateContentOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isViewAllNeedsAttentionOpen, setIsViewAllNeedsAttentionOpen] = useState(false);
  const [isViewAllActivityOpen, setIsViewAllActivityOpen] = useState(false);

  // --- Form Input for New Content Modal ---
  const [newPostPrompt, setNewPostPrompt] = useState("");
  const [newPostPlatform, setNewPostPlatform] = useState("Instagram");

  // Date Range Display Label
  const dateRangeLabel = useMemo(() => {
    if (datePreset === "Custom") return `${customStartDate} → ${customEndDate}`;
    if (datePreset === "Today") return "Today (Jul 31, 2025)";
    if (datePreset === "Yesterday") return "Yesterday (Jul 30, 2025)";
    if (datePreset === "Last 7 Days") return "Jul 24, 2025 - Jul 31, 2025";
    if (datePreset === "Last 30 Days") return "Jul 01, 2025 - Jul 31, 2025";
    if (datePreset === "This Month") return "Jul 01, 2025 - Jul 31, 2025";
    if (datePreset === "Last Month") return "Jun 01, 2025 - Jun 30, 2025";
    return "Jul 01, 2025 - Jul 31, 2025";
  }, [datePreset, customStartDate, customEndDate]);

  // Filtered Needs Attention
  const filteredNeedsAttention = useMemo(() => {
    if (needsAttentionFilter === "All") return NEEDS_ATTENTION_ITEMS;
    return NEEDS_ATTENTION_ITEMS.filter((item) => item.module === needsAttentionFilter);
  }, [needsAttentionFilter]);

  // Filtered Campaign Table
  const filteredCampaigns = useMemo(() => {
    return CAMPAIGNS_DATA.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(campaignSearch.toLowerCase());
      const matchesChannel = campaignChannelFilter === "All" || item.channel === campaignChannelFilter;
      const matchesStatus = campaignStatusFilter === "All" || item.status === campaignStatusFilter;
      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [campaignSearch, campaignChannelFilter, campaignStatusFilter]);

  // Filtered Automation Table
  const filteredAutomations = useMemo(() => {
    return AUTOMATIONS_DATA.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(autoSearch.toLowerCase());
      const matchesType = autoTypeFilter === "All" || item.type === autoTypeFilter;
      const matchesStatus = autoStatusFilter === "All" || item.status === autoStatusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [autoSearch, autoTypeFilter, autoStatusFilter]);

  // Filtered Content Posts
  const filteredUpcomingPosts = useMemo(() => {
    return CONTENT_POSTS_DATA.filter((item) => {
      const matchesTime =
        upcomingTimeFilter === "All" ||
        (upcomingTimeFilter === "Today" && item.scheduledTime.includes("Today")) ||
        (upcomingTimeFilter === "Tomorrow" && item.scheduledTime.includes("Tomorrow"));
      const matchesPlatform = upcomingPlatformFilter === "All" || item.platform === upcomingPlatformFilter;
      return matchesTime && matchesPlatform;
    });
  }, [upcomingTimeFilter, upcomingPlatformFilter]);

  const filteredTopContent = useMemo(() => {
    let list = CONTENT_POSTS_DATA.filter((item) =>
      item.title.toLowerCase().includes(topContentSearch.toLowerCase())
    );
    if (socialPlatformFilter !== "All") {
      list = list.filter((item) => item.platform === socialPlatformFilter);
    }
    if (topContentSort === "Engagements") list.sort((a, b) => b.engagements - a.engagements);
    if (topContentSort === "Impressions") list.sort((a, b) => b.impressions - a.impressions);
    return list;
  }, [topContentSearch, socialPlatformFilter, topContentSort]);

  // Helper platform badges
  const PlatformBadge = ({ platform }: { platform: string }) => {
    switch (platform) {
      case "Instagram":
        return <span className="inline-flex items-center gap-1 rounded-md bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 text-xs font-semibold text-pink-600 dark:text-pink-400 border border-pink-200/50 dark:border-pink-800/50"><Instagram size={12} /> Instagram</span>;
      case "Facebook":
        return <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50"><Facebook size={12} /> Facebook</span>;
      case "LinkedIn":
        return <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300 border border-sky-200/50 dark:border-sky-800/50"><Linkedin size={12} /> LinkedIn</span>;
      case "X":
        return <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-300/50 dark:border-slate-700/50"><Share2 size={12} /> X</span>;
      case "Email":
        return <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50"><Send size={12} /> Email</span>;
      case "WhatsApp":
        return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50"><Megaphone size={12} /> WhatsApp</span>;
      case "SMS":
        return <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50"><Zap size={12} /> SMS</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{platform}</span>;
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    let color = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    if (status === "Running" || status === "Active" || status === "Published")
      color = "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50";
    else if (status === "Scheduled")
      color = "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50";
    else if (status === "Waiting Approval" || status === "Paused")
      color = "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50";
    else if (status === "Completed")
      color = "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50";
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${color}`}>{status}</span>;
  };

  return (
    <div className="w-full space-y-6 pb-12 font-sans">
      {/* ========================================================================= */}
      {/* GLOBAL HEADER BAR: Title, Tabs, Global Date Range Picker                  */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-5 bg-white dark:bg-[#0c1222] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live Marketing Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1.5">
              Good Morning, {user?.first_name || "Sushant"} <span className="inline-block animate-bounce">👋</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Here&apos;s what&apos;s happening with your marketing campaigns, automations, and social content.
            </p>
          </div>

          {/* Global Date Range Picker */}
          <div className="relative">
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-sm hover:border-blue-400 transition"
            >
              <CalendarDays size={16} className="text-blue-600 dark:text-blue-400" />
              <span>{dateRangeLabel}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            <AnimatePresence>
              {isDatePickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDatePickerOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827] p-4 shadow-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Global Date Range</span>
                      <button onClick={() => setIsDatePickerOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-1">
                      {(["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Last Month", "Custom"] as GlobalDatePreset[]).map(
                        (preset) => (
                          <button
                            key={preset}
                            onClick={() => {
                              setDatePreset(preset);
                              if (preset !== "Custom") setIsDatePickerOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                              datePreset === preset
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 font-bold"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                          >
                            <span>{preset}</span>
                            {datePreset === preset && <Check size={14} />}
                          </button>
                        )
                      )}
                    </div>

                    {datePreset === "Custom" && (
                      <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-2 text-xs font-medium text-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">End Date</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-2 text-xs font-medium text-slate-800 dark:text-white"
                          />
                        </div>
                        <button
                          onClick={() => setIsDatePickerOpen(false)}
                          className="w-full mt-2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                        >
                          Apply Range
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Dashboard Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-1 overflow-x-auto">
          {(["Overview", "Campaigns", "Automations", "Content Studio"] as DashboardTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                {tab === "Overview" && <BarChart3 size={16} />}
                {tab === "Campaigns" && <Megaphone size={16} />}
                {tab === "Automations" && <Workflow size={16} />}
                {tab === "Content Studio" && <Share2 size={16} />}
                <span>{tab}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW TAB CONTENT                                               */}
      {/* ========================================================================= */}
      {activeTab === "Overview" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Module Summary Cards */}
          <div className="grid gap-5 md:grid-cols-3">
            {/* Campaigns Card */}
            <div
              onClick={() => setActiveTab("Campaigns")}
              className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm hover:shadow-md hover:border-blue-400 transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <Megaphone size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Campaigns</h3>
                    <p className="text-xs text-slate-500 font-medium">Email, WhatsApp & SMS</p>
                  </div>
                </div>
                <button className="text-slate-400 group-hover:text-blue-600 transition">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">42</span>
                  <span className="text-xs font-semibold text-slate-500">Total Campaigns</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-white/5 pt-3 text-center">
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Running</span>
                    <b className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">12</b>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Scheduled</span>
                    <b className="text-sm font-extrabold text-blue-600 dark:text-blue-400">8</b>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Completed</span>
                    <b className="text-sm font-extrabold text-purple-600 dark:text-purple-400">20</b>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:underline">
                <span>View Campaigns</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Automations Card */}
            <div
              onClick={() => setActiveTab("Automations")}
              className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm hover:shadow-md hover:border-emerald-400 transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <Workflow size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Automations</h3>
                    <p className="text-xs text-slate-500 font-medium">Workflows & Lead Funnels</p>
                  </div>
                </div>
                <button className="text-slate-400 group-hover:text-emerald-600 transition">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">12</span>
                  <span className="text-xs font-semibold text-slate-500">Total Automations</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-white/5 pt-3 text-center">
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Active</span>
                    <b className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">8</b>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Paused</span>
                    <b className="text-sm font-extrabold text-amber-600 dark:text-amber-400">2</b>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Draft</span>
                    <b className="text-sm font-extrabold text-slate-500">2</b>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
                <span>View Automations</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Content Studio Card */}
            <div
              onClick={() => setActiveTab("Content Studio")}
              className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm hover:shadow-md hover:border-purple-400 transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                    <Share2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Content Studio</h3>
                    <p className="text-xs text-slate-500 font-medium">Social Media & AI Posts</p>
                  </div>
                </div>
                <button className="text-slate-400 group-hover:text-purple-600 transition">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">126</span>
                  <span className="text-xs font-semibold text-slate-500">Total Posts</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-white/5 pt-3 text-center">
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Published</span>
                    <b className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">72</b>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Scheduled</span>
                    <b className="text-sm font-extrabold text-blue-600 dark:text-blue-400">28</b>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-500">Drafts</span>
                    <b className="text-sm font-extrabold text-amber-600 dark:text-amber-400">18</b>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:underline">
                <span>View Content Studio</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </div>

          {/* Upcoming Activity & Needs Attention Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming Activity Widget */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock size={18} className="text-blue-600" />
                      Upcoming Activity
                    </h3>
                    <p className="text-xs text-slate-500">Chronological scheduled queue across all modules</p>
                  </div>
                  <button
                    onClick={() => setIsCalendarOpen(true)}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {CONTENT_POSTS_DATA.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedPost(item)}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-extrabold text-slate-500 w-16 text-right shrink-0">
                          {item.scheduledTime.split(", ")[1]}
                        </span>
                        <PlatformBadge platform={item.platform} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                          {item.title}
                        </span>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Needs Attention Widget */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <AlertTriangle size={18} className="text-amber-500" />
                      Needs Attention
                    </h3>
                    <p className="text-xs text-slate-500">Actionable alerts requiring immediate action</p>
                  </div>
                  <button
                    onClick={() => setIsViewAllNeedsAttentionOpen(true)}
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </div>

                {/* Module Filter Pills */}
                <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
                  {(["All", "Campaigns", "Automations", "Content Studio"] as const).map((mod) => (
                    <button
                      key={mod}
                      onClick={() => setNeedsAttentionFilter(mod)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        needsAttentionFilter === mod
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {mod}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {filteredNeedsAttention.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold shrink-0 ${
                            item.severity === "high"
                              ? "bg-red-50 text-red-600 dark:bg-red-950/50"
                              : item.severity === "warning"
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50"
                              : "bg-blue-50 text-blue-600 dark:bg-blue-950/50"
                          }`}
                        >
                          <AlertTriangle size={16} />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{item.module}</span>
                            <span>•</span>
                            <span>{item.time}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => toast.info(`Action triggered: ${item.actionLabel}`)}
                        className="rounded-lg bg-blue-50 dark:bg-blue-950/50 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition"
                      >
                        {item.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Cross-Module Feed */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ActivityIcon />
                  Recent Activity Feed
                </h3>
                <p className="text-xs text-slate-500">Real-time cross-module event log</p>
              </div>
              <button
                onClick={() => setIsViewAllActivityOpen(true)}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {RECENT_ACTIVITIES.map((act) => {
                const Icon = act.icon;
                return (
                  <div
                    key={act.id}
                    className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${act.color}`}>
                        <Icon size={16} />
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{act.time}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">{act.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CAMPAIGNS TAB CONTENT                                              */}
      {/* ========================================================================= */}
      {activeTab === "Campaigns" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Campaigns Dashboard</h2>
              <p className="text-xs text-slate-500">Track key metrics and engagement across Email, WhatsApp & SMS</p>
            </div>
          </div>

          {/* Campaign Overview 6 Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Total Campaigns", val: "42", change: "+18%", icon: Megaphone, bg: "bg-blue-50 text-blue-600" },
              { label: "Sent", val: "125,430", change: "+24%", icon: Send, bg: "bg-indigo-50 text-indigo-600" },
              { label: "Delivered", val: "118,920", change: "+22%", icon: CheckCircle2, bg: "bg-emerald-50 text-emerald-600" },
              { label: "Opened", val: "32,140", change: "+12%", icon: Eye, bg: "bg-purple-50 text-purple-600" },
              { label: "Clicked", val: "8,420", change: "+18%", icon: MousePointerClick, bg: "bg-amber-50 text-amber-600" },
              { label: "Failed / Bounced", val: "1,320", change: "-6%", icon: XCircle, bg: "bg-red-50 text-red-600" },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${c.bg}`}>
                      <Icon size={18} />
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                      <TrendingUp size={12} /> {c.change}
                    </span>
                  </div>
                  <strong className="block text-2xl font-black text-slate-900 dark:text-white mt-3">{c.val}</strong>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">{c.label}</p>
                </div>
              );
            })}
          </div>

          {/* Performance Analytics & Channel Performance Split */}
          <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
            {/* Analytics Chart */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Campaign Performance</h3>
                  <p className="text-xs text-slate-500">Track key campaign metrics over time</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={campaignChannelFilter}
                    onChange={(e) => setCampaignChannelFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                  >
                    <option value="All">All Channels</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="SMS">SMS</option>
                  </select>

                  <select
                    value={campaignMetricFilter}
                    onChange={(e) => setCampaignMetricFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                  >
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Opened">Opened</option>
                    <option value="Clicked">Clicked</option>
                  </select>

                  <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/10 p-0.5">
                    {(["Daily", "Weekly", "Monthly"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setCampaignGroupBy(g)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                          campaignGroupBy === g ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={PERFORMANCE_TIMESERIES}>
                    <defs>
                      <linearGradient id="campGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey={campaignMetricFilter} stroke="#2563eb" strokeWidth={3} fill="url(#campGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Channel Performance Breakdown */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Channel Breakdown</h3>
                <p className="text-xs text-slate-500 mb-4">Volume dispatches per marketing channel</p>

                <div className="space-y-4">
                  {[
                    { name: "Email", count: "68,420", pct: "54%", color: "bg-purple-600", icon: Send },
                    { name: "WhatsApp", count: "32,150", pct: "26%", color: "bg-emerald-600", icon: Megaphone },
                    { name: "SMS", count: "14,260", pct: "20%", color: "bg-amber-600", icon: Zap },
                  ].map((ch) => (
                    <div key={ch.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                          <PlatformBadge platform={ch.name} />
                        </span>
                        <span className="text-slate-900 dark:text-white font-extrabold">{ch.count} ({ch.pct})</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                        <div className={`h-full ${ch.color} rounded-full`} style={{ width: ch.pct }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 block">Pro Tip</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  WhatsApp campaigns yield 3.2x higher open rates than standard Email pushes this month.
                </p>
              </div>
            </div>
          </div>

          {/* Campaign Table ("Recent Campaigns") */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Recent Campaigns</h3>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search campaign name..."
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    className="w-48 sm:w-64 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={campaignStatusFilter}
                  onChange={(e) => setCampaignStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Running">Running</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Paused">Paused</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-3">Campaign Name</th>
                    <th className="py-3 px-3">Channel</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Sent</th>
                    <th className="py-3 px-3 text-right">Delivered</th>
                    <th className="py-3 px-3 text-right">Opened</th>
                    <th className="py-3 px-3 text-right">Clicked</th>
                    <th className="py-3 px-3">Created On</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {filteredCampaigns.map((row, i) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedCampaign(row)}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-2 text-slate-400 font-bold">{i + 1}</td>
                      <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">{row.name}</td>
                      <td className="py-3.5 px-3">
                        <PlatformBadge platform={row.channel} />
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold">{row.sent ? row.sent.toLocaleString() : "—"}</td>
                      <td className="py-3.5 px-3 text-right font-semibold">{row.delivered ? row.delivered.toLocaleString() : "—"}</td>
                      <td className="py-3.5 px-3 text-right font-semibold">{row.opened ? row.opened.toLocaleString() : "—"}</td>
                      <td className="py-3.5 px-3 text-right font-semibold">{row.clicked ? row.clicked.toLocaleString() : "—"}</td>
                      <td className="py-3.5 px-3 text-slate-500">{row.createdOn}</td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCampaign(row);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUTOMATIONS TAB CONTENT                                            */}
      {/* ========================================================================= */}
      {activeTab === "Automations" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Automation Dashboard</h2>
              <p className="text-xs text-slate-500">Track performance, contact progression, and lead conversion journeys</p>
            </div>
          </div>

          {/* Automation Overview 6 Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Total Automations", val: "12", change: "+20%", icon: Workflow, bg: "bg-purple-50 text-purple-600" },
              { label: "Active", val: "8", change: "+14%", icon: CheckCircle2, bg: "bg-emerald-50 text-emerald-600" },
              { label: "Paused", val: "2", change: "-50%", icon: Clock, bg: "bg-amber-50 text-amber-600" },
              { label: "Draft", val: "2", change: "+0%", icon: FileText, bg: "bg-slate-100 text-slate-600" },
              { label: "Contacts in Flow", val: "4,825", change: "+18%", icon: Users, bg: "bg-blue-50 text-blue-600" },
              { label: "Leads Generated", val: "1,284", change: "+32%", icon: Target, bg: "bg-emerald-50 text-emerald-600" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${c.bg}`}>
                    <c.icon size={18} />
                  </span>
                  <span className="text-xs font-bold text-emerald-600">{c.change}</span>
                </div>
                <strong className="block text-2xl font-black text-slate-900 dark:text-white mt-3">{c.val}</strong>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Journey Outcome Funnel Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Journey Outcome</h3>
            <p className="text-xs text-slate-500 mb-6">See how contacts move through your automation journeys</p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 relative">
              {[
                { step: "Contacts Entered", count: "12,640", pct: "100%", icon: Users, color: "border-blue-200 bg-blue-50/40 dark:bg-blue-950/20" },
                { step: "In Automation", count: "4,825", pct: "38.2% Active", icon: Workflow, color: "border-purple-200 bg-purple-50/40 dark:bg-purple-950/20" },
                { step: "Completed / Exited", count: "8,420", pct: "66.6% Completed", icon: UserCheck, color: "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20" },
                { step: "Converted to Lead", count: "1,284", pct: "10.2% Conv. Rate", icon: Target, color: "border-amber-200 bg-amber-50/40 dark:bg-amber-950/20" },
              ].map((st, idx) => {
                const Icon = st.icon;
                return (
                  <div
                    key={st.step}
                    className={`rounded-2xl border ${st.color} p-5 flex flex-col justify-between relative shadow-sm`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white dark:bg-[#0c1222] shadow-sm text-slate-800 dark:text-white">
                        <Icon size={20} />
                      </span>
                      <span className="text-[11px] font-extrabold text-slate-500">{st.pct}</span>
                    </div>
                    <div>
                      <strong className="block text-2xl font-black text-slate-900 dark:text-white">{st.count}</strong>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5 block">{st.step}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Automation Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Automation Performance</h3>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search automation..."
                    value={autoSearch}
                    onChange={(e) => setAutoSearch(e.target.value)}
                    className="w-48 sm:w-64 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={autoTypeFilter}
                  onChange={(e) => setAutoTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                >
                  <option value="All">All Types</option>
                  <option value="Lead Generation">Lead Generation</option>
                  <option value="Nurturing">Nurturing</option>
                </select>

                <select
                  value={autoStatusFilter}
                  onChange={(e) => setAutoStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-3">Automation Name</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Entered</th>
                    <th className="py-3 px-3 text-right">Completed</th>
                    <th className="py-3 px-3 text-right">Leads</th>
                    <th className="py-3 px-3 text-right">Conv. Rate</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {filteredAutomations.map((row, i) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedAutomation(row)}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-2 text-slate-400 font-bold">{i + 1}</td>
                      <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">{row.name}</td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-semibold">{row.type}</td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-3.5 px-3 text-right font-semibold">{row.entered.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right font-semibold">{row.completed.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right font-semibold">{row.leads.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-600">{row.convRate}%</td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAutomation(row);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CONTENT STUDIO TAB CONTENT                                         */}
      {/* ========================================================================= */}
      {activeTab === "Content Studio" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Content Studio Dashboard</h2>
              <p className="text-xs text-slate-500">Create, schedule and analyze your social media content with AI</p>
            </div>
            <button
              onClick={() => setIsCreateContentOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <Plus size={16} />
              <span>+ Create Content</span>
            </button>
          </div>

          {/* Content Overview 6 Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Total Posts", val: "126", change: "+12%", icon: Share2, bg: "bg-purple-50 text-purple-600" },
              { label: "Published", val: "72", change: "+25%", icon: CheckCircle2, bg: "bg-emerald-50 text-emerald-600" },
              { label: "Scheduled", val: "28", change: "+12%", icon: CalendarDays, bg: "bg-blue-50 text-blue-600" },
              { label: "Drafts", val: "18", change: "-10%", icon: FileText, bg: "bg-amber-50 text-amber-600" },
              { label: "Waiting Approval", val: "6", change: "+0%", icon: Clock, bg: "bg-sky-50 text-sky-600" },
              { label: "Failed", val: "2", change: "-50%", icon: XCircle, bg: "bg-red-50 text-red-600" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${c.bg}`}>
                    <c.icon size={18} />
                  </span>
                  <span className="text-xs font-bold text-emerald-600">{c.change}</span>
                </div>
                <strong className="block text-2xl font-black text-slate-900 dark:text-white mt-3">{c.val}</strong>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* AI Usage Cards (Independent of Global Date Filter) */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/50 to-indigo-50/30 dark:from-purple-950/20 dark:to-indigo-950/10 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Image Generation Quota</h4>
                    <span className="text-[11px] text-slate-500 font-medium">Independent of global date range</span>
                  </div>
                </div>
                <span className="text-xs font-black text-purple-600 dark:text-purple-400">18 Images Remaining</span>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-slate-700 dark:text-slate-300">32 / 50 Used</span>
                  <span className="text-purple-600">64%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-purple-100 dark:bg-purple-950/60 overflow-hidden">
                  <div className="h-full bg-purple-600 rounded-full" style={{ width: "64%" }} />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 font-semibold">Resets in 12 days (Aug 12, 2025)</p>
            </div>

            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/50 to-sky-50/30 dark:from-blue-950/20 dark:to-sky-950/10 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
                    <Bot size={20} />
                  </span>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Text Credits Balance</h4>
                    <span className="text-[11px] text-slate-500 font-medium">Independent of global date range</span>
                  </div>
                </div>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">2,750 Credits Remaining</span>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-slate-700 dark:text-slate-300">7,250 / 10,000 Used</span>
                  <span className="text-blue-600">72.5%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-blue-100 dark:bg-blue-950/60 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: "72.5%" }} />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 font-semibold">Resets in 12 days (Aug 12, 2025)</p>
            </div>
          </div>

          {/* Social Media Performance & Top Content */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming Posts Widget */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Upcoming Posts</h3>
                  <p className="text-xs text-slate-500">Scheduled social content across accounts</p>
                </div>
                <button
                  onClick={() => setIsCalendarOpen(true)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition"
                >
                  View Calendar
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {filteredUpcomingPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-purple-50/50 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <img src={post.image} alt={post.title} className="h-10 w-10 rounded-lg object-cover" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">{post.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <PlatformBadge platform={post.platform} />
                          <span className="text-[10px] text-slate-500">{post.scheduledTime}</span>
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={post.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performing Content Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Top Performing Content</h3>
                <select
                  value={topContentSort}
                  onChange={(e) => setTopContentSort(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-white outline-none"
                >
                  <option value="Engagements">By Engagements</option>
                  <option value="Impressions">By Impressions</option>
                </select>
              </div>

              <div className="space-y-3">
                {filteredTopContent.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPost(item)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <img src={item.image} alt={item.title} className="h-10 w-10 rounded-lg object-cover" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">{item.title}</span>
                        <PlatformBadge platform={item.platform} />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {item.engagements.toLocaleString()} Eng.
                      </span>
                      <span className="text-[10px] text-slate-500">{item.impressions.toLocaleString()} Imp.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* MODALS: DRILL-DOWNS & ACTIONS                                             */}
      {/* ========================================================================= */}

      {/* Campaign Analytics Modal */}
      <AnimatePresence>
        {selectedCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCampaign(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1222] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={selectedCampaign.channel} />
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedCampaign.name}</h3>
                </div>
                <button onClick={() => setSelectedCampaign(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">Sent</span>
                  <strong className="text-lg font-black text-slate-900 dark:text-white">{selectedCampaign.sent.toLocaleString()}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">Delivered</span>
                  <strong className="text-lg font-black text-emerald-600">{selectedCampaign.delivered.toLocaleString()}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">Opened</span>
                  <strong className="text-lg font-black text-purple-600">{selectedCampaign.opened.toLocaleString()}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">Clicked</span>
                  <strong className="text-lg font-black text-amber-600">{selectedCampaign.clicked.toLocaleString()}</strong>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Campaign Details</h4>
                <div className="grid grid-cols-2 text-xs space-y-1">
                  <div>Status: <StatusBadge status={selectedCampaign.status} /></div>
                  <div>Created On: <span className="font-semibold">{selectedCampaign.createdOn}</span></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    toast.success(`Exporting analytics for ${selectedCampaign.name}`);
                    setSelectedCampaign(null);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                >
                  Export Report
                </button>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Automation Detail Modal */}
      <AnimatePresence>
        {selectedAutomation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAutomation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1222] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedAutomation.name}</h3>
                  <span className="text-xs text-slate-500 font-semibold">{selectedAutomation.type}</span>
                </div>
                <button onClick={() => setSelectedAutomation(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">Entered</span>
                  <strong className="text-lg font-black text-slate-900 dark:text-white">{selectedAutomation.entered.toLocaleString()}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">In Progress</span>
                  <strong className="text-lg font-black text-blue-600">{selectedAutomation.inProgress.toLocaleString()}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">Completed</span>
                  <strong className="text-lg font-black text-purple-600">{selectedAutomation.completed.toLocaleString()}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                  <span className="block text-xs text-slate-500 font-bold">Leads</span>
                  <strong className="text-lg font-black text-emerald-600">{selectedAutomation.leads.toLocaleString()}</strong>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedAutomation(null)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPost(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1222] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                <PlatformBadge platform={selectedPost.platform} />
                <button onClick={() => setSelectedPost(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <img src={selectedPost.image} alt={selectedPost.title} className="h-48 w-full rounded-xl object-cover" />

              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{selectedPost.title}</h4>
                <p className="text-xs text-slate-500 mt-1">Scheduled for: {selectedPost.scheduledTime}</p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedPost(null)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Content Modal */}
      <AnimatePresence>
        {isCreateContentOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateContentOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1222] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-600" />
                  Create AI Social Post
                </h3>
                <button onClick={() => setIsCreateContentOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Platform</label>
                  <select
                    value={newPostPlatform}
                    onChange={(e) => setNewPostPlatform(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-2.5 text-xs font-bold outline-none"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="X">X (Twitter)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">AI Prompt</label>
                  <textarea
                    rows={4}
                    placeholder="Describe what you want to post about (e.g. Write a teaser about our upcoming summer discount)..."
                    value={newPostPrompt}
                    onChange={(e) => setNewPostPrompt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsCreateContentOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.success("AI Social post generated and added to scheduled queue!");
                    setIsCreateContentOpen(false);
                    setNewPostPrompt("");
                  }}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700"
                >
                  Generate Content
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Calendar Modal */}
      <AnimatePresence>
        {isCalendarOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCalendarOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1222] p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays size={18} className="text-blue-600" />
                  Content & Campaign Calendar Schedule
                </h3>
                <button onClick={() => setIsCalendarOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 py-2 border-b border-slate-100 dark:border-white/5">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>

              <div className="grid grid-cols-7 gap-2 min-h-[300px]">
                {Array.from({ length: 31 }, (_, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 dark:border-white/5 p-2 bg-slate-50/50 dark:bg-white/5 text-xs flex flex-col justify-between">
                    <span className="font-bold text-slate-500">{i + 1}</span>
                    {i === 30 && (
                      <span className="mt-1 block rounded bg-blue-100 dark:bg-blue-950 p-1 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        4 Scheduled
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsCalendarOpen(false)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Close Calendar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivityIcon() {
  return <Zap size={18} className="text-emerald-500" />;
}
