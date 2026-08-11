import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormFieldData } from "./types";
import { FieldRenderer } from "./field-renderers";

interface CanvasProps {
  fields: FormFieldData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}

export function Canvas({ fields, activeId, onSelect, title, setTitle, description, setDescription }: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas",
  });

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Form Preview</h2>
        <p className="text-sm text-slate-500 mt-1">This is how your form will look</p>
      </div>

      <div 
        ref={setNodeRef}
        className={`bg-white rounded-xl border p-8 shadow-sm min-h-[500px] transition-colors ${isOver ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200'}`}
      >
        <div className="mb-8 flex flex-col gap-1">
          <input 
            type="text" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            className="text-2xl font-bold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1 -ml-2 outline-none transition-colors"
            placeholder="Form Title"
          />
          <input 
            type="text" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            className="text-slate-500 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1 -ml-2 outline-none transition-colors w-full"
            placeholder="Form Description"
          />
        </div>

        <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-5 pb-8">
            {fields.length === 0 ? (
              <div className="h-40 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                Drag and drop fields here
              </div>
            ) : (
              fields.map((field) => (
                <SortableFieldItem 
                  key={field.id} 
                  field={field} 
                  isActive={activeId === field.id}
                  onClick={() => onSelect(field.id)}
                />
              ))
            )}
          </div>
        </SortableContext>

        <button className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-medium shadow-sm opacity-90 cursor-not-allowed">
          Submit
        </button>
      </div>
    </div>
  );
}

function SortableFieldItem({ field, isActive, onClick }: { field: FormFieldData, isActive: boolean, onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: field.id,
    data: {
      type: field.type,
      isNew: false
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`group relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
        isActive ? 'border-blue-500 bg-blue-50/20 shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag handle */}
      <div 
        {...attributes} 
        {...listeners}
        className={`absolute left-0 top-1/2 -translate-y-1/2 -ml-2 p-1 cursor-grab opacity-0 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}`}
      >
        <div className="flex flex-col gap-1 w-1.5">
          <div className="h-1 w-1 rounded-full bg-slate-400"></div>
          <div className="h-1 w-1 rounded-full bg-slate-400"></div>
          <div className="h-1 w-1 rounded-full bg-slate-400"></div>
        </div>
      </div>

      <FieldRenderer field={field} />
    </div>
  );
}
