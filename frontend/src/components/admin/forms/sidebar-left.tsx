import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { FieldType } from "./types";
import { 
  Type, AlignLeft, Hash, Mail, Calendar, 
  ListChecks, ChevronDown, CheckSquare, CircleDot,
  Upload, Image as ImageIcon, Link, ToggleLeft
} from "lucide-react";

const FIELD_GROUPS = [
  {
    title: "BASIC FIELDS",
    fields: [
      { type: "text", label: "Single Line Text", icon: Type },
      { type: "textarea", label: "Paragraph Text", icon: AlignLeft },
      { type: "number", label: "Number", icon: Hash },
      { type: "email", label: "Email", icon: Mail },
      { type: "date", label: "Date", icon: Calendar },
    ]
  },
  {
    title: "CHOICE FIELDS",
    fields: [
      { type: "radio", label: "Multiple Choice (MCQ)", icon: CircleDot },
      { type: "dropdown", label: "Dropdown", icon: ChevronDown },
      { type: "checkbox", label: "Checkbox", icon: CheckSquare },
    ]
  },
  {
    title: "OTHER FIELDS",
    fields: [
      { type: "file", label: "File Upload", icon: Upload },
      { type: "image", label: "Image", icon: ImageIcon },
      { type: "url", label: "URL", icon: Link },
      { type: "switch", label: "Switch / Toggle", icon: ToggleLeft },
    ]
  }
];

export function SidebarLeft() {
  return (
    <div className="w-[300px] border-r border-slate-200 bg-white p-6 overflow-y-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Add Field</h2>
        <p className="text-sm text-slate-500 mt-1">Drag and drop or click to add fields</p>
      </div>

      <div className="flex flex-col gap-8">
        {FIELD_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-[11px] font-semibold text-slate-400 tracking-wider mb-3">{group.title}</h3>
            <div className="flex flex-col gap-2">
              {group.fields.map((f) => (
                <DraggableFieldItem key={f.type} type={f.type as FieldType} label={f.label} icon={f.icon} />
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-4 bg-blue-50 text-blue-600 rounded-lg flex gap-3 text-sm">
        <span className="font-semibold shrink-0">Tip:</span>
        <p>Drag a field to the form preview to add it.</p>
      </div>
    </div>
  );
}

function DraggableFieldItem({ type, label, icon: Icon }: { type: FieldType, label: string, icon: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new_${type}`,
    data: {
      type,
      isNew: true
    }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white shadow-sm cursor-grab hover:border-blue-300 hover:shadow-md transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <Icon className="w-4 h-4 text-slate-500" />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
}
