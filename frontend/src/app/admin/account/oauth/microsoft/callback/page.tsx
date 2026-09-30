"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

export default function MicrosoftOAuthCallbackPage() {
  const router = useRouter();
  const { user } = useAuth();
  const accountPath = `/${user?.role?.toLowerCase() || "user"}/account`;

  useEffect(() => {
    router.replace(accountPath);
  }, [router, accountPath]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="text-center text-sm text-slate-500">
        Redirecting to Account Settings...
      </div>
    </div>
  );
}
