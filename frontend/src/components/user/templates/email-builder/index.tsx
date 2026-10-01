"use client";

import React, { useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { EmailBlock, EmailBlockType } from "../types";
import { SidebarLeft } from "./sidebar-left";
import { Canvas } from "./canvas";
import { SidebarRight } from "./sidebar-right";
import { getDefaultBlocks } from "../html-serializer";

interface EmailBuilderProps {
  blocks: EmailBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<EmailBlock[]>>;
}

export function EmailBuilder({ blocks, setBlocks }: EmailBuilderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{
    type: EmailBlockType;
    id: string;
    isNew: boolean;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const createNewBlock = (type: EmailBlockType, isLogo?: boolean): EmailBlock => {
    const id = `block_${type}_${Date.now()}`;
    if (isLogo) {
      return {
        id: `block_logo_${Date.now()}`,
        type: "image",
        src: "",
        alt: "Brand Logo",
        align: "center",
        width: 35,
        maxWidth: 180,
        isLogo: true,
        objectFit: "contain",
      };
    }

    switch (type) {
      case "heading":
        return {
          id,
          type: "heading",
          text: "Catchy Email Heading",
          level: 2,
          align: "left",
          color: "#0f172a",
          fontSize: 22,
          fontFamily: "system",
          fontWeight: "bold",
          bold: true,
          marginY: 12,
        };
      case "text":
        return {
          id,
          type: "text",
          content: "Share updates, helpful information, or exciting news with your audience here.",
          align: "left",
          color: "#475569",
          fontSize: 15,
          fontFamily: "system",
          lineHeight: 1.6,
        };
      case "image":
        return {
          id,
          type: "image",
          src: "",
          alt: "Marketing banner",
          align: "center",
          width: 100,
          maxWidth: 600,
          borderRadius: 8,
          objectFit: "cover",
          isLogo: false,
        };
      case "button":
        return {
          id,
          type: "button",
          text: "Claim Offer →",
          url: "https://example.com",
          actionType: "url",
          align: "center",
          bgColor: "#2563eb",
          textColor: "#ffffff",
          borderRadius: 8,
          fontSize: 15,
          paddingY: 12,
          paddingX: 28,
        };
      case "link":
        return {
          id,
          type: "link",
          text: "View details or learn more →",
          url: "https://example.com",
          actionType: "url",
          align: "center",
          color: "#2563eb",
          fontSize: 14,
          fontFamily: "system",
          underline: true,
        };
      case "divider":
        return {
          id,
          type: "divider",
          style: "solid",
          color: "#e2e8f0",
          thickness: 1,
          marginY: 20,
        };
      case "spacer":
        return {
          id,
          type: "spacer",
          height: 24,
        };
      case "list":
        return {
          id,
          type: "list",
          listType: "bullet",
          items: ["Key highlight #1", "Exclusive perk #2", "Special discount bonus"],
          color: "#334155",
          fontSize: 15,
          fontFamily: "system",
        };
      case "html":
        return {
          id,
          type: "html",
          content: "<div style='text-align: center; color: #64748b;'>Custom HTML block</div>",
        };
      default:
        return {
          id,
          type: "text",
          content: "New element",
          align: "left",
          color: "#334155",
        };
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const isNew = active.data.current?.isNew === true;
    const type = active.data.current?.type as EmailBlockType;

    if (isNew) {
      setActiveDragItem({ type, id: active.id as string, isNew: true });
    } else {
      const block = blocks.find((b) => b.id === active.id);
      if (block) {
        setActiveDragItem({ type: block.type, id: block.id, isNew: false });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const isNew = active.data.current?.isNew === true;

    if (isNew) {
      const type = active.data.current?.type as EmailBlockType;
      const isLogo = active.data.current?.isLogo === true;
      const newBlock = createNewBlock(type, isLogo);

      if (over.id === "canvas") {
        setBlocks((prev) => [...prev, newBlock]);
        setActiveId(newBlock.id);
      } else {
        const overIndex = blocks.findIndex((b) => b.id === over.id);
        if (overIndex !== -1) {
          setBlocks((prev) => {
            const next = [...prev];
            next.splice(overIndex, 0, newBlock);
            return next;
          });
          setActiveId(newBlock.id);
        }
      }
    } else {
      // Reorder existing blocks
      if (active.id !== over.id && over.id !== "canvas") {
        setBlocks((items) => {
          const oldIndex = items.findIndex((b) => b.id === active.id);
          const newIndex = items.findIndex((b) => b.id === over.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            return arrayMove(items, oldIndex, newIndex);
          }
          return items;
        });
      }
    }
  };

  const handleAddBlock = (type: EmailBlockType, isLogo?: boolean) => {
    const newBlock = createNewBlock(type, isLogo);
    setBlocks((prev) => [...prev, newBlock]);
    setActiveId(newBlock.id);
  };

  const handleUpdateBlock = (id: string, updates: Partial<EmailBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...updates } as EmailBlock) : b))
    );
  };

  const handleDuplicateBlock = (id: string) => {
    const target = blocks.find((b) => b.id === id);
    if (!target) return;
    const duplicated: EmailBlock = {
      ...JSON.parse(JSON.stringify(target)),
      id: `block_${target.type}_${Date.now()}`,
    };
    const targetIndex = blocks.findIndex((b) => b.id === id);
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(targetIndex + 1, 0, duplicated);
      return next;
    });
    setActiveId(duplicated.id);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleMoveBlock = (id: string, direction: "up" | "down") => {
    const currentIndex = blocks.findIndex((b) => b.id === id);
    if (currentIndex === -1) return;
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    setBlocks((prev) => arrayMove(prev, currentIndex, newIndex));
  };

  const activeBlock = blocks.find((b) => b.id === activeId) || null;

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[600px] 2xl:min-h-[700px] w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Left Toolbar */}
        <SidebarLeft onAddBlock={handleAddBlock} />

        {/* Center Canvas */}
        <Canvas
          blocks={blocks}
          activeId={activeId}
          onSelect={setActiveId}
          onDuplicate={handleDuplicateBlock}
          onDelete={handleDeleteBlock}
          onMove={handleMoveBlock}
          onResetDefault={() => {
            const defaults = getDefaultBlocks();
            setBlocks(defaults);
            setActiveId(defaults[0]?.id || null);
          }}
        />

        {/* Right Properties Panel */}
        <SidebarRight
          block={activeBlock}
          onUpdate={handleUpdateBlock}
          onClose={() => setActiveId(null)}
        />

        {/* Drag Overlay preview */}
        <DragOverlay>
          {activeDragItem ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-400 bg-white shadow-xl opacity-90">
              <span className="text-xs font-bold text-blue-600 uppercase">
                Add {activeDragItem.type}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export * from "./email-phone-preview";
export * from "./email-preview-modal";

