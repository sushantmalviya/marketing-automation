"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
import { WhatsAppHeaderType } from "./whatsapp-types";

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

interface WhatsAppMediaPickerModalProps {
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT";
  onSelect: (data: { url: string; name: string }) => void;
  onClose: () => void;
}

const MEDIA_LIMITS = {
  IMAGE: {
    title: "Image Header",
    accept: "image/jpeg,image/png,image/webp",
    maxSizeMb: 5,
    description: "Supported: JPEG, PNG, WEBP. Max size: 5 MB.",
    icon: ImageIcon,
  },
  VIDEO: {
    title: "Video Header",
    accept: "video/mp4,video/3gpp,video/quicktime",
    maxSizeMb: 16,
    description: "Supported: MP4, 3GP, MOV. Max size: 16 MB.",
    icon: Video,
  },
  DOCUMENT: {
    title: "Document Header",
    accept: ".pdf,.doc,.docx,.txt,.csv",
    maxSizeMb: 100,
    description: "Supported: PDF, DOCX, TXT, CSV. Max size: 100 MB.",
    icon: FileText,
  },
};

export function WhatsAppMediaPickerModal({
  mediaType,
  onSelect,
  onClose,
}: WhatsAppMediaPickerModalProps) {
  const config = MEDIA_LIMITS[mediaType];
  const IconComponent = config.icon;

  const [tab, setTab] = useState<"library" | "upload" | "url">("library");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [directUrl, setDirectUrl] = useState("");

  const { data, isLoading, refetch } = useQuery<AssetPage>({
    queryKey: ["user-assets-picker", mediaType],
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

    // Check size limit
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

  const handleDirectUrlSubmit = () => {
    if (!directUrl.trim()) {
      toast.error("Please enter a valid media URL");
      return;
    }
    const cleanUrl = directUrl.trim();
    const fileName = cleanUrl.split("/").pop()?.split("?")[0] || `${mediaType.toLowerCase()}_asset`;
    onSelect({ url: cleanUrl, name: fileName });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <IconComponent size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Select {config.title}</h3>
              <p className="text-xs text-slate-400">{config.description}</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 px-6 pt-2 bg-slate-50/50">
          <button
            type="button"
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "library"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("library")}
          >
            <FolderOpen size={14} />
            <span>Asset Library</span>
          </button>
          <button
            type="button"
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "upload"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("upload")}
          >
            <Upload size={14} />
            <span>Upload New</span>
          </button>
          <button
            type="button"
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "url"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("url")}
          >
            <Link2 size={14} />
            <span>Direct URL</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "library" && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${mediaType.toLowerCase()} assets...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sa-input pl-9 text-xs"
                />
              </div>

              {isLoading ? (
                <div className="flex h-48 items-center justify-center text-slate-400 text-xs">
                  Loading assets...
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 p-6 text-center space-y-2">
                  <IconComponent size={32} className="text-slate-300" />
                  <p className="text-xs font-semibold text-slate-700">No {mediaType.toLowerCase()} assets found</p>
                  <p className="text-[11px] text-slate-400">Upload a file or choose direct URL to attach</p>
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
                    const resolved = resolveApiUrl(asset.file_url) || asset.file_url;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          onSelect({ url: resolved, name: asset.name });
                          onClose();
                        }}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2 hover:border-emerald-500 hover:shadow-md transition text-left"
                      >
                        <div className="relative aspect-video w-full rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                          {asset.asset_type === "IMAGE" ? (
                            <img
                              src={resolved}
                              alt={asset.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : asset.asset_type === "VIDEO" ? (
                            <div className="flex flex-col items-center text-slate-400">
                              <Video size={24} className="text-emerald-600 mb-1" />
                              <span className="text-[10px] font-mono">Video File</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-slate-400">
                              <FileText size={24} className="text-blue-600 mb-1" />
                              <span className="text-[10px] font-mono">Document</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-emerald-600/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <span className="rounded-full bg-emerald-600 p-1.5 text-white shadow-sm">
                              <Check size={14} />
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 truncate text-xs font-semibold text-slate-800" title={asset.name}>
                          {asset.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-4">
              <label
                htmlFor="whatsapp-media-file-input"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:border-emerald-500 hover:bg-emerald-50/20 transition cursor-pointer text-center"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
                  <Upload size={24} />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : `Click or drag ${mediaType.toLowerCase()} here`}
                </p>
                <p className="text-xs text-slate-400 mt-1">{config.description}</p>
                <input
                  id="whatsapp-media-file-input"
                  type="file"
                  accept={config.accept}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <div className="flex items-center gap-2 truncate">
                    <IconComponent size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-800 truncate">
                      {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-slate-400 hover:text-red-500 font-semibold"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="secondary-button text-xs px-4" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || uploading}
                  onClick={handleUpload}
                  className="primary-button text-xs px-5 py-2 !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : `Upload & Use ${mediaType}`}
                </button>
              </div>
            </div>
          )}

          {tab === "url" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Link2 size={13} className="text-emerald-600" />
                  <span>Public Media URL</span>
                </label>
                <input
                  type="url"
                  placeholder={`https://example.com/assets/${mediaType.toLowerCase()}.${mediaType === "IMAGE" ? "png" : mediaType === "VIDEO" ? "mp4" : "pdf"}`}
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  className="sa-input text-xs w-full"
                />
                <p className="text-[11px] text-slate-400">
                  Ensure the URL is publicly accessible (HTTPS) so Meta WhatsApp servers can download the media.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" className="secondary-button text-xs px-4" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!directUrl.trim()}
                  onClick={handleDirectUrlSubmit}
                  className="primary-button text-xs px-5 py-2 !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50"
                >
                  Apply Media URL
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
