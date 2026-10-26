"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Error Boundary caught error:", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-white">
      <div className="text-center max-w-xl w-full">
        <h1 className="text-3xl font-bold">Something went wrong</h1>
        {error?.message && (
          <div className="mt-4 p-4 rounded-lg bg-red-950/80 border border-red-800 text-left text-xs font-mono text-red-200 overflow-x-auto max-h-60">
            <p className="font-bold text-red-400">{error.message}</p>
            {error.stack && (
              <pre className="mt-2 text-[10px] text-red-300 whitespace-pre-wrap">{error.stack}</pre>
            )}
            {error.digest && (
              <p className="mt-2 text-[10px] text-slate-400">Digest: {error.digest}</p>
            )}
          </div>
        )}
        <button
          className="mt-5 rounded-lg bg-white px-4 py-2 text-black font-semibold hover:bg-slate-200 transition"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
