"use client";

import { useRouter, usePathname } from "next/navigation";
import { AutomationDashboard } from "./dashboard";

export function AdminAutomations() {
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname.startsWith("/admin") ? "/admin/automations" : "/user/automations";

  return (
    <AutomationDashboard
      onEdit={(id) => router.push(`${basePath}/${id}`)}
      onCreateNew={() => router.push(`${basePath}/new`)}
    />
  );
}
