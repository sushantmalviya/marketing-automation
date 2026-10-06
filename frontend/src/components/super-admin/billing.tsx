"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Settings,
  FileText,
  Mail,
  Zap,
  Bot,
  Calendar,
  ChevronDown,
  Plus,
  Info,
  ExternalLink,
  MessageSquare,
  Check,
  X,
  CreditCard,
  Download,
  Share2,
  Users
} from "lucide-react";
import { toast } from "sonner";

// --- Mock Team Member Usage ---
const TEAM_MEMBERS_USAGE = [
  { id: 1, name: "harshshivhare762", initials: "HA", role: "USER", avatarBg: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300", emailUsed: "2,350", smsUsed: "120", whatsappUsed: "450", aiTokensUsed: "25,000" },
  { id: 2, name: "priyasharma", initials: "PS", role: "USER", avatarBg: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300", emailUsed: "1,800", smsUsed: "90", whatsappUsed: "320", aiTokensUsed: "18,500" },
  { id: 3, name: "rahulverma", initials: "RV", role: "USER", avatarBg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300", emailUsed: "1,200", smsUsed: "60", whatsappUsed: "210", aiTokensUsed: "14,200" },
  { id: 4, name: "ankitjain", initials: "AJ", role: "ADMIN", avatarBg: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300", emailUsed: "1,500", smsUsed: "80", whatsappUsed: "300", aiTokensUsed: "22,300" },
  { id: 5, name: "nehasingh", initials: "NS", role: "USER", avatarBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", emailUsed: "800", smsUsed: "40", whatsappUsed: "150", aiTokensUsed: "10,500" },
];

// --- Mock Recent Transactions ---
const RECENT_TRANSACTIONS = [
  { id: 1, date: "01 Oct 2026", type: "Payment", description: "Monthly subscription", amount: "₹10,000", status: "Paid" },
  { id: 2, date: "25 Sep 2026", type: "Resource", description: "Email Pack (10,000)", amount: "₹499", status: "Paid" },
  { id: 3, date: "12 Sep 2026", type: "Resource", description: "WhatsApp Pack (1,000)", amount: "₹863", status: "Paid" },
  { id: 4, date: "05 Sep 2026", type: "Resource", description: "AI Tokens (50,000)", amount: "₹999", status: "Paid" },
  { id: 5, date: "28 Aug 2026", type: "Payment", description: "Monthly subscription", amount: "₹10,000", status: "Paid" },
];

export function SuperAdminBilling() {
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState("01 Oct 2026 – 31 Oct 2026");
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [activeRechargeResource, setActiveRechargeResource] = useState<string | null>(null);
  const [isManagePlanModalOpen, setIsManagePlanModalOpen] = useState(false);

  const billingPeriods = [
    "01 Oct 2026 – 31 Oct 2026",
    "01 Sep 2026 – 30 Sep 2026",
    "01 Aug 2026 – 31 Aug 2026",
    "01 Jul 2026 – 31 Jul 2026"
  ];

  return (
    <div className="w-full space-y-6 pb-12 font-sans text-slate-900 dark:text-white">
      {/* ========================================================================= */}
      {/* HEADER BAR: Active Subscription Badge, Title, Date Range Picker            */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Active Subscription
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Billing &amp; Usage
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Manage your subscription, resource balances, usage, and payments.
          </p>
        </div>

        {/* Date Range Picker Selector */}
        <div className="relative">
          <button
            onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1222] px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-sm hover:border-blue-400 transition"
          >
            <Calendar size={16} className="text-blue-600 dark:text-blue-400" />
            <div className="text-left">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Billing Period</span>
              <span>{selectedBillingPeriod}</span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          <AnimatePresence>
            {isPeriodDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsPeriodDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827] p-2 shadow-xl space-y-1"
                >
                  {billingPeriods.map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setSelectedBillingPeriod(period);
                        setIsPeriodDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        selectedBillingPeriod === period
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <span>{period}</span>
                      {selectedBillingPeriod === period && <Check size={14} />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CURRENT PLAN CARD                                              */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white mb-5">Current Plan</h2>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1.2fr_auto] items-center">
          {/* Left Column: Plan Details & Dates */}
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Crown size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Marketing Automation Plan</h3>
                <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                  ACTIVE
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">₹10,000</span>
                <span className="text-xs font-semibold text-slate-500">/ month</span>
              </div>

              {/* Dates grid */}
              <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-white/5 pt-4 text-xs">
                <div>
                  <span className="block text-[11px] font-bold text-slate-400">Plan Start Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <Calendar size={13} className="text-slate-400" /> 01 Oct 2026
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-slate-400">Plan End Date</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <Calendar size={13} className="text-slate-400" /> 31 Oct 2026
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-slate-400">Next Renewal</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    <Calendar size={13} className="text-slate-400" /> 01 Nov 2026
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Progress Bar */}
          <div className="rounded-xl bg-slate-50/70 dark:bg-white/5 p-4 border border-slate-100 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-800 dark:text-slate-200">Billing Period Progress</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: "58%" }} />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>01 Oct</span>
              <span>31 Oct</span>
            </div>
            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 pt-1">
              18 days remaining
            </p>
          </div>

          {/* Right Column: Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => setIsManagePlanModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Settings size={15} />
              Manage Plan
            </button>
            <button
              onClick={() => toast.success("Downloading latest invoice (INV-2026-1001-001)...")}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-blue-400 transition"
            >
              <FileText size={15} className="text-blue-600" />
              View Invoice
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: RESOURCE BALANCE (4 Cards)                                    */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Resource Balance</h2>
          <p className="text-xs text-slate-500">Monitor your available messaging and AI resources.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Email */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                    <Mail size={16} />
                  </span>
                  Email
                  <span title="Email credits allocation"><Info size={14} className="text-slate-400 cursor-pointer" /></span>
                </span>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">42,350</span>
                  <span className="block text-[11px] font-semibold text-slate-500">emails remaining</span>
                </div>
                <span className="text-xs font-extrabold text-slate-400">50,000 <span className="block text-[10px] font-normal text-slate-400 text-right">total</span></span>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: "85%" }} />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500">7,650 used of 50,000</span>
                  <span className="text-emerald-600">85% remaining</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveRechargeResource("Email")}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition mt-2"
            >
              <Plus size={14} /> Recharge
            </button>
          </div>

          {/* 2. SMS */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50">
                    <Zap size={16} />
                  </span>
                  SMS
                  <span title="SMS credits allocation"><Info size={14} className="text-slate-400 cursor-pointer" /></span>
                </span>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">650</span>
                  <span className="block text-[11px] font-semibold text-slate-500">SMS remaining</span>
                </div>
                <span className="text-xs font-extrabold text-slate-400">1,000 <span className="block text-[10px] font-normal text-slate-400 text-right">total</span></span>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "65%" }} />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500">350 used of 1,000</span>
                  <span className="text-emerald-600">65% remaining</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveRechargeResource("SMS")}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition mt-2"
            >
              <Plus size={14} /> Recharge
            </button>
          </div>

          {/* 3. WhatsApp */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                    <MessageSquare size={16} />
                  </span>
                  WhatsApp
                  <span title="WhatsApp messaging allocation"><Info size={14} className="text-slate-400 cursor-pointer" /></span>
                </span>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">3,200</span>
                  <span className="block text-[11px] font-semibold text-slate-500">messages remaining</span>
                </div>
                <span className="text-xs font-extrabold text-slate-400">5,000 <span className="block text-[10px] font-normal text-slate-400 text-right">total</span></span>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: "64%" }} />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500">1,800 used of 5,000</span>
                  <span className="text-emerald-600">64% remaining</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveRechargeResource("WhatsApp")}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition mt-2"
            >
              <Plus size={14} /> Recharge
            </button>
          </div>

          {/* 4. AI Content */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50">
                    <Bot size={16} />
                  </span>
                  AI Content
                  <span title="AI token balance"><Info size={14} className="text-slate-400 cursor-pointer" /></span>
                </span>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">120,000</span>
                  <span className="block text-[11px] font-semibold text-slate-500">tokens remaining</span>
                </div>
                <span className="text-xs font-extrabold text-slate-400">200,000 <span className="block text-[10px] font-normal text-slate-400 text-right">total</span></span>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-purple-600 rounded-full" style={{ width: "60%" }} />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500">80,000 used of 200,000</span>
                  <span className="text-emerald-600">60% remaining</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveRechargeResource("AI Tokens")}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition mt-2"
            >
              <Plus size={14} /> Recharge
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: BOTTOM GRID SPLIT (Team Member Usage & Recent Transactions)     */}
      {/* ========================================================================= */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Left Column: Usage by Team Members */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Usage by Team Members</h3>
            <p className="text-xs text-slate-500">See how your team members have used the resources in this billing period.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-2">#</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3 text-right">Email Used</th>
                  <th className="py-3 px-3 text-right">SMS Used</th>
                  <th className="py-3 px-3 text-right">WhatsApp Used</th>
                  <th className="py-3 px-3 text-right">AI Tokens Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {TEAM_MEMBERS_USAGE.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                    <td className="py-3.5 px-2 text-slate-400 font-bold">{m.id}</td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-black shrink-0 ${m.avatarBg}`}>
                          {m.initials}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{m.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">{m.emailUsed}</td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">{m.smsUsed}</td>
                    <td className="py-3.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">{m.whatsappUsed}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-white">{m.aiTokensUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Payments & Transactions */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c1222] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Recent Payments &amp; Transactions</h3>
              <p className="text-xs text-slate-500">Your recent payments and resource purchases.</p>
            </div>
            <button
              onClick={() => toast.info("Opening complete transaction history...")}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              View All &gt;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-2">#</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {RECENT_TRANSACTIONS.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                    <td className="py-3.5 px-2 text-slate-400 font-bold">{tx.id}</td>
                    <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">{tx.date}</td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{tx.description}</td>
                    <td className="py-3.5 px-3 text-right font-black text-slate-900 dark:text-white">{tx.amount}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECHARGE MODAL                                                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {activeRechargeResource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Recharge {activeRechargeResource}
                </h3>
                <button onClick={() => setActiveRechargeResource(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Select a top-up pack to instantly replenish your {activeRechargeResource} balance.
              </p>

              <div className="space-y-2.5">
                {[
                  { pack: `10,000 ${activeRechargeResource}`, price: "₹499" },
                  { pack: `25,000 ${activeRechargeResource}`, price: "₹999" },
                  { pack: `50,000 ${activeRechargeResource}`, price: "₹1,899" },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      toast.success(`Purchase successful! Added ${item.pack} to balance.`);
                      setActiveRechargeResource(null);
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition text-xs font-bold"
                  >
                    <span>{item.pack}</span>
                    <span className="text-blue-600 font-extrabold">{item.price}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MANAGE PLAN MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isManagePlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111827] p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Subscription &amp; Plan Settings
                </h3>
                <button onClick={() => setIsManagePlanModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-1">
                <span className="text-xs font-bold text-slate-500">Current Plan</span>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900 dark:text-white">Marketing Automation Plan</span>
                  <span className="text-sm font-black text-blue-600">₹10,000 / mo</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    toast.info("Auto-renewal enabled for next billing cycle.");
                    setIsManagePlanModalOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  Renew Plan Now (₹10,000)
                </button>
                <button
                  onClick={() => {
                    toast.info("Contacting support for enterprise custom plan...");
                    setIsManagePlanModalOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                >
                  Upgrade to Enterprise Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
