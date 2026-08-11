import React, { useState, useRef, useEffect } from "react";
import { FormFieldData, FieldWidth, FieldType } from "./types";
import { Trash2, ChevronDown, Search, Check } from "lucide-react";

interface SidebarRightProps {
  field?: FormFieldData;
  onUpdate: (updates: Partial<FormFieldData>) => void;
  onDelete: () => void;
}

export function SidebarRight({ field, onUpdate, onDelete }: SidebarRightProps) {
  if (!field) {
    return (
      <div className="w-[320px] border-l border-slate-200 bg-white p-6 flex flex-col items-center justify-center text-center text-slate-400">
        <p>Select a field in the form preview to configure its settings here.</p>
      </div>
    );
  }

  return (
    <div className="w-[320px] border-l border-slate-200 bg-white p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Field Configuration</h2>
          <p className="text-sm text-slate-500">Configure the selected field</p>
        </div>
        <button 
          onClick={onDelete}
          className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">Field Label</label>
          <input 
            type="text" 
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-2 relative">
          <label className="text-sm font-semibold text-slate-700">Field Type</label>
          <FieldTypeDropdown 
            value={field.type} 
            onChange={(newType) => onUpdate({ type: newType })} 
          />
        </div>

        {['text', 'textarea', 'email', 'phone', 'number', 'url'].includes(field.type) && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Placeholder</label>
            <input 
              type="text" 
              value={field.placeholder || ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter placeholder text"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">Help Text (Optional)</label>
          <textarea 
            value={field.helpText || ''}
            onChange={(e) => onUpdate({ helpText: e.target.value })}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
            placeholder="Enter a helpful text for this field"
          />
        </div>

        <div className="flex items-center justify-between py-2 border-y border-slate-100 mt-2">
          <label className="text-sm font-semibold text-slate-700">Required Field</label>
          <button 
            onClick={() => onUpdate({ required: !field.required })}
            className={`w-11 h-6 rounded-full transition-colors relative ${field.required ? 'bg-blue-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${field.required ? 'left-6' : 'left-1'}`}></div>
          </button>
        </div>

        {['text', 'email', 'phone', 'number'].includes(field.type) && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Default Value (Optional)</label>
            <input 
              type="text" 
              value={field.defaultValue || ''}
              onChange={(e) => onUpdate({ defaultValue: e.target.value })}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter default value"
            />
          </div>
        )}

        {['radio', 'checkbox', 'dropdown'].includes(field.type) && (
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-semibold text-slate-700">Options</label>
            <div className="flex flex-col gap-2">
              {(field.options || []).map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <input 
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...(field.options || [])];
                      newOpts[idx] = e.target.value;
                      onUpdate({ options: newOpts });
                    }}
                    className="flex-1 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    onClick={() => {
                      const newOpts = [...(field.options || [])];
                      newOpts.splice(idx, 1);
                      onUpdate({ options: newOpts });
                    }}
                    className="p-2 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => onUpdate({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
                className="text-blue-600 text-sm font-medium text-left hover:underline mt-1"
              >
                + Add Option
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-4">
          <label className="text-sm font-semibold text-slate-700">Field Width</label>
          <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
            {(['full', 'half', 'third'] as FieldWidth[]).map((w) => (
              <button
                key={w}
                onClick={() => onUpdate({ width: w })}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  field.width === w ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="capitalize">{w}</span> Width
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

const ALL_FIELD_TYPES = [
  { value: "text", label: "Single Line Text" },
  { value: "textarea", label: "Paragraph Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "radio", label: "Multiple Choice (MCQ)" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File Upload" },
  { value: "image", label: "Image" },
  { value: "url", label: "URL" },
  { value: "switch", label: "Switch / Toggle" }
];

function FieldTypeDropdown({ value, onChange }: { value: FieldType, onChange: (v: FieldType) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = ALL_FIELD_TYPES.filter(t => t.label.toLowerCase().includes(search.toLowerCase()));
  const currentLabel = ALL_FIELD_TYPES.find(t => t.value === value)?.label || value;

  return (
    <div className="relative w-full text-sm" ref={ref}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-slate-200 rounded-lg p-2.5 text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="truncate text-slate-700">{currentLabel}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center px-3 py-2 border-b border-slate-100">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full focus:outline-none text-sm bg-transparent"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-slate-500 text-center text-xs">No types found</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value as FieldType);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between items-center transition-colors"
                >
                  <span className={`truncate ${value === opt.value ? 'font-medium text-blue-600' : 'text-slate-700'}`}>
                    {opt.label}
                  </span>
                  {value === opt.value && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
