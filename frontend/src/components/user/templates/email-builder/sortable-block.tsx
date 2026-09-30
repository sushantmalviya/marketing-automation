"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EmailBlock } from "../types";
import { GripVertical, Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface SortableBlockProps {
  block: EmailBlock;
  isActive: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function SortableBlock({
  block,
  isActive,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: {
      type: block.type,
      isNew: false,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`group relative rounded-xl border-2 transition-all cursor-pointer ${isActive
        ? "border-blue-500 bg-blue-50/10 shadow-md ring-2 ring-blue-500/20"
        : "border-transparent hover:border-slate-200 hover:bg-slate-50/40"
        } ${isDragging ? "opacity-40 scale-98" : ""}`}
    >
      {/* Floating Toolbar on Hover / Active */}
      <div
        className={`absolute -top-3.5 right-3 z-30 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 shadow-md transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className="cursor-grab p-1 text-slate-400 hover:text-slate-700 active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </div>
        {onMoveUp && (
          <button
            type="button"
            title="Move up"
            className="p-1 text-slate-400 hover:text-blue-600 transition"
            onClick={onMoveUp}
          >
            <ArrowUp size={13} />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            title="Move down"
            className="p-1 text-slate-400 hover:text-blue-600 transition"
            onClick={onMoveDown}
          >
            <ArrowDown size={13} />
          </button>
        )}
        <button
          type="button"
          title="Duplicate block"
          className="p-1 text-slate-400 hover:text-blue-600 transition"
          onClick={onDuplicate}
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          title="Delete block"
          className="p-1 text-slate-400 hover:text-red-600 transition"
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Block Body Content */}
      <div className="p-3">
        {renderBlockPreview(block)}
      </div>
    </div>
  );
}

function renderBlockPreview(block: EmailBlock) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as "h1" | "h2" | "h3";
      const sizeClass =
        block.level === 1
          ? "text-2xl font-bold"
          : block.level === 2
            ? "text-xl font-bold"
            : "text-lg font-semibold";
      const weight =
        block.fontWeight === "bold"
          ? 700
          : block.fontWeight === "semibold"
            ? 600
            : block.fontWeight === "medium"
              ? 500
              : block.bold !== false
                ? 700
                : 400;
      return (
        <Tag
          className={sizeClass}
          style={{
            textAlign: block.align,
            color: block.color,
            fontSize: block.fontSize ? `${block.fontSize}px` : undefined,
            fontWeight: weight,
            marginTop: block.marginY !== undefined ? `${block.marginY}px` : undefined,
            marginBottom: block.marginY !== undefined ? `${block.marginY}px` : undefined,
          }}
        >
          {block.text || "Heading Text"}
        </Tag>
      );
    }

    case "text": {
      let content = block.content || "Start typing your paragraph text here...";
      return (
        <div
          className={`whitespace-pre-line leading-relaxed ${block.bold ? "font-bold" : ""} ${block.italic ? "italic" : ""
            } ${block.underline ? "underline" : ""}`}
          style={{
            textAlign: block.align,
            color: block.color,
            fontSize: block.fontSize ? `${block.fontSize}px` : "15px",
            lineHeight: block.lineHeight || 1.6,
          }}
        >
          {content}
        </div>
      );
    }

    case "image": {
      const isLogo = !!block.isLogo;
      const effectiveMaxWidth = isLogo ? (block.maxWidth || 180) : (block.maxWidth || 600);
      return (
        <div style={{ textAlign: block.align || (isLogo ? "center" : "center") }}>
          {block.src ? (
            <div
              className="relative inline-block max-w-full"
              style={{
                width: `${block.width}%`,
                maxWidth: `${effectiveMaxWidth}px`,
              }}
            >
              <img
                src={block.src}
                alt={block.alt || (isLogo ? "Brand Logo" : "Email banner")}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: `${block.borderRadius || 0}px`,
                  objectFit: block.objectFit || (isLogo ? "contain" : "cover"),
                  display: "block",
                }}
                className="max-w-full border border-slate-100 shadow-xs"
              />
              {isLogo && (
                <span className="absolute top-1.5 left-1.5 bg-amber-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs tracking-wider">
                  LOGO
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-slate-400">
              <span className="text-sm font-semibold">
                {isLogo ? "No brand logo selected" : "No banner image selected"}
              </span>
              <span className="text-xs">
                {isLogo
                  ? "Choose your company logo from Asset Library or enter URL"
                  : "Click here or select a banner image from the right panel"}
              </span>
            </div>
          )}
        </div>
      );
    }

    case "button": {
      const py = block.paddingY || 12;
      const px = block.paddingX || 28;
      return (
        <div style={{ textAlign: block.align }} className="py-2">
          <span
            style={{
              backgroundColor: block.bgColor,
              color: block.textColor,
              borderRadius: `${block.borderRadius || 6}px`,
              fontSize: block.fontSize ? `${block.fontSize}px` : "15px",
              display: block.fullWidth ? "block" : "inline-block",
              width: block.fullWidth ? "100%" : "auto",
              padding: `${py}px ${px}px`,
            }}
            className="font-semibold text-center shadow-xs transition"
          >
            {block.text || "Click Here"}
          </span>
          {block.actionType && block.actionType !== "url" && (
            <span className="block text-[10px] text-slate-400 mt-1 uppercase font-semibold">
              Action: {block.actionType === "phone" ? `Call (${block.phoneNumber || "No phone"})` : `Email (${block.emailAddress || "No email"})`}
            </span>
          )}
        </div>
      );
    }

    case "link": {
      const textDecoration = block.underline !== false ? "underline" : "none";
      const fontWeight = block.bold ? 700 : 500;
      return (
        <div style={{ textAlign: block.align }} className="py-1.5">
          <span
            style={{
              color: block.color || "#2563eb",
              fontSize: block.fontSize ? `${block.fontSize}px` : "15px",
              textDecoration,
              fontWeight,
            }}
            className="cursor-pointer hover:opacity-85 transition inline-flex items-center gap-1"
          >
            {block.text || "Click here to view"}
          </span>
          {block.actionType && block.actionType !== "url" && (
            <span className="block text-[10px] text-slate-400 mt-0.5 uppercase font-semibold">
              Action: {block.actionType === "phone" ? `Call (${block.phoneNumber || "No phone"})` : `Email (${block.emailAddress || "No email"})`}
            </span>
          )}
        </div>
      );
    }

    case "divider": {
      return (
        <div style={{ padding: `${block.marginY}px 0` }}>
          <hr
            style={{
              border: "none",
              borderTop: `${block.thickness}px ${block.style} ${block.color}`,
              margin: 0,
            }}
          />
        </div>
      );
    }

    case "spacer": {
      return (
        <div
          style={{ height: `${block.height}px` }}
          className="flex items-center justify-center bg-slate-100/50 border border-dashed border-slate-200 rounded text-[11px] font-mono text-slate-400 select-none"
        >
          Spacer ({block.height}px)
        </div>
      );
    }

    case "list": {
      const ListTag = block.listType === "number" ? "ol" : "ul";
      return (
        <ListTag
          className={`space-y-1.5 pl-6 ${block.listType === "number" ? "list-decimal" : "list-disc"}`}
          style={{
            color: block.color,
            fontSize: block.fontSize ? `${block.fontSize}px` : "15px",
          }}
        >
          {block.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ListTag>
      );
    }

    case "html": {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 overflow-hidden">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Raw HTML Embed
          </div>
          <div dangerouslySetInnerHTML={{ __html: block.content }} />
        </div>
      );
    }

    default:
      return null;
  }
}
