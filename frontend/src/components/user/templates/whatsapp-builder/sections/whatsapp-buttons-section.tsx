"use client";

import React, { useState } from "react";
import {
  Tag,
  Globe,
  Phone,
  MessageCircle,
  Calendar,
  Plus,
  Trash2,
  AlertCircle,
  Info,
} from "lucide-react";
import { WhatsAppButton, WhatsAppButtonType } from "../whatsapp-types";

interface WhatsAppButtonsSectionProps {
  buttons: WhatsAppButton[];
  onChange: (buttons: WhatsAppButton[]) => void;
}

const BUTTON_TYPE_CONFIG = {
  COUPON_CODE: {
    label: "Copy Coupon Code",
    icon: Tag,
    defaultText: "Copy Offer Code",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  URL: {
    label: "Visit Website URL",
    icon: Globe,
    defaultText: "Visit Website",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  PHONE_NUMBER: {
    label: "Call Phone Number",
    icon: Phone,
    defaultText: "Call Us",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  QUICK_REPLY: {
    label: "Quick Reply",
    icon: MessageCircle,
    defaultText: "Yes, I'm Interested",
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  BOOK_DEMO: {
    label: "Book a Demo",
    icon: Calendar,
    defaultText: "Book a Demo",
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
};

export function WhatsAppButtonsSection({ buttons, onChange }: WhatsAppButtonsSectionProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleAddButton = (type: WhatsAppButtonType) => {
    if (buttons.length >= 10) return;

    const config = BUTTON_TYPE_CONFIG[type];
    const newBtn: WhatsAppButton = {
      id: `btn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      text: config.defaultText,
      url: type === "URL" || type === "BOOK_DEMO" ? "https://" : undefined,
      phoneNumber: type === "PHONE_NUMBER" ? "+1" : undefined,
      couponCode: type === "COUPON_CODE" ? "SAVE20" : undefined,
    };

    onChange([...buttons, newBtn]);
    setDropdownOpen(false);
  };

  const handleUpdateButton = (id: string, updates: Partial<WhatsAppButton>) => {
    onChange(
      buttons.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const handleRemoveButton = (id: string) => {
    onChange(buttons.filter((b) => b.id !== id));
  };

  const ctaCount = buttons.filter((b) => b.type !== "QUICK_REPLY").length;
  const quickReplyCount = buttons.filter((b) => b.type === "QUICK_REPLY").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Section D</span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Call-to-Action & Quick Replies</h3>
          <p className="text-xs text-slate-500">
            Guide customers with actionable buttons: visit links, copy coupons, call, or choose quick replies
          </p>
        </div>

        {/* Add Button Dropdown */}
        <div className="relative">
          <button
            type="button"
            disabled={buttons.length >= 10}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="primary-button text-xs px-4 py-2 !bg-emerald-600 hover:!bg-emerald-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Plus size={15} />
            <span>Add Button ({buttons.length}/10)</span>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-40 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Button Type
                </div>
                {(Object.keys(BUTTON_TYPE_CONFIG) as WhatsAppButtonType[]).map((type) => {
                  const item = BUTTON_TYPE_CONFIG[type];
                  const Icon = item.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAddButton(type)}
                      className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition text-left"
                    >
                      <Icon size={15} className="text-emerald-600 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Buttons List */}
      {buttons.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/30 space-y-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Plus size={20} />
          </div>
          <p className="text-xs font-semibold text-slate-700">No marketing buttons configured</p>
          <p className="text-[11px] text-slate-400 max-w-sm">
            Buttons dramatically improve engagement. Add a coupon code, link to your website, phone number, or quick replies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {buttons.map((btn, index) => {
            const config = BUTTON_TYPE_CONFIG[btn.type];
            const Icon = config.icon;

            return (
              <div
                key={btn.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 transition hover:border-slate-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">#{index + 1}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${config.color}`}>
                      <Icon size={12} />
                      <span>{config.label}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveButton(btn.id)}
                    className="icon-button text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Remove button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Button Label Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Button Label
                      </label>
                      <span className={`text-[10px] font-mono ${btn.text.length > 25 ? "text-red-500 font-bold" : "text-slate-400"}`}>
                        {btn.text.length}/25
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={25}
                      value={btn.text}
                      onChange={(e) => handleUpdateButton(btn.id, { text: e.target.value })}
                      placeholder="e.g. Visit Website"
                      className="sa-input text-xs w-full py-1.5 font-medium"
                    />
                  </div>

                  {/* Type Specific Destination Input */}
                  {btn.type === "COUPON_CODE" && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Coupon Code
                        </label>
                        <span className={`text-[10px] font-mono ${(btn.couponCode?.length || 0) > 15 ? "text-red-500 font-bold" : "text-slate-400"}`}>
                          {btn.couponCode?.length || 0}/15
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={15}
                        value={btn.couponCode || ""}
                        onChange={(e) => handleUpdateButton(btn.id, { couponCode: e.target.value.toUpperCase() })}
                        placeholder="e.g. SUMMER50"
                        className="sa-input text-xs w-full py-1.5 font-mono uppercase"
                      />
                    </div>
                  )}

                  {(btn.type === "URL" || btn.type === "BOOK_DEMO") && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Destination URL
                        </label>
                        <span className="text-[10px] text-slate-400">HTTPS recommended</span>
                      </div>
                      <input
                        type="url"
                        value={btn.url || ""}
                        onChange={(e) => handleUpdateButton(btn.id, { url: e.target.value })}
                        placeholder="https://itsoftlab.com/"
                        className="sa-input text-xs w-full py-1.5 font-mono"
                      />
                    </div>
                  )}

                  {btn.type === "PHONE_NUMBER" && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Phone Number
                        </label>
                        <span className="text-[10px] text-slate-400">With country code</span>
                      </div>
                      <input
                        type="tel"
                        value={btn.phoneNumber || ""}
                        onChange={(e) => handleUpdateButton(btn.id, { phoneNumber: e.target.value })}
                        placeholder="+1 (555) 234-5678"
                        className="sa-input text-xs w-full py-1.5 font-mono"
                      />
                    </div>
                  )}

                  {btn.type === "QUICK_REPLY" && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Reply Behavior
                      </label>
                      <div className="text-xs text-slate-500 py-1.5 flex items-center gap-1.5">
                        <Info size={13} className="text-slate-400 shrink-0" />
                        <span>Sends this response immediately back to your business when tapped.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WhatsApp Guidance Note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 flex items-start gap-2">
        <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-700">WhatsApp Button Guidelines</p>
          <p className="text-[11px]">
            WhatsApp supports up to 10 total buttons. You currently have {buttons.length} configured ({ctaCount} action buttons, {quickReplyCount} quick replies).
          </p>
        </div>
      </div>
    </div>
  );
}
