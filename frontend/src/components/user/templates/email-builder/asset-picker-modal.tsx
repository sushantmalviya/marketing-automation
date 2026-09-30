"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Upload, Image as ImageIcon, Search, Check, FolderOpen } from "lucide-react";
import { apiClient, parseApiError, resolveApiUrl } from "@/services/api-client";
import { toast } from "sonner";

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

interface AssetPickerModalProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function AssetPickerModal({ onSelect, onClose }: AssetPickerModalProps) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<AssetPage>({
    queryKey: ["user-assets-picker"],
    queryFn: async () => (await apiClient.get<AssetPage>("/api/assets/", { params: { size: 100 } })).data,
  });

  const images = (data?.results ?? []).filter(
    (a) => a.asset_type === "IMAGE" && (!search || a.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleFileChange = (f: File) => {
    setSelectedFile(f);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("name", selectedFile.name);
      fd.append("is_personal", "false");
      const res = await apiClient.post<Asset>("/api/assets/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Image uploaded successfully");
      await refetch();
      const resolved = resolveApiUrl(res.data.file_url);
      onSelect(resolved || res.data.file_url);
      onClose();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <ImageIcon size={18} />
            </span>
            <h3 className="text-base font-bold text-slate-900">Select Image Asset</h3>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 px-6 pt-2 bg-slate-50/50">
          <button
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === "library"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("library")}
          >
            Asset Library
          </button>
          <button
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === "upload"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTab("upload")}
          >
            Upload New Image
          </button>
        </div>

        {/* Tab 1: Library */}
        {tab === "library" && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                className="sa-input w-full pl-10 text-sm"
                placeholder="Search images by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="grid grid-cols-3 gap-3 py-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FolderOpen className="mx-auto mb-2 text-slate-300" size={36} />
                <p className="text-sm font-medium">No images found in your asset library.</p>
                <button
                  type="button"
                  className="mt-3 text-xs text-blue-600 font-semibold hover:underline"
                  onClick={() => setTab("upload")}
                >
                  Upload your first image →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((asset) => {
                  const url = resolveApiUrl(asset.file_url) || asset.file_url;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        onSelect(url);
                        onClose();
                      }}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:border-blue-500 hover:shadow-md transition text-left"
                    >
                      <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                        <img
                          src={url}
                          alt={asset.name}
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="rounded-full bg-blue-600 text-white p-1.5 shadow">
                            <Check size={16} />
                          </span>
                        </div>
                      </div>
                      <div className="p-2 bg-white">
                        <p className="truncate text-xs font-semibold text-slate-800" title={asset.name}>
                          {asset.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Direct Upload */}
        {tab === "upload" && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            <div
              onClick={() => document.getElementById("template-image-file-input")?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition text-center"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-40 rounded-lg object-contain shadow-sm" />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                  <Upload size={26} />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : "Click or drag an image here to upload"}
                </p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF, WebP, SVG supported</p>
              </div>
              <input
                id="template-image-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!selectedFile || uploading}
                onClick={handleUpload}
              >
                {uploading ? "Uploading..." : "Upload & Select"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
