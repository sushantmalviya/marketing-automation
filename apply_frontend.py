import os

frontend_path = "frontend/src/components/admin/contacts.tsx"
with open(frontend_path, "r", encoding="utf-8") as f:
    contacts_tsx = f.read()

# 1. Add mutations
if "deleteUpload = useMutation" not in contacts_tsx:
    contacts_tsx = contacts_tsx.replace("""  const deleteGroup = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/audiences/${id}/`),
    onSuccess: () => {
      toast.success("Group deleted");
      setSelectedCategory("all");
      setSelectedSubItem(null);
      void client.invalidateQueries({ queryKey: ["admin-audiences"] });
    },
    onError: err => toast.error(parseApiError(err)),
  });""", """  const deleteGroup = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/audiences/${id}/`),
    onSuccess: () => {
      toast.success("Group deleted");
      setSelectedCategory("all");
      setSelectedSubItem(null);
      void client.invalidateQueries({ queryKey: ["admin-audiences"] });
    },
    onError: err => toast.error(parseApiError(err)),
  });

  const deleteUpload = useMutation({
    mutationFn: (id: string | number) => apiClient.delete(`/api/customers/uploads/${id}/`),
    onSuccess: () => {
      toast.success("File deleted");
      void client.invalidateQueries({ queryKey: ["admin-contacts"] });
      void client.invalidateQueries({ queryKey: ["admin-contacts-hierarchy"] });
    },
    onError: err => toast.error(parseApiError(err)),
  });

  const deleteSource = useMutation({
    mutationFn: ({ source, sub_source_id }: { source: string, sub_source_id: string }) => 
      apiClient.post("/api/customers/source-delete/", { source, sub_source_id }),
    onSuccess: () => {
      toast.success("Item deleted");
      void client.invalidateQueries({ queryKey: ["admin-contacts"] });
      void client.invalidateQueries({ queryKey: ["admin-contacts-hierarchy"] });
    },
    onError: err => toast.error(parseApiError(err)),
  });""")

# 2. Update UI
old_ui_block = """      {/* ── Level 2 Sub-Items Bar ── */}
      {["forms", "meta"].includes(String(selectedCategory)) && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/70 p-2 scrollbar-hide">
          <span className="pl-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            {selectedCategory === "forms" ? "Forms:" : "Ad Campaigns:"}
          </span>
          <button
            onClick={() => { setSelectedSubItem(null); setSelected(new Set()); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              selectedSubItem === null
                ? "bg-white text-blue-700 shadow border border-slate-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            All {selectedCategory === "forms" ? "Forms" : "Ad Campaigns"}
          </button>
          {((selectedCategory === "forms" ? hierarchyQuery.data?.categories?.forms?.items :
              hierarchyQuery.data?.categories?.meta?.items) || []).map(item => {
            const isSubSelected = selectedSubItem?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSelectedSubItem(item); setSelected(new Set()); }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  isSubSelected
                    ? "bg-white text-blue-700 shadow border border-blue-200 ring-2 ring-blue-100"
                    : "text-slate-600 hover:bg-white/60 border border-transparent"
                }`}
              >
                <span>{item.name}</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-700">
                  {item.count}
                </span>
              </button>
            );
          })}
          {!((selectedCategory === "forms" ? hierarchyQuery.data?.categories?.forms?.items :
              hierarchyQuery.data?.categories?.meta?.items) || []).length && (
            <span className="pl-2 text-xs italic text-slate-400">No specific items found in this section.</span>
          )}
        </div>
      )}

      {selectedCategory === "imported" && selectedSubItem && (
        <div className="mb-6 flex items-center">
          <button
            onClick={() => { setSelectedSubItem(null); setSelected(new Set()); }}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
          >
            <span className="text-lg leading-none mt-[-2px]">&larr;</span> Back to Files
          </button>
          <span className="mx-3 text-slate-300">|</span>
          <span className="text-sm font-bold text-slate-800">{selectedSubItem.name}</span>
        </div>
      )}

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sa-card overflow-hidden">
        {/* ── Filters ── */}
        {!(selectedCategory === "imported" && !selectedSubItem) && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-5">
            <label className="relative min-w-64 flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none
                transition-all duration-200
                focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:shadow-[0_0_0_4px_rgba(96,165,250,.12)]"
                placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
            </label>
            <div className="relative">
              <Tags className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
              <select aria-label="Filter by tag" className="h-12 appearance-none rounded-xl border border-slate-200 bg-white py-0 pl-11 pr-11 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-400" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
                <option value="All">Tags: All</option>
                {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {selectedCategory === "imported" && !selectedSubItem ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-5 bg-slate-50/50">
            {(hierarchyQuery.data?.categories?.imported?.items || []).map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedSubItem(item)}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_-4px_rgba(15,23,42,.08)] transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText size={24} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {item.count} contacts
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 line-clamp-2 leading-snug" title={item.name}>{item.name}</h3>
                <p className="mt-2 text-xs font-medium text-slate-400 truncate">{item.type === "manual" ? "Manual Contacts" : "Imported CSV / Excel"}</p>
              </div>
            ))}
            {!(hierarchyQuery.data?.categories?.imported?.items?.length) && (
              <div className="col-span-full py-12 text-center text-slate-500">
                No imported files found. Upload a CSV to get started.
              </div>
            )}
          </div>
        ) : query.isLoading ? ("""

new_ui_block = """      {["imported", "forms", "meta"].includes(String(selectedCategory)) && selectedSubItem && (
        <div className="mb-6 flex items-center">
          <button
            onClick={() => { setSelectedSubItem(null); setSelected(new Set()); }}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
          >
            <span className="text-lg leading-none mt-[-2px]">&larr;</span> Back to {selectedCategory === "imported" ? "Files" : selectedCategory === "forms" ? "Forms" : "Ad Campaigns"}
          </button>
          <span className="mx-3 text-slate-300">|</span>
          <span className="text-sm font-bold text-slate-800">{selectedSubItem.name}</span>
        </div>
      )}

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sa-card overflow-hidden">
        {/* ── Filters ── */}
        {!(["imported", "forms", "meta"].includes(String(selectedCategory)) && !selectedSubItem) && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white p-5">
            <label className="relative min-w-64 flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none
                transition-all duration-200
                focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:shadow-[0_0_0_4px_rgba(96,165,250,.12)]"
                placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
            </label>
            <div className="relative">
              <Tags className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
              <select aria-label="Filter by tag" className="h-12 appearance-none rounded-xl border border-slate-200 bg-white py-0 pl-11 pr-11 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-400" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
                <option value="All">Tags: All</option>
                {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {["imported", "forms", "meta"].includes(String(selectedCategory)) && !selectedSubItem ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-5 bg-slate-50/50">
            {((selectedCategory === "imported" ? hierarchyQuery.data?.categories?.imported?.items :
               selectedCategory === "forms" ? hierarchyQuery.data?.categories?.forms?.items :
               hierarchyQuery.data?.categories?.meta?.items) || []).map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedSubItem(item)}
                className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_-4px_rgba(15,23,42,.08)] transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
              >
                {item.id !== "manual" && item.id !== "general" && (
                  <button
                    className="absolute right-3 top-3 hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 group-hover:flex transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete "${item.name}" and all its contacts?`)) {
                        if (selectedCategory === "imported") deleteUpload.mutate(item.id);
                        else deleteSource.mutate({ source: String(selectedCategory), sub_source_id: item.id });
                      }
                    }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    {selectedCategory === "imported" ? <FileText size={24} /> : selectedCategory === "forms" ? <Tags size={24} /> : <Eye size={24} />}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {item.count} contacts
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 line-clamp-2 leading-snug pr-8" title={item.name}>{item.name}</h3>
                <p className="mt-2 text-xs font-medium text-slate-400 truncate">{item.type === "manual" ? "Manual Contacts" : selectedCategory === "imported" ? "Imported CSV / Excel" : selectedCategory === "forms" ? "Form Leads" : "Meta Leads"}</p>
              </div>
            ))}
            {!((selectedCategory === "imported" ? hierarchyQuery.data?.categories?.imported?.items :
                selectedCategory === "forms" ? hierarchyQuery.data?.categories?.forms?.items :
                hierarchyQuery.data?.categories?.meta?.items) || []).length && (
              <div className="col-span-full py-12 text-center text-slate-500">
                No items found. {selectedCategory === "imported" && "Upload a CSV to get started."}
              </div>
            )}
          </div>
        ) : query.isLoading ? ("""

contacts_tsx = contacts_tsx.replace(old_ui_block, new_ui_block)

with open(frontend_path, "w", encoding="utf-8") as f:
    f.write(contacts_tsx)

print("Frontend updated!")
