"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  CheckCheck,
  Check,
  Phone,
  ExternalLink,
  Tag,
  MessageCircle,
  FileText,
  Play,
  RotateCcw,
  Calendar,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppTemplateData, WhatsAppButton } from "./whatsapp-types";
import { renderFormattedWhatsAppText } from "./whatsapp-serializer";
import { resolveApiUrl } from "@/services/api-client";

interface WhatsAppPreviewProps {
  data: WhatsAppTemplateData;
}

/**
 * Validates that a string has a valid http: or https: scheme.
 */
function isValidHttpUrl(urlStr: string): boolean {
  if (!urlStr || !urlStr.trim()) return false;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates that a string contains a plausible phone number with at least 5 digits.
 */
function isValidPhoneNumber(phoneStr: string): boolean {
  if (!phoneStr || !phoneStr.trim()) return false;
  const digits = phoneStr.replace(/\D/g, "");
  return digits.length >= 5;
}

export function WhatsAppPreview({ data }: WhatsAppPreviewProps) {
  const { header, body, footer, buttons } = data;

  // Track state for clickable CTA interactions
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);
  const [simulatedReply, setSimulatedReply] = useState<{
    id: string;
    text: string;
    time: string;
  } | null>(null);
  const [imageError, setImageError] = useState(false);

  // Reset image error whenever mediaUrl changes
  useEffect(() => {
    setImageError(false);
  }, [header?.mediaUrl]);

  // Resolve media URL (handles relative backend media paths e.g. /media/assets/...)
  const resolvedMediaUrl = useMemo(() => {
    if (!header?.mediaUrl) return "";
    const trimmed = header.mediaUrl.trim().replace(/&amp;/g, "&");
    return resolveApiUrl(trimmed) || trimmed;
  }, [header?.mediaUrl]);

  // Preview text preserves line breaks, paragraphs, emojis, and placeholders faithfully
  const previewText = body && body.trim()
    ? body.trim()
    : "Your WhatsApp message preview will appear here...";

  const headerText = header?.text ? header.text.trim() : "";

  // Separate Action buttons from Quick Replies case-insensitively
  const actionButtons = useMemo(() => {
    return (buttons || []).filter((b) => {
      if (!b) return false;
      const t = String(b.type || "").toUpperCase();
      return t !== "QUICK_REPLY";
    });
  }, [buttons]);

  const quickReplies = useMemo(() => {
    return (buttons || []).filter((b) => {
      if (!b) return false;
      const t = String(b.type || "").toUpperCase();
      return t === "QUICK_REPLY";
    });
  }, [buttons]);

  // Handle URL / Book Demo clicks
  const handleUrlClick = (e: React.MouseEvent, btn: WhatsAppButton) => {
    e.preventDefault();
    e.stopPropagation();
    const rawUrl = (btn.url || "").trim();

    if (!rawUrl) {
      toast.error(
        `Please configure a destination URL for "${btn.text || "this button"}" first.`
      );
      return;
    }

    if (!isValidHttpUrl(rawUrl)) {
      toast.error(
        `Invalid URL: "${rawUrl}". Only http:// and https:// URLs are supported.`
      );
      return;
    }

    window.open(rawUrl, "_blank", "noopener,noreferrer");
  };

  // Handle Phone Number click
  const handlePhoneClick = (e: React.MouseEvent, btn: WhatsAppButton) => {
    e.preventDefault();
    e.stopPropagation();
    const rawPhone = (btn.phoneNumber || "").trim();

    if (!rawPhone) {
      toast.error(
        `Please configure a phone number for "${btn.text || "this button"}" first.`
      );
      return;
    }

    if (!isValidPhoneNumber(rawPhone)) {
      toast.error(
        `Invalid phone number: "${rawPhone}". Please enter a valid phone number.`
      );
      return;
    }

    const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
    toast.success(`Requesting phone dialer for ${cleanPhone}...`);
    window.location.href = `tel:${cleanPhone}`;
  };

  // Handle Coupon Code click
  const handleCouponClick = async (e: React.MouseEvent, btn: WhatsAppButton) => {
    e.preventDefault();
    e.stopPropagation();
    const code = (btn.couponCode || "").trim();

    if (!code) {
      toast.error(
        `Please configure a coupon code for "${btn.text || "this button"}" first.`
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopiedCouponId(btn.id);
      toast.success(`Coupon code "${code}" copied to clipboard!`);
      setTimeout(() => {
        setCopiedCouponId((prev) => (prev === btn.id ? null : prev));
      }, 2500);
    } catch {
      toast.error(`Could not copy coupon code "${code}" to clipboard.`);
    }
  };

  // Dispatcher for action buttons
  const handleActionClick = (e: React.MouseEvent, btn: WhatsAppButton) => {
    const normType = String(btn.type || "").toUpperCase();
    switch (normType) {
      case "URL":
      case "BOOK_DEMO":
        handleUrlClick(e, btn);
        break;
      case "PHONE_NUMBER":
        handlePhoneClick(e, btn);
        break;
      case "COUPON_CODE":
        handleCouponClick(e, btn);
        break;
      default:
        if (btn.url) handleUrlClick(e, btn);
        else if (btn.phoneNumber) handlePhoneClick(e, btn);
        else if (btn.couponCode) handleCouponClick(e, btn);
        break;
    }
  };

  // Handle Quick Reply click
  const handleQuickReplyClick = (e: React.MouseEvent, btn: WhatsAppButton) => {
    e.preventDefault();
    e.stopPropagation();

    if (simulatedReply?.id === btn.id) {
      setSimulatedReply(null);
    } else {
      setSimulatedReply({
        id: btn.id,
        text: btn.text || "Quick Reply",
        time: "12:46 PM",
      });
    }
  };

  return (
    <div className="w-full max-w-[365px] min-w-[290px] sm:w-[365px] rounded-[38px] border-[10px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden flex flex-col transition-all">
      {/* Phone Speaker Notch */}
      <div className="flex justify-center py-2 bg-slate-900 shrink-0">
        <div className="h-4 w-24 rounded-full bg-slate-800"></div>
      </div>

      {/* WhatsApp Header */}
      <div className="bg-[#075e54] px-4 py-3 text-white flex items-center gap-3 shrink-0">
        <div className="h-8 w-8 rounded-full bg-emerald-100/30 flex items-center justify-center font-bold text-xs">
          WA
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">Marketing Assistant</p>
          <p className="text-[10px] text-emerald-200">online</p>
        </div>
      </div>

      {/* WhatsApp Chat Area: Scrollable container preserving full message and layout */}
      <div
        className="p-3.5 sm:p-4 min-h-[400px] max-h-[520px] overflow-y-auto flex flex-col scroll-smooth"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage: "radial-gradient(#d1d7db 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      >
        <div className="mt-auto w-full flex flex-col space-y-2">
          {/* Dynamic Chat Bubble */}
          <div className="relative self-start w-full max-w-[95%] rounded-2xl rounded-tl-xs bg-[#ffffff] p-3 shadow-xs text-xs text-slate-800 space-y-1.5">
            {/* Header Media / Text */}
            {header && header.type !== "NONE" && (
              <div>
                {header.type === "TEXT" && headerText && (
                  <p className="font-bold text-xs text-slate-900 pb-1 mb-1 border-b border-slate-100 leading-snug">
                    {headerText}
                  </p>
                )}

                {header.type === "IMAGE" && resolvedMediaUrl && (
                  <div className="w-full rounded-lg overflow-hidden bg-slate-100 mb-2 border border-slate-100 max-h-[200px] flex items-center justify-center">
                    {!imageError ? (
                      <img
                        src={resolvedMediaUrl}
                        alt={header.mediaName || "Header Banner"}
                        className="w-full h-auto max-h-[200px] object-contain rounded-lg"
                        loading="lazy"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="w-full py-5 px-3 flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-1.5 rounded-lg border border-dashed border-slate-200">
                        <ImageIcon size={22} className="text-slate-400" />
                        <span className="text-[11px] font-medium text-slate-500 truncate max-w-[200px]">
                          {header.mediaName || "Header Image"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {header.type === "VIDEO" && resolvedMediaUrl && (
                  <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center text-white mb-2 border border-slate-800">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur-xs">
                      <Play size={18} className="ml-0.5 fill-white" />
                    </div>
                  </div>
                )}

                {header.type === "DOCUMENT" && resolvedMediaUrl && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 mb-2">
                    <FileText size={16} className="text-blue-600 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-800 truncate">
                      {header.mediaName || "Attachment.pdf"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Body Text */}
            <div
              className="leading-relaxed break-words whitespace-pre-line"
              dangerouslySetInnerHTML={renderFormattedWhatsAppText(previewText)}
            />

            {/* Footer Text */}
            {footer && footer.trim() && (
              <p className="text-[10px] text-slate-400 italic pt-0.5 leading-snug">
                {footer.trim()}
              </p>
            )}

            {/* Timestamp and Checkmark */}
            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-0.5">
              <span>12:45 PM</span>
              <CheckCheck size={13} className="text-blue-500" />
            </div>

            {/* Interactive CTA Buttons (Rendered only when configured) */}
            {actionButtons.length > 0 && (
              <div className="border-t border-slate-100 divide-y divide-slate-100 -mx-3 -mb-3 mt-2 bg-slate-50/60 rounded-b-2xl overflow-hidden">
                {actionButtons.map((btn, idx) => {
                  const isCopied = copiedCouponId === btn.id;
                  const normType = String(btn.type || "URL").toUpperCase();
                  const actionTitle =
                    normType === "PHONE_NUMBER"
                      ? `Click to test call: ${btn.phoneNumber || "not set"}`
                      : normType === "COUPON_CODE"
                      ? `Click to copy coupon: ${btn.couponCode || "not set"}`
                      : normType === "BOOK_DEMO"
                      ? `Click to book demo: ${btn.url || "not set"}`
                      : `Click to visit: ${btn.url || "not set"}`;

                  return (
                    <button
                      key={btn.id || `act_btn_${idx}`}
                      type="button"
                      onClick={(e) => handleActionClick(e, btn)}
                      title={actionTitle}
                      aria-label={`${btn.text || "Action"}: ${actionTitle}`}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-[#00a884] hover:bg-slate-100/80 active:scale-[0.99] transition cursor-pointer select-none text-center outline-hidden"
                    >
                      {normType === "PHONE_NUMBER" && (
                        <Phone size={13} className="shrink-0" />
                      )}
                      {normType === "URL" && (
                        <ExternalLink size={13} className="shrink-0" />
                      )}
                      {normType === "BOOK_DEMO" && (
                        <Calendar size={13} className="shrink-0" />
                      )}
                      {normType === "COUPON_CODE" && (
                        isCopied ? (
                          <Check size={13} className="shrink-0 text-emerald-600" />
                        ) : (
                          <Tag size={13} className="shrink-0" />
                        )
                      )}
                      <span className="truncate">
                        {isCopied ? "Copied!" : btn.text || "Action"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Quick Replies (Rendered only when configured) */}
          {quickReplies.length > 0 && (
            <div className="flex flex-col gap-1.5 self-start w-full max-w-[95%] mt-2">
              {quickReplies.map((btn, idx) => {
                const isSelected = simulatedReply?.id === btn.id;
                return (
                  <button
                    key={btn.id || `qr_btn_${idx}`}
                    type="button"
                    onClick={(e) => handleQuickReplyClick(e, btn)}
                    title={
                      isSelected
                        ? "Click to remove simulated response"
                        : `Click to simulate reply "${btn.text || "Quick Reply"}"`
                    }
                    aria-label={`Quick reply: ${btn.text || "Quick Reply"}`}
                    className={`rounded-xl py-2 px-3 text-xs font-semibold transition text-center shadow-xs flex items-center justify-center gap-1.5 cursor-pointer outline-hidden active:scale-[0.99] ${
                      isSelected
                        ? "bg-emerald-600 text-white border border-emerald-600 shadow-sm"
                        : "bg-white border border-slate-200 text-[#00a884] hover:border-emerald-300"
                    }`}
                  >
                    <MessageCircle
                      size={13}
                      className={isSelected ? "text-white" : "text-[#00a884]"}
                    />
                    <span className="truncate">{btn.text || "Quick Reply"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Simulated Customer Outgoing Quick Reply Bubble */}
          {simulatedReply && (
            <div className="relative self-end max-w-[85%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] p-2.5 px-3 text-xs text-slate-800 shadow-xs border border-emerald-200/60 mt-2 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <p className="leading-snug break-words">{simulatedReply.text}</p>
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
                <span>{simulatedReply.time}</span>
                <CheckCheck size={12} className="text-blue-500" />
              </div>
            </div>
          )}

          {/* Reset Simulated Quick Reply Action */}
          {simulatedReply && (
            <div className="flex justify-center pt-1.5">
              <button
                type="button"
                onClick={() => setSimulatedReply(null)}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-white/90 hover:bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-xs transition"
              >
                <RotateCcw size={10} />
                <span>Reset simulated reply</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Phone Bottom bar */}
      <div className="bg-slate-900 py-3 flex justify-center shrink-0">
        <div className="h-1 w-28 rounded-full bg-slate-700"></div>
      </div>
    </div>
  );
}
