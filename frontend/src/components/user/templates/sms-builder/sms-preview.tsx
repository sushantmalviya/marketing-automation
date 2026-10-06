"use client";

import React, { useState, useMemo } from "react";
import {
  ExternalLink,
  MessageSquare,
  Sparkles,
  Check,
  CheckCheck,
  Wifi,
  Signal,
  Battery,
  ChevronLeft,
  Info,
  Clock,
  Globe,
  Phone,
  Tag,
  Calendar,
  Image as ImageIcon,
  Play,
  FileText,
} from "lucide-react";
import { resolveApiUrl } from "@/services/api-client";
import { SmsTemplateData, SmsButton } from "./sms-types";
import {
  analyzeSmsText,
  renderSmsPreviewText,
  splitTextWithUrls,
} from "./sms-encoder";
import { compileSmsMessage } from "./sms-serializer";
import { toast } from "sonner";

interface SmsPreviewProps {
  data: SmsTemplateData;
  className?: string;
  senderName?: string;
  customSamples?: Record<string, string>;
}

export function SmsPreview({
  data,
  className = "",
  senderName,
  customSamples,
}: SmsPreviewProps) {
  const [useSampleData, setUseSampleData] = useState(true);
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Reset image error whenever mediaUrl changes
  React.useEffect(() => {
    setImageError(false);
  }, [data.mediaUrl]);

  // Resolve media URL (handles relative backend media paths e.g. /media/assets/...)
  const resolvedMediaUrl = useMemo(() => {
    if (!data.mediaUrl) return "";
    const trimmed = data.mediaUrl.trim().replace(/&amp;/g, "&");
    return resolveApiUrl(trimmed) || trimmed;
  }, [data.mediaUrl]);

  const [currentTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  });

  // Calculate full compiled message for live carrier character & segment analysis
  const compiledFullMessage = useMemo(() => {
    return compileSmsMessage(data);
  }, [data]);

  const analysis = useMemo(() => {
    return analyzeSmsText(compiledFullMessage);
  }, [compiledFullMessage]);

  // Resolve sample variables for Header
  const previewHeader = useMemo(() => {
    if (!data.header || !data.header.trim() || data.headerType === "NONE") return "";
    return renderSmsPreviewText(data.header.trim(), useSampleData, customSamples);
  }, [data.header, data.headerType, useSampleData, customSamples]);

  // Resolve sample variables for Body
  const previewBody = useMemo(() => {
    if (!data.body || !data.body.trim()) return "";
    return renderSmsPreviewText(data.body.trim(), useSampleData, customSamples);
  }, [data.body, useSampleData, customSamples]);

  // Resolve sample variables for Footer
  const previewFooter = useMemo(() => {
    if (!data.footer || !data.footer.trim()) return "";
    return renderSmsPreviewText(data.footer.trim(), useSampleData, customSamples);
  }, [data.footer, useSampleData, customSamples]);

  // Resolve sample variables for Buttons
  const previewButtons = useMemo(() => {
    if (!data.buttons || data.buttons.length === 0) return [];
    return data.buttons.map((btn) => ({
      ...btn,
      text: renderSmsPreviewText(btn.text || "", useSampleData, customSamples),
      url: btn.url ? renderSmsPreviewText(btn.url, useSampleData, customSamples) : undefined,
      phoneNumber: btn.phoneNumber
        ? renderSmsPreviewText(btn.phoneNumber, useSampleData, customSamples)
        : undefined,
      couponCode: btn.couponCode
        ? renderSmsPreviewText(btn.couponCode, useSampleData, customSamples)
        : undefined,
    }));
  }, [data.buttons, useSampleData, customSamples]);

  // Resolve sample variables for legacy CTA
  const previewCta = useMemo(() => {
    if (!data.cta || !data.cta.enabled || !data.cta.value || !data.cta.value.trim()) {
      return null;
    }
    const resolvedValue = renderSmsPreviewText(data.cta.value.trim(), useSampleData, customSamples);
    const resolvedLabel =
      data.cta.label && data.cta.label.trim()
        ? renderSmsPreviewText(data.cta.label.trim(), useSampleData, customSamples)
        : "";
    return {
      type: data.cta.type,
      label: resolvedLabel,
      value: resolvedValue,
    };
  }, [data.cta, useSampleData, customSamples]);

  const bodySegments = useMemo(() => {
    return splitTextWithUrls(previewBody);
  }, [previewBody]);

  const displayName = senderName || data.name.trim() || "Brand SMS";
  const avatarLetter = displayName.charAt(0).toUpperCase() || "S";

  const hasMedia = Boolean(
    resolvedMediaUrl &&
      data.headerType &&
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(data.headerType)
  );

  const hasAnyContent = Boolean(
    hasMedia ||
      previewHeader.trim() ||
      previewBody.trim() ||
      previewFooter.trim() ||
      previewButtons.length > 0 ||
      previewCta
  );

  const handleActionClick = (e: React.MouseEvent, btn: SmsButton) => {
    e.preventDefault();
    e.stopPropagation();

    if (btn.type === "URL" || btn.type === "BOOK_DEMO") {
      const url = btn.url || "";
      if (url.startsWith("http://") || url.startsWith("https://")) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.info(`Opening ${url || "website"}...`);
      }
    } else if (btn.type === "PHONE_NUMBER") {
      const cleanPhone = (btn.phoneNumber || "").replace(/[^\d+]/g, "");
      toast.success(`Requesting phone dialer for ${cleanPhone || "+1 (800) 555-0199"}...`);
    } else if (btn.type === "COUPON_CODE") {
      const code = btn.couponCode || "PROMO";
      navigator.clipboard?.writeText(code);
      setCopiedCouponId(btn.id);
      toast.success(`Coupon code "${code}" copied to clipboard!`);
      setTimeout(() => setCopiedCouponId(null), 2500);
    } else if (btn.type === "QUICK_REPLY") {
      toast.info(`Sends reply keyword "${btn.text || "REPLY"}" when tapped`);
    }
  };

  return (
    <div className={`flex flex-col items-center w-full max-w-[340px] sm:max-w-[360px] ${className}`}>
      {/* Sample Data Toggle Switch */}
      <div className="w-full flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Sparkles size={13} className="text-indigo-600" />
          <span>Preview Mode:</span>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setUseSampleData(true)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
              useSampleData
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sample Data
          </button>
          <button
            type="button"
            onClick={() => setUseSampleData(false)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
              !useSampleData
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Raw Variables
          </button>
        </div>
      </div>

      {/* Realistic Mobile Device Frame */}
      <div className="w-full rounded-[40px] border-[8px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden ring-1 ring-slate-800/80">
        {/* Device Top Speaker & Camera Notch */}
        <div className="relative bg-slate-900 pt-2 pb-1.5 px-6 flex items-center justify-between text-white text-[11px] font-semibold">
          <span className="font-mono text-xs">{currentTime}</span>
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-4 w-20 rounded-full bg-slate-800 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-slate-950/80 ml-auto mr-2"></div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Signal size={12} />
            <Wifi size={12} />
            <Battery size={13} />
          </div>
        </div>

        {/* Messaging App Top Navigation Bar */}
        <div className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center gap-1.5 text-blue-600 font-medium text-xs">
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Messages</span>
          </div>

          <div className="flex flex-col items-center min-w-0 px-2 flex-1">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {avatarLetter}
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[170px] mt-0.5">
              {displayName}
            </p>
            <span className="text-[10px] text-slate-500 font-medium">Text Message • SMS</span>
          </div>

          <button
            type="button"
            className="text-blue-600 p-1 rounded-full hover:bg-slate-200/60 transition"
            title="Conversation Details"
          >
            <Info size={16} />
          </button>
        </div>

        {/* SMS Chat Screen Body */}
        <div className="bg-slate-50 min-h-[360px] max-h-[460px] overflow-y-auto p-4 flex flex-col justify-between">
          <div>
            {/* Timestamp Divider */}
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-white/80 px-2.5 py-0.5 rounded-full shadow-2xs border border-slate-100">
                <Clock size={10} />
                Today {currentTime}
              </span>
            </div>

            {/* Outgoing Message Bubble */}
            {hasAnyContent ? (
              <div className="flex flex-col items-end space-y-1">
                <div className="max-w-[88%] rounded-2xl rounded-br-xs bg-gradient-to-br from-blue-600 to-blue-700 text-white p-3.5 shadow-md text-[13px] leading-relaxed break-words space-y-2">
                  {/* 1. Header: Media (Image, Video, Document) or Text Header */}
                  {data.headerType === "IMAGE" && resolvedMediaUrl && (
                    <div className="w-full rounded-xl overflow-hidden bg-blue-900/40 mb-2 border border-white/20 max-h-[200px] flex items-center justify-center">
                      {!imageError ? (
                        <img
                          src={resolvedMediaUrl}
                          alt={data.mediaName || "MMS Image"}
                          className="w-full h-auto max-h-[200px] object-cover rounded-xl"
                          loading="lazy"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <div className="w-full py-4 px-3 flex flex-col items-center justify-center bg-blue-900/30 text-blue-200 gap-1.5 rounded-xl border border-dashed border-blue-400/40">
                          <ImageIcon size={22} className="text-blue-200" />
                          <span className="text-[11px] font-medium text-white truncate max-w-[200px]">
                            {data.mediaName || "MMS Image"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {data.headerType === "VIDEO" && resolvedMediaUrl && (
                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center text-white mb-2 border border-white/20 relative">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-white/25 text-white backdrop-blur-xs shadow-md">
                        <Play size={18} className="ml-0.5 fill-white" />
                      </div>
                      {data.mediaName && (
                        <span className="absolute bottom-1.5 left-2 right-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/90 truncate text-center">
                          {data.mediaName}
                        </span>
                      )}
                    </div>
                  )}

                  {data.headerType === "DOCUMENT" && resolvedMediaUrl && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/15 border border-white/20 mb-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-amber-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate leading-tight">
                          {data.mediaName || "Attachment Document"}
                        </p>
                        <span className="text-[10px] text-blue-200 block truncate font-mono">
                          {data.mediaUrl}
                        </span>
                      </div>
                    </div>
                  )}

                  {(data.headerType === "TEXT" || !data.headerType) && previewHeader && (
                    <div className="pb-1.5 border-b border-blue-400/40">
                      <p className="font-bold text-xs tracking-wider text-white uppercase">
                        {previewHeader}
                      </p>
                    </div>
                  )}

                  {/* 2. Main Message Body */}
                  {previewBody && (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {bodySegments.map((seg, idx) => {
                        if (seg.isUrl) {
                          return (
                            <a
                              key={idx}
                              href={seg.text}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 underline font-semibold text-blue-100 hover:text-white hover:bg-blue-800/40 px-1 py-0.5 rounded transition break-all"
                              title={`Open ${seg.text}`}
                            >
                              <span>{seg.text}</span>
                              <ExternalLink size={11} className="shrink-0 opacity-80" />
                            </a>
                          );
                        }
                        return <span key={idx}>{seg.text}</span>;
                      })}
                    </div>
                  )}

                  {/* 3. Optional Footer */}
                  {previewFooter && (
                    <div className="pt-1.5 border-t border-blue-400/30">
                      <p className="text-[11px] text-blue-100/90 italic leading-snug">
                        {previewFooter}
                      </p>
                    </div>
                  )}

                  {/* 4. Supported Call-to-Action / Buttons (Rendered only when configured) */}
                  {previewButtons.length > 0 ? (
                    <div className="pt-2 border-t border-blue-400/40 space-y-1.5">
                      {previewButtons.map((btn) => {
                        const isCopied = copiedCouponId === btn.id;

                        if (btn.type === "URL" || btn.type === "BOOK_DEMO") {
                          const url = btn.url || "";
                          return (
                            <a
                              key={btn.id}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => handleActionClick(e, btn)}
                              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1.5 rounded-lg transition font-semibold text-xs shadow-2xs group cursor-pointer"
                              title={`Open ${url}`}
                            >
                              {btn.type === "BOOK_DEMO" ? (
                                <Calendar size={13} className="shrink-0 text-rose-200" />
                              ) : (
                                <Globe size={13} className="shrink-0 text-blue-100" />
                              )}
                              <span className="truncate">
                                {btn.text ? `${btn.text}: ${url}` : url}
                              </span>
                              <ExternalLink
                                size={11}
                                className="shrink-0 ml-auto opacity-70 group-hover:opacity-100"
                              />
                            </a>
                          );
                        }

                        if (btn.type === "PHONE_NUMBER") {
                          const phone = btn.phoneNumber || "";
                          return (
                            <a
                              key={btn.id}
                              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                              onClick={(e) => handleActionClick(e, btn)}
                              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1.5 rounded-lg transition font-semibold text-xs shadow-2xs cursor-pointer"
                              title={`Call ${phone}`}
                            >
                              <Phone size={13} className="shrink-0 text-emerald-200" />
                              <span className="truncate">
                                {btn.text ? `${btn.text}: ${phone}` : `Call: ${phone}`}
                              </span>
                            </a>
                          );
                        }

                        if (btn.type === "COUPON_CODE") {
                          const code = btn.couponCode || "PROMO";
                          return (
                            <button
                              key={btn.id}
                              type="button"
                              onClick={(e) => handleActionClick(e, btn)}
                              className="w-full flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1.5 rounded-lg transition font-semibold text-xs shadow-2xs cursor-pointer text-left"
                              title="Click to copy coupon code"
                            >
                              {isCopied ? (
                                <Check size={13} className="shrink-0 text-emerald-300" />
                              ) : (
                                <Tag size={13} className="shrink-0 text-amber-200" />
                              )}
                              <span className="truncate">
                                {isCopied
                                  ? "Copied!"
                                  : btn.text
                                  ? `${btn.text}: ${code}`
                                  : `Code: ${code}`}
                              </span>
                            </button>
                          );
                        }

                        if (btn.type === "QUICK_REPLY") {
                          return (
                            <div
                              key={btn.id}
                              onClick={(e) => handleActionClick(e, btn)}
                              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1.5 rounded-lg font-semibold text-xs shadow-2xs cursor-pointer"
                            >
                              <MessageSquare size={13} className="shrink-0 text-purple-200" />
                              <span className="truncate">
                                Reply "{btn.text || "YES"}"
                              </span>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  ) : previewCta ? (
                    <div className="pt-2 border-t border-blue-400/40">
                      {previewCta.type === "URL" && (
                        <a
                          href={previewCta.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1.5 rounded-lg transition font-semibold text-xs shadow-2xs group"
                          title={`Open ${previewCta.value}`}
                        >
                          <Globe size={13} className="shrink-0 text-blue-100" />
                          <span className="truncate">
                            {previewCta.label ? `${previewCta.label}: ${previewCta.value}` : previewCta.value}
                          </span>
                          <ExternalLink size={11} className="shrink-0 ml-auto opacity-70 group-hover:opacity-100" />
                        </a>
                      )}

                      {previewCta.type === "PHONE" && (
                        <a
                          href={`tel:${previewCta.value.replace(/[^\d+]/g, "")}`}
                          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1.5 rounded-lg transition font-semibold text-xs shadow-2xs"
                          title={`Call ${previewCta.value}`}
                        >
                          <Phone size={13} className="shrink-0 text-emerald-200" />
                          <span className="truncate">
                            {previewCta.label ? `${previewCta.label}: ${previewCta.value}` : `Call: ${previewCta.value}`}
                          </span>
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Delivery Receipt */}
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mr-1">
                  <span>Delivered</span>
                  <CheckCheck size={12} className="text-blue-500" />
                </div>
              </div>
            ) : (
              /* Empty State Placeholder */
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center mb-3 shadow-xs">
                  <MessageSquare size={22} />
                </div>
                <h4 className="text-xs font-bold text-slate-700">No message content yet</h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                  Start composing your SMS text on the left to see a live mobile preview here.
                </p>
              </div>
            )}
          </div>

          {/* Interactive Link Indicator */}
          {(bodySegments.some((s) => s.isUrl) ||
            previewButtons.length > 0 ||
            previewCta?.type === "URL" ||
            previewCta?.type === "PHONE") && (
            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1 text-blue-600 font-semibold">
                <ExternalLink size={10} /> Clickable link detected
              </span>
              <span className="text-slate-400">Recipients can tap to open</span>
            </div>
          )}
        </div>

        {/* Simulated Mobile Bottom Input Bar */}
        <div className="bg-slate-100 px-3 py-2 flex items-center gap-2 border-t border-slate-200">
          <div className="flex-1 rounded-full bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-400 flex items-center justify-between">
            <span className="text-[11px]">Text Message</span>
            <div className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              ↑
            </div>
          </div>
        </div>

        {/* Device Home Indicator Bar */}
        <div className="bg-slate-900 py-2.5 flex justify-center">
          <div className="h-1 w-28 rounded-full bg-slate-700"></div>
        </div>
      </div>
    </div>
  );
}
