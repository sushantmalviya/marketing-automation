"use client";

import React, { useState } from "react";
import { EmailBlock, FontFamilyType } from "../types";
import { VariableDropdown } from "./variable-dropdown";
import { AssetPickerModal } from "./asset-picker-modal";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Sliders,
  Image as ImageIcon,
  Link,
  Plus,
  Trash2,
  ExternalLink,
  Info,
  Phone,
  Mail,
  Globe,
  Crown,
  Type,
} from "lucide-react";

interface SidebarRightProps {
  block: EmailBlock | null;
  onUpdate: (id: string, updates: Partial<EmailBlock>) => void;
  onClose?: () => void;
}

const PRESET_COLORS = [
  "#0f172a", // Slate 900
  "#334155", // Slate 700
  "#64748b", // Slate 500
  "#2563eb", // Blue 600
  "#4f46e5", // Indigo 600
  "#059669", // Emerald 600
  "#dc2626", // Red 600
  "#d97706", // Amber 600
  "#ffffff", // White
];

const FONT_OPTIONS: { id: FontFamilyType; label: string }[] = [
  { id: "system", label: "Default System" },
  { id: "sans", label: "Modern Sans (Inter)" },
  { id: "serif", label: "Editorial Serif (Georgia)" },
  { id: "mono", label: "Monospace" },
];

export function SidebarRight({ block, onUpdate, onClose }: SidebarRightProps) {
  const [assetModalOpen, setAssetModalOpen] = useState(false);

  if (!block) {
    return (
      <aside className="w-80 shrink-0 border-l border-slate-200 bg-white p-6 overflow-y-auto flex flex-col justify-between select-none">
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <Sliders size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">No Block Selected</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[210px] leading-relaxed">
              Click any element on the email canvas to configure its styles, typography, links, and layout.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Info size={14} className="text-blue-600" />
            <span>Email Best Practices</span>
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            Keep subject lines under 50 characters, use high contrast colors for CTA buttons, and always add alt text for accessibility.
          </p>
        </div>
      </aside>
    );
  }

  const update = (updates: Partial<EmailBlock>) => {
    onUpdate(block.id, updates);
  };

  return (
    <aside className="w-80 shrink-0 border-l border-slate-200 bg-white p-5 overflow-y-auto flex flex-col gap-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
            Block Properties
          </span>
          <h3 className="text-sm font-bold text-slate-900 capitalize flex items-center gap-1.5">
            {block.type === "image" && (block as any).isLogo && (
              <Crown size={14} className="text-amber-500" />
            )}
            {block.type === "image" && (block as any).isLogo ? "Brand Logo" : `${block.type} Element`}
          </h3>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">
          #{block.id.split("_")[1] || block.id.slice(0, 6)}
        </span>
      </div>

      {/* Heading Block Settings */}
      {block.type === "heading" && (
        <div className="space-y-4">
          <div className="field">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Headline Text</label>
              <VariableDropdown
                size="sm"
                onInsert={(tag) => update({ text: `${block.text} ${tag}` })}
              />
            </div>
            <textarea
              rows={2}
              value={block.text}
              onChange={(e) => update({ text: e.target.value })}
              className="sa-input text-sm"
              placeholder="Enter headline..."
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Heading Level</label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() =>
                    update({
                      level: lvl,
                      fontSize: lvl === 1 ? 28 : lvl === 2 ? 22 : 18,
                    })
                  }
                  className={`py-1.5 rounded-lg border text-xs font-bold transition ${block.level === lvl
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  H{lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Font Family</label>
            <select
              value={block.fontFamily || "system"}
              onChange={(e) => update({ fontFamily: e.target.value as FontFamilyType })}
              className="sa-input text-xs"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Font Weight</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["normal", "medium", "semibold", "bold"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => update({ fontWeight: w, bold: w === "bold" })}
                  className={`py-1 rounded-md border text-[11px] font-semibold capitalize transition ${(block.fontWeight === w) || (!block.fontWeight && w === "bold" && block.bold)
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Text Alignment</label>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ align })}
                  className={`py-1.5 flex justify-center rounded-lg border text-xs font-medium transition ${block.align === align
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {align === "left" && <AlignLeft size={16} />}
                  {align === "center" && <AlignCenter size={16} />}
                  {align === "right" && <AlignRight size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">
              Font Size ({block.fontSize || (block.level === 1 ? 28 : 22)}px)
            </label>
            <input
              type="range"
              min={16}
              max={44}
              value={block.fontSize || (block.level === 1 ? 28 : 22)}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">
              Vertical Spacing ({block.marginY !== undefined ? block.marginY : 12}px)
            </label>
            <input
              type="range"
              min={4}
              max={36}
              value={block.marginY !== undefined ? block.marginY : 12}
              onChange={(e) => update({ marginY: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.color || "#0f172a"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={block.color}
                onChange={(e) => update({ color: e.target.value })}
                className="sa-input flex-1 text-xs font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ backgroundColor: c }}
                  className="h-5 w-5 rounded-full border border-slate-300 shadow-xs hover:scale-110 transition"
                  onClick={() => update({ color: c })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Paragraph / Text Block Settings */}
      {block.type === "text" && (
        <div className="space-y-4">
          <div className="field">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Body Content</label>
              <VariableDropdown
                size="sm"
                onInsert={(tag) => update({ content: `${block.content} ${tag}` })}
              />
            </div>
            <textarea
              rows={5}
              value={block.content}
              onChange={(e) => update({ content: e.target.value })}
              className="sa-input text-sm"
              placeholder="Enter message text..."
            />
          </div>

          {/* Quick Formatting Toggles */}
          <div className="field">
            <label className="text-xs font-bold text-slate-700">Formatting</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => update({ bold: !block.bold })}
                className={`p-2 rounded-lg border text-xs transition ${block.bold
                  ? "border-blue-600 bg-blue-50 text-blue-600 font-bold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                title="Bold"
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                onClick={() => update({ italic: !block.italic })}
                className={`p-2 rounded-lg border text-xs transition ${block.italic
                  ? "border-blue-600 bg-blue-50 text-blue-600"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                title="Italic"
              >
                <Italic size={15} />
              </button>
              <button
                type="button"
                onClick={() => update({ underline: !block.underline })}
                className={`p-2 rounded-lg border text-xs transition ${block.underline
                  ? "border-blue-600 bg-blue-50 text-blue-600"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                title="Underline"
              >
                <Underline size={15} />
              </button>

              <div className="flex-1">
                <select
                  value={block.fontFamily || "system"}
                  onChange={(e) => update({ fontFamily: e.target.value as FontFamilyType })}
                  className="sa-input text-xs w-full py-1.5"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Text Alignment</label>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ align })}
                  className={`py-1.5 flex justify-center rounded-lg border text-xs font-medium transition ${block.align === align
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {align === "left" && <AlignLeft size={16} />}
                  {align === "center" && <AlignCenter size={16} />}
                  {align === "right" && <AlignRight size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">
              Font Size ({block.fontSize || 15}px)
            </label>
            <input
              type="range"
              min={12}
              max={24}
              value={block.fontSize || 15}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">
              Line Spacing ({block.lineHeight || 1.6})
            </label>
            <input
              type="range"
              min={1.2}
              max={2.2}
              step={0.1}
              value={block.lineHeight || 1.6}
              onChange={(e) => update({ lineHeight: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.color || "#475569"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={block.color}
                onChange={(e) => update({ color: e.target.value })}
                className="sa-input flex-1 text-xs font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ backgroundColor: c }}
                  className="h-5 w-5 rounded-full border border-slate-300 shadow-xs hover:scale-110 transition"
                  onClick={() => update({ color: c })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Image & Brand Logo Settings */}
      {block.type === "image" && (
        <div className="space-y-4">
          <div className="field">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>{block.isLogo ? "Brand Logo Image" : "Image Source"}</span>
              {block.isLogo && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  Brand Element
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setAssetModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-xs mt-1"
            >
              <ImageIcon size={15} />
              <span>Choose from Asset Library / Upload</span>
            </button>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Or Direct Image URL</label>
            <input
              type="url"
              value={block.src}
              onChange={(e) => update({ src: e.target.value })}
              className="sa-input text-xs"
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Alt Text (Accessibility)</label>
            <input
              type="text"
              value={block.alt}
              onChange={(e) => update({ alt: e.target.value })}
              className="sa-input text-xs"
              placeholder={block.isLogo ? "Company Logo" : "Image description..."}
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Link size={13} className="text-slate-400" />
              <span>Clickable Destination Link (Optional)</span>
            </label>
            <input
              type="url"
              value={block.linkUrl || ""}
              onChange={(e) => update({ linkUrl: e.target.value })}
              className="sa-input text-xs"
              placeholder="https://yourstore.com"
            />
          </div>

          {/* Width slider */}
          <div className="field">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                {block.isLogo ? "Logo Width" : "Banner Width"} ({block.width}%)
              </label>
              {!block.isLogo && (block.width < 100 || (block.maxWidth && block.maxWidth < 600)) && (
                <button
                  type="button"
                  onClick={() => update({ width: 100, maxWidth: 600 })}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  Reset Full Width (600px)
                </button>
              )}
            </div>
            <input
              type="range"
              min={block.isLogo ? 15 : 20}
              max={100}
              value={block.width}
              onChange={(e) => update({ width: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Logo-specific Max Bounds */}
          {block.isLogo && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Logo Max Bounds</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[120, 160, 200, 260].map((px) => (
                  <button
                    key={px}
                    type="button"
                    onClick={() => update({ maxWidth: px })}
                    className={`py-1 rounded-md border text-[11px] font-semibold transition ${
                      (block.maxWidth || 180) === px
                        ? "border-blue-600 bg-blue-50 text-blue-600 font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {px}px
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Constrains the brand logo within standard header sizing guidelines.
              </p>
            </div>
          )}

          {/* Banner-specific Max Bounds (Separate from Logo 260px limit) */}
          {!block.isLogo && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Banner Max Width</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Full 600px", px: 600 },
                  { label: "500px", px: 500 },
                  { label: "400px", px: 400 },
                  { label: "300px", px: 300 },
                ].map((opt) => (
                  <button
                    key={opt.px}
                    type="button"
                    onClick={() => update({ maxWidth: opt.px, width: opt.px === 600 ? 100 : block.width })}
                    className={`py-1 rounded-md border text-[11px] font-semibold transition ${
                      (block.maxWidth || 600) === opt.px
                        ? "border-blue-600 bg-blue-50 text-blue-600 font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Banners scale up to 600px (100% of email content width) and scale responsively on mobile.
              </p>
            </div>
          )}

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Aspect Ratio Fit</label>
            <div className="grid grid-cols-2 gap-2">
              {(["contain", "cover"] as const).map((fit) => (
                <button
                  key={fit}
                  type="button"
                  onClick={() => update({ objectFit: fit })}
                  className={`py-1.5 rounded-lg border text-xs font-medium capitalize transition ${
                    (block.objectFit || (block.isLogo ? "contain" : "cover")) === fit
                      ? "border-blue-600 bg-blue-50 text-blue-600 font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {fit === "contain" ? "Maintain (Contain)" : "Fill (Cover)"}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Corner Radius ({block.borderRadius || 0}px)</label>
            <input
              type="range"
              min={0}
              max={24}
              value={block.borderRadius || 0}
              onChange={(e) => update({ borderRadius: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Alignment</label>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ align })}
                  className={`py-1.5 flex justify-center rounded-lg border text-xs font-medium transition ${block.align === align
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {align === "left" && <AlignLeft size={16} />}
                  {align === "center" && <AlignCenter size={16} />}
                  {align === "right" && <AlignRight size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Button / CTA Block Settings */}
      {block.type === "button" && (
        <div className="space-y-4">
          <div className="field">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Button Label</label>
              <VariableDropdown
                size="sm"
                onInsert={(tag) => update({ text: `${block.text} ${tag}` })}
              />
            </div>
            <input
              type="text"
              value={block.text}
              onChange={(e) => update({ text: e.target.value })}
              className="sa-input text-sm"
              placeholder="e.g. Shop Now"
            />
          </div>

          {/* CTA Action Switcher */}
          <div className="field">
            <label className="text-xs font-bold text-slate-700">CTA Action Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { type: "url", label: "Website", icon: Globe },
                { type: "phone", label: "Phone", icon: Phone },
                { type: "email", label: "Email", icon: Mail },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update({ actionType: type as any })}
                  className={`py-1.5 px-2 flex items-center justify-center gap-1 rounded-lg border text-xs font-semibold transition ${(block.actionType || "url") === type
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Destination Inputs */}
          {(!block.actionType || block.actionType === "url") && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Website URL</label>
              <input
                type="url"
                value={block.url}
                onChange={(e) => update({ url: e.target.value })}
                className="sa-input text-xs"
                placeholder="https://example.com/summer-sale"
              />
            </div>
          )}

          {block.actionType === "phone" && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Phone Number (tel:)</label>
              <input
                type="tel"
                value={block.phoneNumber || ""}
                onChange={(e) => {
                  const cleaned = e.target.value;
                  update({ phoneNumber: cleaned, url: `tel:${cleaned.replace(/\s+/g, "")}` });
                }}
                className="sa-input text-xs"
                placeholder="+91 98765 43210"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Generates a mobile-friendly <code>tel:</code> link that launches the dialer when clicked.
              </span>
            </div>
          )}

          {block.actionType === "email" && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Email Address (mailto:)</label>
              <input
                type="email"
                value={block.emailAddress || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  update({ emailAddress: val, url: `mailto:${val.trim()}` });
                }}
                className="sa-input text-xs"
                placeholder="sales@example.com"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Opens the recipient's email client addressed to this email.
              </span>
            </div>
          )}

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Alignment</label>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ align })}
                  className={`py-1.5 flex justify-center rounded-lg border text-xs font-medium transition ${block.align === align
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {align === "left" && <AlignLeft size={16} />}
                  {align === "center" && <AlignCenter size={16} />}
                  {align === "right" && <AlignRight size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Button Size</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Compact", py: 8, px: 18, fontSize: 13 },
                { label: "Standard", py: 12, px: 28, fontSize: 15 },
                { label: "Large", py: 16, px: 36, fontSize: 16 },
              ].map((sz) => (
                <button
                  key={sz.label}
                  type="button"
                  onClick={() => update({ paddingY: sz.py, paddingX: sz.px, fontSize: sz.fontSize })}
                  className={`py-1 rounded-md border text-xs font-semibold transition ${(block.paddingY || 12) === sz.py
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.bgColor || "#2563eb"}
                onChange={(e) => update({ bgColor: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={block.bgColor}
                onChange={(e) => update({ bgColor: e.target.value })}
                className="sa-input flex-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.textColor || "#ffffff"}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={block.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
                className="sa-input flex-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Corner Radius ({block.borderRadius || 6}px)</label>
            <input
              type="range"
              min={0}
              max={30}
              value={block.borderRadius || 6}
              onChange={(e) => update({ borderRadius: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={!!block.fullWidth}
              onChange={(e) => update({ fullWidth: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700">Full Width Button</span>
          </label>
        </div>
      )}

      {/* Text Link Block Settings */}
      {block.type === "link" && (
        <div className="space-y-4">
          <div className="field">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Link Text</label>
              <VariableDropdown
                size="sm"
                onInsert={(tag) => update({ text: `${block.text} ${tag}` })}
              />
            </div>
            <input
              type="text"
              value={block.text}
              onChange={(e) => update({ text: e.target.value })}
              className="sa-input text-sm"
              placeholder="e.g. View complete collection →"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Link Action</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { type: "url", label: "Website", icon: Globe },
                { type: "phone", label: "Phone", icon: Phone },
                { type: "email", label: "Email", icon: Mail },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update({ actionType: type as any })}
                  className={`py-1.5 px-2 flex items-center justify-center gap-1 rounded-lg border text-xs font-semibold transition ${(block.actionType || "url") === type
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {(!block.actionType || block.actionType === "url") && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Website URL</label>
              <input
                type="url"
                value={block.url}
                onChange={(e) => update({ url: e.target.value })}
                className="sa-input text-xs"
                placeholder="https://example.com/collection"
              />
            </div>
          )}

          {block.actionType === "phone" && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Phone Number (tel:)</label>
              <input
                type="tel"
                value={block.phoneNumber || ""}
                onChange={(e) => {
                  const cleaned = e.target.value;
                  update({ phoneNumber: cleaned, url: `tel:${cleaned.replace(/\s+/g, "")}` });
                }}
                className="sa-input text-xs"
                placeholder="+91 98765 43210"
              />
            </div>
          )}

          {block.actionType === "email" && (
            <div className="field">
              <label className="text-xs font-bold text-slate-700">Email Address (mailto:)</label>
              <input
                type="email"
                value={block.emailAddress || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  update({ emailAddress: val, url: `mailto:${val.trim()}` });
                }}
                className="sa-input text-xs"
                placeholder="support@example.com"
              />
            </div>
          )}

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Alignment</label>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ align })}
                  className={`py-1.5 flex justify-center rounded-lg border text-xs font-medium transition ${block.align === align
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {align === "left" && <AlignLeft size={16} />}
                  {align === "center" && <AlignCenter size={16} />}
                  {align === "right" && <AlignRight size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Link Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.color || "#2563eb"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={block.color}
                onChange={(e) => update({ color: e.target.value })}
                className="sa-input flex-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={block.underline !== false}
                onChange={(e) => update({ underline: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700">Underline</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.bold}
                onChange={(e) => update({ bold: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700">Bold Text</span>
            </label>
          </div>
        </div>
      )}

      {/* Divider Settings */}
      {block.type === "divider" && (
        <div className="space-y-4">
          <div className="field">
            <label className="text-xs font-bold text-slate-700">Line Style</label>
            <div className="grid grid-cols-3 gap-2">
              {(["solid", "dashed", "dotted"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => update({ style })}
                  className={`py-1.5 rounded-lg border text-xs font-medium capitalize transition ${block.style === style
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Thickness ({block.thickness}px)</label>
            <input
              type="range"
              min={1}
              max={6}
              value={block.thickness}
              onChange={(e) => update({ thickness: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Vertical Spacing ({block.marginY}px)</label>
            <input
              type="range"
              min={8}
              max={48}
              value={block.marginY}
              onChange={(e) => update({ marginY: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Divider Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.color || "#e2e8f0"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={block.color}
                onChange={(e) => update({ color: e.target.value })}
                className="sa-input flex-1 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Spacer Settings */}
      {block.type === "spacer" && (
        <div className="space-y-4">
          <div className="field">
            <label className="text-xs font-bold text-slate-700">Spacer Height ({block.height}px)</label>
            <input
              type="range"
              min={10}
              max={120}
              value={block.height}
              onChange={(e) => update({ height: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* List Settings */}
      {block.type === "list" && (
        <div className="space-y-4">
          <div className="field">
            <label className="text-xs font-bold text-slate-700">List Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["bullet", "number"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ listType: t })}
                  className={`py-1.5 rounded-lg border text-xs font-semibold capitalize transition ${block.listType === t
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {t === "bullet" ? "Bulleted (•)" : "Numbered (1.)"}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">List Items</label>
            <div className="space-y-2">
              {block.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...block.items];
                      newItems[idx] = e.target.value;
                      update({ items: newItems });
                    }}
                    className="sa-input flex-1 text-xs py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newItems = block.items.filter((_, i) => i !== idx);
                      update({ items: newItems.length ? newItems : ["Item"] });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update({ items: [...block.items, `Item ${block.items.length + 1}`] })}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline pt-1"
              >
                <Plus size={13} /> Add item
              </button>
            </div>
          </div>

          <div className="field">
            <label className="text-xs font-bold text-slate-700">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={block.color || "#334155"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={block.color}
                onChange={(e) => update({ color: e.target.value })}
                className="sa-input flex-1 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Raw HTML Block Settings */}
      {block.type === "html" && (
        <div className="space-y-4">
          <div className="field">
            <label className="text-xs font-bold text-slate-700">HTML Code</label>
            <textarea
              rows={8}
              value={block.content}
              onChange={(e) => update({ content: e.target.value })}
              className="sa-input font-mono text-xs"
              placeholder="<div>Custom HTML content</div>"
            />
          </div>
        </div>
      )}

      {/* Asset Picker Modal */}
      {assetModalOpen && (
        <AssetPickerModal
          onSelect={(url) => update({ src: url })}
          onClose={() => setAssetModalOpen(false)}
        />
      )}
    </aside>
  );
}
