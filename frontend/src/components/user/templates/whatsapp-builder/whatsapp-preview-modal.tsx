"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { X, MessageCircle, Edit3 } from "lucide-react";
import { WhatsAppPreview } from "./whatsapp-preview";
import { parseWhatsAppTemplate } from "./whatsapp-serializer";
import { WhatsAppTemplateData } from "./whatsapp-types";

interface WhatsAppPreviewModalProps {
  template: {
    id?: number;
    name: string;
    channel_name?: string;
    subject?: string;
    body: string;
  };
  onClose: () => void;
  onEdit?: () => void;
}

export function WhatsAppPreviewModal({
  template,
  onClose,
  onEdit,
}: WhatsAppPreviewModalProps) {
  // Parse template data with full support for new structured JSON and legacy text
  const data: WhatsAppTemplateData = useMemo(() => {
    const parsed = parseWhatsAppTemplate(template.subject, template.body);
    return {
      ...parsed,
      name: template.name || "WhatsApp Template",
    };
  }, [template.subject, template.body, template.name]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
              <MessageCircle size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate" title={template.name}>
                {template.name || "WhatsApp Template"}
              </h3>
              <p className="text-[11px] text-slate-400">
                Interactive preview with simulated customer view
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-700 hover:border-emerald-300 transition shadow-xs"
              >
                <Edit3 size={13} className="text-emerald-600" />
                <span>Edit</span>
              </button>
            )}
            <button
              type="button"
              className="icon-button text-slate-400 hover:text-slate-700"
              onClick={onClose}
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Centered Phone Mockup */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50 flex justify-center">
          <WhatsAppPreview data={data} />
        </div>
      </motion.div>
    </div>
  );
}
