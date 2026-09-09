"use client";

import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, CheckCircle2, Clock3, Mail,
  Megaphone, Send, Target, TrendingUp, MoreHorizontal, ChevronDown, BarChart2, Users
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line
} from "recharts";
import { parseApiError } from "@/services/api-client";
import { superAdminService } from "@/services/super-admin.service";
import { useDateRange } from "@/components/ui/date-range-picker";
import { useAuth } from "@/providers/auth-provider";

// Utility for compact numbers
const compact = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: value > 9999 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

// Dummy trend data for sparklines
const generateTrend = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 40) + 10);
const sparklineData1 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData2 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData3 = generateTrend().map((v, i) => ({ i, v }));
const sparklineData4 = generateTrend().map((v, i) => ({ i, v }));

export function AdminDashboard() {
  const { startDate, endDate, picker } = useDateRange();
  const { user } = useAuth();

  const [dashboard, analytics] = useQueries({
    queries: [
      { queryKey: ["admin-dashboard"], queryFn: superAdminService.dashboard },
      {
        queryKey: ["admin-analytics", startDate, endDate],
        queryFn: () => superAdminService.analyticsWithRange(startDate, endDate),
      },
    ],
  });

  if (dashboard.isLoading || analytics.isLoading)
    return (
      <div className="space-y-6">
        <div className="h-16 animate-pulse rounded-2xl bg-white dark:bg-[#0c1222]" />
        <div className="grid gap-5 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div className="h-32 animate-pulse rounded-2xl bg-white dark:bg-[#0c1222]" key={i} />)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <div className="h-96 animate-pulse rounded-2xl bg-white dark:bg-[#0c1222]" />
          <div className="h-96 animate-pulse rounded-2xl bg-white dark:bg-[#0c1222]" />
        </div>
      </div>
    );

  const error = dashboard.error || analytics.error;
  if (error)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:bg-[#0c1222] dark:border-white/5">
        <Activity className="mx-auto text-red-500" />
        <h2 className="mt-3 text-lg font-bold">Dashboard data unavailable</h2>
        <p className="mt-1 text-sm text-slate-500">{parseApiError(error)}</p>
      </div>
    );

  const campaigns = dashboard.data?.campaigns;
  const delivery  = dashboard.data?.deliveries;
  const totalSent = (analytics.data?.email.sent ?? 0)
                  + (analytics.data?.sms.sent   ?? 0)
                  + (analytics.data?.whatsapp.sent ?? 0);

  const cards = [
    {
      label: "Total Campaigns", note: `${campaigns?.sending ?? 0} currently sending`,
      value: campaigns?.total ?? 0, icon: Megaphone,
      bg: "bg-indigo-100 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400",
      sparklineColor: "#6366f1", sparkData: sparklineData1
    },
    {
      label: "Messages Sent", note: "Across all active channels",
      value: totalSent, icon: Send,
      bg: "bg-fuchsia-100 dark:bg-fuchsia-500/20", text: "text-fuchsia-600 dark:text-fuchsia-400",
      sparklineColor: "#d946ef", sparkData: sparklineData2
    },
    {
      label: "Delivery Rate", note: `${compact(delivery?.delivered ?? 0)} delivered`,
      value: `${delivery?.success_rate ?? 0}%`, icon: CheckCircle2,
      bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400",
      sparklineColor: "#10b981", sparkData: sparklineData3
    },
    {
      label: "Email Open Rate", note: `${analytics.data?.email.click_rate ?? 0}% click rate`,
      value: `${analytics.data?.email.open_rate ?? 0}%`, icon: Target,
      bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-600 dark:text-orange-400",
      sparklineColor: "#f97316", sparkData: sparklineData4
    },
  ];

  const chart = [
    { name: "Draft",     value: campaigns?.draft     ?? 0 },
    { name: "Scheduled", value: campaigns?.scheduled ?? 0 },
    { name: "Sending",   value: campaigns?.sending   ?? 0 },
    { name: "Completed", value: campaigns?.completed ?? 0 },
  ];

  const pulseRows = [
    { label: "Completed Campaigns", value: campaigns?.completed ?? 0, icon: CheckCircle2, bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-500", sparkColor: "#10b981" },
    { label: "Scheduled Campaigns", value: campaigns?.scheduled ?? 0, icon: Clock3,       bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10", text: "text-fuchsia-500", sparkColor: "#d946ef"  },
    { label: "Pending Deliveries",  value: delivery?.pending    ?? 0, icon: Mail,         bg: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-500", sparkColor: "#f97316"   },
    { label: "Active Contacts",     value: (dashboard.data as any)?.contacts?.total ?? 0, icon: Users,      bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-500", sparkColor: "#3b82f6"     },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* ── Heading ── */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5
            text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            LIVE ANALYTICS
          </span>
          <h1 className="page-title mt-2">
            Welcome back, <span className="text-indigo-600 dark:text-indigo-400 mx-1.5">{user?.first_name || "Admin"}</span>! 👋
          </h1>
          <p className="page-subtitle">Here's what's happening with your marketing automation today.</p>
        </div>
        <div className="bg-white dark:bg-[#0c1222] rounded-lg shadow-sm border border-slate-200 dark:border-white/10 p-1">
          {picker}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, i) => (
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
              {typeof card.value === "number" ? compact(card.value) : card.value}
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

      {/* ── Charts ── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">

        {/* Area chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:bg-[#0c1222] dark:border-white/5"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Campaign Pipeline</h2>
              <p className="text-[12px] text-slate-500 font-medium">Live campaign status distribution</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                All Campaigns <ChevronDown size={14} />
              </button>
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
                <button className="rounded-md bg-indigo-50 p-1.5 text-indigo-600 dark:bg-indigo-500/20"><TrendingUp size={14}/></button>
                <button className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><BarChart2 size={14}/></button>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="campaignFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 10px 25px rgba(0,0,0,.05)" }} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#campaignFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Performance pulse */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_rgb(0,0,0,0.02)] dark:bg-[#0c1222] dark:border-white/5"
        >
          <div>
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Performance Pulse</h2>
            <p className="text-[12px] text-slate-500 font-medium">Key operational signals</p>
          </div>
          <div className="mt-6 flex-1 space-y-4">
            {pulseRows.map((item, idx) => (
              <div key={item.label} className="flex items-center gap-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.bg} ${item.text}`}>
                  <item.icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate">{item.label}</p>
                  <strong className="text-[15px] font-bold text-slate-900 dark:text-white">{compact(item.value)}</strong>
                </div>
                <div className="h-6 w-16 opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData1}>
                      <Line type="monotone" dataKey="v" stroke={item.sparkColor} strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
          
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 py-2.5 text-[13px] font-bold text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20">
            <BarChart2 size={16} /> View Detailed Analytics
          </button>
        </motion.div>
      </div>
      
      {/* ── Bottom Row Overview Cards ── */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 pb-8">
        {[
          { title: "Top Campaigns", sub: "By performance" },
          { title: "Channel Overview", sub: "Across all channels" },
          { title: "Audience Overview", sub: "Total contacts" },
          { title: "Recent Activities", sub: "Latest actions" }
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i*0.05, duration: 0.4 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgb(0,0,0,0.02)] min-h-[140px] flex flex-col dark:bg-[#0c1222] dark:border-white/5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{card.title}</h3>
                <p className="text-[12px] text-slate-500 font-medium">{card.sub}</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><MoreHorizontal size={16}/></button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[12px] font-medium text-slate-400">Data loading...</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
