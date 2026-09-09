"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function PublicFormPage() {
  const params = useParams();
  const uuid = params.uuid as string;
  
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: form, isLoading, isError } = useQuery({
    queryKey: ["public-form", uuid],
    queryFn: async () => {
      const res = await apiClient.get(`/api/forms/public/${uuid}/`);
      return res.data;
    },
    enabled: !!uuid,
    retry: false
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiClient.post(`/api/forms/public/${uuid}/submit/`, payload);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to submit form. Please try again.");
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Form Not Found</h2>
          <p className="text-slate-500">This form may have been removed or is not currently active.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h2>
          <p className="text-slate-600">
            {form.thank_you_message || "Your submission has been received successfully."}
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Format answers for backend: [{ field_id: X, answer: Y }]
    const formattedAnswers = Object.entries(answers).map(([field_id, answer]) => ({
      field_id: field_id,
      answer
    }));

    submitMutation.mutate({ answers: formattedAnswers });
  };

  const handleChange = (fieldId: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-blue-600 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold">{form.title}</h1>
            {form.description && (
              <p className="mt-3 text-blue-100 text-lg">{form.description}</p>
            )}
          </div>
          
          <div className="p-8 sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              {form.fields_schema?.sort((a: any, b: any) => a.field_order - b.field_order).map((field: any) => (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  
                  {field.field_type === "textarea" ? (
                    <textarea
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900 resize-y min-h-[120px]"
                      value={answers[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                    />
                  ) : field.field_type === "dropdown" ? (
                    <select
                      required={field.required}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
                      value={answers[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                    >
                      <option value="">Select an option...</option>
                      {field.options?.map((opt: any, i: number) => (
                        <option key={i} value={opt.value || opt.label || opt}>{opt.label || opt}</option>
                      ))}
                    </select>
                  ) : field.field_type === "radio" ? (
                    <div className="space-y-3 mt-2">
                      {field.options?.map((opt: any, i: number) => (
                        <label key={i} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="radio"
                              name={`field_${field.id}`}
                              value={opt.value || opt.label || opt}
                              required={field.required}
                              checked={answers[field.id] === (opt.value || opt.label || opt)}
                              onChange={(e) => handleChange(field.id, e.target.value)}
                              className="peer sr-only"
                            />
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-all"></div>
                            <div className="absolute w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                          </div>
                          <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{opt.label || opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type={field.field_type === "email" ? "email" : field.field_type === "number" ? "number" : "text"}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
                      value={answers[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                    />
                  )}
                  {field.help_text && (
                    <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
                  )}
                </div>
              ))}
              
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-200 disabled:opacity-50 hover:shadow-xl hover:-translate-y-0.5"
                >
                  {submitMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                  {submitMutation.isPending ? "Submitting..." : "Submit Form"}
                </button>
              </div>
            </form>
          </div>
        </div>
        <p className="text-center text-sm text-slate-400 mt-8">
          Powered by MARKETING-AUTOMATION
        </p>
      </div>
    </div>
  );
}
