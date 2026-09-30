import { apiClient } from "@/services/api-client";
import type { AuthUser, Paginated } from "@/types/auth";

export interface AdminRecord { id: number; full_name?: string; first_name?: string; last_name?: string; email: string; mobile_no?: string | null; role: string; is_active: boolean; created_at: string | null }
export interface DashboardData {
  campaigns: { total: number; draft: number; scheduled: number; sending: number; completed: number };
  deliveries: { total: number; sent: number; failed: number; pending: number; delivered: number; success_rate: number };
  recent_campaigns: Array<{ id: number; name: string; status: string; created_at: string }>;
  recent_deliveries: Array<{ id: number; status: string; channel: string; created_at: string }>;
}
export interface AnalyticsData {
  email: { sent: number; open_rate: number; click_rate: number; bounce_rate: number; unsubscribe_rate: number };
  sms: { sent: number; delivery_rate: number };
  whatsapp: { sent: number; read_rate: number; reply_rate: number };
  workflow: { execution_count: number; success_rate: number; failure_rate: number; average_duration: number };
}
export interface BillingData {
  balance: number; credited: number; consumed: number; transaction_count: number;
  transactions: Array<{ id: string; type: "CREDIT" | "DEBIT"; amount: number; description: string; reference_id: string | null; created_at: string }>;
  payment_methods_supported: boolean; invoices_supported: boolean;
}

export const superAdminService = {
  stats: async () => (await apiClient.get<{ total_admins: number; total_users: number }>("/api/dashboard/stats/")).data,
  dashboard: async () => (await apiClient.get<DashboardData>("/api/dashboard/")).data,
  analytics: async () => (await apiClient.get<AnalyticsData>("/api/analytics/summary/")).data,
  analyticsWithRange: async (dateFrom: string, dateTo: string) =>
    (await apiClient.get<AnalyticsData>("/api/analytics/summary/", { params: { date_from: dateFrom, date_to: dateTo } })).data,
  billingWithRange: async (dateFrom: string, dateTo: string) =>
    (await apiClient.get<BillingData>("/api/billing/summary/", { params: { date_from: dateFrom, date_to: dateTo } })).data,
  admins: async (params: { page: number; search: string }) => (await apiClient.get<Paginated<AdminRecord>>("/api/admins/", { params })).data,
  getAdmin: async (id: number) => (await apiClient.get<AdminRecord>(`/api/admins/${id}/`)).data,
  toggleAdminStatus: async (id: number, is_active: boolean) => (await apiClient.patch<AdminRecord>(`/api/admins/${id}/`, { is_active })).data,
  billing: async () => (await apiClient.get<BillingData>("/api/billing/summary/")).data,
  updateProfile: async (data: { first_name: string; last_name: string }) => (await apiClient.patch<AuthUser>("/api/auth/profile/", data)).data,
};
