"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/providers/auth-provider";
import { getDashboardPath } from "@/permissions/permission-matrix";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace(getDashboardPath(user.role));
      } else {
        router.replace("/login");
      }
    }
  }, [loading, user, router]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-[#050d1f] text-slate-500">
      <div className="flex items-center gap-3 text-sm">
        <motion.span
          className="h-2.5 w-2.5 rounded-full bg-blue-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        Verifying session…
      </div>
    </div>
  );
}
