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
  Info,
} from "lucide-react";
import { SmsButton, SmsButtonType, SmsCta } from "../sms-types";

interface SmsCtaSectionProps {
  buttons?: SmsButton[];
  onChange?: (buttons: SmsButton[]) => void;
  onButtonsChange?: (buttons: SmsButton[]) => void;
  cta?: SmsCta;
  onCtaChange?: (cta?: SmsCta) => void;
}

const BUTTON_TYPE_CONFIG: Record<
  SmsButtonType,
  {
    label: string;
    icon: React.ElementType;
    defaultText: string;
    color: string;
    carrierNote: string;
  }
> = {
  COUPON_CODE: {
    label: "Copy Coupon Code",
    icon: Tag,
    defaultText: "Copy Offer Code",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    carrierNote: "Appears as a promo discount code in SMS",
  },
  URL: {
    label: "Visit Website URL",
    icon: Globe,
    defaultText: "Visit Website",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    carrierNote: "Appears as a clickable link in the SMS text",
  },
  PHONE_NUMBER: {
    label: "Call Phone Number",
    icon: Phone,
    defaultText: "Call Us",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    carrierNote: "Appears as a tap-to-call telephone link in SMS",
  },
  QUICK_REPLY: {
    label: "Quick Reply",
    icon: MessageCircle,
    defaultText: "Yes, I'm Interested",
    color: "text-violet-600 bg-violet-50 border-violet-200",
    carrierNote: 'Delivered as a keyword reply prompt (e.g. Reply "YES")',
  },
  BOOK_DEMO: {
    label: "Book a Demo",
    icon: Calendar,
    defaultText: "Book a Demo",
    color: "text-rose-600 bg-rose-50 border-rose-200",
    carrierNote: "Appears as a direct calendar booking link in SMS",
  },
};

export function SmsCtaSection({
  buttons = [],
  onChange,
  onButtonsChange,
  cta,
  onCtaChange,
}: SmsCtaSectionProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // If buttons is empty but cta is provided with enabled: true, initialize buttons from cta
  const activeButtons: SmsButton[] =
    buttons.length > 0
      ? buttons
      : cta && cta.enabled && cta.value
      ? [
          {
            id: "btn_cta_init",
            type:
              cta.type === "PHONE"
                ? "PHONE_NUMBER"
                : cta.type === "REPLY_KEYWORD"
                ? "QUICK_REPLY"
                : "URL",
            text:
              cta.label ||
              (cta.type === "PHONE"
                ? "Call Us"
                : cta.type === "REPLY_KEYWORD"
                ? "Reply"
                : "Visit Website"),
            url: cta.type === "URL" ? cta.value : undefined,
            phoneNumber: cta.type === "PHONE" ? cta.value : undefined,
          },
        ]
      : [];

  const handleButtonsUpdate = (newButtons: SmsButton[]) => {
    if (onButtonsChange) {
      onButtonsChange(newButtons);
    }
    if (onChange) {
      onChange(newButtons);
    }

    // Sync primary button to cta for backwards compatibility
    const ctaHandler = onCtaChange;
    if (ctaHandler) {
      if (newButtons.length > 0) {
        const first = newButtons[0];
        ctaHandler({
          enabled: true,
          type:
            first.type === "PHONE_NUMBER"
              ? "PHONE"
              : first.type === "QUICK_REPLY"
              ? "REPLY_KEYWORD"
              : "URL",
          label: first.text || "",
          value: first.url || first.phoneNumber || first.couponCode || first.text || "",
        });
      } else {
        ctaHandler({
          enabled: false,
          type: "URL",
          label: "",
          value: "",
        });
      }
    }
  };

  const handleAddButton = (type: SmsButtonType) => {
    if (activeButtons.length >= 10) return;

    const config = BUTTON_TYPE_CONFIG[type];
    const newBtn: SmsButton = {
      id: `btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      text: config.defaultText,
      url: type === "URL" || type === "BOOK_DEMO" ? "https://" : undefined,
      phoneNumber: type === "PHONE_NUMBER" ? "+1" : undefined,
      couponCode: type === "COUPON_CODE" ? "SAVE20" : undefined,
    };

    handleButtonsUpdate([...activeButtons, newBtn]);
    setDropdownOpen(false);
  };

  const handleUpdateButton = (id: string, updates: Partial<SmsButton>) => {
    const updated = activeButtons.map((b) => (b.id === id ? { ...b, ...updates } : b));
    handleButtonsUpdate(updated);
  };

  const handleRemoveButton = (id: string) => {
    const updated = activeButtons.filter((b) => b.id !== id);
    handleButtonsUpdate(updated);
  };

  const ctaCount = activeButtons.filter((b) => b.type !== "QUICK_REPLY").length;
  const quickReplyCount = activeButtons.filter((b) => b.type === "QUICK_REPLY").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Section D
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Optional
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Call-to-Action & Quick Replies</h3>
          <p className="text-xs text-slate-500">
            Guide customers with actionable buttons: visit links, copy coupons, call, or choose quick replies
          </p>
        </div>

        {/* Add Button Dropdown (Matches Image Reference) */}
        <div className="relative">
          <button
            type="button"
            disabled={activeButtons.length >= 10}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="primary-button text-xs px-4 py-2 !bg-blue-600 hover:!bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Plus size={15} />
            <span>Add Button</span>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-40 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Button Type
                </div>
                {(
                  [
                    "COUPON_CODE",
                    "URL",
                    "PHONE_NUMBER",
                    "QUICK_REPLY",
                    "BOOK_DEMO",
                  ] as SmsButtonType[]
                ).map((type) => {
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
      {activeButtons.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/30 space-y-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Plus size={20} />
          </div>
          <p className="text-xs font-semibold text-slate-700">No marketing buttons configured</p>
          <p className="text-[11px] text-slate-400 max-w-sm">
            Buttons dramatically improve engagement. Add a coupon code, website, phone number, or quick replies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeButtons.map((btn, index) => {
            const config = BUTTON_TYPE_CONFIG[btn.type] || BUTTON_TYPE_CONFIG.URL;
            const Icon = config.icon;

            return (
              <div
                key={btn.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 transition hover:border-slate-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">#{index + 1}</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${config.color}`}
                    >
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
                      <span
                        className={`text-[10px] font-mono ${
                          btn.text.length > 25 ? "text-red-500 font-bold" : "text-slate-400"
                        }`}
                      >
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
                        <span
                          className={`text-[10px] font-mono ${
                            (btn.couponCode?.length || 0) > 15 ? "text-red-500 font-bold" : "text-slate-400"
                          }`}
                        >
                          {btn.couponCode?.length || 0}/15
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={15}
                        value={btn.couponCode || ""}
                        onChange={(e) =>
                          handleUpdateButton(btn.id, { couponCode: e.target.value.toUpperCase() })
                        }
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
                        placeholder="https://yourbrand.com/offer"
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
                        <Info size={13} className="text-indigo-500 shrink-0" />
                        <span>Formatted as keyword prompt (e.g. Reply &quot;{btn.text || "KEYWORD"}&quot;)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Button Guidelines Note (Matches Image Reference) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 flex items-start gap-2">
        <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-700">SMS Button Guidelines</p>
          <p className="text-[11px] text-slate-500">
            SMS supports up to 10 total buttons. You currently have {activeButtons.length} configured ({ctaCount} action buttons, {quickReplyCount} quick replies).
          </p>
        </div>
      </div>
    </div>
  );
}
