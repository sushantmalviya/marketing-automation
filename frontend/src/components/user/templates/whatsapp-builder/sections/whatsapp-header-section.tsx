"use client";

import React, { useState } from "react";
import {
  Type,
  Image as ImageIcon,
  Video,
  FileText,
  Ban,
  Sparkles,
  Upload,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { WhatsAppHeader, WhatsAppHeaderType } from "../whatsapp-types";
import { WhatsAppMediaPickerModal } from "../whatsapp-media-picker-modal";
import { VariableDropdown } from "../../email-builder/variable-dropdown";

interface WhatsAppHeaderSectionProps {
  header: WhatsAppHeader;
  onChange: (header: WhatsAppHeader) => void;
}

const HEADER_TYPES: { type: WhatsAppHeaderType; label: string; icon: React.ElementType; description: string }[] = [
  { type: "NONE", label: "None", icon: Ban, description: "No header content" },
  { type: "TEXT", label: "Text", icon: Type, description: "Short text title (max 60 chars)" },
  { type: "IMAGE", label: "Image", icon: ImageIcon, description: "Visual banner (JPG, PNG, max 5MB)" },
  { type: "VIDEO", label: "Video", icon: Video, description: "Video clip (MP4, max 16MB)" },
  { type: "DOCUMENT", label: "Document", icon: FileText, description: "PDF or document file (max 100MB)" },
];

export function WhatsAppHeaderSection({ header, onChange }: WhatsAppHeaderSectionProps) {
  const [modalMediaType, setModalMediaType] = useState<"IMAGE" | "VIDEO" | "DOCUMENT" | null>(null);

  const handleTypeSelect = (type: WhatsAppHeaderType) => {
    onChange({
      ...header,
      type,
      text: type === "TEXT" ? header.text || "" : "",
      mediaUrl: type !== "TEXT" && type !== "NONE" ? header.mediaUrl || "" : "",
    });
  };

  const handleInsertTag = (tag: string) => {
    const current = header.text || "";
    if (current.length + tag.length > 60) return;
    onChange({
      ...header,
      text: `${current ? current + " " : ""}${tag}`,
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Section A</span>
          <h3 className="text-base font-bold text-slate-900">Header Content</h3>
          <p className="text-xs text-slate-500">
            Add an optional text title or rich media banner to capture attention at the top of your message
          </p>
        </div>
      </div>

      {/* Segmented Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {HEADER_TYPES.map((item) => {
          const Icon = item.icon;
          const isSelected = header.type === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => handleTypeSelect(item.type)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                isSelected
                  ? "border-emerald-600 bg-emerald-50/60 text-emerald-900 shadow-xs ring-1 ring-emerald-600"
                  : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100/50"
              }`}
            >
              <Icon size={18} className={isSelected ? "text-emerald-600" : "text-slate-400"} />
              <span className="text-xs font-bold mt-1.5">{item.label}</span>
              <span className="text-[10px] text-slate-400 hidden sm:block mt-0.5 line-clamp-1">{item.description}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Content by Type */}
      {header.type === "NONE" && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
          No header will be displayed above your WhatsApp message.
        </div>
      )}

      {header.type === "TEXT" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Header Text</span>
              <span className="text-slate-400 font-normal text-[11px]">(up to 60 characters)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono ${(header.text?.length || 0) > 60 ? "text-red-500 font-bold" : "text-slate-400"}`}>
                {header.text?.length || 0} / 60
              </span>
              <VariableDropdown size="sm" onInsert={handleInsertTag} />
            </div>
          </div>
          <input
            type="text"
            maxLength={60}
            value={header.text || ""}
            onChange={(e) => onChange({ ...header, text: e.target.value })}
            placeholder="e.g. Exclusive Weekend Deal Alert!"
            className="sa-input text-sm font-semibold py-2 px-3.5 w-full"
          />
          <p className="text-[11px] text-slate-400">
            Rendered as a prominent bold title at the very top of the WhatsApp message bubble.
          </p>
        </div>
      )}

      {(header.type === "IMAGE" || header.type === "VIDEO" || header.type === "DOCUMENT") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {header.type === "IMAGE" ? "Header Image" : header.type === "VIDEO" ? "Header Video" : "Header Document"}
            </label>
            <span className="text-[11px] text-slate-400">
              {header.type === "IMAGE"
                ? "JPG, PNG, WEBP (max 5 MB)"
                : header.type === "VIDEO"
                ? "MP4, 3GP (max 16 MB)"
                : "PDF, DOCX, TXT (max 100 MB)"}
            </span>
          </div>

          {header.mediaUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {header.type === "IMAGE" ? (
                <div className="h-20 w-32 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white">
                  <img
                    src={header.mediaUrl}
                    alt="Header Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  {header.type === "VIDEO" ? <Video size={24} /> : <FileText size={24} />}
                </div>
              )}

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {header.mediaName || header.mediaUrl.split("/").pop()}
                </p>
                <a
                  href={header.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-600 hover:underline flex items-center justify-center sm:justify-start gap-1 mt-0.5"
                >
                  <ExternalLink size={11} />
                  <span>View media link</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalMediaType(header.type as "IMAGE" | "VIDEO" | "DOCUMENT")}
                  className="secondary-button text-xs px-3 py-1.5"
                >
                  Change Media
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...header, mediaUrl: "", mediaName: "" })}
                  className="icon-button text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Remove Media"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50/30 space-y-2">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                {header.type === "IMAGE" ? (
                  <ImageIcon size={20} />
                ) : header.type === "VIDEO" ? (
                  <Video size={20} />
                ) : (
                  <FileText size={20} />
                )}
              </div>
              <p className="text-xs font-semibold text-slate-700">No {header.type.toLowerCase()} selected yet</p>
              <p className="text-[11px] text-slate-400">
                Select from your existing Asset Library, upload from your device, or enter a direct URL.
              </p>
              <button
                type="button"
                onClick={() => setModalMediaType(header.type as "IMAGE" | "VIDEO" | "DOCUMENT")}
                className="primary-button text-xs px-4 py-2 mt-2 !bg-emerald-600 hover:!bg-emerald-700 flex items-center gap-1.5"
              >
                <Upload size={14} />
                <span>Select / Upload {header.type}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal instance */}
      {modalMediaType && (
        <WhatsAppMediaPickerModal
          mediaType={modalMediaType}
          onSelect={({ url, name }) => {
            onChange({
              ...header,
              mediaUrl: url,
              mediaName: name,
            });
            setModalMediaType(null);
          }}
          onClose={() => setModalMediaType(null)}
        />
      )}
    </div>
  );
}
