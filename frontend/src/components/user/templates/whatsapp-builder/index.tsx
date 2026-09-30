"use client";

import React from "react";
import {
  MessageCircle,
  Sparkles,
  Layers,
  Globe,
  Tag,
} from "lucide-react";
import {
  WhatsAppTemplateData,
  WHATSAPP_CATEGORIES,
  WHATSAPP_LANGUAGES,
} from "./whatsapp-types";
import { WhatsAppHeaderSection } from "./sections/whatsapp-header-section";
import { WhatsAppBodySection } from "./sections/whatsapp-body-section";
import { WhatsAppFooterSection } from "./sections/whatsapp-footer-section";
import { WhatsAppButtonsSection } from "./sections/whatsapp-buttons-section";
import { WhatsAppPreview } from "./whatsapp-preview";

interface WhatsAppTemplateBuilderProps {
  data: WhatsAppTemplateData;
  onChange: (updated: WhatsAppTemplateData) => void;
  isEditing?: boolean;
}

export function WhatsAppTemplateBuilder({
  data,
  onChange,
  isEditing,
}: WhatsAppTemplateBuilderProps) {
  const updateField = <K extends keyof WhatsAppTemplateData>(
    field: K,
    val: WhatsAppTemplateData[K]
  ) => {
    onChange({ ...data, [field]: val });
  };

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1560px] mx-auto space-y-6">
      {/* Basic Information Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Layers size={17} />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">Basic Template Information</h3>
            <p className="text-xs text-slate-500">Configure name, category, and language for your WhatsApp campaign</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* 1. Template Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <span>Template Name</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Summer Promo 2026"
              className="sa-input w-full text-sm font-semibold py-2 px-3.5"
            />
            <p className="text-[11px] text-slate-400">
              Unique internal identifier for campaigns and automations
            </p>
          </div>

          {/* 2. Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <Tag size={13} className="text-emerald-600" />
              <span>Category</span>
            </label>
            <select
              value={data.category}
              onChange={(e) => updateField("category", e.target.value as any)}
              className="sa-input w-full text-sm font-semibold py-2 px-3.5 bg-white"
            >
              {WHATSAPP_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} — {cat.description.split(",")[0]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Categorizes template for WhatsApp business verification
            </p>
          </div>

          {/* 3. Language Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <Globe size={13} className="text-emerald-600" />
              <span>Language</span>
            </label>
            <select
              value={data.language}
              onChange={(e) => updateField("language", e.target.value)}
              className="sa-input w-full text-sm font-semibold py-2 px-3.5 bg-white"
            >
              {WHATSAPP_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Primary language for recipient rendering
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: 4 Main Template Sections */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          {/* SECTION A — HEADER */}
          <WhatsAppHeaderSection
            header={data.header}
            onChange={(header) => updateField("header", header)}
          />

          {/* SECTION B — BODY */}
          <WhatsAppBodySection
            body={data.body}
            onChange={(body) => updateField("body", body)}
          />

          {/* SECTION C — FOOTER */}
          <WhatsAppFooterSection
            footer={data.footer}
            onChange={(footer) => updateField("footer", footer)}
          />

          {/* SECTION D — CTA / BUTTONS */}
          <WhatsAppButtonsSection
            buttons={data.buttons}
            onChange={(buttons) => updateField("buttons", buttons)}
          />
        </div>

        {/* Right Column: Anchored Interactive Phone Preview */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col items-center lg:sticky lg:top-[90px] space-y-3">
          <div className="w-full flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Live Customer Preview
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
              Interactive
            </span>
          </div>

          <div className="w-full rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-100/80 via-slate-50/50 to-slate-100/70 p-4 sm:p-6 flex flex-col items-center justify-center shadow-xs">
            <WhatsAppPreview data={data} />
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Real-time WhatsApp rendering with scrollable chat and simulated CTA buttons
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
