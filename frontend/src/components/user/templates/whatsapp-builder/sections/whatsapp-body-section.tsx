"use client";

import React, { useState, useRef } from "react";
import {
  MessageSquare,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Sparkles,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { VariableDropdown } from "../../email-builder/variable-dropdown";

interface WhatsAppBodySectionProps {
  body: string;
  onChange: (body: string) => void;
}

export function WhatsAppBodySection({ body, onChange }: WhatsAppBodySectionProps) {
  const [showTips, setShowTips] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);

    let replacement = "";
    if (selectedText) {
      replacement = `${prefix}${selectedText}${suffix}`;
    } else {
      replacement = `${prefix}text${suffix}`;
    }

    const updated = body.substring(0, start) + replacement + body.substring(end);
    onChange(updated);

    // Reset selection focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText ? selectedText.length : 4)
      );
    }, 10);
  };

  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${body ? body + " " : ""}${tag}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = body.substring(0, start) + tag + body.substring(end);
    onChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 10);
  };

  const charCount = body.length;
  const isOverLimit = charCount > 1024;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Section B</span>
            <span className="text-red-500 font-bold">*</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Body Message</h3>
          <p className="text-xs text-slate-500">
            Write your primary WhatsApp marketing or notification message. Personalize with customer tokens.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <VariableDropdown size="sm" onInsert={handleInsertTag} />
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 border border-slate-200">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyFormatting("*")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition"
            title="Bold (*text*)"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("_")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition"
            title="Italic (_text_)"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("~")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition"
            title="Strikethrough (~text~)"
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("```")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs transition"
            title="Monospace (```code```)"
          >
            <Code size={14} />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1"></div>

          <span className="text-[11px] text-slate-400">Quick variables:</span>
          <button
            type="button"
            onClick={() => handleInsertTag("{{first_name}}")}
            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 transition"
          >
            {"{{first_name}}"}
          </button>
          <button
            type="button"
            onClick={() => handleInsertTag("{{company}}")}
            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 transition"
          >
            {"{{company}}"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1"
        >
          <Sparkles size={13} />
          <span>{showTips ? "Hide formatting" : "Formatting guide"}</span>
        </button>
      </div>

      {/* Formatting Tips Collapse */}
      {showTips && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white p-2 rounded-lg border border-emerald-100">
            <code className="text-emerald-700 font-bold">*bold*</code>
            <p className="text-[11px] text-slate-500 mt-0.5">Renders as <strong>bold</strong></p>
          </div>
          <div className="bg-white p-2 rounded-lg border border-emerald-100">
            <code className="text-emerald-700 font-bold">_italic_</code>
            <p className="text-[11px] text-slate-500 mt-0.5">Renders as <em>italic</em></p>
          </div>
          <div className="bg-white p-2 rounded-lg border border-emerald-100">
            <code className="text-emerald-700 font-bold">~strike~</code>
            <p className="text-[11px] text-slate-500 mt-0.5">Renders as <del>strike</del></p>
          </div>
          <div className="bg-white p-2 rounded-lg border border-emerald-100">
            <code className="text-emerald-700 font-bold">```code```</code>
            <p className="text-[11px] text-slate-500 mt-0.5">Renders as <code>mono</code></p>
          </div>
        </div>
      )}

      {/* Textarea Editor */}
      <div className="space-y-1.5">
        <textarea
          ref={textareaRef}
          rows={7}
          value={body}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Hello {{first_name}}!\n\nWe have exciting offers for you. Discover our latest products and exclusive deals today.\n\nVisit our website to explore more.`}
          className={`sa-input w-full text-sm leading-relaxed p-3.5 ${
            isOverLimit ? "border-red-500 focus:border-red-500" : ""
          }`}
        />

        <div className="flex items-center justify-between text-xs">
          <div>
            {!body.trim() ? (
              <span className="text-amber-600 flex items-center gap-1 text-[11px] font-medium">
                <AlertCircle size={12} />
                Message body is required
              </span>
            ) : isOverLimit ? (
              <span className="text-red-500 font-semibold text-[11px]">
                Exceeds maximum character limit of 1024
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">
                Line breaks and emojis supported
              </span>
            )}
          </div>

          <span
            className={`font-mono text-xs font-semibold ${
              isOverLimit ? "text-red-600 font-bold" : "text-slate-400"
            }`}
          >
            {charCount} / 1024
          </span>
        </div>
      </div>
    </div>
  );
}
