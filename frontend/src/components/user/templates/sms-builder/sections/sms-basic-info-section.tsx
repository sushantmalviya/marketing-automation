"use client";

import React from "react";
import { Layers, Tag, AlertCircle } from "lucide-react";
import { SmsCategory, SMS_CATEGORIES } from "../sms-types";

interface SmsBasicInfoSectionProps {
  name: string;
  category: SmsCategory;
  description?: string;
  onNameChange: (val: string) => void;
  onCategoryChange: (cat: SmsCategory) => void;
  onDescriptionChange?: (val: string) => void;
}

export function SmsBasicInfoSection({
  name,
  category,
  onNameChange,
  onCategoryChange,
}: SmsBasicInfoSectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Layers size={17} />
        </span>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              Section A
            </span>
            <span className="text-red-500 font-bold">*</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Basic Template Information</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* 1. Template Name Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <span>Template Name</span>
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Summer Promo 2026"
            className="sa-input w-full text-sm font-semibold py-2 px-3.5"
          />
          {!name.trim() && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1 font-medium">
              <AlertCircle size={12} />
              Template name is required
            </p>
          )}
        </div>

        {/* 2. SMS Category Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <Tag size={13} className="text-indigo-600" />
            <span>Category</span>
            <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as SmsCategory)}
            className="sa-input w-full text-sm font-semibold py-2 px-3.5 bg-white cursor-pointer"
          >
            {SMS_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label} — {cat.description.split(",")[0]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
