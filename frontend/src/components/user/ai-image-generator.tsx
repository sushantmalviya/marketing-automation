"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Coins,
  Download,
  Image as ImageIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { apiClient, parseApiError, resolveApiUrl } from "@/services/api-client";

export type AIImageModelKey = "google_nano_banana" | "openai_gpt_image_2_5";
export type AIImageQuality = "STANDARD" | "HIGH" | "ULTRA";
export type AIImageAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface ImageEstimateResponse {
  model: AIImageModelKey;
  model_label: string;
  provider: string;
  provider_model_id: string;
  quality: AIImageQuality;
  aspect_ratio: AIImageAspectRatio;
  credits: number;
  image_credits?: number;
  caption_credits?: number;
  caption_count?: number;
  caption_unit_credits?: number;
  base_credits: number;
  reference_surcharge: number;
  reference_image_count: number;
  wallet_balance: number;
  sufficient_credits: boolean;
  remaining_after_generation: number;
  brand_identity_active: boolean;
  brand_logo_injected: boolean;
  brand_reference_count: number;
  capabilities?: Array<{
    key: AIImageModelKey;
    label: string;
    supported_qualities: AIImageQuality[];
    supported_aspect_ratios: AIImageAspectRatio[];
  }>;
}

export interface ImageGenerationJobRecord {
  id: string;
  prompt: string;
  brand_identity_applied: boolean;
  reference_image_count: number;
  provider: string;
  model_key: AIImageModelKey;
  model_label: string;
  quality: AIImageQuality;
  aspect_ratio: AIImageAspectRatio;
  status: "PENDING" | "COMPLETED" | "FAILED";
  estimated_credits: number;
  charged_credits: number;
  refunded_credits: number;
  image_url: string;
  asset_id: string | null;
  error_message: string;
  created_at: string;
}

export const MODEL_OPTIONS: Array<{ key: AIImageModelKey; label: string; subtitle: string }> = [
  { key: "google_nano_banana", label: "Google Nano Banana", subtitle: "Nano Banana 2.1" },
  { key: "openai_gpt_image_2_5", label: "OpenAI GPT Image 2.5", subtitle: "GPT Image 2.5" },
];

export const QUALITY_OPTIONS: Array<{ key: AIImageQuality; label: string }> = [
  { key: "STANDARD", label: "Standard" },
  { key: "HIGH", label: "High" },
  { key: "ULTRA", label: "Ultra" },
];

export const ASPECT_RATIO_OPTIONS: AIImageAspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

export function generateClientIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatHistoryDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BrandIdentityBadge({ estimate }: { estimate?: ImageEstimateResponse }) {
  return (
    <Link
      href="/user/account?tab=brand-identity"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
        estimate?.brand_identity_active
          ? "bg-purple-50 text-purple-700 hover:bg-purple-100"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      <ShieldCheck size={14} />
      {estimate?.brand_identity_active
        ? `Brand Identity Connected${
            estimate.brand_reference_count > 0
              ? ` (${estimate.brand_reference_count} visual ref${
                  estimate.brand_reference_count > 1 ? "s" : ""
                })`
              : ""
          }`
        : "Configure Brand Identity"}
    </Link>
  );
}

export function ImageOptionsPanel({
  model,
  quality,
  aspectRatio,
  estimate,
  onModelChange,
  onQualityChange,
  onAspectRatioChange,
}: {
  model: AIImageModelKey;
  quality: AIImageQuality;
  aspectRatio: AIImageAspectRatio;
  estimate?: ImageEstimateResponse;
  onModelChange: (nextModel: AIImageModelKey) => void;
  onQualityChange: (nextQuality: AIImageQuality) => void;
  onAspectRatioChange: (nextRatio: AIImageAspectRatio) => void;
}) {
  const activeCapabilities = useMemo(() => {
    const cap = estimate?.capabilities?.find((item) => item.key === model);
    return {
      qualities: new Set(cap?.supported_qualities ?? ["STANDARD", "HIGH", "ULTRA"]),
      ratios: new Set(cap?.supported_aspect_ratios ?? ASPECT_RATIO_OPTIONS),
    };
  }, [estimate, model]);

  const handleModelSelect = (nextModel: AIImageModelKey) => {
    onModelChange(nextModel);
    const nextCap = estimate?.capabilities?.find((item) => item.key === nextModel);
    if (nextCap && !nextCap.supported_qualities.includes(quality)) {
      onQualityChange(nextCap.supported_qualities[0] ?? "STANDARD");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <span className="block text-sm font-bold text-slate-800">AI Model</span>
        <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="AI Model">
          {MODEL_OPTIONS.map((opt) => {
            const selected = model === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleModelSelect(opt.key)}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  selected
                    ? "border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                }`}
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="mt-0.5 text-xs text-slate-500">{opt.subtitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <span className="block text-sm font-bold text-slate-800">Image Quality</span>
          <div className="mt-2 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Image Quality">
            {QUALITY_OPTIONS.map((opt) => {
              const supported = activeCapabilities.qualities.has(opt.key);
              const selected = quality === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!supported}
                  onClick={() => onQualityChange(opt.key)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="block text-sm font-bold text-slate-800">Aspect Ratio</span>
          <div className="mt-2 grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="Aspect Ratio">
            {ASPECT_RATIO_OPTIONS.map((ratio) => {
              const supported = activeCapabilities.ratios.has(ratio);
              const selected = aspectRatio === ratio;
              return (
                <button
                  key={ratio}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!supported}
                  onClick={() => onAspectRatioChange(ratio)}
                  className={`rounded-xl border px-2.5 py-2.5 text-sm font-bold transition ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {ratio}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreditEstimateBanner({
  estimate,
  isLoading,
  isError,
  error,
}: {
  estimate?: ImageEstimateResponse;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}) {
  const insufficientCredits = estimate ? !estimate.sufficient_credits : false;
  const imageCredits = estimate?.image_credits ?? estimate?.credits ?? 0;
  const captionCredits = estimate?.caption_credits ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-semibold text-slate-700">
          <Coins size={16} className="text-amber-500" />
          Estimated Cost:{" "}
          <strong className="text-slate-950" data-testid="estimated-credits">
            {isLoading ? "…" : `${estimate?.credits ?? "—"} credits`}
          </strong>
        </span>
        <span className="text-xs font-semibold text-slate-600" data-testid="wallet-balance">
          Available Balance:{" "}
          <strong className="text-slate-950">
            {isLoading ? "…" : `${estimate?.wallet_balance ?? 0} credits`}
          </strong>
        </span>
      </div>

      {estimate && (imageCredits > 0 || captionCredits > 0) && (
        <p className="text-xs text-slate-500">
          {[
            imageCredits > 0
              ? `Image: ${imageCredits} cr${
                  estimate.reference_surcharge > 0
                    ? ` (${estimate.base_credits} base + ${estimate.reference_surcharge} for ${estimate.reference_image_count} brand visual ref(s))`
                    : ""
                }`
              : null,
            captionCredits > 0
              ? `Captions: ${captionCredits} cr (${estimate.caption_count} channel(s) × ${estimate.caption_unit_credits ?? 5} cr)`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {estimate && !insufficientCredits && (
        <p className="text-xs text-slate-500">
          Remaining balance after generation:{" "}
          <strong>{estimate.remaining_after_generation} credits</strong>
        </p>
      )}

      {insufficientCredits && (
        <div className="flex items-center gap-2 text-xs font-semibold text-red-600">
          <AlertCircle size={14} />
          Insufficient AI credits. Available: {estimate?.wallet_balance}, Required:{" "}
          {estimate?.credits}.
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-xs font-semibold text-red-600">
          <AlertCircle size={14} />
          {parseApiError(error)}
        </div>
      )}
    </div>
  );
}

export function ImageGenerationHistorySection({
  onUseInPost,
}: {
  onUseInPost?: (assetId: string) => void;
}) {
  const historyQuery = useQuery({
    queryKey: ["ai-image-history"],
    queryFn: async () => {
      const res = await apiClient.get<{ results?: ImageGenerationJobRecord[] } | ImageGenerationJobRecord[]>(
        "/api/content/images/history/",
      );
      return Array.isArray(res.data) ? res.data : (res.data.results ?? []);
    },
  });

  const handleDownload = (url: string, filename = "generated-image.png") => {
    const resolved = resolveApiUrl(url);
    if (!resolved) return;
    const anchor = document.createElement("a");
    anchor.href = resolved;
    anchor.download = filename;
    anchor.target = "_blank";
    anchor.click();
  };

  return (
    <section className="sa-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="font-black text-slate-900">Recent Generated Images</h2>
          <p className="text-xs text-slate-500">
            Generated visuals, credit charges, and automatic refunds from your Content Studio runs.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button flex items-center gap-1.5 px-3 py-1.5 text-xs"
          onClick={() => void historyQuery.refetch()}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {historyQuery.isLoading ? (
        <div className="p-6 text-sm text-slate-500">Loading image history...</div>
      ) : !historyQuery.data?.length ? (
        <div className="p-10 text-center text-sm text-slate-500">
          <ImageIcon size={32} className="mx-auto mb-2 text-slate-300" />
          No generated images yet. Your Content Studio visuals will appear here.
        </div>
      ) : (
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {historyQuery.data.map((job, idx) => (
            <motion.article
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative h-40 w-full bg-slate-100">
                {job.status === "COMPLETED" && job.image_url ? (
                  <NextImage
                    unoptimized
                    src={resolveApiUrl(job.image_url) || job.image_url}
                    alt={job.prompt}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-3 text-center text-xs text-red-600">
                    <AlertCircle size={24} className="mb-1" />
                    <span className="font-bold">Generation Failed</span>
                    {job.refunded_credits > 0 && (
                      <span className="mt-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Refunded {job.refunded_credits} credits
                      </span>
                    )}
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm">
                  {job.aspect_ratio} · {job.quality}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-3.5">
                <p className="text-[11px] font-bold text-blue-600">{job.model_label}</p>
                <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-800">{job.prompt}</p>
                {job.status === "FAILED" && job.error_message && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-red-500">{job.error_message}</p>
                )}

                <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{formatHistoryDate(job.created_at)}</span>
                  <span className="font-bold text-slate-700">
                    {job.status === "COMPLETED"
                      ? `${job.charged_credits} cr`
                      : job.refunded_credits > 0
                      ? "Refunded"
                      : "Failed"}
                  </span>
                </div>

                {job.status === "COMPLETED" && job.image_url && (
                  <div className="mt-2.5 flex gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      className="secondary-button flex-1 justify-center py-1.5 text-xs"
                      onClick={() => handleDownload(job.image_url)}
                    >
                      <Download size={12} /> Download
                    </button>
                    {job.asset_id && onUseInPost && (
                      <button
                        type="button"
                        className="primary-button flex-1 justify-center py-1.5 text-xs"
                        onClick={() => onUseInPost(job.asset_id!)}
                      >
                        <Sparkles size={12} /> Use
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
