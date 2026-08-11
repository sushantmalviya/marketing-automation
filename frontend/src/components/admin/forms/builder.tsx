"use client";

import React, { useState } from "react";
import { 
  DndContext, 
  DragOverlay, 
  pointerWithin, 
  closestCenter,
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragEndEvent,
  DragOverEvent
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy, 
  arrayMove 
} from "@dnd-kit/sortable";
import { FormFieldData, FieldType } from "./types";
import { SidebarLeft } from "./sidebar-left";
import { Canvas } from "./canvas";
import { SidebarRight } from "./sidebar-right";

interface FormBuilderProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  fields: FormFieldData[];
  setFields: (fields: FormFieldData[] | ((prev: FormFieldData[]) => FormFieldData[])) => void;
}

export function FormBuilder({ title, setTitle, description, setDescription, fields, setFields }: FormBuilderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{ type: FieldType, id: string, isNew: boolean } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const isNew = active.data.current?.isNew === true;
    const type = active.data.current?.type as FieldType;
    
    if (isNew) {
      setActiveDragItem({ type, id: active.id as string, isNew: true });
    } else {
      const field = fields.find(f => f.id === active.id);
      if (field) {
        setActiveDragItem({ type: field.type, id: field.id, isNew: false });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const isNew = active.data.current?.isNew === true;

    if (isNew) {
      // Add new field from sidebar
      const type = active.data.current?.type as FieldType;
      const newField: FormFieldData = {
        id: `field_${Date.now()}`,
        type,
        label: getDefaultLabel(type),
        required: false,
        width: "full",
        options: ["radio", "checkbox", "dropdown"].includes(type) ? ["Option 1", "Option 2"] : undefined
      };

      if (over.id === "canvas") {
        setFields([...fields, newField]);
        setActiveId(newField.id);
      } else {
        const overIndex = fields.findIndex(f => f.id === over.id);
        if (overIndex !== -1) {
          const newFields = [...fields];
          newFields.splice(overIndex, 0, newField);
          setFields(newFields);
          setActiveId(newField.id);
        }
      }
    } else {
      // Reorder existing fields
      if (active.id !== over.id && over.id !== "canvas") {
        setFields((items) => {
          const oldIndex = items.findIndex(f => f.id === active.id);
          const newIndex = items.findIndex(f => f.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  const updateField = (id: string, updates: Partial<FormFieldData>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const activeField = fields.find(f => f.id === activeId);

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SidebarLeft />
        
        <div className="flex-1 overflow-y-auto p-8 flex justify-center">
          <Canvas 
            fields={fields} 
            activeId={activeId} 
            onSelect={setActiveId} 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
          />
        </div>

        <SidebarRight 
          field={activeField} 
          onUpdate={(updates) => activeId && updateField(activeId, updates)}
          onDelete={() => activeId && deleteField(activeId)}
        />

        <DragOverlay>
          {activeDragItem ? (
            <div className="bg-white border-2 border-blue-500 rounded-lg shadow-xl p-4 opacity-80 cursor-grabbing w-[280px]">
              <div className="font-medium">{getDefaultLabel(activeDragItem.type)}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function getDefaultLabel(type: FieldType): string {
  const map: Record<FieldType, string> = {
    text: "Single Line Text",
    textarea: "Paragraph Text",
    email: "Email Address",
    phone: "Phone Number",
    number: "Number",
    date: "Date",
    radio: "Multiple Choice",
    checkbox: "Checkbox",
    dropdown: "Dropdown",
    file: "File Upload",
    image: "Image",
    url: "URL",
    switch: "Switch / Toggle"
  };
  return map[type] || "Field";
}
