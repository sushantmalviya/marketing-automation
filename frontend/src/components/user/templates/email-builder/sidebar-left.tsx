"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { EmailBlockType } from "../types";
import {
  Heading,
  Type,
  Image as ImageIcon,
  MousePointerClick,
  Minus,
  MoveVertical,
  List as ListIcon,
  Code,
  Sparkles,
  Link2,
  Crown,
} from "lucide-react";

interface BlockDefinition {
  type: EmailBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
  isLogo?: boolean;
}

const BLOCK_GROUPS: { title: string; blocks: BlockDefinition[] }[] = [
  {
    title: "BASIC CONTENT",
    blocks: [
      {
        type: "heading",
        label: "Heading",
        description: "Eye-catching headline or title",
        icon: Heading,
      },
      {
        type: "text",
        label: "Paragraph Text",
        description: "Formatted copy, greetings, and body",
        icon: Type,
      },
      {
        type: "button",
        label: "CTA Button",
        description: "Action button (URL, Phone, Email)",
        icon: MousePointerClick,
      },
      {
        type: "link",
        label: "Text Link",
        description: "Clickable text link or anchor",
        icon: Link2,
      },
    ],
  },
  {
    title: "BRAND & MEDIA",
    blocks: [
      {
        type: "image",
        label: "Brand Logo",
        description: "Company logo with optimized sizing",
        icon: Crown,
        isLogo: true,
      },
      {
        type: "image",
        label: "Image / Banner",
        description: "Hero graphic, photo, or visual banner",
        icon: ImageIcon,
      },
    ],
  },
  {
    title: "STRUCTURE & LAYOUT",
    blocks: [
      {
        type: "divider",
        label: "Divider",
        description: "Clean horizontal separator line",
        icon: Minus,
      },
      {
        type: "spacer",
        label: "Spacer",
        description: "Adjustable vertical whitespace",
        icon: MoveVertical,
      },
      {
        type: "list",
        label: "List",
        description: "Bulleted or numbered highlights",
        icon: ListIcon,
      },
      {
        type: "html",
        label: "Custom HTML",
        description: "Raw HTML or custom email markup",
        icon: Code,
      },
    ],
  },
];

interface SidebarLeftProps {
  onAddBlock?: (type: EmailBlockType, isLogo?: boolean) => void;
}

export function SidebarLeft({ onAddBlock }: SidebarLeftProps) {
  return (
    <aside className="w-64 xl:w-72 2xl:w-80 shrink-0 border-r border-slate-200 bg-white p-4 sm:p-5 overflow-y-auto flex flex-col gap-5 select-none">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-50 text-blue-600">
            <Sparkles size={14} />
          </span>
          <h2 className="text-sm font-bold text-slate-900">Content Blocks</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Drag blocks into the canvas or click to insert.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {BLOCK_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-[10px] font-bold text-slate-400 tracking-wider mb-2 uppercase">
              {group.title}
            </h3>
            <div className="flex flex-col gap-1.5">
              {group.blocks.map((block) => (
                <DraggableBlockItem
                  key={`${block.type}_${block.isLogo ? "logo" : "normal"}`}
                  type={block.type}
                  label={block.label}
                  description={block.description}
                  icon={block.icon}
                  isLogo={block.isLogo}
                  onAdd={() => onAddBlock?.(block.type, block.isLogo)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function DraggableBlockItem({
  type,
  label,
  description,
  icon: Icon,
  isLogo,
  onAdd,
}: {
  type: EmailBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
  isLogo?: boolean;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new_${type}${isLogo ? "_logo" : ""}`,
    data: {
      type,
      isLogo: !!isLogo,
      isNew: true,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onAdd}
      className={`group flex items-start gap-3 p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs cursor-grab hover:border-blue-400 hover:shadow-md transition-all active:cursor-grabbing ${
        isDragging ? "opacity-40 scale-95 border-blue-400" : ""
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
        <Icon size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="block text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
          {label}
        </span>
        <span className="block text-[11px] text-slate-400 line-clamp-1">
          {description}
        </span>
      </div>
    </div>
  );
}
