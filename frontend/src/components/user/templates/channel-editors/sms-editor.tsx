"use client";

import React from "react";
import { MessageSquare, Sparkles, AlertCircle } from "lucide-react";
import { VariableDropdown } from "../email-builder/variable-dropdown";

interface SMSEditorProps {
  value: string;
  onChange: (val: string) => void;
}

export function SMSEditor({ value, onChange }: SMSEditorProps) {
  const charCount = value.length;
  // GSM SMS calculation: 1 segment = 160 chars. Multi-part SMS = 153 chars per segment
  const segments = charCount <= 160 ? (charCount === 0 ? 0 : 1) : Math.ceil(charCount / 153);
  const remainingInSegment =
    charCount <= 160
      ? 160 - charCount
      : 153 - (charCount % 153 === 0 ? 0 : charCount % 153);

  // Replace variable placeholders with sample data for preview
  const previewText = value
    ? value
        .replace(/\{\{\s*first_name\s*\}\}/gi, "Alex")
        .replace(/\{\{\s*last_name\s*\}\}/gi, "Morgan")
        .replace(/\{\{\s*name\s*\}\}/gi, "Alex Morgan")
        .replace(/\{\{\s*email\s*\}\}/gi, "alex@example.com")
        .replace(/\{\{\s*phone\s*\}\}/gi, "+1 555-0199")
        .replace(/\{\{\s*company\s*\}\}/gi, "Acme Corp")
        .replace(/\{\{\s*city\s*\}\}/gi, "San Francisco")
    : "Your SMS preview text will appear here...";

  const handleInsertTag = (tag: string) => {
    onChange(`${value ? value + " " : ""}${tag}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Input Column */}
      <div className="lg:col-span-7 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
              <MessageSquare size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">SMS Text Message</h3>
              <p className="text-xs text-slate-400">Direct, concise messages optimized for mobile delivery</p>
            </div>
          </div>
          <VariableDropdown size="sm" onInsert={handleInsertTag} />
        </div>

        <div className="field">
          <div className="flex items-center justify-between">
            <label>Message Content <b className="text-red-500">*</b></label>
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-mono font-bold ${charCount > 160 ? "text-amber-600" : "text-slate-600"}`}>
                {charCount} chars
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 font-semibold">
                {segments} {segments === 1 ? "segment" : "segments"}
              </span>
            </div>
          </div>
          <textarea
            required
            rows={7}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your SMS message here. Use variables like {{first_name}} to personalize..."
            className="sa-input text-sm leading-relaxed"
          />
        </div>

        {/* SMS Counter Info Box */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-950 space-y-2">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              <span>Standard GSM Delivery Info</span>
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {remainingInSegment} chars left in current segment
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Standard SMS messages fit within 160 characters. When exceeding 160 characters, carriers split the message into 153-character segments and charge per segment. Personalization variables will expand to the customer&apos;s actual data when sent.
          </p>
        </div>
      </div>

      {/* Right Column: SMS Phone Preview */}
      <div className="lg:col-span-5 flex justify-center">
        <div className="w-[330px] rounded-[36px] border-[10px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden">
          {/* Phone Speaker Notch */}
          <div className="flex justify-center py-2 bg-slate-900">
            <div className="h-4 w-24 rounded-full bg-slate-800"></div>
          </div>

          {/* SMS App Header */}
          <div className="bg-slate-100 px-4 py-3 text-slate-800 flex items-center gap-3 border-b border-slate-200">
            <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              M
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Marketing SMS</p>
              <p className="text-[10px] text-slate-400">SMS / MMS</p>
            </div>
          </div>

          {/* SMS Chat Area */}
          <div className="bg-white p-4 min-h-[380px] flex flex-col justify-end">
            <div className="text-center text-[10px] text-slate-400 font-semibold mb-3">
              Today 12:45 PM
            </div>

            {/* Message Bubble (iMessage / Android style) */}
            <div className="self-end max-w-[85%] rounded-2xl rounded-br-xs bg-blue-600 text-white p-3 shadow-xs text-xs space-y-1">
              <p className="leading-relaxed whitespace-pre-line break-words">
                {previewText}
              </p>
            </div>
            <span className="self-end text-[10px] text-slate-400 mt-1 mr-1">Delivered</span>
          </div>

          {/* Phone Bottom bar */}
          <div className="bg-slate-900 py-3 flex justify-center">
            <div className="h-1 w-28 rounded-full bg-slate-700"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
