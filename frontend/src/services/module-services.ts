import { apiClient } from "@/services/api-client";

export interface ModuleDefinition { title: string; endpoint: string; description: string; }
export const moduleDefinitions: Record<string, ModuleDefinition> = {
  dashboard: { title: "Dashboard", endpoint: "/api/dashboard/", description: "Campaign and delivery performance" },
  admins: { title: "Administrators", endpoint: "/api/admins/", description: "Admin accounts and access" },
  users: { title: "Users", endpoint: "/api/users/", description: "Operational user accounts" },
  analytics: { title: "Analytics", endpoint: "/api/analytics/summary/", description: "Communication and workflow metrics" },
  audiences: { title: "Segmentation", endpoint: "/api/audiences/", description: "Manage and organize customer segments" },
  automations: { title: "Automations", endpoint: "/api/automations/", description: "Workflow definitions and status" },
  campaigns: { title: "Campaigns", endpoint: "/api/campaigns/my/", description: "Campaign workflow and approvals" },
  channels: { title: "Channels", endpoint: "/api/channels/", description: "Available delivery channels" },
  communications: { title: "Communications", endpoint: "/api/communications/events/", description: "Provider delivery events" },
  content: { title: "Content Studio", endpoint: "/api/content/content-drafts/", description: "Content drafts and approvals" },
  customers: { title: "Customers", endpoint: "/api/customers/", description: "Imported database-backed customer records" },
  forms: { title: "Forms", endpoint: "/api/forms/", description: "Forms, publishing and responses" },
  templates: { title: "Templates", endpoint: "/api/templates/", description: "Campaign delivery templates" },
};

export async function getModuleData(key: string, params?: Record<string, string | number>) {
  const definition = moduleDefinitions[key];
  if (!definition) throw new Error("Unknown module");
  return (await apiClient.get(definition.endpoint, { params, signal: AbortSignal.timeout(15000) })).data as unknown;
}
