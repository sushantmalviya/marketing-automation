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
  async getAdAccounts(code?: string) {
    return unwrap<MetaAdAccount[]>(await apiClient.get("/api/ads/meta/ad-accounts/", code ? { params: { code } } : undefined));
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
  async updateCampaignStatus(campaignId: string, status: string) {
    return unwrap<unknown>(await apiClient.post(`/api/ads/meta/campaigns/${campaignId}/status/`, { status }));
  },
  async updateCampaign(campaignId: string, payload: { name?: string; status?: string }) {
    return unwrap<unknown>(await apiClient.post(`/api/ads/meta/campaigns/${campaignId}/update/`, payload));
  },
  async deleteCampaign(campaignId: string) {
    return unwrap<unknown>(await apiClient.delete(`/api/ads/meta/campaigns/${campaignId}/delete/`));
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
  async getWebhookLeads() {
    return unwrap<{ id: number; email: string; name: string; created_at: string }[]>(await apiClient.get("/api/ads/meta/leads/"));
  },
  async getPixelSettings() {
    return unwrap<{ pixel_id: string; access_token: string; test_event_code: string; is_active: boolean }>(await apiClient.get("/api/ads/meta/pixel/"));
  },
  async savePixelSettings(payload: { pixel_id: string; access_token?: string; test_event_code?: string; is_active: boolean; is_test_action?: boolean }) {
    return unwrap<{ status: string; message: string; test_triggered: boolean }>(await apiClient.post("/api/ads/meta/pixel/", payload));
  },
  async getPixelEventLogs() {
    return unwrap<{ id: string; event_name: string; pixel_id: string; test_event_code: string; status: string; created_at: string }[]>(await apiClient.get("/api/ads/meta/pixel/events/"));
  },
  async uploadMedia(accountId: string, mediaType: "image" | "video", file: File) {
    const formData = new FormData();
    formData.append("account_id", accountId);
    formData.append("media_type", mediaType);
    formData.append("file", file);
    return unwrap<{ image_hash?: string; video_id?: string }>(
      await apiClient.post("/api/ads/meta/media/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
    );
  },
};
