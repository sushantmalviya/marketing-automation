"use client";

import React, { useState } from "react";
import { X, Tag, Sparkles, Check } from "lucide-react";
import type { MetaCampaignObjective, MetaBuyingType } from "@/types/meta-ads";

interface CampaignTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  objective: MetaCampaignObjective;
  buyingType: MetaBuyingType;
  onApply: (formattedName: string) => void;
}

export function CampaignTemplateModal({
  isOpen,
  onClose,
  currentName,
  objective,
  buyingType,
  onApply,
}: CampaignTemplateModalProps) {
  const [templateString, setTemplateString] = useState<string>(
    "{{campaign.name}} - {{objective}} - {{date}}"
  );

  if (!isOpen) return null;

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const cleanObjective = objective.replace("OUTCOME_", "");

  const availableTags = [
    { tag: "{{campaign.name}}", label: "Campaign Name", sample: currentName || "New Leads" },
    { tag: "{{objective}}", label: "Objective", sample: cleanObjective },
    { tag: "{{date}}", label: "Date (YYYY-MM-DD)", sample: today },
    { tag: "{{buying_type}}", label: "Buying Type", sample: buyingType },
    { tag: "{{country}}", label: "Country", sample: "IN" },
  ];

  // Resolve preview
  const preview = templateString
    .replace(/\{\{campaign\.name\}\}/g, currentName || "New Leads")
    .replace(/\{\{objective\}\}/g, cleanObjective)
    .replace(/\{\{date\}\}/g, today)
    .replace(/\{\{buying_type\}\}/g, buyingType)
    .replace(/\{\{country\}\}/g, "IN");

  const insertTag = (tag: string) => {
    setTemplateString((prev) => (prev ? `${prev} - ${tag}` : tag));
  };

  const handleApply = () => {
    onApply(preview || currentName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Sparkles size={18} />
            </span>
            <h3 id="template-modal-title" className="text-lg font-bold text-slate-900">
              Campaign Name Template
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close template modal"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Standardize naming across your ad campaigns. Click tag pills below to insert dynamic fields.
        </p>

        {/* Template Input */}
        <div className="mt-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Template Format
          </label>
          <input
            type="text"
            value={templateString}
            onChange={(e) => setTemplateString(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="{{campaign.name}} - {{objective}} - {{date}}"
          />
        </div>

        {/* Tag Pills */}
        <div className="mt-4">
          <span className="block text-xs font-bold text-slate-700 mb-2">Available Tags</span>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(({ tag, label }) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 active:scale-95"
              >
                <Tag size={12} className="text-blue-500" />
                <span>{tag}</span>
                <span className="text-[10px] text-blue-500 font-normal">({label})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Preview Result
          </span>
          <div className="mt-1 font-semibold text-slate-900 break-all text-sm">
            {preview || <span className="text-slate-400 italic">Empty name</span>}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Check size={16} />
            Apply Template
          </button>
        </div>
      </div>
    </div>
  );
}
