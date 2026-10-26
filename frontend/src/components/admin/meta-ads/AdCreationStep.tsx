"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Facebook,
  Instagram,
  Image as ImageIcon,
  Video,
  Layers,
  Upload,
  FolderOpen,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ArrowRight,
  ExternalLink,
  Sparkles,
  HelpCircle,
  FileText,
  Sliders,
  Check,
  X,
  Play,
  Volume2,
  Share2,
  MessageCircle,
  Heart,
  Bookmark,
  MoreVertical,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import type {
  CampaignFormData,
  AdSetFormData,
  AdCreativeFormData,
} from "@/types/meta-ads";

interface AdCreationStepProps {
  campaignData?: CampaignFormData;
  adSetData?: AdSetFormData;
  formData: AdCreativeFormData;
  onChange: (updated: Partial<AdCreativeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onNavigateStep: (step: number) => void;
  currencySymbol?: string;
  currencyCode?: string;
}

const PAGES_LIST = [
  { id: "page_automarket", name: "Auto Market Official", avatar: "🏢", ig: "@automarket_official" },
  { id: "page_realestate", name: "Apex Real Estate & Properties", avatar: "🏡", ig: "@apex_properties" },
  { id: "page_interiors", name: "Luxe Interior Design Studio", avatar: "🛋️", ig: "@luxe_interiors" },
  { id: "page_agency", name: "Growth Marketing Agency", avatar: "🚀", ig: "@growth_agency" },
];

const CTA_OPTIONS = [
  "Get Quote",
  "Learn More",
  "Sign Up",
  "Contact Us",
  "Apply Now",
  "Book Now",
  "Subscribe",
];

const PREVIEW_PLATFORMS = [
  { id: "fb_feed", label: "Facebook Mobile Feed", icon: Facebook, ratio: "1:1" },
  { id: "ig_feed", label: "Instagram Feed", icon: Instagram, ratio: "1:1" },
  { id: "fb_stories", label: "Facebook Stories", icon: Facebook, ratio: "9:16" },
  { id: "ig_stories", label: "Instagram Stories", icon: Instagram, ratio: "9:16" },
  { id: "fb_reels", label: "Facebook Reels", icon: Facebook, ratio: "9:16" },
  { id: "ig_reels", label: "Instagram Reels", icon: Instagram, ratio: "9:16" },
] as const;

export function AdCreationStep({
  campaignData,
  adSetData,
  formData,
  onChange,
  onNext,
  onBack,
  onClose,
  onNavigateStep,
  currencySymbol = "₹",
  currencyCode = "INR",
}: AdCreationStepProps) {
  const [activePlatform, setActivePlatform] = useState<string>("fb_feed");
  const [isAssetLibraryModalOpen, setIsAssetLibraryModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileAccept, setFileAccept] = useState("image/*");

  const nameRef = useRef<HTMLInputElement>(null);
  const primaryTextRef = useRef<HTMLTextAreaElement>(null);
  const headlineRef = useRef<HTMLInputElement>(null);

  // Asset Library Query
  const assetsQuery = useQuery({
    queryKey: ["assets-for-ads"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ results?: any[]; data?: any[] }>("/api/assets/");
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (raw?.results || raw?.data || []);
        return list;
      } catch {
        return [];
      }
    },
    enabled: isAssetLibraryModalOpen,
  });

  // Validation
  const validation = useMemo(() => {
    const errors: Array<{ id: string; message: string; ref?: React.RefObject<any> }> = [];
    const warnings: Array<{ id: string; message: string }> = [];

    if (!formData.name || formData.name.trim().length === 0) {
      errors.push({ id: "ad_name", message: "Ad name is required.", ref: nameRef });
    }

    if (!formData.media_url && !formData.media_file) {
      errors.push({ id: "media", message: "An image or video creative is required." });
    }

    if (!formData.primary_text || formData.primary_text.trim().length === 0) {
      errors.push({ id: "primary_text", message: "Primary text is required.", ref: primaryTextRef });
    }

    if (!formData.headline || formData.headline.trim().length === 0) {
      errors.push({ id: "headline", message: "Headline is required.", ref: headlineRef });
    }

    if (!formData.page_id) {
      errors.push({ id: "page_id", message: "A Facebook Page identity must be selected." });
    }

    if (adSetData?.conversion_location === "INSTANT_FORMS" && !adSetData?.leadgen_form_id) {
      errors.push({ id: "lead_form_missing", message: "A Lead Form must be connected for this campaign." });
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }, [formData, adSetData]);

  // Handle local media upload
  const triggerFileInput = (type: "image" | "video") => {
    setFileAccept(type === "image" ? "image/*" : "video/*");
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 40);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVid = file.type.startsWith("video");
      const url = URL.createObjectURL(file);
      onChange({
        media_file: file,
        media_name: file.name,
        media_type: isVid ? "video" : "image",
        media_url: url,
      });
    }
  };

  const removeMedia = () => {
    onChange({
      media_file: null,
      media_name: "",
      media_url: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectedPage = useMemo(() => {
    return PAGES_LIST.find((p) => p.id === formData.page_id) || PAGES_LIST[0];
  }, [formData.page_id]);

  const handleNext = () => {
    if (validation.errors.length > 0) {
      const firstError = validation.errors[0];
      if (firstError?.ref?.current) {
        firstError.ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.ref.current.focus?.();
      }
      return;
    }
    onNext();
  };

  const isStoriesOrReels = activePlatform.includes("stories") || activePlatform.includes("reels");
  const isInstagramPlatform = activePlatform.startsWith("ig_");

  return (
    <div className="flex flex-col min-h-[640px] bg-slate-50 text-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-xl">
      {/* 1. Header Bar matching Meta Ads Manager Level 3 */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-3">
          <nav aria-label="Campaign hierarchy" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => onNavigateStep(1)}
              className="max-w-[170px] truncate text-slate-600 font-medium hover:text-blue-600 transition"
              title={campaignData?.name || "New Leads campaign"}
            >
              {campaignData?.name || "New Leads campaign"}
            </button>
            <span className="text-slate-400">&gt;</span>
            <button
              type="button"
              onClick={() => onNavigateStep(2)}
              className="max-w-[170px] truncate text-slate-600 font-medium hover:text-blue-600 transition"
              title={adSetData?.name || "1 Ad set"}
            >
              {adSetData?.name || "1 Ad set"}
            </button>
            <span className="text-slate-400">&gt;</span>
            <span className="max-w-[170px] truncate text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
              1 Ad
            </span>
          </nav>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            Draft
          </span>

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.status !== "PAUSED"}
                onChange={(e) => onChange({ status: e.target.checked ? "ACTIVE" : "PAUSED" })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <span className="text-xs font-bold text-slate-700">
              {formData.status !== "PAUSED" ? (
                <span className="text-emerald-700">Active</span>
              ) : (
                <span className="text-slate-500">Inactive</span>
              )}
            </span>
          </div>
        </div>

        {/* View Mode & Review CTA */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              className="rounded-md px-3 py-1 bg-white text-blue-700 shadow-sm font-bold"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onNavigateStep(4)}
              className="rounded-md px-3 py-1 text-slate-600 hover:text-slate-900 transition"
            >
              Review
            </button>
          </div>
        </div>
      </header>

      {/* Main Content: Left Configuration + Right Sticky Live Preview */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
        {/* Left Column (7 cols in LG) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Ad Name */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                  1
                </span>
                <h3 className="text-base font-bold text-slate-900">Ad name</h3>
              </div>
              <span className="text-xs font-medium text-slate-400">Required</span>
            </div>
            <input
              ref={nameRef}
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. New Leads Ad - Festive Offer Video"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
            />
          </section>

          {/* Section 2: Identity (Facebook Page & Instagram Account) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                2
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Identity</h3>
                <p className="text-xs text-slate-500">
                  Select the public Facebook Page and Instagram profile that represents this ad.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Facebook size={14} className="text-blue-600" />
                  <span>Facebook Page</span>
                </label>
                <select
                  value={formData.page_id}
                  onChange={(e) => {
                    const found = PAGES_LIST.find((p) => p.id === e.target.value);
                    onChange({
                      page_id: e.target.value,
                      page_name: found?.name || "Auto Market Official",
                      instagram_account: found?.ig || "@automarket_official",
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white"
                >
                  {PAGES_LIST.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Instagram size={14} className="text-pink-600" />
                  <span>Instagram Account</span>
                </label>
                <select
                  value={formData.instagram_account}
                  onChange={(e) => onChange({ instagram_account: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white"
                >
                  <option value={selectedPage.ig}>{selectedPage.ig} (Connected)</option>
                  <option value="Use selected Facebook Page">Use selected Facebook Page</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section 3: Ad Setup & Creative Format */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                3
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Creative format</h3>
                <p className="text-xs text-slate-500">Choose how you&apos;d like to structure your ad creative.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => onChange({ format: "SINGLE_IMAGE_VIDEO" })}
                className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                  formData.format === "SINGLE_IMAGE_VIDEO"
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="ad_format"
                  checked={formData.format === "SINGLE_IMAGE_VIDEO"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">Single image or video</span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    One high-impact photo or video showcasing your value proposition.
                  </p>
                </div>
              </label>

              <label
                onClick={() => onChange({ format: "CAROUSEL" })}
                className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                  formData.format === "CAROUSEL"
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="ad_format"
                  checked={formData.format === "CAROUSEL"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">Carousel</span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    2 or more scrollable media cards with individual headlines.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* Section 4: Media Selection & Upload */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Ad Creative Media</h3>
                <p className="text-xs text-slate-500">Add an image or video to appear on user feeds.</p>
              </div>
              {formData.media_url && (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <Check size={12} />
                  <span>Media active</span>
                </span>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept={fileAccept}
              onChange={handleFileChange}
              className="hidden"
            />

            {!formData.media_url ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <ImageIcon size={26} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Add creative media to your ad</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload from your device or select from your Marketing Auto Asset Library.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => triggerFileInput("image")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    <Upload size={14} />
                    <span>Upload Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerFileInput("video")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Video size={14} />
                    <span>Upload Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAssetLibraryModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    <FolderOpen size={14} />
                    <span>Select from Asset Library</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-black flex items-center justify-center">
                  {formData.media_type === "video" ? (
                    <video src={formData.media_url} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={formData.media_url} alt="Ad creative preview" className="h-full w-full object-cover" />
                  )}
                  {formData.media_type === "video" && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play size={16} className="text-white fill-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {formData.media_name || "Active creative asset"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formData.media_type === "video" ? "MP4 Video format" : "Standard Image format"} · Ready for Meta placement
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerFileInput(formData.media_type)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={removeMedia}
                    className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 transition"
                    title="Remove media"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Section 5: Ad Copy & Text */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Text and links</h3>

            {/* Primary Text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800">Primary Text</label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {formData.primary_text?.length || 0} chars
                </span>
              </div>
              <textarea
                ref={primaryTextRef}
                rows={3}
                value={formData.primary_text}
                onChange={(e) => onChange({ primary_text: e.target.value })}
                placeholder="Tell people what your offer is and why they should submit their information..."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Appears above the image/video on Facebook and below the handle on Instagram.
              </p>
            </div>

            {/* Headline */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800">Headline</label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {formData.headline?.length || 0} chars
                </span>
              </div>
              <input
                ref={headlineRef}
                type="text"
                value={formData.headline}
                onChange={(e) => onChange({ headline: e.target.value })}
                placeholder="e.g. Book Your Free Consultation Today"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">Description (Optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="e.g. Limited spots available this festive week"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Call to Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Call to action</label>
                <select
                  value={formData.call_to_action}
                  onChange={(e) => onChange({ call_to_action: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
                >
                  {CTA_OPTIONS.map((cta) => (
                    <option key={cta} value={cta}>
                      {cta}
                    </option>
                  ))}
                </select>
              </div>

              {/* Connected Lead Form Indicator */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Connected Lead Form</label>
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs font-bold text-emerald-900">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText size={14} className="text-emerald-700 shrink-0" />
                    <span className="truncate">
                      {adSetData?.custom_form_name || "Diwali Festive Leads 2026 Form"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateStep(2)}
                    className="text-[11px] font-bold text-blue-700 hover:underline shrink-0 ml-2"
                  >
                    Change in Ad Set
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Sticky Live Preview Panel (5 cols in LG) */}
        <aside className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 sticky top-20">
            {/* Preview Header & Platform Switcher */}
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-blue-600" />
                  <span>DYNAMIC LIVE AD PREVIEW</span>
                </h4>
                <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold">
                  Live Sync
                </span>
              </div>

              {/* Platform Selector */}
              <select
                value={activePlatform}
                onChange={(e) => setActivePlatform(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white transition cursor-pointer"
              >
                {PREVIEW_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Realistic Preview Device Frame */}
            <div className="flex justify-center py-2">
              {/* Feeds Mockup */}
              {!isStoriesOrReels ? (
                <div className="w-full max-w-[320px] rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden transition-all duration-200">
                  {/* Account Header */}
                  <div className="p-3 flex items-center justify-between border-b border-slate-50">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold shadow-inner">
                        {selectedPage.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900 leading-none">
                          {isInstagramPlatform ? selectedPage.ig : selectedPage.name}
                        </p>
                        <span className="text-[10px] text-slate-400 font-normal mt-0.5 block">
                          Sponsored · 🌐
                        </span>
                      </div>
                    </div>
                    <MoreVertical size={16} className="text-slate-400" />
                  </div>

                  {/* Primary text */}
                  <p className="px-3 py-2 text-xs text-slate-800 leading-snug line-clamp-3">
                    {formData.primary_text || "Your engaging primary copy will appear right here."}
                  </p>

                  {/* Media Banner */}
                  <div className="relative aspect-square w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                    {formData.media_url ? (
                      formData.media_type === "video" ? (
                        <video src={formData.media_url} controls={false} autoPlay loop muted className="h-full w-full object-cover" />
                      ) : (
                        <img src={formData.media_url} alt="Ad media preview" className="h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="h-full w-full bg-gradient-to-tr from-slate-200 via-blue-50 to-indigo-100 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <ImageIcon size={36} className="mb-2 text-slate-300" />
                        <span className="text-xs font-semibold">Upload an image or video to preview</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="min-w-0 pr-1">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        {selectedPage.name}
                      </p>
                      <p className="text-xs font-black text-slate-900 truncate">
                        {formData.headline || "Headline for your offer"}
                      </p>
                      {formData.description && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{formData.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 whitespace-nowrap shrink-0 transition"
                    >
                      {formData.call_to_action}
                    </button>
                  </div>
                </div>
              ) : (
                /* Stories / Reels 9:16 Vertical Smartphone Mockup */
                <div className="relative w-[240px] h-[420px] rounded-3xl overflow-hidden shadow-2xl bg-black flex flex-col justify-between p-3.5 text-white transition-all duration-200 border-4 border-slate-800">
                  {/* Media background */}
                  {formData.media_url ? (
                    formData.media_type === "video" ? (
                      <video src={formData.media_url} autoPlay loop muted className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    ) : (
                      <img src={formData.media_url} alt="Stories preview" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    )
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-900 via-slate-900 to-black opacity-90" />
                  )}

                  {/* Gradient overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

                  {/* Stories top profile header */}
                  <div className="relative z-10 flex items-center gap-2 pt-1">
                    <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-slate-900 shadow">
                      {selectedPage.avatar}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold leading-tight drop-shadow">
                        {isInstagramPlatform ? selectedPage.ig : selectedPage.name}
                      </p>
                      <span className="text-[9px] text-white/80 font-normal">Sponsored</span>
                    </div>
                  </div>

                  {/* Stories Bottom Content & CTA */}
                  <div className="relative z-10 space-y-2">
                    <p className="text-[11px] font-semibold text-white/95 leading-snug drop-shadow line-clamp-2">
                      {formData.primary_text || "Your primary text teaser appears overlaying the vertical creative."}
                    </p>
                    <div className="rounded-xl bg-white/20 backdrop-blur-md p-2 border border-white/20 text-center">
                      <p className="text-[10px] font-extrabold text-white truncate">{formData.headline}</p>
                      <button
                        type="button"
                        className="mt-1.5 w-full rounded-lg bg-blue-600 py-1.5 text-xs font-black text-white shadow-lg flex items-center justify-center gap-1 hover:bg-blue-700 transition"
                      >
                        <span>{formData.call_to_action}</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Creative Readiness Check
              </span>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 size={14} className={formData.name ? "text-emerald-600" : "text-slate-300"} />
                <span>Ad Name set</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 size={14} className={formData.media_url ? "text-emerald-600" : "text-slate-300"} />
                <span>Creative Media attached</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 size={14} className={formData.primary_text ? "text-emerald-600" : "text-slate-300"} />
                <span>Primary text written</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 size={14} className={formData.headline ? "text-emerald-600" : "text-slate-300"} />
                <span>Headline configured</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Docked Footer Navigation Bar */}
      <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 shadow-md">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          <ChevronLeft size={16} />
          <span>Back to Ad Set</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
          <CheckCircle2 size={13} className="text-emerald-600" />
          <span>All edits saved</span>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-98 transition disabled:opacity-50"
        >
          <span>Continue to Review</span>
          <ArrowRight size={16} />
        </button>
      </footer>

      {/* Asset Library Picker Modal */}
      {isAssetLibraryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Asset from Library</h3>
                <p className="text-xs text-slate-500">Pick from existing high-resolution marketing creatives.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssetLibraryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {assetsQuery.isLoading ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                  Loading your assets...
                </div>
              ) : (assetsQuery.data?.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No assets found in library. Use the direct upload buttons.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 p-1">
                  {assetsQuery.data?.map((asset: any) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        onChange({
                          media_url: asset.file_url,
                          media_name: asset.name,
                          media_type: asset.asset_type === "VIDEO" ? "video" : "image",
                          media_file: null,
                        });
                        setIsAssetLibraryModalOpen(false);
                      }}
                      className="group relative aspect-video rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-600 hover:ring-2 hover:ring-blue-600/30 transition bg-slate-100"
                    >
                      {asset.asset_type === "VIDEO" ? (
                        <video src={asset.file_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={asset.file_url} alt={asset.name} className="h-full w-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                          Select
                        </span>
                      </div>
                      <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        {asset.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAssetLibraryModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
