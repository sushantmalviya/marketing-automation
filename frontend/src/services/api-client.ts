import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const baseURL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export const apiClient = axios.create({ baseURL, timeout: 15000, headers: { Accept: "application/json" } });
export function resolveApiUrl(url?: string | null) { if (!url) return undefined; if (/^(https?:|data:|blob:)/i.test(url)) return url; return `${baseURL}${url.startsWith("/") ? "" : "/"}${url}`; }
export function setAccessToken(token: string | null) { accessToken = token; }
export function getStoredRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ma_refresh") ?? sessionStorage.getItem("ma_refresh");
}
export function storeRefreshToken(token: string | null, persistent = false) {
  if (typeof window === "undefined") return;
  // Clear from both storages first to avoid stale tokens
  localStorage.removeItem("ma_refresh");
  sessionStorage.removeItem("ma_refresh");
  if (!token) return;
  if (persistent) {
    localStorage.setItem("ma_refresh", token);
  } else {
    sessionStorage.setItem("ma_refresh", token);
  }
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

async function refreshAccess(): Promise<string> {
  const refresh = getStoredRefreshToken();
  if (!refresh) throw new Error("No refresh token");
  const { data } = await axios.post<{ access: string; refresh?: string }>(`${baseURL}/api/auth/token/refresh/`, { refresh }, { timeout: 15000 });
  setAccessToken(data.access);
  if (data.refresh) storeRefreshToken(data.refresh);
  return data.access;
}

export async function restoreAccessToken() { return refreshAccess(); }

apiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (error.response?.status !== 401 || !request || request._retried || request.url?.includes("/api/auth/")) return Promise.reject(error);
  request._retried = true;
  try {
    refreshPromise ??= refreshAccess().finally(() => { refreshPromise = null; });
    request.headers.Authorization = `Bearer ${await refreshPromise}`;
    return apiClient(request);
  } catch {
    setAccessToken(null); storeRefreshToken(null);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("auth:expired"));
    return Promise.reject(error);
  }
});

export function parseApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : "Unexpected error";
  if (!error.response) return "Cannot reach the API. Check that the backend is running.";
  const data = error.response.data as Record<string, unknown> | undefined;
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  const apiError = data?.error ?? data?.message;
  if (typeof apiError === "string") return apiError;
  const first = data && Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  return error.response.status === 429 ? "Too many requests. Please wait and try again." : `Request failed (${error.response.status}).`;
}
