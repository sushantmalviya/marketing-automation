import { apiClient } from "@/services/api-client";
import type { CreateMetaCampaignPayload, MetaAdAccount, MetaCampaign, MetaInsights, MetaLead, MetaObjectStatus } from "@/types/meta-ads";

type ApiEnvelope<T> = { status?: string; data: T; message?: string };
const unwrap = <T>(response: { data: ApiEnvelope<T> | T }): T => {
  const data = response.data;
  return typeof data === "object" && data !== null && "data" in data ? (data as ApiEnvelope<T>).data : data as T;
};

export type InsightsLevel = "account" | "campaign" | "adset" | "ad";
export type InsightsTimeRange = string | { since: string; until: string };

export const metaAdsService = {
  async getAuthorizationUrl() {
    return unwrap<{ auth_url: string; csrf_state?: string }>(await apiClient.get("/api/ads/meta/auth-url/"));
  },
  async getAdAccounts() {
    return unwrap<MetaAdAccount[]>(await apiClient.get("/api/ads/meta/ad-accounts/"));
  },
  async setActiveAdAccount(account: Pick<MetaAdAccount, "account_id" | "name"> & { currency?: string }) {
    return unwrap<unknown>(await apiClient.post("/api/ads/meta/ad-accounts/select/", account));
  },
  async getCampaigns(accountId: string) {
    return unwrap<MetaCampaign[]>(await apiClient.get("/api/ads/meta/campaigns/list/", { params: { account_id: accountId } }));
  },
  async updateObjectStatus(objectId: string, status: MetaObjectStatus) {
    return unwrap<unknown>(await apiClient.post(`/api/ads/meta/objects/${objectId}/status/`, { status }));
  },
  async createCampaign(payload: CreateMetaCampaignPayload) {
    return unwrap<{ campaign_id: string; adset_id: string; ad_id: string; message?: string }>(await apiClient.post("/api/ads/meta/campaigns/create/", payload));
  },
  async updateAdsetBudget(adsetId: string, budget: number) {
    return unwrap<unknown>(await apiClient.post(`/api/ads/meta/adsets/${adsetId}/budget/`, { budget }));
  },
  async getInsights(level: InsightsLevel, id: string, timeRange: InsightsTimeRange = "last_30d", breakdowns?: string[]) {
    // `account_id` maintains compatibility with the account-level dashboard endpoint;
    // `level` and `id` are used by the object-level insights endpoint.
    const params: Record<string, string> = { level, id, ...(level === "account" ? { account_id: id } : {}) };
    if (typeof timeRange === "string") params.date_preset = timeRange;
    else params.time_range = JSON.stringify(timeRange);
    if (breakdowns?.length) params.breakdowns = breakdowns.join(",");
    return unwrap<MetaInsights | MetaInsights[]>(await apiClient.get("/api/ads/meta/insights/", { params }));
  },
  async syncHistoricalLeads(formId: string) {
    return unwrap<{ leads: MetaLead[]; synced?: number }>(await apiClient.post(`/api/ads/meta/forms/${formId}/leads/sync/`));
  },
};
