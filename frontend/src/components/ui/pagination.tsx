import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, count, pageSize, setPage }: { page: number; count: number; pageSize: number; setPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  
  return (
    <div className="flex items-center justify-between border-t border-slate-100 p-4">
      <span className="text-sm text-slate-500">
        Showing {count ? ((page - 1) * pageSize) + 1 : 0} to {Math.min(page * pageSize, count)} of {count}
      </span>
      <div className="flex gap-2">
        <button 
          aria-label="Previous page" 
          className="icon-button !border !border-slate-200" 
          disabled={page <= 1} 
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span className="grid h-8 min-w-8 place-items-center rounded-lg border border-blue-500 px-2 text-sm font-bold text-blue-600">
          {page}
        </span>
        <button 
          aria-label="Next page" 
          className="icon-button !border !border-slate-200" 
          disabled={page >= pages} 
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
