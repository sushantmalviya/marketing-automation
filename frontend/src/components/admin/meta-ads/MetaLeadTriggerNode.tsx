"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Power,
  Trash2,
  RefreshCw,
  ExternalLink,
  Layers,
  FileText,
  CheckCircle2,
  Plus,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { parseApiError } from "@/services/api-client";
import { metaAdsService } from "@/services/meta-ads.service";
import type { MetaLeadTrigger } from "@/types/meta-ads";

export function MetaLeadTriggerNode({
  onSyncForm,
  isSyncing,
}: {
  onSyncForm?: (formId: string) => void;
  isSyncing?: boolean;
}) {
  const queryClient = useQueryClient();

  // Selected state for creating a new trigger
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selectedFormId, setSelectedFormId] = useState("all");
  const [isCreatingOpen, setIsCreatingOpen] = useState(false);

  // Queries
  const triggersQuery = useQuery({
    queryKey: ["meta-lead-triggers"],
    queryFn: () => metaAdsService.getTriggers(),
    refetchInterval: 15000,
  });

  const pagesQuery = useQuery({
    queryKey: ["meta-pages"],
    queryFn: () => metaAdsService.getPages(),
  });

  const formsQuery = useQuery({
    queryKey: ["meta-page-lead-forms", selectedPageId],
    queryFn: () => metaAdsService.getPageLeadForms(selectedPageId),
    enabled: !!selectedPageId,
  });

  // Mutations
  const createTriggerMutation = useMutation({
    mutationFn: () => {
      const page = pagesQuery.data?.find((p) => p.id === selectedPageId);
      const form = formsQuery.data?.find((f) => f.id === selectedFormId);
      const pageName = page?.name || selectedPageId;
      const formName =
        selectedFormId === "all"
          ? "All Forms on this Page"
          : form?.name || selectedFormId;

      return metaAdsService.createTrigger({
        page_id: selectedPageId,
        page_name: pageName,
        form_id: selectedFormId,
        form_name: formName,
        is_active: true,
      });
    },
    onSuccess: (data) => {
      toast.success(
        `Trigger for "${data.page_name}" (${data.form_name}) activated!`
      );
      queryClient.invalidateQueries({ queryKey: ["meta-lead-triggers"] });
      setIsCreatingOpen(false);
      setSelectedFormId("all");
    },
    onError: (err) => {
      toast.error(parseApiError(err));
    },
  });

  const toggleTriggerMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      metaAdsService.updateTrigger(id, { is_active }),
    onSuccess: (data) => {
      toast.success(
        `Trigger ${data.is_active ? "activated" : "deactivated"} successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["meta-lead-triggers"] });
    },
    onError: (err) => {
      toast.error(parseApiError(err));
    },
  });

  const deleteTriggerMutation = useMutation({
    mutationFn: (id: string) => metaAdsService.deleteTrigger(id),
    onSuccess: () => {
      toast.success("Trigger deleted");
      queryClient.invalidateQueries({ queryKey: ["meta-lead-triggers"] });
    },
    onError: (err) => {
      toast.error(parseApiError(err));
    },
  });

  const triggers = triggersQuery.data || [];
  const hasActiveTriggers = triggers.some((t) => t.is_active);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/20 p-5 shadow-sm">
      {/* n8n-Style Node Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-[#1877F2] to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Zap size={20} className="fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-700">
                Trigger Node
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  hasActiveTriggers
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <Radio
                  size={10}
                  className={hasActiveTriggers ? "animate-pulse" : ""}
                />
                {hasActiveTriggers ? "Listening Live" : "Idle"}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Facebook Lead Ads Trigger
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreatingOpen(!isCreatingOpen)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus size={14} />
            <span>Add Trigger</span>
          </button>
        </div>
      </div>

      {/* Trigger Creator Modal / Expandable Panel */}
      {isCreatingOpen && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <SlidersHorizontal size={14} className="text-indigo-600" />
              <span>Configure New Trigger</span>
            </div>
            <button
              onClick={() => setIsCreatingOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Select Facebook Page
              </label>
              <select
                value={selectedPageId}
                onChange={(e) => {
                  setSelectedPageId(e.target.value);
                  setSelectedFormId("all");
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">-- Choose a Page --</option>
                {pagesQuery.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Instant Form Filter
              </label>
              <select
                value={selectedFormId}
                disabled={!selectedPageId || formsQuery.isLoading}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="all">⚡ All Forms on this Page (Recommended)</option>
                {formsQuery.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreatingOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedPageId || createTriggerMutation.isPending}
              onClick={() => createTriggerMutation.mutate()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {createTriggerMutation.isPending
                ? "Subscribing & Activating..."
                : "Activate Trigger"}
            </button>
          </div>
        </div>
      )}

      {/* Configured Triggers List */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>Active Triggers ({triggers.length})</span>
          <span className="text-[11px] font-normal text-slate-500">
            Automatically pulls lead details when submitted
          </span>
        </div>

        {triggersQuery.isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Loading triggers...
          </div>
        ) : triggers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-indigo-200 bg-white/60 p-6 text-center text-xs text-slate-500">
            <Zap size={24} className="mx-auto mb-2 text-indigo-400 opacity-80" />
            <p className="font-semibold text-slate-700">No triggers configured yet.</p>
            <p className="mt-1 text-slate-500">
              Click &quot;Add Trigger&quot; above to select a Facebook Page and start receiving leads instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {triggers.map((trigger: MetaLeadTrigger) => (
              <div
                key={trigger.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-200"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-lg ${
                      trigger.is_active
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Layers size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        {trigger.page_name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                        {trigger.page_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <FileText size={12} className="text-slate-400" />
                      <span>{trigger.form_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Lead metrics */}
                  <div className="text-right text-[11px]">
                    <div className="font-bold text-slate-800">
                      {trigger.leads_count} lead{trigger.leads_count === 1 ? "" : "s"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {trigger.last_lead_at
                        ? `Last: ${new Date(trigger.last_lead_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "No leads yet"}
                    </div>
                  </div>

                  {/* Manual Form Sync */}
                  {trigger.form_id !== "all" && onSyncForm && (
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => onSyncForm(trigger.form_id)}
                      className="rounded bg-blue-50 border border-blue-200 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition disabled:opacity-50"
                      title="Fetch test leads or historical submissions"
                    >
                      <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
                    </button>
                  )}

                  {/* Active Toggle Switch */}
                  <button
                    type="button"
                    onClick={() =>
                      toggleTriggerMutation.mutate({
                        id: trigger.id,
                        is_active: !trigger.is_active,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      trigger.is_active ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                    title={trigger.is_active ? "Deactivate trigger" : "Activate trigger"}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        trigger.is_active ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this lead trigger?")) {
                        deleteTriggerMutation.mutate(trigger.id);
                      }
                    }}
                    className="p-1 text-slate-300 hover:text-red-600 transition"
                    title="Delete trigger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helpful Testing Tool Banner */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50/70 border border-indigo-100/80 px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 font-medium">
          <CheckCircle2 size={15} className="text-indigo-600" />
          <span>Test live webhook delivery:</span>
        </div>
        <a
          href="https://developers.facebook.com/tools/lead-ads-testing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 transition"
        >
          <span>Open Meta Lead Ads Testing Tool</span>
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
