"use client";

import React from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import { SmsTemplateData, SmsCategory, SmsPresetExample } from "./sms-types";
import { SmsBasicInfoSection } from "./sections/sms-basic-info-section";
import { SmsHeaderSection } from "./sections/sms-header-section";
import { SmsComposerSection } from "./sections/sms-composer-section";
import { SmsCtaSection } from "./sections/sms-cta-section";
import { SmsPreview } from "./sms-preview";

interface SmsTemplateBuilderProps {
  data: SmsTemplateData;
  onChange: (updated: SmsTemplateData) => void;
  isEditing?: boolean;
}

export function SmsTemplateBuilder({
  data,
  onChange,
  isEditing,
}: SmsTemplateBuilderProps) {
  const updateField = <K extends keyof SmsTemplateData>(
    field: K,
    val: SmsTemplateData[K]
  ) => {
    onChange({ ...data, [field]: val });
  };

  const handleApplyPreset = (preset: SmsPresetExample) => {
    onChange({
      ...data,
      category: preset.category,
      body: preset.body,
      description: data.description || preset.description,
    });
  };

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1560px] mx-auto space-y-6">
      {/* SECTION A — Basic Information Card */}
      <SmsBasicInfoSection
        name={data.name}
        category={data.category}
        onNameChange={(name) => updateField("name", name)}
        onCategoryChange={(cat) => updateField("category", cat)}
      />

      {/* Main Two-Column Layout: Composer on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Sections B, C, D */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          {/* SECTION B — Optional Header & Media */}
          <SmsHeaderSection
            header={data.header}
            headerType={data.headerType}
            mediaUrl={data.mediaUrl}
            mediaName={data.mediaName}
            onChange={(updates) => onChange({ ...data, ...updates })}
          />

          {/* SECTION C — Message Body & Footer */}
          <SmsComposerSection
            body={data.body}
            footer={data.footer}
            onBodyChange={(body) => updateField("body", body)}
            onFooterChange={(footer) => updateField("footer", footer)}
            onApplyPreset={handleApplyPreset}
          />

          {/* SECTION D — Call-to-Action */}
          <SmsCtaSection
            buttons={data.buttons}
            onButtonsChange={(buttons) => onChange({ ...data, buttons })}
            cta={data.cta}
            onCtaChange={(cta) => onChange({ ...data, cta })}
          />
        </div>

        {/* Right Column: Anchored Interactive Phone Preview */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col items-center lg:sticky lg:top-[90px] space-y-3">
          <div className="w-full flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Live Customer Preview
              </span>
            </div>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
              Interactive
            </span>
          </div>

          <div className="w-full rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-100/80 via-slate-50/50 to-slate-100/70 p-4 sm:p-6 flex flex-col items-center justify-center shadow-xs">
            <SmsPreview data={data} />
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Real-time SMS rendering with simulated mobile chat bubble and clickable link detection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export * from "./sms-types";
export * from "./sms-encoder";
export * from "./sms-serializer";
export * from "./sms-preview";
export * from "./sms-preview-modal";
