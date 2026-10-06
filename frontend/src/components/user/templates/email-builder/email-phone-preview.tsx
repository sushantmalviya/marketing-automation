"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Wifi,
  Signal,
  Battery,
  ChevronLeft,
  Archive,
  Trash2,
  Reply,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface EmailPhonePreviewProps {
  subject?: string;
  html: string;
  className?: string;
  senderName?: string;
  senderEmail?: string;
  recipientEmail?: string;
}

/**
 * Validates whether a URL is a valid HTTP or HTTPS address.
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

export function EmailPhonePreview({
  subject = "",
  html = "",
  className = "",
  senderName = "Marketing Team",
  senderEmail = "marketing@brand.com",
  recipientEmail = "alex.morgan@example.com",
}: EmailPhonePreviewProps) {
  const [currentTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  });

  const senderAvatarLetter = useMemo(() => {
    const trimmed = (senderName || "").trim();
    return trimmed.charAt(0).toUpperCase() || "M";
  }, [senderName]);

  // Listen for link click events dispatched from inside the sandboxed iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== "EMAIL_PREVIEW_LINK_CLICK") return;
      const rawUrl = String(event.data.url || "").trim();
      const label = String(event.data.label || "").trim();

      if (!rawUrl || rawUrl === "#" || rawUrl.toLowerCase().startsWith("javascript:")) {
        toast.info(
          label ? `No destination URL configured for "${label}".` : "No link destination configured."
        );
        return;
      }

      // Handle mailto: links
      if (/^mailto:/i.test(rawUrl)) {
        const emailAddr = rawUrl.replace(/^mailto:/i, "");
        toast.success(`Opening email client for ${emailAddr}...`);
        window.location.href = rawUrl;
        return;
      }

      // Handle tel: phone number links
      if (/^tel:/i.test(rawUrl)) {
        const phone = rawUrl.replace(/^tel:/i, "");
        toast.success(`Requesting phone dialer for ${phone}...`);
        window.location.href = rawUrl;
        return;
      }

      // Handle web URLs
      let targetUrl = rawUrl;
      if (!/^[a-zA-Z]+:\/\//.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      if (!isValidHttpUrl(targetUrl)) {
        toast.error(`Invalid URL "${rawUrl}". Only HTTP and HTTPS links are supported.`);
        return;
      }

      toast.success(
        label
          ? `Opening destination for "${label}": ${targetUrl}`
          : `Opening destination: ${targetUrl}`
      );
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const sanitizedHtml = useMemo(() => {
    const content =
      html && html.trim()
        ? html.trim()
        : "<div style='color:#94a3b8;font-size:13px;text-align:center;padding:50px 14px;font-family:sans-serif;'>No email content available.</div>";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <base target="_blank">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html {
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      color: #1e293b;
      overflow-x: hidden;
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    body {
      margin: 0;
      padding: 14px 12px 28px 12px;
      font-size: 14px;
      line-height: 1.5;
      min-height: 100%;
      word-break: break-word;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
      display: block;
    }
    table {
      max-width: 100% !important;
      width: 100% !important;
    }
    td, th {
      word-break: break-word;
    }
    a {
      color: #2563eb;
      cursor: pointer;
    }
    a[style*="background"], a[class*="btn"], a[class*="button"] {
      display: inline-block;
      text-decoration: none;
      cursor: pointer;
    }
    /* Modern slim scrollbar inside phone */
    ::-webkit-scrollbar {
      width: 4px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.5);
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(100, 116, 139, 0.75);
    }
  </style>
</head>
<body>
  ${content}

  <script>
    // Intercept clicks on links and buttons to dispatch to parent window safely
    document.addEventListener('click', function(e) {
      var anchor = e.target.closest('a');
      if (!anchor) return;
      e.preventDefault();
      e.stopPropagation();

      var href = anchor.getAttribute('href') || '';
      var label = (anchor.innerText || '').trim();
      if (!label && anchor.querySelector('img')) {
        label = anchor.querySelector('img').getAttribute('alt') || 'Linked Image';
      }
      if (!label) {
        label = anchor.getAttribute('title') || 'Button';
      }
      if (label.length > 25) {
        label = label.slice(0, 25) + '...';
      }

      window.parent.postMessage({
        type: 'EMAIL_PREVIEW_LINK_CLICK',
        url: href,
        label: label
      }, '*');
    }, true);
  </script>
</body>
</html>`;
  }, [html]);

  return (
    <div
      className={`flex flex-col items-center w-full max-w-[365px] min-w-[290px] sm:w-[365px] mx-auto select-none shrink-0 ${className}`}
    >
      {/* Device Frame matching WhatsApp preview dimensions & styling */}
      <div className="w-full rounded-[38px] border-[10px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden flex flex-col transition-all shrink-0">
        {/* Device Top Speaker & Status Notch */}
        <div className="relative bg-slate-900 pt-2 pb-1.5 px-5 flex items-center justify-between text-white text-[11px] font-semibold shrink-0">
          <span className="font-mono text-[11px] text-slate-300">{currentTime}</span>
          <div className="h-3.5 w-20 rounded-full bg-slate-800 flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-950 ml-auto mr-2"></div>
          </div>
          <div className="flex items-center gap-1 text-slate-300">
            <Signal size={11} />
            <Wifi size={11} />
            <Battery size={12} />
          </div>
        </div>

        {/* Mobile Mail App Navigation Bar */}
        <div className="bg-slate-100/95 dark:bg-slate-800/95 px-3.5 py-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 shrink-0">
          <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-xs cursor-default">
            <ChevronLeft size={16} />
            <span>Inbox</span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-400">
            <Archive size={13} className="hover:text-slate-600 transition" />
            <Trash2 size={13} className="hover:text-slate-600 transition" />
            <Reply size={13} className="hover:text-slate-600 transition" />
          </div>
        </div>

        {/* Email Header Card (Subject & Sender) */}
        <div className="bg-white border-b border-slate-100 px-3.5 py-2.5 shrink-0">
          <h4
            className="text-xs font-bold text-slate-900 leading-snug line-clamp-2"
            title={subject}
          >
            {subject.trim() || "(No Subject)"}
          </h4>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs">
              {senderAvatarLetter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold text-slate-800 truncate" title={senderName}>
                  {senderName}
                </p>
                <span className="text-[9px] text-slate-400 font-medium shrink-0">
                  {currentTime}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 truncate" title={recipientEmail}>
                To: {recipientEmail}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Email Screen Viewport: content scrolls vertically inside stationary frame */}
        <div className="relative w-full bg-white overflow-hidden shrink-0 h-[440px] sm:h-[460px]">
          <iframe
            srcDoc={sanitizedHtml}
            title="Mobile Email Preview"
            className="w-full h-full border-0 select-text block"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>

        {/* Phone Bottom Bar matching WhatsApp preview */}
        <div className="bg-slate-900 py-2.5 flex justify-center shrink-0">
          <div className="h-1 w-28 rounded-full bg-slate-700"></div>
        </div>
      </div>
    </div>
  );
}
