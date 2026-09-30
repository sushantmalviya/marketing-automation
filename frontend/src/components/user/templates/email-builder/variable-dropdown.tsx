"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Check, ChevronDown } from "lucide-react";
import { PERSONALIZATION_VARIABLES } from "../types";
import { toast } from "sonner";

interface VariableDropdownProps {
  onInsert?: (tag: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function VariableDropdown({ onInsert, className = "", size = "md" }: VariableDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (tag: string) => {
    if (onInsert) {
      onInsert(tag);
      toast.success(`Inserted ${tag}`);
    } else {
      navigator.clipboard.writeText(tag);
      toast.success(`Copied ${tag} to clipboard`);
    }
    setOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-sm ${
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
        }`}
      >
        <Sparkles size={13} className="text-indigo-600" />
        <span>Personalize</span>
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
          <div className="px-2 py-1 mb-1 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer Variables</p>
          </div>
          <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {PERSONALIZATION_VARIABLES.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => handleSelect(v.value)}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-indigo-50 transition group"
              >
                <div>
                  <span className="font-semibold text-slate-800 group-hover:text-indigo-700">{v.label}</span>
                  <span className="block text-[10px] text-slate-400">{v.description}</span>
                </div>
                <code className="text-[11px] font-mono font-medium text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100 group-hover:bg-indigo-100">
                  {v.value}
                </code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
