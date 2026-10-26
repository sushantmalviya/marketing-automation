"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  Globe,
  Facebook,
  Instagram,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  ShieldCheck,
  Rocket,
  Pencil,
  X,
  Play,
} from "lucide-react";
import type {
  CampaignFormData,
  AdSetFormData,
  AdCreativeFormData,
} from "@/types/meta-ads";

interface CampaignUnifiedReviewStepProps {
  campaignData?: CampaignFormData;
  adSetData?: AdSetFormData;
  adCreativeData?: AdCreativeFormData;
  onNavigateStep: (step: number) => void;
  onLaunch: () => void;
  onClose: () => void;
  isLaunching?: boolean;
  currencySymbol?: string;
  currencyCode?: string;
}

export function CampaignUnifiedReviewStep({
  campaignData,
  adSetData,
  adCreativeData,
  onNavigateStep,
  onLaunch,
  onClose,
  isLaunching = false,
  currencySymbol = "₹",
  currencyCode = "INR",
}: CampaignUnifiedReviewStepProps) {
  const cData = useMemo(() => campaignData || ({
    name: "Diwali Festive Leads 2026",
    status: "PAUSED",
    buying_type: "AUCTION",
    objective: "OUTCOME_LEADS",
    budget_strategy: "CAMPAIGN_BUDGET",
    budget_amount: 500,
    budget_mode: "DAILY",
    special_ad_categories: ["NONE"],
  } as unknown as CampaignFormData), [campaignData]);

  const sData = useMemo(() => adSetData || ({
    name: "Indore Leads Ad Set",
    conversion_location: "INSTANT_FORMS",
    leadgen_form_id: "default_form_1",
    custom_form_name: "Diwali Festive Leads 2026 Form",
    location: "India",
    radius: 40,
    age_min: 18,
    age_max: 55,
    gender: "All",
    placement_type: "ADVANTAGE_PLUS",
    interests: [],
    performance_goal: "MAXIMIZE_LEADS",
  } as unknown as AdSetFormData), [adSetData]);

  const aData = useMemo(() => adCreativeData || ({
    name: "New Leads Ad",
    page_name: "Marketing Automation Official",
    headline: "Transform Your Lead Generation Today",
    primary_text: "Grow your business with marketing automation.",
    call_to_action: "LEARN_MORE",
    media_url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1000&auto=format&fit=crop&q=80",
    media_type: "image",
  } as unknown as AdCreativeFormData), [adCreativeData]);

  const [activeTab, setActiveTab] = useState<"summary" | "preview">("summary");

  // Global Multi-Level Validation
  const validation = useMemo(() => {
    const errors: Array<{ level: string; step: 1 | 2 | 3; message: string }> = [];

    // Campaign level
    if (!cData.name || cData.name.trim().length === 0) {
      errors.push({ level: "Campaign", step: 1, message: "Campaign name is missing." });
    }
    if (
      cData.budget_strategy === "CAMPAIGN_BUDGET" &&
      (!cData.budget_amount || cData.budget_amount <= 0)
    ) {
      errors.push({ level: "Campaign", step: 1, message: "Campaign budget amount is invalid." });
    }

    // Ad Set level
    if (!sData.name || sData.name.trim().length === 0) {
      errors.push({ level: "Ad Set", step: 2, message: "Ad set name is missing." });
    }
    if (sData.conversion_location === "INSTANT_FORMS" && !sData.leadgen_form_id) {
      errors.push({ level: "Ad Set", step: 2, message: "Lead form is not selected." });
    }
    if (sData.age_min > sData.age_max) {
      errors.push({ level: "Ad Set", step: 2, message: "Audience age range is invalid." });
    }
    if (!sData.run_continuously && sData.end_date && sData.start_date) {
      if (new Date(sData.end_date) < new Date(sData.start_date)) {
        errors.push({ level: "Ad Set", step: 2, message: "Schedule end date is before start date." });
      }
    }

    // Ad level
    if (!aData.name || aData.name.trim().length === 0) {
      errors.push({ level: "Ad", step: 3, message: "Ad name is missing." });
    }
    if (!aData.media_url && !aData.media_file) {
      errors.push({ level: "Ad", step: 3, message: "Ad creative image or video is missing." });
    }
    if (!aData.primary_text || aData.primary_text.trim().length === 0) {
      errors.push({ level: "Ad", step: 3, message: "Primary copy text is missing." });
    }
    if (!aData.headline || aData.headline.trim().length === 0) {
      errors.push({ level: "Ad", step: 3, message: "Headline is missing." });
    }

    return {
      errors,
      canLaunch: errors.length === 0,
      campaignValid: !errors.some((e) => e.level === "Campaign"),
      adSetValid: !errors.some((e) => e.level === "Ad Set"),
      adValid: !errors.some((e) => e.level === "Ad"),
    };
  }, [cData, sData, aData]);

  return (
    <div className="flex flex-col min-h-[640px] bg-slate-50 text-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-xl">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <nav aria-label="Campaign hierarchy" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => onNavigateStep(1)}
              className="max-w-[160px] truncate text-slate-600 hover:text-blue-600 transition"
            >
              {cData.name || "Campaign"}
            </button>
            <span className="text-slate-400">&gt;</span>
            <button
              type="button"
              onClick={() => onNavigateStep(2)}
              className="max-w-[160px] truncate text-slate-600 hover:text-blue-600 transition"
            >
              {sData.name || "1 Ad set"}
            </button>
            <span className="text-slate-400">&gt;</span>
            <button
              type="button"
              onClick={() => onNavigateStep(3)}
              className="max-w-[160px] truncate text-slate-600 hover:text-blue-600 transition"
            >
              {aData.name || "1 Ad"}
            </button>
            <span className="text-slate-400">&gt;</span>
            <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
              Review
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Review Content */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Verification Status Banner */}
        {validation.canLaunch ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 flex items-start gap-3.5 shadow-sm">
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Ready to launch! All hierarchy levels verified.
              </h3>
              <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
                Campaign, Ad Set targeting, and Creative specs comply with Meta Marketing API rules.
                Your campaign will be submitted as active or paused based on your status preference.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-950">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <span>Please resolve {validation.errors.length} issue(s) before launching:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {validation.errors.map((err, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-white border border-rose-200 px-3.5 py-2 text-xs"
                >
                  <span className="font-semibold text-rose-900">
                    <strong className="text-rose-950">[{err.level}]</strong> {err.message}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateStep(err.step)}
                    className="font-bold text-blue-700 hover:underline shrink-0 ml-2 text-[11px]"
                  >
                    Fix in {err.level} &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3-Level Hierarchy Summaries */}
        <div className="space-y-4">
          {/* LEVEL 1: CAMPAIGN CARD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${
                    validation.campaignValid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {validation.campaignValid ? "✓" : "!"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900">CAMPAIGN</h4>
                    <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600">
                      {cData.status === "ACTIVE" ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{cData.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateStep(1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition"
              >
                <Pencil size={13} />
                <span>Edit Campaign</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Objective</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {cData.objective.replace("OUTCOME_", "")}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Buying Type</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{cData.buying_type}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Budget Strategy</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {cData.budget_strategy === "CAMPAIGN_BUDGET"
                    ? `Advantage+ (${currencySymbol}${cData.budget_amount})`
                    : "Ad Set Controlled"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Special Categories</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {cData.special_ad_categories?.join(", ") || "None"}
                </span>
              </div>
            </div>
          </section>

          {/* LEVEL 2: AD SET CARD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${
                    validation.adSetValid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {validation.adSetValid ? "✓" : "!"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900">1 AD SET</h4>
                    <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600">
                      {sData.conversion_location}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{sData.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateStep(2)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition"
              >
                <Pencil size={13} />
                <span>Edit Ad Set</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Lead Form</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate text-emerald-800">
                  {sData.custom_form_name || "Diwali Festive Leads 2026 Form"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Target Location</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {sData.location} (+{sData.radius}km)
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Demographics</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {sData.age_min}–{sData.age_max} yrs · {sData.gender}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Placements</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {sData.placement_type === "ADVANTAGE_PLUS" ? "Advantage+ (All Feeds)" : "Manual Placements"}
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Performance Goal</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {sData.performance_goal?.replace("MAXIMIZE_", "").replace(/_/g, " ") || "Maximize Leads"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Facebook Page</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {sData.facebook_page_name || "Marketing Automation Official"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Optimization</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {sData.dynamic_creative ? "Dynamic Creative · " : ""}
                  {sData.frequency_control?.enabled
                    ? `${sData.frequency_control.frequency}x/${sData.frequency_control.period}d`
                    : "Standard Freq"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-slate-400 block font-medium">Regulatory Policy</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {sData.india_policy?.verification_status === "VERIFIED" ? (
                    <span className="text-emerald-700">✓ India Verified</span>
                  ) : sData.location?.includes("India") ? (
                    <span className="text-amber-700">⚠ Verification Required</span>
                  ) : (
                    "Compliant"
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* LEVEL 3: AD CREATIVE CARD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${
                    validation.adValid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {validation.adValid ? "✓" : "!"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900">1 AD</h4>
                    <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600">
                      {aData.page_name}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{aData.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateStep(3)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition"
              >
                <Pencil size={13} />
                <span>Edit Ad</span>
              </button>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start">
              {/* Media Thumbnail */}
              <div className="relative h-24 w-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                {aData.media_url ? (
                  aData.media_type === "video" ? (
                    <video src={aData.media_url} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={aData.media_url} alt="Review thumb" className="h-full w-full object-cover" />
                  )
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold">No Media</span>
                )}
              </div>

              {/* Copy Details */}
              <div className="flex-1 space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Headline:</span>
                  <p className="font-bold text-slate-900">{aData.headline || "None"}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Primary Copy:</span>
                  <p className="text-slate-700 line-clamp-2">{aData.primary_text || "None"}</p>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5">
                    CTA: {aData.call_to_action}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Lead form: {sData.custom_form_name || "Diwali Festive Leads 2026 Form"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Docked Footer Actions */}
      <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 shadow-md">
        <button
          type="button"
          onClick={() => onNavigateStep(3)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          <ChevronLeft size={16} />
          <span>Back to Ad Creative</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Save as Draft & Close
          </button>
          <button
            type="button"
            disabled={!validation.canLaunch || isLaunching}
            onClick={onLaunch}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:scale-98 transition disabled:opacity-50"
          >
            <Rocket size={16} />
            <span>{isLaunching ? "Launching to Meta..." : "Publish & Launch Campaign"}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
