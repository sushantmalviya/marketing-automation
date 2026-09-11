"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient, parseApiError } from "@/services/api-client";

export default function GoogleOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMsg(`Google authorization was denied or failed: ${error}`);
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMsg("No authorization code was provided by Google.");
      return;
    }

    apiClient
      .post("/api/communications/sender-identities/oauth/google/callback/", { code })
      .then(() => {
        setStatus("success");
        setTimeout(() => {
          router.push("/admin/account");
        }, 2000);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(parseApiError(err));
      });
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Connecting Google Account...</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Exchanging credentials and verifying sender identity permissions.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Successfully Connected!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your Google sender email is ready. Redirecting back to Account Settings...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Connection Failed</h2>
            <p className="text-sm text-rose-600 dark:text-rose-400">{errorMsg}</p>
            <button
              onClick={() => router.push("/admin/account")}
              className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Return to Account Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
