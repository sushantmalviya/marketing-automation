"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Check,
  X,
  MoreHorizontal,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sliders,
  DollarSign,
  TrendingUp,
  Ban,
  Trash2,
  PlusCircle,
  Clock,
} from "lucide-react";
import type {
  CampaignFormData,
  MetaBuyingType,
  MetaCampaignObjective,
  MetaBudgetStrategy,
  MetaBudgetMode,
  MetaBidStrategy,
  MetaSpecialAdCategory,
} from "@/types/meta-ads";
import { CampaignTemplateModal } from "./CampaignTemplateModal";

interface CampaignCreationStepProps {
  formData: CampaignFormData;
  onChange: (updated: Partial<CampaignFormData>) => void;
  onNext: () => void;
  onClose: () => void;
  currencySymbol?: string;
  currencyCode?: string;
}

export function CampaignCreationStep({
  formData,
  onChange,
  onNext,
  onClose,
  currencySymbol = "₹",
  currencyCode = "INR",
}: CampaignCreationStepProps) {
  // Navigation & View mode
  const [viewMode, setViewMode] = useState<"edit" | "review">("edit");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Accordion collapses
  const [showCampaignOptions, setShowCampaignOptions] = useState(false);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);

  // Buying type custom dropdown & confirmation modal (Exact replica of Meta Ads Manager)
  const [isBuyingTypeDropdownOpen, setIsBuyingTypeDropdownOpen] = useState(false);
  const [isBuyingTypeModalOpen, setIsBuyingTypeModalOpen] = useState(false);
  const [pendingBuyingType, setPendingBuyingType] = useState<MetaBuyingType | null>(null);

  // Campaign objective custom dropdown
  const [isObjectiveDropdownOpen, setIsObjectiveDropdownOpen] = useState(false);

  // Campaign bid strategy custom dropdown
  const [isBidStrategyDropdownOpen, setIsBidStrategyDropdownOpen] = useState(false);

  // Budget strategy & mode states (Exact replica of Meta Ads Manager screenshot)
  const [showBudgetStrategyCard, setShowBudgetStrategyCard] = useState(true);
  const [isBudgetModeDropdownOpen, setIsBudgetModeDropdownOpen] = useState(false);
  const [scheduleBudgetIncreases, setScheduleBudgetIncreases] = useState(
    formData.schedule_budget_increases ?? false
  );

  // Budget scheduling periods (Exact replica of user screenshot)
  const [schedulePeriods, setSchedulePeriods] = useState<
    Array<{
      id: string;
      startDate: string;
      startTime: string;
      endDate: string;
      endTime: string;
      increaseType: "VALUE" | "PERCENTAGE";
      increaseValue: number;
      isCollapsed?: boolean;
    }>
  >(
    formData.budget_schedules && formData.budget_schedules.length > 0
      ? formData.budget_schedules
      : [
          {
            id: "period-1",
            startDate: "2026-10-23",
            startTime: "00:00",
            endDate: "2026-10-24",
            endTime: "00:00",
            increaseType: "VALUE",
            increaseValue: 5,
            isCollapsed: true,
          },
          {
            id: "period-2",
            startDate: "2026-10-24",
            startTime: "00:00",
            endDate: "2026-10-25",
            endTime: "00:00",
            increaseType: "VALUE",
            increaseValue: 5,
            isCollapsed: false,
          },
        ]
  );

  // Sync scheduling state back to parent formData
  const handleToggleScheduleBudgetIncreases = (enabled: boolean) => {
    setScheduleBudgetIncreases(enabled);
    onChange({
      schedule_budget_increases: enabled,
      budget_schedules: enabled ? schedulePeriods : undefined,
    });
  };

  const syncPeriodsToParent = (
    periods: Array<{
      id: string;
      startDate: string;
      startTime: string;
      endDate: string;
      endTime: string;
      increaseType: "VALUE" | "PERCENTAGE";
      increaseValue: number;
      isCollapsed?: boolean;
    }>
  ) => {
    setSchedulePeriods(periods);
    if (scheduleBudgetIncreases) {
      onChange({ budget_schedules: periods });
    }
  };

  const formatPeriodDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const updatePeriod = (id: string, updates: Partial<(typeof schedulePeriods)[0]>) => {
    const next = schedulePeriods.map((p) => (p.id === id ? { ...p, ...updates } : p));
    syncPeriodsToParent(next);
  };

  const togglePeriodCollapse = (id: string) => {
    setSchedulePeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isCollapsed: !p.isCollapsed } : p))
    );
  };

  const removePeriod = (id: string) => {
    const next = schedulePeriods.filter((p) => p.id !== id);
    syncPeriodsToParent(next);
  };

  const addPeriod = () => {
    if (schedulePeriods.length >= 50) return;
    const newId = `period-${Date.now()}`;
    const next = [
      ...schedulePeriods,
      {
        id: newId,
        startDate: "2026-10-26",
        startTime: "00:00",
        endDate: "2026-10-27",
        endTime: "00:00",
        increaseType: "VALUE" as const,
        increaseValue: 5,
        isCollapsed: false,
      },
    ];
    syncPeriodsToParent(next);
  };

  // Click outside listener refs
  const buyingTypeContainerRef = useRef<HTMLDivElement>(null);
  const objectiveContainerRef = useRef<HTMLDivElement>(null);
  const bidStrategyContainerRef = useRef<HTMLDivElement>(null);
  const budgetModeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buyingTypeContainerRef.current && !buyingTypeContainerRef.current.contains(target)) {
        setIsBuyingTypeDropdownOpen(false);
      }
      if (objectiveContainerRef.current && !objectiveContainerRef.current.contains(target)) {
        setIsObjectiveDropdownOpen(false);
      }
      if (bidStrategyContainerRef.current && !bidStrategyContainerRef.current.contains(target)) {
        setIsBidStrategyDropdownOpen(false);
      }
      if (budgetModeContainerRef.current && !budgetModeContainerRef.current.contains(target)) {
        setIsBudgetModeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-save debounced visual state
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus("saved");
    }, 600);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [formData]);

  // Field refs for quick anchor jumping from validation drawer
  const nameRef = useRef<HTMLInputElement>(null);
  const objectiveRef = useRef<HTMLButtonElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const spendCapRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  // Objective definitions
  const objectives: Array<{
    key: MetaCampaignObjective;
    title: string;
    description: string;
    goodFor: string;
  }> = [
    {
      key: "OUTCOME_LEADS",
      title: "Leads",
      description: "Collect leads for your business or brand.",
      goodFor: "Instant forms, Messenger, Instagram, conversions, calls",
    },
    {
      key: "OUTCOME_SALES",
      title: "Sales",
      description: "Find people likely to purchase your goods or service.",
      goodFor: "Catalog sales, website purchases, Messenger, WhatsApp",
    },
    {
      key: "OUTCOME_ENGAGEMENT",
      title: "Engagement",
      description: "Get more messages, video views, post engagement, page likes.",
      goodFor: "Messenger, Instagram, WhatsApp, video views, post engagement",
    },
    {
      key: "OUTCOME_AWARENESS",
      title: "Awareness",
      description: "Reach the largest number of people likely to remember your brand.",
      goodFor: "Reach, brand awareness, video views, store location awareness",
    },
    {
      key: "OUTCOME_TRAFFIC",
      title: "Traffic",
      description: "Send people to a destination, like your website, app or event.",
      goodFor: "Link clicks, landing page views, Messenger, WhatsApp",
    },
    {
      key: "OUTCOME_APP_PROMOTION",
      title: "App promotion",
      description: "Find new people to install your app and keep using it.",
      goodFor: "App installs, app events",
    },
  ];

  // Special categories definitions
  const specialCategoriesList: Array<{
    key: MetaSpecialAdCategory;
    title: string;
    description: string;
  }> = [
    {
      key: "CREDIT",
      title: "Credit",
      description: "Ads for credit card offers, auto loans, personal or business loans, mortgage loans and other financing opportunities.",
    },
    {
      key: "EMPLOYMENT",
      title: "Employment",
      description: "Ads for job offers, internships, professional certification programs or related employment opportunities.",
    },
    {
      key: "HOUSING",
      title: "Housing",
      description: "Ads for real estate listings, homeowners insurance, mortgage loans or other related opportunities.",
    },
    {
      key: "ISSUES_ELECTIONS_POLITICS",
      title: "Social issues, elections or politics",
      description: "Ads about social issues (such as civil rights, economy, health), elections, politics or political figures.",
    },
  ];

  // Bid strategies definitions
  const bidStrategies: Array<{
    key: MetaBidStrategy;
    title: string;
    subtitle: string;
    description: string;
  }> = [
    {
      key: "LOWEST_COST_WITHOUT_CAP",
      title: "Highest volume",
      subtitle: "Lowest cost without cap — Maximize results for your budget.",
      description: "Gets the most results for your budget automatically without restricting bids.",
    },
    {
      key: "COST_CAP",
      title: "Cost per result goal",
      subtitle: "Cost cap — Aim for a specific CPA while maximizing volume.",
      description: "Maintains an average cost per result while maximizing volume.",
    },
    {
      key: "BID_CAP",
      title: "Bid cap",
      subtitle: "Set highest bid allowed in any auction.",
      description: "Sets maximum bid in auctions to avoid overpaying, which may limit delivery.",
    },
  ];

  // Validation checking
  const validationResults = useMemo(() => {
    const errors: Array<{ id: string; code: string; message: string; focusRef?: React.RefObject<any> }> = [];
    const warnings: Array<{ id: string; message: string }> = [];

    // 1. Name validation
    if (!formData.name || !formData.name.trim()) {
      errors.push({
        id: "name_required",
        code: "#100_NAME_REQUIRED",
        message: "Campaign name is required to publish or advance.",
        focusRef: nameRef,
      });
    }

    // 2. Budget validation if Advantage+ is selected
    if (formData.budget_strategy === "CAMPAIGN_BUDGET") {
      const minDailyBudget = currencyCode === "INR" ? 80 : 1;
      const minLifetimeBudget = currencyCode === "INR" ? 2863.80 : 35;
      const minBudget = formData.budget_mode === "LIFETIME" ? minLifetimeBudget : minDailyBudget;
      const amount = formData.budget_amount ?? 0;
      if (amount < minBudget) {
        errors.push({
          id: "budget_too_low",
          code: "#2446375",
          message: `Your budget is too low: Your campaign budget must be at least ${currencySymbol}${minBudget.toLocaleString(
            currencyCode === "INR" ? "en-IN" : "en-US",
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )} to account for all ad set budgets in this campaign. Go to Budget and update your campaign budget.`,
          focusRef: budgetRef,
        });
      }

      // Spend cap vs budget validation
      if (formData.spend_cap_enabled && formData.spend_cap !== undefined && formData.spend_cap !== null) {
        const minSpendCap = currencyCode === "INR" ? 5000 : 100;
        const formattedMinSpendCap = `${currencySymbol}${minSpendCap.toLocaleString(
          currencyCode === "INR" ? "en-IN" : "en-US",
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}`;
        if (formData.spend_cap < minSpendCap) {
          errors.push({
            id: "spend_cap_too_low",
            code: "#1343011",
            message: `Campaign spending limit too low: Your campaign spending limit must be at least ${formattedMinSpendCap} for this currency.`,
            focusRef: spendCapRef,
          });
        } else if (amount > 0 && formData.spend_cap < amount) {
          errors.push({
            id: "spend_cap_below_budget",
            code: "#1343012",
            message: `Campaign spending limit (${currencySymbol}${formData.spend_cap}) cannot be lower than your budget amount (${currencySymbol}${amount}).`,
            focusRef: spendCapRef,
          });
        }
      }

      warnings.push({
        id: "cbo_multi_adset",
        message: "Advantage+ Campaign Budget optimizes performance when you have 2 or more ad sets in this campaign.",
      });
    }

    return { errors, warnings };
  }, [formData, currencyCode, currencySymbol]);

  // Campaign Setup Score calculation (0 - 100%)
  const setupScore = useMemo(() => {
    let score = 0;
    // 1. Name configured and distinct
    if (formData.name && formData.name.trim().length > 3) score += 25;
    // 2. Objective selected
    if (formData.objective) score += 25;
    // 3. Special category evaluated
    if (formData.special_ad_categories && formData.special_ad_categories.length > 0) score += 25;
    // 4. Budget valid
    if (
      formData.budget_strategy === "ADSET_BUDGET" ||
      (formData.budget_strategy === "CAMPAIGN_BUDGET" && (formData.budget_amount ?? 0) >= (currencyCode === "INR" ? 80 : 1))
    ) {
      score += 25;
    }
    return score;
  }, [formData, currencyCode]);

  // Budget Amount Calculations
  const minDailyBudget = currencyCode === "INR" ? 80 : 1;
  const minLifetimeBudget = currencyCode === "INR" ? 2863.80 : 35;
  const isBudgetTooLow = Boolean(
    formData.budget_strategy === "CAMPAIGN_BUDGET" &&
      formData.budget_amount !== undefined &&
      formData.budget_amount !== null &&
      Number(formData.budget_amount) > 0 &&
      (formData.budget_mode === "LIFETIME"
        ? Number(formData.budget_amount) < minLifetimeBudget
        : Number(formData.budget_amount) < minDailyBudget)
  );

  const formattedMinBudget = `${currencySymbol}${
    (formData.budget_mode === "LIFETIME" ? minLifetimeBudget : minDailyBudget).toLocaleString(
      currencyCode === "INR" ? "en-IN" : "en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )
  }`;

  // Campaign Spending Limit Calculations
  const minSpendCap = currencyCode === "INR" ? 5000 : 100;
  const isSpendLimitTooLow = Boolean(
    formData.spend_cap_enabled &&
      formData.spend_cap !== undefined &&
      formData.spend_cap !== null &&
      Number(formData.spend_cap) < minSpendCap
  );

  const formattedMinSpend = `${currencySymbol}${minSpendCap.toLocaleString(
    currencyCode === "INR" ? "en-IN" : "en-US",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}`;

  const formattedCurrentLimit =
    formData.spend_cap !== undefined && formData.spend_cap !== null && !isNaN(Number(formData.spend_cap))
      ? `${currencySymbol}${Number(formData.spend_cap).toLocaleString(
          currencyCode === "INR" ? "en-IN" : "en-US",
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}`
      : `${currencySymbol}0.00`;

  const spentPercentage =
    formData.spend_cap && Number(formData.spend_cap) > 0
      ? Math.min(100, Math.max(0, (0 / Number(formData.spend_cap)) * 100))
      : 0;

  // Handle Buying Type selection
  const handleSelectBuyingType = (newType: MetaBuyingType) => {
    setIsBuyingTypeDropdownOpen(false);
    if (newType === formData.buying_type) return;
    // Open the Meta Ads Manager "Your settings may change" modal
    setPendingBuyingType(newType);
    setIsBuyingTypeModalOpen(true);
  };

  // Special Category Toggle Handler
  const toggleSpecialCategory = (category: MetaSpecialAdCategory) => {
    const current = formData.special_ad_categories || ["NONE"];
    let updated: MetaSpecialAdCategory[];

    if (category === "NONE") {
      updated = ["NONE"];
    } else {
      const filtered = current.filter((c) => c !== "NONE");
      if (filtered.includes(category)) {
        updated = filtered.filter((c) => c !== category);
        if (updated.length === 0) updated = ["NONE"];
      } else {
        updated = [...filtered, category];
      }
    }
    onChange({ special_ad_categories: updated });
  };

  // Handle Next with validation check
  const handleNextClick = () => {
    if (validationResults.errors.length > 0) {
      const firstError = validationResults.errors[0];
      if (firstError?.focusRef?.current) {
        firstError.focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.focusRef.current.focus();
      }
      return;
    }
    onNext();
  };

  // Helper for quick jump
  const scrollToField = (ref?: React.RefObject<any>) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      ref.current.focus();
    }
  };

  const selectedObjectiveObj = objectives.find((o) => o.key === formData.objective);

  return (
    <div className="flex flex-col min-h-[620px] bg-slate-50 text-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-xl">
      {/* 1. Header & Navigation Bar */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm">
        {/* Left: Breadcrumbs & Badges */}
        <div className="flex items-center gap-3">
          <nav aria-label="Campaign hierarchy" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="max-w-[200px] truncate text-slate-900 font-bold" title={formData.name || "New Leads campaign"}>
              {formData.name || "New Leads campaign"}
            </span>
            <span className="text-slate-400">&gt;</span>
            <span className="hover:text-slate-700 cursor-pointer">1 Ad set</span>
            <span className="text-slate-400">&gt;</span>
            <span className="hover:text-slate-700 cursor-pointer">1 Ad</span>
          </nav>

          {/* Status Badge */}
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            Draft
          </span>

          {/* Active / Inactive Toggle Switch */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.status === "ACTIVE"}
                onChange={(e) => onChange({ status: e.target.checked ? "ACTIVE" : "PAUSED" })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <span className="text-xs font-bold text-slate-700">
              {formData.status === "ACTIVE" ? (
                <span className="text-emerald-700">Active</span>
              ) : (
                <span className="text-slate-500">Inactive</span>
              )}
            </span>
          </div>
        </div>

        {/* Right: View Mode Toggle & Action Menu */}
        <div className="flex items-center gap-3">
          {/* Segmented View Mode */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`rounded-md px-3 py-1 transition ${
                viewMode === "edit"
                  ? "bg-white text-blue-700 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setViewMode("review")}
              className={`rounded-md px-3 py-1 transition ${
                viewMode === "review"
                  ? "bg-white text-blue-700 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Review
            </button>
          </div>

          {/* Action Menu (...) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowActionMenu((prev) => !prev)}
              aria-label="More actions"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <MoreHorizontal size={16} />
            </button>
            {showActionMenu && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-30 text-xs font-medium text-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    onChange({ name: `${formData.name || "Campaign"} (Copy)` });
                    setShowActionMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 transition"
                >
                  Duplicate Campaign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      name: "New Leads campaign",
                      objective: "OUTCOME_LEADS",
                      buying_type: "AUCTION",
                      budget_strategy: "CAMPAIGN_BUDGET",
                      budget_mode: "DAILY",
                      budget_amount: 500,
                      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
                      special_ad_categories: ["NONE"],
                    });
                    setShowActionMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 transition"
                >
                  Reset Form to Defaults
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area: Left Edit Form + Right Auditing Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
        {/* Main Column (8 cols in LG) */}
        <div className="lg:col-span-8 space-y-6">
          {viewMode === "review" ? (
            /* Review Mode Readout */
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Campaign Summary Review</h3>
                  <p className="text-xs text-slate-500">Readout of all campaign settings before proceeding.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode("edit")}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Edit Configuration
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="font-semibold text-slate-500">Campaign Name:</span>
                  <p className="mt-1 font-bold text-slate-900 text-sm">{formData.name}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="font-semibold text-slate-500">Status:</span>
                  <p className="mt-1 font-bold text-slate-900 text-sm">
                    {formData.status === "ACTIVE" ? "Active" : "Inactive (Paused)"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="font-semibold text-slate-500">Buying Type:</span>
                  <p className="mt-1 font-bold text-slate-900 text-sm">{formData.buying_type === "AUCTION" ? "Auction" : "Reservation"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="font-semibold text-slate-500">Objective:</span>
                  <p className="mt-1 font-bold text-slate-900 text-sm">
                    {formData.objective.replace("OUTCOME_", "")}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="font-semibold text-slate-500">Budget Strategy:</span>
                  <p className="mt-1 font-bold text-slate-900 text-sm">
                    {formData.budget_strategy === "CAMPAIGN_BUDGET"
                      ? "Advantage campaign budget (CBO)"
                      : "Ad set budget"}
                  </p>
                </div>
                {formData.budget_strategy === "CAMPAIGN_BUDGET" && (
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <span className="font-semibold text-slate-500">
                      {formData.budget_mode === "DAILY" ? "Daily Budget" : "Lifetime Budget"}:
                    </span>
                    <p className="mt-1 font-bold text-slate-900 text-sm">
                      {currencySymbol}
                      {formData.budget_amount} {currencyCode}
                    </p>
                  </div>
                )}
                <div className="col-span-2 rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="font-semibold text-slate-500">Special Ad Categories:</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.special_ad_categories?.map((c) => (
                      <span
                        key={c}
                        className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-bold text-slate-700"
                      >
                        {c.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Edit Mode Sections */
            <>
              {/* Section 1: Campaign name */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#00875a] text-[#00875a]">
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Campaign name</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <Sparkles size={14} />
                    Create Template
                  </button>
                </div>

                <div className="mt-4">
                  <input
                    id="campaign-name"
                    ref={nameRef}
                    type="text"
                    value={formData.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    placeholder="New Leads campaign"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0064e0] focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Use clear naming conventions to easily identify your objective, audience, and dates.
                  </p>
                </div>
              </section>

              {/* Section 2: Campaign details (Exact Replica of User Screenshots 1 & 2) */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#00875a] text-[#00875a]">
                    <Check size={12} strokeWidth={3.5} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Campaign details</h3>
                </div>

                {/* Buying Type - Exact Replica of Screenshot 1 */}
                <div ref={buyingTypeContainerRef} className="relative">
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Buying type
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBuyingTypeDropdownOpen((prev) => !prev)}
                    className={`w-full flex items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition ${
                      isBuyingTypeDropdownOpen
                        ? "border-[#0064e0] ring-2 ring-blue-100"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold text-slate-900">
                        {formData.buying_type === "AUCTION" ? "Auction" : "Reservation"}
                      </div>
                      <div className="text-xs text-slate-500 font-normal mt-0.5">
                        {formData.buying_type === "AUCTION"
                          ? "Buy in real time with cost-effective bidding."
                          : "Buy in advance for more predictable outcomes."}
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-600 transition-transform shrink-0 ml-2 ${isBuyingTypeDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Dropdown Menu - Exact Screenshot 1 */}
                  {isBuyingTypeDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in duration-100">
                      {/* Option 1: Auction */}
                      <button
                        type="button"
                        onClick={() => handleSelectBuyingType("AUCTION")}
                        className={`w-full flex items-start gap-3 rounded-md p-3 text-left transition ${
                          formData.buying_type === "AUCTION" ? "bg-blue-50/80" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="mt-0.5">
                          {formData.buying_type === "AUCTION" ? (
                            <div className="grid h-4 w-4 place-items-center rounded-full border-2 border-blue-600">
                              <div className="h-2 w-2 rounded-full bg-blue-600" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Auction</div>
                          <div className="text-xs text-slate-600 mt-0.5 leading-snug">
                            Buy in real time with cost-effective bidding.
                          </div>
                        </div>
                      </button>

                      {/* Option 2: Reservation */}
                      <button
                        type="button"
                        onClick={() => handleSelectBuyingType("RESERVED")}
                        className={`w-full flex items-start gap-3 rounded-md p-3 text-left transition ${
                          formData.buying_type === "RESERVED" ? "bg-blue-50/80" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="mt-0.5">
                          {formData.buying_type === "RESERVED" ? (
                            <div className="grid h-4 w-4 place-items-center rounded-full border-2 border-blue-600">
                              <div className="h-2 w-2 rounded-full bg-blue-600" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Reservation</div>
                          <div className="text-xs text-slate-600 mt-0.5 leading-snug">
                            Buy in advance for more predictable outcomes.
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Campaign Objective Dropdown */}
                <div ref={objectiveContainerRef} className="relative pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-slate-900">
                      Campaign objective <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 cursor-help" title="Meta Outcome-Driven Ad Experiences (ODAX)">
                      ODAX <HelpCircle size={12} />
                    </span>
                  </div>

                  <button
                    type="button"
                    ref={objectiveRef}
                    onClick={() => setIsObjectiveDropdownOpen((prev) => !prev)}
                    className={`w-full flex items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition ${
                      isObjectiveDropdownOpen
                        ? "border-[#0064e0] ring-2 ring-blue-100"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold text-slate-900">
                        {selectedObjectiveObj?.title || "Select objective"}
                      </div>
                      {selectedObjectiveObj?.description && (
                        <div className="text-xs text-slate-500 font-normal mt-0.5">
                          {selectedObjectiveObj.description}
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-600 transition-transform shrink-0 ml-2 ${isObjectiveDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isObjectiveDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in duration-100 max-h-[380px] overflow-y-auto">
                      {objectives.map((obj) => {
                        const isReservation = formData.buying_type === "RESERVED";
                        const isAvailableInReservation = obj.key === "OUTCOME_ENGAGEMENT";
                        const isDisabled = isReservation && !isAvailableInReservation;
                        const isSelected = formData.objective === obj.key;

                        return (
                          <button
                            key={obj.key}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;
                              onChange({ objective: obj.key });
                              setIsObjectiveDropdownOpen(false);
                            }}
                            className={`w-full flex items-start gap-3 rounded-md p-3 text-left transition ${
                              isDisabled
                                ? "opacity-45 cursor-not-allowed bg-slate-50/50"
                                : isSelected
                                ? "bg-blue-50/80"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="mt-0.5">
                              {isSelected ? (
                                <div className="grid h-4 w-4 place-items-center rounded-full border-2 border-blue-600">
                                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                                </div>
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-slate-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{obj.title}</span>
                                {isDisabled && (
                                  <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                    Unavailable in Reservation
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 font-normal mt-0.5 leading-snug">
                                {obj.description}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">Good for: </span>
                                {obj.goodFor}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Objective "Good for" readout card */}
                  {selectedObjectiveObj && (
                    <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                      <span className="font-bold text-slate-900">Good for: </span>
                      <span>{selectedObjectiveObj.goodFor}</span>
                    </div>
                  )}
                </div>

                {/* Collapsible Show Options Accordion */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCampaignOptions((prev) => !prev)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>{showCampaignOptions ? "Hide options" : "Show options"}</span>
                    {showCampaignOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showCampaignOptions && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4 animate-in fade-in duration-150">
                      {/* Campaign spending limit radio group */}
                      <div>
                        <span className="block text-xs font-bold text-slate-700 mb-1">
                          Campaign Spending Limit
                        </span>
                        <p className="text-xs text-slate-500 mb-2.5">
                          A campaign spending limit is a maximum amount you&apos;re willing to spend on this campaign. Delivery will stop when your limit is reached.
                        </p>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                            <input
                              type="radio"
                              name="spend_cap_radio"
                              checked={!formData.spend_cap_enabled}
                              onChange={() => onChange({ spend_cap_enabled: false })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>None set</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                            <input
                              type="radio"
                              name="spend_cap_radio"
                              checked={formData.spend_cap_enabled}
                              onChange={() => onChange({ spend_cap_enabled: true })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>Add campaign spending limit</span>
                          </label>
                        </div>
                      </div>

                      {/* Spend Limit Currency Input (conditional) */}
                      {formData.spend_cap_enabled && (
                        <div className="mt-3 space-y-2">
                          <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-900 font-medium text-sm">
                              {currencySymbol}
                            </span>
                            <input
                              id="spend-cap-input"
                              ref={spendCapRef}
                              type="text"
                              value={formData.spend_cap !== undefined && formData.spend_cap !== null ? formData.spend_cap : ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, "");
                                onChange({ spend_cap: val ? Number(val) : undefined });
                              }}
                              placeholder="5000"
                              className={`w-full rounded-md border bg-white pl-8 pr-10 py-2.5 text-sm font-normal text-slate-900 transition ${
                                isSpendLimitTooLow
                                  ? "border-[#b00020] text-slate-900 focus:border-[#b00020] focus:ring-1 focus:ring-[#b00020] focus:outline-none"
                                  : "border-slate-300 focus:border-[#0064e0] focus:ring-1 focus:ring-blue-100 focus:outline-none"
                              }`}
                            />
                            {isSpendLimitTooLow && (
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#b00020]">
                                <Ban size={18} strokeWidth={2.2} />
                              </div>
                            )}
                          </div>

                          {isSpendLimitTooLow && (
                            <p className="text-xs text-[#b00020] font-normal leading-relaxed">
                              Campaign spending limit too low: Your campaign spending limit must be at least {formattedMinSpend} for this currency.
                            </p>
                          )}

                          <div className="pt-1">
                            <div className="text-xs text-slate-500 font-normal">
                              {currencySymbol}0.00 of {formattedCurrentLimit} Limit Spent
                            </div>
                            <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${spentPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Section 3: Budget (Advantage+ Campaign Budget) */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#00875a] text-[#00875a]">
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Budget</h3>
                  </div>

                  {formData.budget_strategy === "CAMPAIGN_BUDGET" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f7ed] px-3 py-1 text-xs font-semibold text-[#00875a] border border-[#baf3db]">
                      <Sparkles size={12} className="text-[#00875a]" /> Advantage+ on
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                      <Sparkles size={12} className="text-slate-400" /> Advantage+ off
                    </span>
                  )}
                </div>

                {/* Budget Strategy Card */}
                <div className="rounded-lg border border-slate-200 bg-[#f7f9fc] p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowBudgetStrategyCard((prev) => !prev)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900">Budget strategy</span>
                      <HelpCircle size={14} className="text-slate-500 cursor-help" />
                    </div>
                    <ChevronUp
                      size={16}
                      className={`text-slate-600 transition-transform ${showBudgetStrategyCard ? "" : "rotate-180"}`}
                    />
                  </div>

                  {showBudgetStrategyCard && (
                    <div className="mt-3 space-y-3 pt-2">
                      {/* Option 1: Campaign budget */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="budget_strategy"
                          checked={formData.budget_strategy === "CAMPAIGN_BUDGET"}
                          onChange={() => onChange({ budget_strategy: "CAMPAIGN_BUDGET" })}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div>
                          <span className="block text-sm font-bold text-slate-900">Campaign budget</span>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-normal">
                            Automatically distribute your budget to the best opportunities across your campaign. Also known as Advantage+ campaign budget.{" "}
                            <a href="#about-cbo" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline">
                              About campaign budget
                            </a>
                          </p>
                        </div>
                      </label>

                      {/* Option 2: Ad set budget */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="budget_strategy"
                          checked={formData.budget_strategy === "ADSET_BUDGET"}
                          onChange={() => onChange({ budget_strategy: "ADSET_BUDGET" })}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div>
                          <span className="block text-sm font-bold text-slate-900">Ad set budget</span>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-normal">
                            Set different bid strategies or budget schedules for each ad set.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                {/* Campaign Budget Controls (when Campaign budget is selected) */}
                {formData.budget_strategy === "CAMPAIGN_BUDGET" && (
                  <div className="space-y-4 pt-2">
                    {/* Inline Split Row: [ Daily budget ▼ ] [ ₹ 200.00       INR ] */}
                    <div>
                      <div className="flex items-center gap-0 w-full max-w-lg">
                        {/* Dropdown Container */}
                        <div ref={budgetModeContainerRef} className="relative w-44 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsBudgetModeDropdownOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between rounded-l-md border border-r-0 border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none transition"
                          >
                            <span>{formData.budget_mode === "LIFETIME" ? "Lifetime budget" : "Daily budget"}</span>
                            <ChevronDown
                              size={16}
                              className={`text-slate-600 transition-transform ${isBudgetModeDropdownOpen ? "rotate-180" : ""}`}
                            />
                          </button>

                          {isBudgetModeDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1 z-30 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  onChange({ budget_mode: "DAILY" });
                                  setIsBudgetModeDropdownOpen(false);
                                }}
                                className={`w-full px-3.5 py-2 text-left text-sm transition ${
                                  formData.budget_mode !== "LIFETIME"
                                    ? "bg-blue-50 font-bold text-blue-700"
                                    : "font-medium text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                Daily budget
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onChange({ budget_mode: "LIFETIME" });
                                  setIsBudgetModeDropdownOpen(false);
                                }}
                                className={`w-full px-3.5 py-2 text-left text-sm transition ${
                                  formData.budget_mode === "LIFETIME"
                                    ? "bg-blue-50 font-bold text-blue-700"
                                    : "font-medium text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                Lifetime budget
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Amount Input */}
                        <div className="relative flex-1">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-900 font-semibold text-sm">
                            {currencySymbol}
                          </span>
                          <input
                            id="budget-amount-input"
                            ref={budgetRef}
                            type="text"
                            value={formData.budget_amount !== undefined && formData.budget_amount !== null ? formData.budget_amount : ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, "");
                              onChange({ budget_amount: val ? Number(val) : undefined });
                            }}
                            placeholder={formData.budget_mode === "LIFETIME" ? "3000.00" : "200.00"}
                            className={`w-full rounded-r-md border bg-white pl-7 pr-16 py-2.5 text-sm font-semibold text-slate-900 transition focus:outline-none ${
                              isBudgetTooLow
                                ? "border-[#b00020] text-slate-900 focus:border-[#b00020] focus:ring-1 focus:ring-[#b00020]"
                                : "border-slate-300 focus:border-[#0064e0] focus:ring-1 focus:ring-blue-100"
                            }`}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 pointer-events-none">
                            <span className="text-slate-500 font-semibold text-xs">
                              {currencyCode}
                            </span>
                            {isBudgetTooLow && <Ban size={16} strokeWidth={2.2} className="text-[#b00020]" />}
                          </div>
                        </div>
                      </div>

                      {/* Error message when budget is too low */}
                      {isBudgetTooLow && (
                        <p className="mt-1.5 text-xs text-[#b00020] font-normal leading-relaxed">
                          Your budget is too low: Your campaign budget must be at least {formattedMinBudget} to account for all ad set budgets in this campaign. Go to Budget and update your campaign budget.
                        </p>
                      )}

                      {/* Dynamic Pacing Feedback text directly underneath */}
                      {formData.budget_mode === "LIFETIME" ? (
                        <div className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                          You&apos;ll spend no more than {currencySymbol}
                          {Number(formData.budget_amount || 3000).toLocaleString(currencyCode === "INR" ? "en-IN" : "en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          during the lifetime of your campaign.
                          <div className="mt-1">
                            <a href="#about-lifetime-budget" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline">
                              About lifetime budget
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                          We&apos;ll spend around {currencySymbol}
                          {Number(formData.budget_amount || 200).toLocaleString(currencyCode === "INR" ? "en-IN" : "en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          per day. Your maximum daily spend is {currencySymbol}
                          {(Number(formData.budget_amount || 200) * 1.75).toLocaleString(currencyCode === "INR" ? "en-IN" : "en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          and your maximum weekly spend is {currencySymbol}
                          {(Number(formData.budget_amount || 200) * 7).toLocaleString(currencyCode === "INR" ? "en-IN" : "en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          .
                          <div className="mt-1">
                            <a href="#about-daily-budget" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline">
                              About daily budget
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Campaign Bid Strategy */}
                    <div className="pt-2">
                      <div className="flex items-center gap-1.5">
                        <label className="text-sm font-bold text-slate-900">Campaign bid strategy</label>
                        <HelpCircle size={14} className="text-slate-500 cursor-help" />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 mb-2 font-normal">How we&apos;ll bid in ad auctions.</p>

                      <div ref={bidStrategyContainerRef} className="relative w-full max-w-xs">
                        <button
                          type="button"
                          onClick={() => setIsBidStrategyDropdownOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 transition"
                        >
                          <span>
                            {formData.bid_strategy === "LOWEST_COST_WITHOUT_CAP" && "Highest volume"}
                            {formData.bid_strategy === "COST_CAP" && "Cost per result goal"}
                            {formData.bid_strategy === "BID_CAP" && "Bid cap"}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`text-slate-600 transition-transform ${isBidStrategyDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {isBidStrategyDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in duration-100">
                            {bidStrategies.map((strat) => {
                              const isSelected = formData.bid_strategy === strat.key;
                              return (
                                <button
                                  key={strat.key}
                                  type="button"
                                  onClick={() => {
                                    onChange({ bid_strategy: strat.key });
                                    setIsBidStrategyDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-start gap-3 rounded-md p-2.5 text-left transition ${
                                    isSelected ? "bg-blue-50/80" : "hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="mt-0.5">
                                    {isSelected ? (
                                      <div className="grid h-4 w-4 place-items-center rounded-full border-2 border-blue-600">
                                        <div className="h-2 w-2 rounded-full bg-blue-600" />
                                      </div>
                                    ) : (
                                      <div className="h-4 w-4 rounded-full border border-slate-400" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-slate-900">{strat.title}</div>
                                    <div className="text-xs text-slate-500 font-normal mt-0.5 leading-snug">
                                      {strat.subtitle}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <hr className="border-slate-200 my-4" />

                    {/* Collapsible Show/Hide Settings */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowBudgetSettings((prev) => !prev)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                      >
                        <span>{showBudgetSettings ? "Hide settings" : "Show settings"}</span>
                        {showBudgetSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {showBudgetSettings && (
                        <div className="mt-4 space-y-4 animate-in fade-in duration-150">
                          {/* Budget scheduling */}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">Budget scheduling</span>
                              <HelpCircle size={13} className="text-slate-500 cursor-help" />
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 mb-2 font-normal">
                              Increase your budget during specific days or times.
                            </p>
                            <div className="flex items-center justify-between">
                              <label
                                className={`flex items-center gap-2.5 text-xs font-normal ${
                                  formData.budget_mode === "LIFETIME"
                                    ? "cursor-not-allowed text-slate-400 opacity-60"
                                    : "cursor-pointer text-slate-800"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={formData.budget_mode === "LIFETIME"}
                                  checked={formData.budget_mode !== "LIFETIME" && scheduleBudgetIncreases}
                                  onChange={(e) => handleToggleScheduleBudgetIncreases(e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50"
                                />
                                <span>Schedule budget increases</span>
                              </label>
                              <button
                                type="button"
                                className="flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                              >
                                <span>View</span>
                                <ChevronDown size={14} className="text-slate-500" />
                              </button>
                            </div>

                            {/* Scheduled Budget Increase Periods (Exact Replica of User Screenshot) */}
                            {formData.budget_mode !== "LIFETIME" && scheduleBudgetIncreases && (
                              <div className="mt-4 space-y-3">
                                {schedulePeriods.map((period) => {
                                  const startFormatted = formatPeriodDate(period.startDate);
                                  const endFormatted = formatPeriodDate(period.endDate);
                                  const baseAmt = Number(formData.budget_amount) || 20;
                                  const periodBudgetTotal = baseAmt + (period.increaseValue || 5);

                                  if (period.isCollapsed) {
                                    return (
                                      <div
                                        key={period.id}
                                        onClick={() => togglePeriodCollapse(period.id)}
                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition cursor-pointer select-none"
                                      >
                                        <span className="text-xs font-semibold text-slate-800">
                                          Spend {currencySymbol}{periodBudgetTotal} as the daily budget from {startFormatted} to {endFormatted}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                                            In draft
                                          </span>
                                          <ChevronDown size={16} className="text-slate-500" />
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={period.id}
                                      className="rounded-lg border border-slate-200 bg-[#f0f4f9] p-3.5 space-y-3"
                                    >
                                      {/* Period Header */}
                                      <div
                                        className="flex items-center justify-between cursor-pointer select-none"
                                        onClick={() => togglePeriodCollapse(period.id)}
                                      >
                                        <span className="text-xs font-bold text-slate-900">
                                          Time period for budget increase
                                        </span>
                                        <ChevronUp size={16} className="text-slate-600" />
                                      </div>

                                      {/* White Inner Card */}
                                      <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3.5 shadow-sm">
                                        {/* Date and Time Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                                          {/* Starts On */}
                                          <div>
                                            <label className="block text-xs font-bold text-slate-800 mb-1">
                                              Starts on
                                            </label>
                                            <div className="flex items-center rounded-md border border-slate-300 bg-white overflow-hidden text-xs">
                                              <input
                                                type="date"
                                                value={period.startDate}
                                                onChange={(e) => updatePeriod(period.id, { startDate: e.target.value })}
                                                className="flex-1 px-2.5 py-2 text-slate-800 font-medium focus:outline-none"
                                              />
                                              <div className="h-6 w-px bg-slate-200" />
                                              <div className="flex items-center gap-1 px-2.5 py-2 text-slate-700">
                                                <Clock size={13} className="text-slate-400" />
                                                <input
                                                  type="time"
                                                  value={period.startTime}
                                                  onChange={(e) => updatePeriod(period.id, { startTime: e.target.value })}
                                                  className="text-xs text-slate-800 font-medium focus:outline-none bg-transparent w-16"
                                                />
                                              </div>
                                            </div>
                                          </div>

                                          <span className="hidden sm:block text-slate-400 font-bold self-center mb-2.5">-</span>

                                          {/* Ends */}
                                          <div>
                                            <label className="block text-xs font-bold text-slate-800 mb-1">
                                              Ends
                                            </label>
                                            <div className="flex items-center rounded-md border border-slate-300 bg-white overflow-hidden text-xs">
                                              <input
                                                type="date"
                                                value={period.endDate}
                                                onChange={(e) => updatePeriod(period.id, { endDate: e.target.value })}
                                                className="flex-1 px-2.5 py-2 text-slate-800 font-medium focus:outline-none"
                                              />
                                              <div className="h-6 w-px bg-slate-200" />
                                              <div className="flex items-center gap-1 px-2.5 py-2 text-slate-700">
                                                <Clock size={13} className="text-slate-400" />
                                                <input
                                                  type="time"
                                                  value={period.endTime}
                                                  onChange={(e) => updatePeriod(period.id, { endTime: e.target.value })}
                                                  className="text-xs text-slate-800 font-medium focus:outline-none bg-transparent w-16"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Increase type & value */}
                                        <div className="flex items-center gap-2">
                                          <div className="relative flex-1">
                                            <select
                                              value={period.increaseType}
                                              onChange={(e) =>
                                                updatePeriod(period.id, { increaseType: e.target.value as "VALUE" | "PERCENTAGE" })
                                              }
                                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0064e0]"
                                            >
                                              <option value="VALUE">
                                                Increase daily budget by value amount ({currencySymbol})
                                              </option>
                                              <option value="PERCENTAGE">Increase daily budget by percentage (%)</option>
                                            </select>
                                          </div>
                                          <div className="relative w-36 shrink-0">
                                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-900 font-semibold text-xs">
                                              {period.increaseType === "VALUE" ? currencySymbol : "%"}
                                            </span>
                                            <input
                                              type="number"
                                              value={period.increaseValue}
                                              onChange={(e) =>
                                                updatePeriod(period.id, { increaseValue: Number(e.target.value) })
                                              }
                                              className="w-full rounded-md border border-slate-300 bg-white pl-6 pr-9 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0064e0]"
                                            />
                                            <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 font-semibold text-[11px] pointer-events-none">
                                              {currencyCode}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Summary sentence */}
                                        <p className="text-xs text-slate-600 font-normal leading-relaxed">
                                          Meta will aim to spend an average of {currencySymbol}
                                          {periodBudgetTotal} a day (a {currencySymbol}
                                          {period.increaseValue} increase) from {startFormatted} to {endFormatted}.
                                        </p>

                                        {/* Remove period button */}
                                        <button
                                          type="button"
                                          onClick={() => removePeriod(period.id)}
                                          className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                        >
                                          <Trash2 size={13} className="text-slate-500" />
                                          <span>Remove this period</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Add another time period & Counter */}
                                <div className="flex items-center justify-between pt-1">
                                  <button
                                    type="button"
                                    onClick={addPeriod}
                                    className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                                  >
                                    <PlusCircle size={14} className="text-slate-600" />
                                    <span>Add another time period</span>
                                  </button>
                                  <span className="text-xs text-slate-500 font-normal">
                                    {schedulePeriods.length}/50 time periods
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Ad scheduling */}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">Ad scheduling</span>
                              <HelpCircle size={13} className="text-slate-500 cursor-help" />
                            </div>
                            {formData.budget_mode === "LIFETIME" ? (
                              <div className="mt-1 space-y-2">
                                <p className="text-xs text-slate-500 font-normal">
                                  You&apos;ll set the specific schedule within each ad set.
                                </p>
                                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-normal text-slate-800">
                                  <input
                                    type="checkbox"
                                    checked={formData.ad_schedule_type === "ON_SCHEDULE"}
                                    onChange={(e) =>
                                      onChange({
                                        ad_schedule_type: e.target.checked ? "ON_SCHEDULE" : "ALL_TIME",
                                      })
                                    }
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                  />
                                  <span>Run ads on a schedule</span>
                                </label>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 mt-0.5 font-normal">Run ads all the time</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Campaign Frequency Control Section */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Campaign frequency control</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {formData.frequency_control_enabled ? "On" : "Off"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.frequency_control_enabled)}
                        onChange={(e) =>
                          onChange({
                            frequency_control_enabled: e.target.checked,
                            frequency_control_type: formData.frequency_control_type || "CAP",
                            frequency_control_times: formData.frequency_control_times ?? 2,
                            frequency_control_days: formData.frequency_control_days ?? 7,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0064e0]"></div>
                    </label>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Set a frequency if you have a specific number of times that you want people to see your ads throughout your campaign.{" "}
                  <a href="#learn-more" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline">
                    Learn more
                  </a>
                </p>

                {formData.frequency_control_enabled && (
                  <div className="pt-2 space-y-4">
                    {/* Target and Cap Radio options */}
                    <div className="space-y-3">
                      {/* Target Option */}
                      <label
                        onClick={() => onChange({ frequency_control_type: "TARGET" })}
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        <div className="mt-1 flex items-center justify-center">
                          <input
                            type="radio"
                            name="frequency_control_type"
                            checked={formData.frequency_control_type === "TARGET"}
                            onChange={() => onChange({ frequency_control_type: "TARGET" })}
                            className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>
                        <div className="flex items-start gap-2.5">
                          {/* Target normal bell curve icon */}
                          <div className="h-8 w-8 rounded bg-slate-100/80 flex items-center justify-center shrink-0 border border-slate-200/60 p-1">
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-500 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
                              <path d="M2 20 C6 20 8 4 12 4 C16 4 18 20 22 20" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                              Target
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                              The average number of times that you want people to see your ads
                            </div>
                          </div>
                        </div>
                      </label>

                      {/* Cap Option */}
                      <label
                        onClick={() => onChange({ frequency_control_type: "CAP" })}
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        <div className="mt-1 flex items-center justify-center">
                          <input
                            type="radio"
                            name="frequency_control_type"
                            checked={formData.frequency_control_type === "CAP" || !formData.frequency_control_type}
                            onChange={() => onChange({ frequency_control_type: "CAP" })}
                            className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>
                        <div className="flex items-start gap-2.5">
                          {/* Cap flat-top curve icon */}
                          <div className="h-8 w-8 rounded bg-slate-100/80 flex items-center justify-center shrink-0 border border-slate-200/60 p-1">
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-500 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
                              <path d="M2 20 C5 20 7 8 10 8 L14 8 C17 8 19 20 22 20" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                              Cap
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                              The maximum number of times that you want people to see your ads
                            </div>
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Numeric frequency controls & dynamic explainer text */}
                    <div className="pt-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Times input / select */}
                        {formData.frequency_control_type === "TARGET" ? (
                          <div className="relative">
                            <select
                              value={formData.frequency_control_times ?? 2}
                              onChange={(e) =>
                                onChange({ frequency_control_times: Number(e.target.value) })
                              }
                              className="appearance-none w-20 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0064e0] pr-7"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={14}
                              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600"
                            />
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={formData.frequency_control_times ?? 2}
                            onChange={(e) =>
                              onChange({ frequency_control_times: Number(e.target.value) || 1 })
                            }
                            className="w-20 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0064e0]"
                          />
                        )}

                        <span className="text-xs text-slate-800 font-medium">times every</span>

                        {/* Days input */}
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={formData.frequency_control_days ?? 7}
                          onChange={(e) =>
                            onChange({ frequency_control_days: Number(e.target.value) || 1 })
                          }
                          className="w-20 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0064e0]"
                        />

                        <span className="text-xs text-slate-800 font-medium">days</span>
                      </div>

                      {/* Dynamic explainer copy */}
                      <p className="text-xs text-slate-700 font-normal pt-1">
                        {formData.frequency_control_type === "TARGET"
                          ? `To help achieve your target, we'll aim to deliver about ${formData.frequency_control_times ?? 2} impressions every ${formData.frequency_control_days ?? 7} days.`
                          : `As a maximum, we'll aim to stay under ${formData.frequency_control_times ?? 2} impressions every ${formData.frequency_control_days ?? 7} days.`}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Section 4: Special Ad Categories */}
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#00875a] text-[#00875a] shrink-0 mt-0.5">
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Special ad categories</h3>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        Declare if your ads are related to credit, employment or housing, or about social issues, elections or politics. Requirements vary by country.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 shrink-0">
                    {formData.special_ad_categories?.includes("NONE")
                      ? "None added"
                      : `${formData.special_ad_categories?.length} selected`}
                  </span>
                </div>

                <div ref={categoryRef} className="space-y-2.5 pt-2">
                  {/* None Option */}
                  <label
                    onClick={() => toggleSpecialCategory("NONE")}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                      formData.special_ad_categories?.includes("NONE")
                        ? "border-[#0064e0] bg-blue-50/50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.special_ad_categories?.includes("NONE")}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900">None of the above</span>
                      <p className="text-[11px] text-slate-500">
                        My ads do not relate to housing, employment, credit, or politics.
                      </p>
                    </div>
                  </label>

                  {/* Defined Categories */}
                  {specialCategoriesList.map((cat) => {
                    const isSelected = formData.special_ad_categories?.includes(cat.key);
                    return (
                      <label
                        key={cat.key}
                        onClick={() => toggleSpecialCategory(cat.key)}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                          isSelected
                            ? "border-[#0064e0] bg-blue-50/50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900">{cat.title}</span>
                          <p className="text-[11px] text-slate-500 leading-snug">{cat.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Right Sidebar Column: Auditing & Guidance (4 cols in LG) */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Estimated campaign frequency Card (Visible when frequency control is on and type is TARGET) */}
          {formData.frequency_control_enabled && formData.frequency_control_type === "TARGET" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900">
                Estimated campaign frequency
              </h4>

              {/* Red Left-Bordered Error Notice */}
              <div className="border-l-4 border-red-600 pl-3.5 py-1">
                <div className="flex items-start gap-2.5">
                  <Ban size={18} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2.2} />
                  <p className="text-xs text-slate-800 leading-relaxed font-normal">
                    The configured start or stop time is not valid: Ad sets using target frequency must be scheduled to run for at least 7 days and the end time must end after 06:00. Adjust your schedule to meet these requirements.
                  </p>
                </div>
              </div>

              {/* Muted footnote */}
              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                These estimates are for all ads within your campaign and for the average lifetime frequency per person. They are provided to give you an idea of possible performance, but aren&apos;t guaranteed.
              </p>
            </div>
          )}

          {/* Campaign Setup Score Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Campaign Setup Score
            </h4>
            <div className="flex items-center gap-4">
              {/* Circular Progress Ring */}
              <div className="relative grid h-16 w-16 place-items-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background track */}
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress arc */}
                  <path
                    className={
                      setupScore === 100
                        ? "text-emerald-500 transition-all duration-500 ease-out"
                        : setupScore >= 50
                        ? "text-blue-600 transition-all duration-500 ease-out"
                        : "text-amber-500 transition-all duration-500 ease-out"
                    }
                    strokeDasharray={`${setupScore}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-sm font-black text-slate-900">{setupScore}%</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-900">
                  {setupScore === 100
                    ? "Ready to advance!"
                    : setupScore >= 75
                    ? "Almost complete"
                    : "Setup in progress"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {setupScore === 100
                    ? "All required campaign parameters are verified."
                    : "Fill required fields to achieve full delivery optimization."}
                </p>
              </div>
            </div>
          </div>

          {/* Advantage+ Smart Setup Card */}
          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <Sparkles size={14} className="text-blue-600" />
                Advantage+ Smart Setup
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.budget_strategy === "CAMPAIGN_BUDGET"}
                  onChange={(e) =>
                    onChange({
                      budget_strategy: e.target.checked ? "CAMPAIGN_BUDGET" : "ADSET_BUDGET",
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <p className="mt-2 text-xs text-blue-950 leading-relaxed font-medium">
              Meta AI dynamically shifts budget to your best-performing ad sets in real time, reducing overall cost per lead by up to 24%.
            </p>
          </div>

          {/* Live Validation Drawer / Verifying Changes */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Verifying Changes
              </h4>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                Live checks
              </span>
            </div>

            {/* Error notifications */}
            {validationResults.errors.length > 0 && (
              <div className="space-y-2">
                {validationResults.errors.map((err) => (
                  <div
                    key={err.id}
                    className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-900"
                  >
                    <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-rose-700">{err.code}</span>
                        {err.focusRef && (
                          <button
                            type="button"
                            onClick={() => scrollToField(err.focusRef)}
                            className="font-bold text-blue-700 hover:underline text-[11px]"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 font-semibold text-rose-950 text-[11px] leading-tight">
                        {err.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {validationResults.warnings.length > 0 && (
              <div className="space-y-2">
                {validationResults.warnings.map((warn) => (
                  <div
                    key={warn.id}
                    className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900"
                  >
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="font-medium text-amber-950 text-[11px] leading-tight">
                      {warn.message}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Success state if no errors */}
            {validationResults.errors.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 font-semibold">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>All parameters conform to Meta Marketing API v19.0.</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 4. Docked Footer Action Bar */}
      <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 shadow-md">
        {/* Left: Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          Close
        </button>

        {/* Center: Auto-save Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          {saveStatus === "saving" ? (
            <span className="flex items-center gap-1 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
              Saving edits…
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 size={13} className="text-emerald-600" />
              All edits saved
            </span>
          )}
        </div>

        {/* Right: Primary CTA Next */}
        <button
          type="button"
          onClick={handleNextClick}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-98 transition disabled:opacity-50"
        >
          <span>Next</span>
          <ArrowRight size={16} />
        </button>
      </footer>

      {/* Template Modal Dialog */}
      <CampaignTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        currentName={formData.name}
        objective={formData.objective}
        buyingType={formData.buying_type}
        onApply={(formattedName) => onChange({ name: formattedName })}
      />

      {/* Buying Type Confirmation Dialog - Exact Replica of User Screenshot */}
      {isBuyingTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px] animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-buying-type-title"
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200"
          >
            <div className="flex items-start justify-between">
              <h3 id="change-buying-type-title" className="text-lg font-bold text-slate-900">
                {pendingBuyingType === "RESERVED"
                  ? "Change buying type to reservation?"
                  : "Change buying type to auction?"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsBuyingTypeModalOpen(false);
                  setPendingBuyingType(null);
                }}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition -mr-1"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            {pendingBuyingType === "RESERVED" && (
              <p className="mt-3 text-sm text-slate-800 leading-relaxed font-normal">
                With this buying type, you can only create engagement campaigns for video views.
              </p>
            )}

            <p className="mt-3 text-sm text-slate-800 leading-relaxed font-normal">
              Most of the current settings won&apos;t be saved and your ads will be deleted. We&apos;ll keep the existing settings when possible and others will get a default value. You can edit these settings.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsBuyingTypeModalOpen(false);
                  setPendingBuyingType(null);
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingBuyingType) {
                    if (pendingBuyingType === "RESERVED") {
                      onChange({
                        buying_type: "RESERVED",
                        objective: "OUTCOME_ENGAGEMENT",
                      });
                    } else {
                      onChange({
                        buying_type: pendingBuyingType,
                      });
                    }
                  }
                  setIsBuyingTypeModalOpen(false);
                  setPendingBuyingType(null);
                }}
                className="rounded-md bg-[#0064e0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1877f2] shadow-sm transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
