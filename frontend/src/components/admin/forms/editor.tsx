"use client";

import React, { useState, useEffect } from "react";
import { FormBuilder } from "./builder";
import { FormResponses } from "./responses";
import { FormSettings } from "./settings";
import { Save, ArrowLeft, Loader2, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { FormFieldData } from "./types";
import { toast } from "sonner";

type TabType = "builder" | "responses" | "settings";

export function FormEditor({ formId }: { formId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("builder");
  const [formTitle, setFormTitle] = useState("Lead Generation Form");
  const [formDescription, setFormDescription] = useState("Fill out the details below.");
  const [isLive, setIsLive] = useState(false);
  const [formUuid, setFormUuid] = useState("");
  const [fields, setFields] = useState<FormFieldData[]>([]);

  const isNew = formId === "new" || formId.startsWith("tmpl_");

  const { isLoading: isFetching } = useQuery({
    queryKey: ["admin-form", formId],
    queryFn: async () => {
      if (isNew) return null;
      const res = await apiClient.get(`/api/forms/${formId}/`);
      return res.data;
    },
    enabled: !isNew,
  });

  // Effect to populate state when data loads
  useEffect(() => {
    // If not new, we should rely on useQuery's onSuccess or a manual fetch,
    // but React Query v5 doesn't have onSuccess. We fetch manually or let useEffect handle it.
    if (!isNew) {
      apiClient.get(`/api/forms/${formId}/`).then(res => {
        const data = res.data;
        setFormTitle(data.title);
        setFormDescription(data.description);
        setIsLive(data.status === "published");
        setFormUuid(data.uuid);
        
        // Map backend fields to frontend format
        if (data.fields_schema) {
          setFields(data.fields_schema.map((f: any) => ({
            id: String(f.id || f.field_order || Math.random()),
            type: f.field_type,
            label: f.label,
            required: f.required,
            placeholder: f.placeholder,
            options: f.options
          })));
        }
      });
    }
  }, [formId, isNew]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Map frontend fields to backend format
      const payload = {
        title: formTitle,
        description: formDescription,
        status: isLive ? "published" : "draft",
        fields_schema: fields.map((f, i) => ({
          id: f.id,
          field_type: f.type,
          label: f.label,
          required: f.required,
          placeholder: f.placeholder || "",
          options: f.options || [],
          step_number: 1,
          field_order: i + 1,
        }))
      };

      if (isNew) {
        return await apiClient.post("/api/forms/", payload);
      } else {
        return await apiClient.put(`/api/forms/${formId}/`, payload);
      }
    },
    onSuccess: (res) => {
      toast.success("Form saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      if (isNew) {
        setFormUuid(res.data.uuid);
        router.push(`/admin/forms/${res.data.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to save form");
    }
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (isNew) throw new Error("Save the form first before publishing");
      return await apiClient.post(`/api/forms/${formId}/publish/`);
    },
    onSuccess: () => {
      toast.success("Form published and is now live!");
      setIsLive(true);
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to publish form");
    }
  });

  const handleSave = () => {
    saveMutation.mutate();
  };
  
  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Top Navigation Bar */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.push("/admin/forms")}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="h-full flex items-center gap-1">
            <TabButton 
              label="Builder" 
              isActive={activeTab === "builder"} 
              onClick={() => setActiveTab("builder")} 
            />
            <TabButton 
              label="Responses" 
              isActive={activeTab === "responses"} 
              onClick={() => setActiveTab("responses")} 
            />
            <TabButton 
              label="Settings" 
              isActive={activeTab === "settings"} 
              onClick={() => setActiveTab("settings")} 
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isNew && isLive && formUuid && (
            <button 
              onClick={() => {
                const url = `${window.location.origin}/f/${formUuid}`;
                navigator.clipboard.writeText(url);
                toast.success("Public link copied to clipboard!");
              }}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Copy Link
            </button>
          )}

          {!isNew && !isLive && (
            <button 
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <Globe className="w-4 h-4" />
              Make Live
            </button>
          )}
          
          <button 
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? "Saving..." : "Save Form"}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "builder" && (
          <FormBuilder 
            title={formTitle} 
            setTitle={setFormTitle} 
            description={formDescription} 
            setDescription={setFormDescription} 
            fields={fields}
            setFields={setFields}
          />
        )}
        {activeTab === "responses" && <FormResponses formId={formId} />}
        {activeTab === "settings" && <FormSettings formId={formId} isLive={isLive} setIsLive={setIsLive} />}
      </div>
    </div>
  );
}

function TabButton({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-16 px-4 text-sm font-medium transition-colors ${
        isActive ? "text-blue-600" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
      )}
    </button>
  );
}
