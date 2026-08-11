import React from "react";
import { FormFieldData } from "./types";
import { Upload, Image as ImageIcon } from "lucide-react";

export function FieldRenderer({ field }: { field: FormFieldData }) {
  const isRequired = field.required;
  const label = field.label;

  return (
    <div className="w-full text-left pointer-events-none">
      <div className="mb-1.5 flex items-center gap-1">
        <label className="text-sm font-semibold text-slate-800">{label}</label>
        {isRequired && <span className="text-red-500 text-sm">*</span>}
      </div>
      
      {renderInput(field)}

      {field.helpText && (
        <p className="text-xs text-slate-500 mt-1.5">{field.helpText}</p>
      )}
    </div>
  );
}

function renderInput(field: FormFieldData) {
  const commonClasses = "w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 text-slate-400";
  
  switch (field.type) {
    case "text":
    case "email":
    case "phone":
    case "url":
    case "number":
    case "date":
      return (
        <div className={commonClasses}>
          {field.placeholder || `Enter ${field.label.toLowerCase()}`}
        </div>
      );
    case "textarea":
      return (
        <div className={`${commonClasses} min-h-[100px]`}>
          {field.placeholder || `Enter ${field.label.toLowerCase()}`}
        </div>
      );
    case "dropdown":
      return (
        <div className={`${commonClasses} flex justify-between items-center`}>
          <span>Select an option</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      );
    case "radio":
      return (
        <div className="flex flex-col gap-2 mt-2">
          {(field.options || ["Option 1", "Option 2"]).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-slate-300 bg-slate-50"></div>
              <span className="text-sm text-slate-600">{opt}</span>
            </div>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="flex flex-col gap-2 mt-2">
          {(field.options || ["Option 1", "Option 2"]).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-slate-300 bg-slate-50"></div>
              <span className="text-sm text-slate-600">{opt}</span>
            </div>
          ))}
        </div>
      );
    case "file":
      return (
        <div className="w-full border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-50 gap-2">
          <Upload className="w-8 h-8 text-slate-400" />
          <div className="text-sm text-slate-600 text-center">
            Drag and drop file here<br/>
            <span className="text-blue-500">or click to browse</span>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="w-full border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-50 gap-2">
          <ImageIcon className="w-8 h-8 text-slate-400" />
          <div className="text-sm text-slate-600 text-center">
            Upload an image
          </div>
        </div>
      );
    case "switch":
      return (
        <div className="mt-2 w-11 h-6 bg-slate-200 rounded-full relative">
          <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"></div>
        </div>
      );
    default:
      return <div className={commonClasses}>Unknown field type</div>;
  }
}
