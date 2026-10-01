"use client";

import React, { useState, useRef } from "react";
import {
  MessageSquare,
  Sparkles,
  Link as LinkIcon,
  Smile,
  BookOpen,
  AlertCircle,
  Copy,
  Check,
  X,
  Plus,
  Bold,
  Italic,
  Strikethrough,
  Code,
} from "lucide-react";
import { VariableDropdown } from "../../email-builder/variable-dropdown";
import { SMS_PRESET_EXAMPLES, SmsPresetExample } from "../sms-types";
import { toast } from "sonner";

interface SmsComposerSectionProps {
  body: string;
  footer?: string;
  onChange?: (body: string) => void;
  onBodyChange?: (body: string) => void;
  onFooterChange?: (footer: string) => void;
  onApplyPreset?: (preset: SmsPresetExample) => void;
}

const COMMON_SMS_EMOJIS = [
  "🔥", "⚡", "🎁", "🎉", "🛒", "📢", "⏰", "📍", "💳", "✅", "🔔", "🏷️", "🚀", "💬"
];

const COMMON_FOOTER_PRESETS = [
  "Reply STOP to opt out",
  "Reply STOP to unsubscribe",
  "Text HELP for info, STOP to end",
  "Opt-out: reply STOP",
];

export function SmsComposerSection({
  body,
  footer = "",
  onChange,
  onBodyChange,
  onFooterChange,
  onApplyPreset,
}: SmsComposerSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showFooterInput, setShowFooterInput] = useState(() => Boolean(footer && footer.trim().length > 0));

  const handleBodyChange = (newBody: string) => {
    if (onBodyChange) {
      onBodyChange(newBody);
    } else if (onChange) {
      onChange(newBody);
    }
  };

  /**
   * Applies inline formatting (bold, italic, strikethrough, monospace)
   */
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
    handleBodyChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText ? selectedText.length : 4)
      );
    }, 10);
  };

  /**
   * Inserts text at the current cursor position in the textarea
   */
  const insertAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleBodyChange(body ? `${body} ${textToInsert}` : textToInsert);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = body.substring(0, start);
    const after = body.substring(end);

    // Add smart spacing around inserted token if needed
    const needsLeadingSpace = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
    const formattedInsert = `${needsLeadingSpace ? " " : ""}${textToInsert}`;

    const updated = before + formattedInsert + after;
    handleBodyChange(updated);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + formattedInsert.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  /**
   * Handles inserting a personalization variable tag
   */
  const handleInsertTag = (tag: string) => {
    insertAtCursor(tag);
  };

  /**
   * Handles inserting an emoji
   */
  const handleInsertEmoji = (emoji: string) => {
    insertAtCursor(emoji);
  };

  /**
   * Handles inserting a website link
   */
  const handleInsertUrl = (e: React.FormEvent) => {
    e.preventDefault();
    let url = urlInput.trim();
    if (!url) {
      toast.error("Please enter a valid website URL");
      return;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    insertAtCursor(url);
    setUrlInput("");
    setShowUrlModal(false);
    toast.success("Website URL inserted into message");
  };

  /**
   * Loads a preset example
   */
  const handleSelectPreset = (preset: SmsPresetExample) => {
    if (body.trim() && body.trim() !== preset.body.trim()) {
      if (!confirm("Replace current message text with this preset template?")) {
        return;
      }
    }
    handleBodyChange(preset.body);
    if (onApplyPreset) {
      onApplyPreset(preset);
    }
    setShowPresetsModal(false);
    toast.success(`Loaded "${preset.title}" template`);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <MessageSquare size={17} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Section C
              </span>
              <span className="text-red-500 font-bold">*</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">Message Body and Footer Text</h3>
            <p className="text-xs text-slate-500">
              Primary SMS message with personalized tokens, plus an optional opt-out or compliance footer
            </p>
          </div>
        </div>

        {/* Action Helpers */}
        <div className="flex items-center gap-2">
          {/* Preset Templates Library Button */}
          <button
            type="button"
            onClick={() => setShowPresetsModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition shadow-2xs"
          >
            <BookOpen size={13} className="text-indigo-600" />
            <span>Load Preset</span>
          </button>

          {/* Personalization Dropdown */}
          <VariableDropdown size="sm" onInsert={handleInsertTag} />
        </div>
      </div>

      {/* Editing Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2 border border-slate-200">
        <div className="flex flex-wrap items-center gap-1">
          {/* Text Formatting Tools */}
          <button
            type="button"
            onClick={() => applyFormatting("*")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition"
            title="Bold (*text*)"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("_")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition"
            title="Italic (_text_)"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("~")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition"
            title="Strikethrough (~text~)"
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyFormatting("```")}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition"
            title="Monospace (```code```)"
          >
            <Code size={14} />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Insert URL Button */}
          <button
            type="button"
            onClick={() => setShowUrlModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-2xs transition"
            title="Insert a website URL into your message"
          >
            <LinkIcon size={13} className="text-indigo-600" />
            <span>Link</span>
          </button>

          {/* Quick Emoji Picker Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-2xs transition"
              title="Add emojis to SMS message"
            >
              <Smile size={13} className="text-amber-500" />
              <span>Emojis</span>
            </button>

            {/* Quick Emoji Dropdown */}
            {showEmojiPicker && (
              <div className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase">
                  <span>Common SMS Emojis</span>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {COMMON_SMS_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        handleInsertEmoji(em);
                        setShowEmojiPicker(false);
                      }}
                      className="h-7 w-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-sm transition"
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-purple-600 mt-2 italic text-center">
                  Note: Emojis use Unicode (UCS-2) encoding
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Clear Content Button */}

        {/* Clear Content Button */}
        {body.trim() && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all message text?")) {
                handleBodyChange("");
              }
            }}
            className="text-[11px] text-slate-400 hover:text-red-600 transition"
          >
            Clear text
          </button>
        )}
      </div>

      {/* Message Textarea */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
          <span>Main Message Body</span>
          <span className="text-red-500">*</span>
        </label>
        <textarea
          ref={textareaRef}
          rows={6}
          required
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder="Hi {{first_name}}, we're having a special sale at {{company}}! Enjoy 20% off with promo code SAVE20. Shop our collection now: https://yourbrand.com/sale"
          className={`sa-input w-full text-sm leading-relaxed p-3.5 ${
            !body.trim() ? "focus:border-indigo-500" : ""
          }`}
        />

        <div className="flex items-center justify-between text-xs">
          <div>
            {!body.trim() ? (
              <span className="text-amber-600 flex items-center gap-1 text-[11px] font-medium">
                <AlertCircle size={12} />
                Message body content is required for SMS delivery
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Preserves exact spaces, line breaks, emojis, and URLs
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            Insert placeholders anywhere in text
          </span>
        </div>
      </div>

      {/* Optional Footer Subsection */}
      <div className="pt-4 border-t border-slate-200/90 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Message Footer
              </span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                Optional
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Compliance, opt-out notice, or signature displayed after the message body
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showFooterInput) {
                if (onFooterChange) onFooterChange("");
                setShowFooterInput(false);
              } else {
                setShowFooterInput(true);
                if (onFooterChange && !footer) {
                  onFooterChange("Reply STOP to opt out");
                }
              }
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              showFooterInput
                ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
            }`}
          >
            {showFooterInput ? (
              <>
                <X size={12} />
                <span>Remove Footer</span>
              </>
            ) : (
              <>
                <Plus size={12} />
                <span>Add Footer</span>
              </>
            )}
          </button>
        </div>

        {showFooterInput ? (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            <div className="relative">
              <input
                type="text"
                value={footer}
                onChange={(e) => onFooterChange && onFooterChange(e.target.value)}
                placeholder="e.g. Reply STOP to opt out"
                maxLength={80}
                className="sa-input w-full text-xs font-medium py-2 px-3 pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                {footer.length}/80
              </span>
            </div>

            {/* Quick footer presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400">Quick suggestions:</span>
              {COMMON_FOOTER_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onFooterChange && onFooterChange(p)}
                  className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 px-2 py-0.5 rounded-md transition"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            onClick={() => {
              setShowFooterInput(true);
              if (onFooterChange && !footer) {
                onFooterChange("Reply STOP to opt out");
              }
            }}
            className="border border-dashed border-slate-200 rounded-xl p-2.5 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition group"
          >
            <p className="text-[11px] font-semibold text-slate-400 group-hover:text-indigo-600 flex items-center justify-center gap-1">
              <Plus size={12} />
              <span>Click to add an opt-out or compliance footer (e.g. Reply STOP to opt out)</span>
            </p>
          </div>
        )}
      </div>

      {/* Insert URL Popover Modal */}
      {showUrlModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-2xs"
          onClick={() => setShowUrlModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <LinkIcon size={16} />
                </span>
                <h4 className="text-sm font-bold text-slate-900">Insert Website URL</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowUrlModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleInsertUrl} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Website URL or Link Target
                </label>
                <input
                  type="text"
                  autoFocus
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/summer-sale"
                  className="sa-input w-full text-sm py-2 px-3"
                />
                <p className="text-[11px] text-slate-400">
                  The link will be inserted directly into the SMS text body at your cursor position
                </p>
              </div>

              {/* Quick URL Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Quick URL templates:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "https://example.com/shop",
                    "https://example.com/track",
                    "https://example.com/confirm",
                    "https://example.com/deals",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setUrlInput(sug)}
                      className="text-[11px] text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 px-2 py-0.5 rounded font-mono transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
                >
                  <Plus size={14} />
                  <span>Insert Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preset Templates Library Modal */}
      {showPresetsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-2xs"
          onClick={() => setShowPresetsModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <BookOpen size={16} />
                </span>
                <div>
                  <h4 className="text-base font-bold text-slate-900">SMS Template Library</h4>
                  <p className="text-xs text-slate-400">Select a pre-made template to kickstart your message</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SMS_PRESET_EXAMPLES.map((preset) => (
                <div
                  key={preset.title}
                  onClick={() => handleSelectPreset(preset)}
                  className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {preset.category}
                      </span>
                      <span className="text-[11px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                        Use Template →
                      </span>
                    </div>
                    <h5 className="font-bold text-sm text-slate-900">{preset.title}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2.5 font-mono line-clamp-3">
                      {preset.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
