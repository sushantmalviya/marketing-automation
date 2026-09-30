"use client";

import React, { useState } from "react";
import { MessageCircle, Sparkles, CheckCheck, HelpCircle } from "lucide-react";
import { VariableDropdown } from "../email-builder/variable-dropdown";

interface WhatsAppEditorProps {
  value: string;
  onChange: (val: string) => void;
}

export function WhatsAppEditor({ value, onChange }: WhatsAppEditorProps) {
  const [showHelp, setShowHelp] = useState(false);

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
    : "Your WhatsApp message preview will appear here...";

  // Simple WhatsApp markdown formatting renderer: *bold*, _italic_, ~strike~
  const renderFormattedPreview = (text: string) => {
    // Escape HTML first
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // *bold*
    escaped = escaped.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
    // _italic_
    escaped = escaped.replace(/_(.*?)_/g, "<em>$1</em>");
    // ~strike~
    escaped = escaped.replace(/~(.*?)~/g, "<del>$1</del>");
    // \n to br
    escaped = escaped.replace(/\n/g, "<br />");

    return { __html: escaped };
  };

  const handleInsertTag = (tag: string) => {
    onChange(`${value ? value + " " : ""}${tag}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Edit Column */}
      <div className="lg:col-span-7 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <MessageCircle size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">WhatsApp Message Content</h3>
              <p className="text-xs text-slate-400">Compose your verified or promotional WhatsApp text</p>
            </div>
          </div>
          <VariableDropdown size="sm" onInsert={handleInsertTag} />
        </div>

        <div className="field">
          <div className="flex items-center justify-between">
            <label>Message Body <b className="text-red-500">*</b></label>
            <span className="text-xs text-slate-400 font-mono">
              {value.length} characters
            </span>
          </div>
          <textarea
            required
            rows={8}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your WhatsApp message here. Use *bold*, _italic_, or variables like {{first_name}}..."
            className="sa-input text-sm leading-relaxed"
          />
        </div>

        {/* WhatsApp Formatting Helper */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-xs text-emerald-900 space-y-2">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-600" />
              <span>WhatsApp Formatting & Personalization</span>
            </span>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-[11px] text-emerald-700 underline"
            >
              {showHelp ? "Hide tips" : "View formatting"}
            </button>
          </div>
          {showHelp && (
            <div className="pt-2 grid grid-cols-2 gap-2 text-slate-600">
              <div className="bg-white/80 p-2 rounded border border-emerald-200">
                <code className="text-emerald-700 font-bold">*bold text*</code> → <strong>bold text</strong>
              </div>
              <div className="bg-white/80 p-2 rounded border border-emerald-200">
                <code className="text-emerald-700 font-bold">_italic text_</code> → <em>italic text</em>
              </div>
              <div className="bg-white/80 p-2 rounded border border-emerald-200">
                <code className="text-emerald-700 font-bold">~strike text~</code> → <del>strike text</del>
              </div>
              <div className="bg-white/80 p-2 rounded border border-emerald-200">
                <code className="text-emerald-700 font-bold">{"{{first_name}}"}</code> → Customer name
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Simulated WhatsApp Mobile Phone Preview */}
      <div className="lg:col-span-5 flex justify-center">
        <div className="w-[330px] rounded-[36px] border-[10px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden">
          {/* Phone Speaker Notch */}
          <div className="flex justify-center py-2 bg-slate-900">
            <div className="h-4 w-24 rounded-full bg-slate-800"></div>
          </div>

          {/* WhatsApp Header */}
          <div className="bg-[#075e54] px-4 py-3 text-white flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100/30 flex items-center justify-center font-bold text-xs">
              WA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Marketing Assistant</p>
              <p className="text-[10px] text-emerald-200">online</p>
            </div>
          </div>

          {/* WhatsApp Chat Area */}
          <div
            className="p-4 min-h-[380px] flex flex-col justify-end"
            style={{
              backgroundColor: "#efeae2",
              backgroundImage:
                "radial-gradient(#d1d7db 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          >
            {/* Chat Bubble */}
            <div className="relative self-start max-w-[90%] rounded-2xl rounded-tl-xs bg-[#ffffff] p-3 shadow-xs text-xs text-slate-800 space-y-1">
              <div
                className="leading-relaxed break-words"
                dangerouslySetInnerHTML={renderFormattedPreview(previewText)}
              />
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-0.5">
                <span>12:45 PM</span>
                <CheckCheck size={13} className="text-blue-500" />
              </div>
            </div>
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
