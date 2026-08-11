"use client";

import { useRouter } from "next/navigation";
import { AutomationDashboard } from "./dashboard";

export function AdminAutomations() {
  const router = useRouter();

  return (
    <AutomationDashboard
      onEdit={(id) => router.push(`/admin/automations/${id}`)}
      onCreateNew={() => router.push("/admin/automations/new")}
    />
  );
}
