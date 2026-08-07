"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, LayoutGrid, List, MoreHorizontal, Plus, Search,
  SlidersHorizontal, ChevronDown, Image as ImageIcon,
  Video, FileType2, MessageSquareText, FolderOpen, ChevronRight,
  Eye, Download, Trash2, X,
} from "lucide-react";
import NextImage from "next/image";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { apiClient, parseApiError, resolveApiUrl } from "@/services/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Asset = {
  id: string;
  name: string;
  file_url: string;
  asset_type: "IMAGE" | "DOCUMENT" | "VIDEO" | "OTHER";
  is_personal: boolean;
  tags: { id: string; name: string }[];
  uploaded_by_name?: string;
  created_at: string;
  file_size?: number;
  mime_type?: string;
};

type AssetPage = { count: number; next: string | null; previous: string | null; results: Asset[] };

// ─── Constants ────────────────────────────────────────────────────────────────

type AssetTypeFilter = "ALL" | "DOCUMENT" | "IMAGE" | "VIDEO" | "OTHER";

const TYPE_META: Record<
  Exclude<AssetTypeFilter, "ALL">,
  { label: string; icon: React.ElementType; color: string; bg: string; statBg: string }
> = {
  DOCUMENT: { label: "Documents",       icon: FileText,         color: "text-blue-600",   bg: "bg-blue-100",   statBg: "bg-blue-50"   },
  IMAGE:    { label: "Images",           icon: ImageIcon,        color: "text-amber-500",  bg: "bg-amber-100",  statBg: "bg-amber-50"  },
  VIDEO:    { label: "Videos",           icon: Video,            color: "text-purple-600", bg: "bg-purple-100", statBg: "bg-purple-50" },
  OTHER:    { label: "Captions (Texts)", icon: MessageSquareText,color: "text-rose-500",   bg: "bg-rose-100",   statBg: "bg-rose-50"   },
};

const SORT_OPTIONS = [
  { value: "newest",  label: "Newest First"  },
  { value: "oldest",  label: "Oldest First"  },
  { value: "name_az", label: "Name A → Z"    },
  { value: "name_za", label: "Name Z → A"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function ext(name: string) {
  return name.split(".").pop()?.toUpperCase() ?? "";
}

function sortAssets(assets: Asset[], sort: string) {
  const arr = [...assets];
  if (sort === "oldest")  return arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  if (sort === "name_az") return arr.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "name_za") return arr.sort((a, b) => b.name.localeCompare(a.name));
  return arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className ?? ""}`}>
      {children}
    </span>
  );
}

function TypeIcon({ type, size = 18 }: { type: Asset["asset_type"]; size?: number }) {
  const meta = TYPE_META[type] ?? TYPE_META.OTHER;
  const Icon = meta.icon;
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.bg}`}>
      <Icon size={size} className={meta.color} />
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ type, count, sub }: { type: Exclude<AssetTypeFilter, "ALL">; count: number; sub: string }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sa-card flex items-center gap-4 p-5"
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${meta.bg}`}>
        <Icon size={24} className={meta.color} />
      </span>
      <div>
        <p className="text-xs text-slate-500">{meta.label}</p>
        <strong className="block text-2xl font-black text-slate-900">{count.toLocaleString()}</strong>
        <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
      </div>
    </motion.div>
  );
}

// ─── Asset Grid Card ──────────────────────────────────────────────────────────

function AssetGridCard({ asset, onPreview }: { asset: Asset; onPreview: (a: Asset) => void }) {
  const [menu, setMenu] = useState(false);
  const url = resolveApiUrl(asset.file_url);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = asset.name;
    a.target = "_blank";
    a.click();
    toast.success("Download started");
  };

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="sa-card group relative flex flex-col overflow-hidden"
    >
      {/* Thumbnail */}
      <div
        className="relative h-40 w-full cursor-pointer overflow-hidden bg-slate-100"
        onClick={() => onPreview(asset)}
      >
        {asset.asset_type === "IMAGE" && url ? (
          <NextImage src={url} alt={asset.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center">
            <TypeIcon type={asset.asset_type} size={40} />
          </div>
        )}
        {asset.asset_type === "VIDEO" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white">▶</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-sm font-semibold text-slate-800">{asset.name}</p>
        <p className="text-[11px] text-slate-400">
          {fmtSize(asset.file_size)} {asset.file_size ? "· " : ""}{fmtDate(asset.created_at)}
        </p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {asset.tags.slice(0, 2).map(t => (
            <Badge key={t.id} className="bg-slate-100 text-slate-500">{t.name}</Badge>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="absolute right-2 top-2">
        <button
          className="grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm hover:bg-white"
          onClick={e => { e.stopPropagation(); setMenu(v => !v); }}
        >
          <MoreHorizontal size={15} />
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50" onClick={() => { onPreview(asset); setMenu(false); }}><Eye size={14} />Preview</button>
              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50" onClick={() => { handleDownload(); setMenu(false); }}><Download size={14} />Download</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

// ─── Asset List Row ────────────────────────────────────────────────────────────

function AssetListRow({ asset, onPreview }: { asset: Asset; onPreview: (a: Asset) => void }) {
  const url = resolveApiUrl(asset.file_url);
  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = asset.name; a.target = "_blank"; a.click();
    toast.success("Download started");
  };
  return (
    <tr className="group border-t border-slate-100 transition hover:bg-slate-50/60">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <TypeIcon type={asset.asset_type} />
          <div className="min-w-0">
            <p className="truncate max-w-[200px] text-sm font-semibold text-slate-800">{asset.name}</p>
            <p className="text-[11px] text-slate-400">{ext(asset.name)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{fmtSize(asset.file_size) || "—"}</td>
      <td className="px-4 py-3">
        <Badge className={`${TYPE_META[asset.asset_type]?.bg ?? "bg-slate-100"} ${TYPE_META[asset.asset_type]?.color ?? "text-slate-600"}`}>
          {asset.asset_type}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(asset.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button className="icon-button" title="Preview" onClick={() => onPreview(asset)}><Eye size={15} /></button>
          <button className="icon-button" title="Download" onClick={handleDownload}><Download size={15} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Asset Preview Modal ───────────────────────────────────────────────────────

function AssetPreviewModal({ asset, onClose, onDelete }: { asset: Asset; onClose: () => void; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [choosingChannels, setChoosingChannels] = useState(false);
  const contentPlatforms = [
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "LINKEDIN", label: "LinkedIn" },
    { value: "X", label: "X" }
  ];
  const [selectedChannels, setSelectedChannels] = useState<string[]>(contentPlatforms.map(p => p.value));
  const url = resolveApiUrl(asset.file_url);
  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = asset.name; a.target = "_blank"; a.click();
    toast.success("Download started");
  };
  
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this asset?")) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/assets/${asset.id}/`);
      toast.success("Asset deleted");
      onDelete(asset.id);
      onClose();
    } catch (e) {
      toast.error(parseApiError(e));
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <TypeIcon type={asset.asset_type} />
            <div>
              <p className="font-semibold text-slate-800">{asset.name}</p>
              <p className="text-xs text-slate-400">{fmtDate(asset.created_at)} {asset.file_size ? `· ${fmtSize(asset.file_size)}` : ""}</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-6">
          {asset.asset_type === "IMAGE" && url && (
            <div className="relative h-80 w-full overflow-hidden rounded-xl bg-slate-100">
              <NextImage src={url} alt={asset.name} fill className="object-contain" unoptimized />
            </div>
          )}
          {asset.asset_type === "VIDEO" && url && (
            <video src={url} controls className="w-full rounded-xl" />
          )}
          {(asset.asset_type === "DOCUMENT" || asset.asset_type === "OTHER") && (
            <div className="flex flex-col items-center gap-4 rounded-xl bg-slate-50 py-12">
              <TypeIcon type={asset.asset_type} size={36} />
              <p className="text-sm text-slate-500">Preview not available for this file type.</p>
            </div>
          )}
          {asset.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {asset.tags.map(t => <Badge key={t.id} className="bg-blue-50 text-blue-600">{t.name}</Badge>)}
            </div>
          )}
        </div>

        {choosingChannels ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <p className="font-semibold text-sm text-slate-800">Select channels for this asset:</p>
            <div className="flex flex-wrap gap-2">
              {contentPlatforms.map(p => (
                <label key={p.value} className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 hover:border-blue-300">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selectedChannels.includes(p.value)} onChange={(e) => {
                    if (e.target.checked) setSelectedChannels([...selectedChannels, p.value]);
                    else setSelectedChannels(selectedChannels.filter(c => c !== p.value));
                  }}/>
                  <span className="text-sm font-semibold text-slate-700">{p.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button className="secondary-button px-4 text-sm" onClick={() => setChoosingChannels(false)}>Cancel</button>
              <button className="primary-button px-4 text-sm" disabled={selectedChannels.length === 0} onClick={() => router.push(`/user/content?assetId=${asset.id}&channels=${selectedChannels.join(',')}`)}>Proceed</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            <button className="secondary-button flex items-center gap-2 px-4 text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 size={15} /> {isDeleting ? "Deleting..." : "Delete"}
            </button>
            
            <div className="flex items-center gap-3">
              <button className="secondary-button px-5" onClick={onClose} disabled={isDeleting}>Close</button>
              {url && <button className="secondary-button flex items-center gap-2 px-5 text-sm" onClick={handleDownload} disabled={isDeleting}><Download size={15} />Download</button>}
              {asset.asset_type === "IMAGE" && (
                <button className="primary-button px-5 text-sm" onClick={() => setChoosingChannels(true)} disabled={isDeleting}>
                  Use in Content Studio
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Section Row (collapsed gallery) ─────────────────────────────────────────

function SectionRow({
  type, assets, onPreview, onViewAll,
}: {
  type: Exclude<AssetTypeFilter, "ALL">;
  assets: Asset[];
  onPreview: (a: Asset) => void;
  onViewAll: (t: Exclude<AssetTypeFilter, "ALL">) => void;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const preview = assets.slice(0, 5);

  return (
    <section className="sa-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${meta.bg}`}>
            <Icon size={16} className={meta.color} />
          </span>
          <h2 className="font-black text-slate-800">
            {meta.label}{" "}
            <span className="text-sm font-semibold text-slate-400">({assets.length})</span>
          </h2>
        </div>
        <button
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          onClick={() => onViewAll(type)}
        >
          View all <ChevronRight size={14} />
        </button>
      </div>

      {/* Grid */}
      {type === "IMAGE" || type === "VIDEO" ? (
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {preview.map(asset => (
            <AssetGridCard key={asset.id} asset={asset} onPreview={onPreview} />
          ))}
          {!preview.length && (
            <p className="col-span-full py-6 text-center text-sm text-slate-400">No {meta.label.toLowerCase()} yet.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {preview.map(asset => (
            <div key={asset.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
              <TypeIcon type={asset.asset_type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{asset.name}</p>
                <p className="text-xs text-slate-400">
                  {type === "DOCUMENT"
                    ? `${fmtSize(asset.file_size) || ext(asset.name)} · ${fmtDate(asset.created_at)}`
                    : asset.file_url?.slice(0, 80)}
                </p>
              </div>
              <button className="icon-button text-slate-400" onClick={() => onPreview(asset)}><Eye size={15} /></button>
            </div>
          ))}
          {!preview.length && (
            <p className="py-6 text-center text-sm text-slate-400">No {meta.label.toLowerCase()} yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [isPersonal, setIsPersonal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  const handleFile = (f: File) => { setFile(f); if (!name) setName(f.name); };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim() || file.name);
      fd.append("is_personal", String(isPersonal));
      await apiClient.post("/api/assets/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Asset uploaded successfully");
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-black text-slate-800">Upload Asset</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition cursor-pointer ${drag ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300"}`}
            onClick={() => document.getElementById("asset-file-input")?.click()}
          >
            <FolderOpen size={36} className="text-slate-400" />
            {file ? (
              <p className="text-sm font-semibold text-slate-700">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-600">Drop file here or click to browse</p>
                <p className="text-xs text-slate-400">Images, Documents, Videos supported</p>
              </>
            )}
            <input id="asset-file-input" type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {/* Name */}
          <div className="field">
            <label>Asset Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter asset name" />
          </div>

          {/* Private toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
            <input type="checkbox" checked={isPersonal} onChange={e => setIsPersonal(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Private asset</p>
              <p className="text-xs text-slate-400">Only visible to you</p>
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button className="secondary-button px-5" onClick={onClose} disabled={uploading}>Cancel</button>
          <button className="primary-button px-6 text-sm" onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload Asset"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function UserAssetLibrary() {
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("ALL");
  const [sort, setSort]             = useState("newest");
  const [viewMode, setViewMode]     = useState<"grid" | "list">("grid");
  const [preview, setPreview]       = useState<Asset | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [sortOpen, setSortOpen]     = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<AssetPage>({
    queryKey: ["user-assets"],
    queryFn: async () => (await apiClient.get<AssetPage>("/api/assets/", { params: { size: 200 } })).data,
  });

  const all: Asset[] = data?.results ?? [];

  // Stat counts per type
  const counts = useMemo(() => ({
    DOCUMENT: all.filter(a => a.asset_type === "DOCUMENT").length,
    IMAGE:    all.filter(a => a.asset_type === "IMAGE").length,
    VIDEO:    all.filter(a => a.asset_type === "VIDEO").length,
    OTHER:    all.filter(a => a.asset_type === "OTHER").length,
  }), [all]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = all;
    if (typeFilter !== "ALL") list = list.filter(a => a.asset_type === typeFilter);
    if (search.trim()) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
    return sortAssets(list, sort);
  }, [all, typeFilter, search, sort]);

  // Grouped by type (for overview view)
  const groups = useMemo(() => ({
    DOCUMENT: sortAssets(all.filter(a => a.asset_type === "DOCUMENT"), sort),
    IMAGE:    sortAssets(all.filter(a => a.asset_type === "IMAGE"),    sort),
    VIDEO:    sortAssets(all.filter(a => a.asset_type === "VIDEO"),    sort),
    OTHER:    sortAssets(all.filter(a => a.asset_type === "OTHER"),    sort),
  }), [all, sort]);

  const isOverview = typeFilter === "ALL" && !search.trim();
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Newest First";

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <FolderOpen size={48} className="text-slate-300" />
        <p className="font-semibold text-slate-500">{parseApiError(error)}</p>
        <button className="secondary-button px-5" onClick={() => void refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="sa-title">Asset Library</h1>
          <p className="sa-subtitle">Organize, manage and reuse your content assets across campaigns.</p>
        </div>
        <div className="relative">
          <button
            className="primary-button gap-2 px-5 text-sm"
            onClick={() => setShowUpload(true)}
          >
            <Plus size={17} /> Add Asset
            <span className="ml-1 text-blue-300">▾</span>
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(["DOCUMENT", "IMAGE", "OTHER", "VIDEO"] as const).map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <StatCard
              type={t}
              count={isLoading ? 0 : counts[t]}
              sub={t === "DOCUMENT" ? "All documents" : t === "IMAGE" ? "JPG, PNG, WEBP" : t === "VIDEO" ? "MP4, MOV, GIF" : "Post captions"}
            />
          </motion.div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {(["ALL", "DOCUMENT", "IMAGE", "OTHER", "VIDEO"] as AssetTypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${typeFilter === t ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {t === "ALL" ? "All Types" : t === "OTHER" ? "Captions" : t.charAt(0) + t.slice(1).toLowerCase() + "s"}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            className="secondary-button flex items-center gap-2 px-4 py-2 text-sm"
            onClick={() => setSortOpen(v => !v)}
          >
            <SlidersHorizontal size={15} />
            {currentSortLabel}
            <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              >
                {SORT_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-sm transition hover:bg-slate-50 ${sort === o.value ? "font-bold text-blue-600" : ""}`}
                    onClick={() => { setSort(o.value); setSortOpen(false); }}
                  >
                    {o.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            className={`grid h-8 w-8 place-items-center rounded-lg transition ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-700"}`}
            onClick={() => setViewMode("grid")}
          ><LayoutGrid size={16} /></button>
          <button
            className={`grid h-8 w-8 place-items-center rounded-lg transition ${viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-700"}`}
            onClick={() => setViewMode("list")}
          ><List size={16} /></button>
        </div>
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="sa-card h-52 animate-pulse bg-slate-100" />
          ))}
        </div>
      )}

      {/* ── Overview (all types sectioned) ── */}
      {!isLoading && isOverview && (
        <div className="space-y-6">
          {(["DOCUMENT", "IMAGE", "OTHER", "VIDEO"] as const).map(t => (
            <SectionRow
              key={t}
              type={t}
              assets={groups[t]}
              onPreview={setPreview}
              onViewAll={setTypeFilter}
            />
          ))}
        </div>
      )}

      {/* ── Filtered view ── */}
      {!isLoading && !isOverview && (
        <>
          <p className="mb-3 text-xs text-slate-400 font-semibold">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <FolderOpen size={44} className="text-slate-300" />
              <p className="font-semibold text-slate-500">No assets found</p>
              <p className="text-sm text-slate-400">Try adjusting your filters or search term.</p>
            </div>
          )}

          {viewMode === "grid" && filtered.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map(a => <AssetGridCard key={a.id} asset={a} onPreview={setPreview} />)}
            </div>
          )}

          {viewMode === "list" && filtered.length > 0 && (
            <div className="sa-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Name</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Uploaded</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => <AssetListRow key={a.id} asset={a} onPreview={setPreview} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {preview && <AssetPreviewModal key="preview" asset={preview} onClose={() => setPreview(null)} onDelete={() => refetch()} />}
        {showUpload && <UploadModal key="upload" onClose={() => setShowUpload(false)} onUploaded={() => void refetch()} />}
      </AnimatePresence>
    </div>
  );
}
