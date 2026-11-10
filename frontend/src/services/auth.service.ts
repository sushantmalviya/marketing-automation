import { apiClient } from "@/services/api-client";
import type { AuthUser, LoginResponse } from "@/types/auth";

export const authService = {
  // Authentication can include a cold connection to the remote Neon database.
  // Keep the general API timeout strict, but do not abort a valid login while
  // Django is still checking the password and issuing tokens.
  login: async (payload: { email: string; password: string }) => (
    await apiClient.post<LoginResponse>("/api/auth/login/", payload, { timeout: 60000 })
  ).data,
  profile: async () => {
    const res = await apiClient.get<AuthUser>("/api/auth/profile/");
    const profile = res.data;
    if (profile?.email && !profile.mobile_no) {
      try {
        const usersRes = await apiClient.get<{ results: Array<{ email: string; mobile_no?: string | null }> }>("/api/users/", {
          params: { search: profile.email },
        });
        const match = usersRes.data?.results?.find(
          u => u.email?.toLowerCase() === profile.email.toLowerCase()
        );
        if (match?.mobile_no) {
          profile.mobile_no = match.mobile_no;
        }
      } catch {
        // Fallback gracefully if directory lookup fails
      }
    }
    if (profile) {
      const anyProf = profile as any;
      if (!profile.rent_start_date) {
        profile.rent_start_date =
          anyProf.rent_start_date ??
          anyProf.organization?.subscription?.rent_start_date ??
          anyProf.subscription?.rent_start_date ??
          anyProf.rentStartDate ??
          null;
      }
      if (!profile.rent_end_date) {
        profile.rent_end_date =
          anyProf.rent_end_date ??
          anyProf.organization?.subscription?.rent_end_date ??
          anyProf.subscription?.rent_end_date ??
          anyProf.rentEndDate ??
          null;
      }
    }
    return profile;
  },
  updateProfile: async (data: { first_name?: string; last_name?: string; mobile_no?: string }) => {
    const res = await apiClient.patch<AuthUser>("/api/auth/profile/", data);
    const updated = res.data;
    if (updated && data.mobile_no !== undefined) {
      updated.mobile_no = data.mobile_no;
    }
    return updated;
  },
  logout: async (refresh: string) => (await apiClient.post("/api/auth/logout/", { refresh })).data,
  forgotPassword: async (email: string) => (await apiClient.post("/api/auth/forgot-password/", { email })).data,
  resetPassword: async (payload: { email: string; otp: string; password: string; confirm_password: string }) => (await apiClient.post("/api/auth/reset-password/", payload)).data,
};
