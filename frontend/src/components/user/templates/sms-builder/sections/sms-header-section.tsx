"use client";

import React, { useState } from "react";
import {
  Type,
  Image as ImageIcon,
  Video,
  FileText,
  Ban,
  Upload,
  Trash2,
  ExternalLink,
  Info,
} from "lucide-react";
import { SmsHeaderType } from "../sms-types";
import { SmsMediaPickerModal } from "../sms-media-picker-modal";
import { VariableDropdown } from "../../email-builder/variable-dropdown";

interface SmsHeaderSectionProps {
  header?: string;
  headerType?: SmsHeaderType;
  mediaUrl?: string;
  mediaName?: string;
  onChange: (updates: {
    header?: string;
    headerType: SmsHeaderType;
    mediaUrl?: string;
    mediaName?: string;
  }) => void;
}

const HEADER_TYPES: {
  type: SmsHeaderType;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    type: "NONE",
    label: "None",
    icon: Ban,
    description: "No header content",
  },
  {
    type: "TEXT",
    label: "Text Header",
    icon: Type,
    description: "Short title (max 60 chars)",
  },
  {
    type: "IMAGE",
    label: "Image",
    icon: ImageIcon,
    description: "Visual banner (JPG, PNG)",
  },
  {
    type: "VIDEO",
    label: "Video",
    icon: Video,
    description: "Video clip (MP4, 3GP)",
  },
  {
    type: "DOCUMENT",
    label: "Document",
    icon: FileText,
    description: "PDF or document file",
  },
];

export function SmsHeaderSection({
  header = "",
  headerType,
  mediaUrl = "",
  mediaName = "",
  onChange,
}: SmsHeaderSectionProps) {
  const activeType: SmsHeaderType =
    headerType ||
    (mediaUrl ? "IMAGE" : header && header.trim().length > 0 ? "TEXT" : "NONE");

  const [modalMediaType, setModalMediaType] = useState<
    "IMAGE" | "VIDEO" | "DOCUMENT" | null
  >(null);

  const handleTypeSelect = (type: SmsHeaderType) => {
    if (type === "NONE") {
      onChange({ header: "", headerType: "NONE", mediaUrl: "", mediaName: "" });
    } else if (type === "TEXT") {
      onChange({ header: header || "", headerType: "TEXT", mediaUrl: "", mediaName: "" });
    } else {
      onChange({
        header: "",
        headerType: type,
        mediaUrl: mediaUrl || "",
        mediaName: mediaName || "",
      });
      if (!mediaUrl) {
        setModalMediaType(type);
      }
    }
  };

  const handleInsertTag = (tag: string) => {
    const current = header || "";
    if (current.length + tag.length > 60) return;
    const updated = current ? `${current} ${tag}` : tag;
    onChange({ header: updated, headerType: "TEXT" });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              Section B
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Optional
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Header Content & Media</h3>
          <p className="text-xs text-slate-500">
            Capture attention at the top of your SMS with a text title, promotional banner, or media attachment
          </p>
        </div>
      </div>

      {/* Segmented Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {HEADER_TYPES.map((item) => {
          const Icon = item.icon;
          const isSelected = activeType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => handleTypeSelect(item.type)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-xs ring-1 ring-indigo-600"
                  : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100/50"
              }`}
            >
              <Icon size={18} className={isSelected ? "text-indigo-600" : "text-slate-400"} />
              <span className="text-xs font-bold mt-1.5">{item.label}</span>
              <span className="text-[10px] text-slate-400 hidden sm:block mt-0.5 line-clamp-1">
                {item.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content depending on selected Header Type */}
      {activeType === "NONE" && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
          No header or media will be displayed above your SMS message.
        </div>
      )}

      {activeType === "TEXT" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Header Text</span>
              <span className="text-slate-400 font-normal text-[11px]">(up to 60 characters)</span>
            </label>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono ${
                  (header?.length || 0) > 60 ? "text-red-500 font-bold" : "text-slate-400"
                }`}
              >
                {header?.length || 0} / 60
              </span>
              <VariableDropdown size="sm" onInsert={handleInsertTag} />
            </div>
          </div>
          <input
            type="text"
            maxLength={60}
            value={header || ""}
            onChange={(e) =>
              onChange({
                header: e.target.value,
                headerType: "TEXT",
                mediaUrl: "",
                mediaName: "",
              })
            }
            placeholder="e.g. FLASH SALE: 24 HOURS ONLY"
            className="sa-input text-sm font-semibold py-2 px-3.5 w-full"
          />
          <p className="text-[11px] text-slate-400">
            Rendered as a prominent bold title at the very top of the SMS message bubble.
          </p>
        </div>
      )}

      {(activeType === "IMAGE" || activeType === "VIDEO" || activeType === "DOCUMENT") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {activeType === "IMAGE"
                ? "Promotional Image Header"
                : activeType === "VIDEO"
                ? "Promotional Video Header"
                : "Document Attachment"}
            </label>
            <span className="text-[11px] text-slate-400">
              {activeType === "IMAGE"
                ? "JPG, PNG, WEBP, GIF (max 5 MB)"
                : activeType === "VIDEO"
                ? "MP4, 3GP, MOV (max 16 MB)"
                : "PDF, DOCX, TXT, CSV (max 50 MB)"}
            </span>
          </div>

          {mediaUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {activeType === "IMAGE" ? (
                <div className="h-20 w-32 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white">
                  <img
                    src={mediaUrl}
                    alt="Header Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                  {activeType === "VIDEO" ? <Video size={24} /> : <FileText size={24} />}
                </div>
              )}

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {mediaName || mediaUrl.split("/").pop()}
                </p>
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-600 hover:underline flex items-center justify-center sm:justify-start gap-1 mt-0.5"
                >
                  <ExternalLink size={11} />
                  <span>View media link</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalMediaType(activeType)}
                  className="secondary-button text-xs px-3 py-1.5"
                >
                  Change Media
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      headerType: activeType,
                      mediaUrl: "",
                      mediaName: "",
                    })
                  }
                  className="icon-button text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Remove Media"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50/30 space-y-2">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-50 text-indigo-600">
                {activeType === "IMAGE" ? (
                  <ImageIcon size={20} />
                ) : activeType === "VIDEO" ? (
                  <Video size={20} />
                ) : (
                  <FileText size={20} />
                )}
              </div>
              <p className="text-xs font-semibold text-slate-700">
                No {activeType.toLowerCase()} selected yet
              </p>
              <p className="text-[11px] text-slate-400">
                Select from your existing Asset Library, upload from your device, or enter a direct URL.
              </p>
              <button
                type="button"
                onClick={() => setModalMediaType(activeType)}
                className="primary-button text-xs px-4 py-2 mt-2 !bg-indigo-600 hover:!bg-indigo-700 flex items-center gap-1.5"
              >
                <Upload size={14} />
                <span>Select / Upload {activeType}</span>
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5 text-indigo-500" />
            <p className="text-[11px] leading-relaxed">
              <strong>Promotional Media Delivery:</strong> Multimedia messages are preserved in template metadata and linked in outgoing SMS payloads for universal recipient access across standard carrier networks.
            </p>
          </div>
        </div>
      )}

      {/* Modal instance */}
      {modalMediaType && (
        <SmsMediaPickerModal
          mediaType={modalMediaType}
          onSelect={({ url, name }) => {
            onChange({
              headerType: modalMediaType,
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
