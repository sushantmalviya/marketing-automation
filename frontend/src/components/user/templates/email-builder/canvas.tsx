"use client";

import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { EmailBlock } from "../types";
import { SortableBlock } from "./sortable-block";
import { serializeBlocksToHtml } from "../html-serializer";
import {
  Monitor,
  Smartphone,
  Layers,
  RotateCcw,
  Edit3,
  Eye,
  Sparkles,
} from "lucide-react";

interface CanvasProps {
  blocks: EmailBlock[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onResetDefault: () => void;
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

export function Canvas({
  blocks,
  activeId,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
  onResetDefault,
}: CanvasProps) {
  const [deviceView, setDeviceView] = useState<"desktop" | "mobile">("desktop");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [useSampleData, setUseSampleData] = useState(true);

  const { setNodeRef, isOver } = useDroppable({
    id: "canvas",
  });

  // Generate preview HTML
  let previewHtml = serializeBlocksToHtml(blocks);
  if (useSampleData) {
    for (const [key, val] of Object.entries(SAMPLE_DATA)) {
      const reg = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      previewHtml = previewHtml.replace(reg, val);
    }
  }

  return (
    <div
      className="flex-1 min-w-0 min-h-0 h-full flex flex-col items-center bg-slate-100/70 p-4 sm:p-6 overflow-hidden select-none"
      onClick={() => onSelect(null)}
    >
      {/* Top Canvas Toolbar: Mode Switch + Device Switch + Reset */}
      <div
        style={{
          width: deviceView === "desktop" ? "600px" : "375px",
          maxWidth: "100%",
          transition: "width 0.25s ease-in-out",
        }}
        className="w-full mb-3 shrink-0 flex flex-wrap items-center justify-between gap-2.5"
      >
        {/* Edit / Preview Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMode("edit");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === "edit"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Edit3 size={13} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMode("preview");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === "preview"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
        </div>

        {/* Device Switcher (Desktop 600px / Mobile 375px) */}
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeviceView("desktop");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              deviceView === "desktop"
                ? "bg-slate-100 text-slate-900 font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Monitor size={14} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeviceView("mobile");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              deviceView === "mobile"
                ? "bg-slate-100 text-slate-900 font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Smartphone size={14} />
            <span>Mobile</span>
          </button>
        </div>

        {/* Right Tools: Sample Data Toggle & Reset */}
        <div className="flex items-center gap-2">
          {mode === "preview" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUseSampleData(!useSampleData);
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition ${
                useSampleData
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-medium"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Sparkles size={12} className={useSampleData ? "text-emerald-600" : "text-slate-400"} />
              <span>{useSampleData ? "Sample: ON" : "Sample: OFF"}</span>
            </button>
          )}

          {mode === "edit" && (
            <button
              type="button"
              title="Reset to starter layout"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Reset canvas to default starter template? Current blocks will be replaced.")) {
                  onResetDefault();
                }
              }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition shadow-xs"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Email Canvas Container */}
      <div
        style={{
          width: deviceView === "desktop" ? "600px" : "375px",
          maxWidth: "100%",
          transition: "width 0.25s ease-in-out",
        }}
        className={`flex-1 min-h-0 w-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden ${
          deviceView === "mobile" ? "border-slate-300 ring-4 ring-slate-100" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Simulated Browser / Email Client Header Bar */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 select-none">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
            <span className="ml-2 font-mono text-[10px] text-slate-400 uppercase tracking-wide">
              {mode === "preview" ? "Live Render Preview" : "Visual Email Canvas"}
            </span>
          </div>
          <span className="font-semibold text-[11px] text-slate-500">
            {deviceView === "desktop" ? "Desktop (600px)" : "Mobile (375px)"}
          </span>
        </div>

        {/* Content Area: Either Sortable Edit Mode OR Live Iframe Preview */}
        {mode === "preview" ? (
          <div className="flex-1 min-h-0 bg-slate-50 p-2 sm:p-4 flex flex-col">
            <iframe
              srcDoc={previewHtml}
              title="Email Live Preview"
              className="w-full h-full min-h-0 flex-1 border-0 rounded-xl bg-white shadow-xs"
              sandbox="allow-same-origin allow-popups"
            />
          </div>
        ) : (
          <div
            ref={setNodeRef}
            className={`flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 transition-colors overscroll-y-contain ${
              isOver ? "bg-blue-50/40 border-2 border-dashed border-blue-400" : "bg-white"
            }`}
          >
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                    <Layers size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Your email canvas is empty</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Drag blocks from the left panel or click to insert.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onResetDefault}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Load starter template →
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-[600px] mx-auto flex flex-col gap-2.5 pb-8">
                  {blocks.map((block, index) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isActive={activeId === block.id}
                      onSelect={() => onSelect(block.id)}
                      onDuplicate={() => onDuplicate(block.id)}
                      onDelete={() => onDelete(block.id)}
                      onMoveUp={index > 0 ? () => onMove(block.id, "up") : undefined}
                      onMoveDown={index < blocks.length - 1 ? () => onMove(block.id, "down") : undefined}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          </div>
        )}
      </div>
    </div>
  );
}
