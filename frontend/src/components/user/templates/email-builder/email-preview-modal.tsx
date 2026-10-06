"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Monitor, Smartphone, Sparkles, Mail, CheckCircle2 } from "lucide-react";
import { EmailBlock } from "../types";
import { serializeBlocksToHtml } from "../html-serializer";
import { EmailPhonePreview } from "./email-phone-preview";

interface EmailPreviewModalProps {
  subject: string;
  blocks: EmailBlock[];
  onClose: () => void;
}

const SAMPLE_DATA: Record<string, string> = {
  first_name: "Alex",
  last_name: "Morgan",
  name: "Alex Morgan",
  email: "alex.morgan@example.com",
  phone: "+1 (555) 234-5678",
  company: "Acme Innovations",
  city: "San Francisco",
};

export function EmailPreviewModal({ subject, blocks, onClose }: EmailPreviewModalProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const [useSampleData, setUseSampleData] = useState(true);

  // Generate HTML and optionally replace sample variables
  let renderedSubject = subject || "(No subject provided)";
  let rawHtml = serializeBlocksToHtml(blocks);

  if (useSampleData) {
    for (const [key, val] of Object.entries(SAMPLE_DATA)) {
      const reg = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      renderedSubject = renderedSubject.replace(reg, val);
      rawHtml = rawHtml.replace(reg, val);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Mail size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Email Preview</h3>
              <p className="text-xs text-slate-400">See how your email renders across clients</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Device Switcher */}
            <div className="flex items-center gap-1 rounded-xl bg-white p-1 border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  device === "mobile"
                    ? "bg-blue-50 text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Smartphone size={14} />
                <span>Mobile</span>
              </button>
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  device === "desktop"
                    ? "bg-blue-50 text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Monitor size={14} />
                <span>Desktop</span>
              </button>
            </div>

            {/* Sample Data Toggle */}
            <button
              type="button"
              onClick={() => setUseSampleData(!useSampleData)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                useSampleData
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Sparkles size={13} className={useSampleData ? "text-emerald-600" : "text-slate-400"} />
              <span>{useSampleData ? "Sample Data: ON" : "Sample Data: OFF"}</span>
            </button>

            <button className="icon-button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Email Header Simulation (Desktop Only) */}
        {device === "desktop" && (
          <div className="border-b border-slate-100 bg-white px-6 py-3 space-y-1.5 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-400 w-16">Subject:</span>
              <span className="font-bold text-slate-900 text-sm">{renderedSubject}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span className="font-semibold text-slate-400 w-16">To:</span>
              <span>{useSampleData ? "Alex Morgan <alex.morgan@example.com>" : "customer@example.com"}</span>
            </div>
          </div>
        )}

        {/* Email Preview Frame */}
        <div className="flex-1 bg-slate-100/80 p-4 sm:p-6 overflow-y-auto flex justify-center items-center">
          {device === "mobile" ? (
            <div className="w-full flex justify-center py-2 shrink-0">
              <EmailPhonePreview
                subject={renderedSubject}
                html={rawHtml}
                recipientEmail={useSampleData ? "alex.morgan@example.com" : "customer@example.com"}
              />
            </div>
          ) : (
            <div
              style={{
                width: "680px",
                maxWidth: "100%",
                transition: "width 0.25s ease-in-out",
              }}
              className="overflow-hidden bg-white shadow-xl rounded-xl border border-slate-200 my-auto shrink-0"
            >
              <iframe
                srcDoc={rawHtml}
                title="Rendered Email Preview"
                className="w-full min-h-[580px] border-0 block"
                sandbox="allow-same-origin allow-popups"
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
