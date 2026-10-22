"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Search,
  Check,
  FolderOpen,
  AlertCircle,
  Link2,
} from "lucide-react";
import { apiClient, parseApiError, resolveApiUrl } from "@/services/api-client";
import { toast } from "sonner";
import { SmsHeaderType } from "./sms-types";

interface Asset {
  id: string;
  name: string;
  file_url: string;
  asset_type: "IMAGE" | "DOCUMENT" | "VIDEO" | "OTHER";
  created_at: string;
}

interface AssetPage {
  count: number;
  results: Asset[];
}

export interface SmsMediaPickerModalProps {
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT";
  onSelect: (data: { url: string; name: string }) => void;
  onClose: () => void;
}

const MEDIA_LIMITS = {
  IMAGE: {
    title: "Promotional Image Header",
    accept: "image/jpeg,image/png,image/webp,image/gif",
    maxSizeMb: 5,
    description: "Supported: JPEG, PNG, WEBP, GIF. Max size: 5 MB.",
    icon: ImageIcon,
  },
  VIDEO: {
    title: "Promotional Video Header",
    accept: "video/mp4,video/3gpp,video/quicktime",
    maxSizeMb: 16,
    description: "Supported: MP4, 3GP, MOV. Max size: 16 MB.",
    icon: Video,
  },
  DOCUMENT: {
    title: "Document Attachment Header",
    accept: ".pdf,.doc,.docx,.txt,.csv",
    maxSizeMb: 50,
    description: "Supported: PDF, DOCX, TXT, CSV. Max size: 50 MB.",
    icon: FileText,
  },
};

export function SmsMediaPickerModal({
  mediaType,
  onSelect,
  onClose,
}: SmsMediaPickerModalProps) {
  const config = MEDIA_LIMITS[mediaType];
  const IconComponent = config.icon;

  const [tab, setTab] = useState<"library" | "upload" | "url">("library");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [directUrl, setDirectUrl] = useState("");

  const { data, isLoading, refetch } = useQuery<AssetPage>({
    queryKey: ["sms-user-assets-picker", mediaType],
    queryFn: async () =>
      (await apiClient.get<AssetPage>("/api/assets/", { params: { size: 100 } })).data,
  });

  const filteredAssets = (data?.results ?? []).filter(
    (a) =>
      a.asset_type === mediaType &&
      (!search || a.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > config.maxSizeMb) {
      toast.error(`File size exceeds maximum limit of ${config.maxSizeMb} MB`);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("name", selectedFile.name);
      fd.append("asset_type", mediaType);
      fd.append("is_personal", "false");

      const res = await apiClient.post<Asset>("/api/assets/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(`${config.title} uploaded successfully`);
      await refetch();
      const resolved = resolveApiUrl(res.data.file_url) || res.data.file_url;
      onSelect({ url: resolved, name: res.data.name || selectedFile.name });
      onClose();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDirectUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = directUrl.trim();
    if (!trimmed) {
      toast.error("Please enter a valid media URL");
      return;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      toast.error("Media URL must begin with http:// or https://");
      return;
    }
    const filename = trimmed.split("/").pop() || `${mediaType.toLowerCase()}_asset`;
    onSelect({ url: trimmed, name: filename });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <IconComponent size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">{config.title}</h3>
              <p className="text-xs text-slate-400">{config.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setTab("library")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              tab === "library"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FolderOpen size={14} />
            <span>Asset Library</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              tab === "upload"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Upload size={14} />
            <span>Upload New</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              tab === "url"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Link2 size={14} />
            <span>Direct URL</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: ASSET LIBRARY */}
          {tab === "library" && (
            <div className="space-y-4">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${mediaType.toLowerCase()} assets...`}
                  className="sa-input pl-10 text-xs py-2 w-full"
                />
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading assets...</div>
              ) : filteredAssets.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <IconComponent size={24} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">No {mediaType.toLowerCase()} assets found</p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Upload an asset to your library or enter a direct media URL.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("upload")}
                    className="secondary-button text-xs px-3 py-1.5 mt-2"
                  >
                    Upload Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredAssets.map((asset) => {
                    const resolvedUrl = resolveApiUrl(asset.file_url) || asset.file_url;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => {
                          onSelect({ url: resolvedUrl, name: asset.name });
                          onClose();
                        }}
                        className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 hover:border-indigo-500 hover:shadow-md transition flex flex-col"
                      >
                        {mediaType === "IMAGE" ? (
                          <div className="aspect-video w-full rounded-lg bg-slate-100 overflow-hidden mb-2">
                            <img
                              src={resolvedUrl}
                              alt={asset.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video w-full rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2">
                            <IconComponent size={28} />
                          </div>
                        )}
                        <p className="text-xs font-bold text-slate-800 truncate">{asset.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(asset.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UPLOAD */}
          {tab === "upload" && (
            <div className="space-y-4">
              <label
                htmlFor="sms-asset-upload-input"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition group"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition mb-3">
                  <Upload size={22} />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : `Choose a ${mediaType.toLowerCase()} file`}
                </p>
                <p className="text-xs text-slate-400 mt-1">{config.description}</p>
                <input
                  id="sms-asset-upload-input"
                  type="file"
                  accept={config.accept}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="primary-button text-xs px-4 py-2 !bg-indigo-600 hover:!bg-indigo-700 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : `Upload & Use ${mediaType}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT URL */}
          {tab === "url" && (
            <form onSubmit={handleSelectDirectUrl} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Public Media URL
                </label>
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder={`https://example.com/assets/${mediaType.toLowerCase()}.png`}
                  className="sa-input w-full text-xs font-mono py-2"
                />
                <p className="text-[11px] text-slate-400">
                  Must be publicly accessible via HTTPS for mobile recipients.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="secondary-button text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!directUrl.trim()}
                  className="primary-button text-xs px-4 py-2 !bg-indigo-600 hover:!bg-indigo-700 disabled:opacity-50"
                >
                  Apply Media URL
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
