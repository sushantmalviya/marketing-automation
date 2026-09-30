import { apiClient } from "@/services/api-client";
import type { AuthUser, LoginResponse } from "@/types/auth";

export const authService = {
  // Authentication can include a cold connection to the remote Neon database.
  // Keep the general API timeout strict, but do not abort a valid login while
  // Django is still checking the password and issuing tokens.
  login: async (payload: { email: string; password: string }) => (
    await apiClient.post<LoginResponse>("/api/auth/login/", payload, { timeout: 60000 })
  ).data,
  profile: async () => (await apiClient.get<AuthUser>("/api/auth/profile/")).data,
  updateProfile: async (data: { first_name?: string; last_name?: string }) => (
    await apiClient.patch<AuthUser>("/api/auth/profile/", data)
  ).data,
  logout: async (refresh: string) => (await apiClient.post("/api/auth/logout/", { refresh })).data,
  forgotPassword: async (email: string) => (await apiClient.post("/api/auth/forgot-password/", { email })).data,
  resetPassword: async (payload: { email: string; otp: string; password: string; confirm_password: string }) => (await apiClient.post("/api/auth/reset-password/", payload)).data,
};
