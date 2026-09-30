"use client";

import React from "react";
import { MessageSquareText } from "lucide-react";

interface WhatsAppFooterSectionProps {
  footer: string;
  onChange: (footer: string) => void;
}

export function WhatsAppFooterSection({ footer, onChange }: WhatsAppFooterSectionProps) {
  const charCount = footer.length;
  const isOverLimit = charCount > 60;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Section C</span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Footer Text</h3>
          <p className="text-xs text-slate-500">
            Add a short concluding line, disclaimer, or opt-out instructions at the bottom of your message
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Footer Content
          </label>
          <span
            className={`font-mono text-xs ${
              isOverLimit ? "text-red-500 font-bold" : "text-slate-400"
            }`}
          >
            {charCount} / 60
          </span>
        </div>

        <input
          type="text"
          maxLength={60}
          value={footer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Reply STOP to opt out • Terms apply"
          className={`sa-input w-full text-sm font-medium py-2 px-3.5 ${
            isOverLimit ? "border-red-500" : ""
          }`}
        />

        <p className="text-[11px] text-slate-400">
          Rendered as subtle, dimmed text right below the message body.
        </p>
      </div>
    </div>
  );
}
