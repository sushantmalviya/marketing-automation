"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { getStoredRefreshToken, restoreAccessToken, setAccessToken, storeRefreshToken } from "@/services/api-client";
import { getDashboardPath } from "@/permissions/permission-matrix";
import { isUserRole } from "@/constants/roles";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null; loading: boolean;
  login(email: string, password: string, rememberMe?: boolean): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const clear = useCallback(() => { setAccessToken(null); storeRefreshToken(null); setUser(null); }, []);

  const restore = useCallback(async () => {
    if (!getStoredRefreshToken()) { setLoading(false); return; }
    try {
      await restoreAccessToken();
      const profile = await authService.profile();
      if (!profile.is_active || !isUserRole(profile.role)) throw new Error("Invalid account");
      setUser(profile);
    } catch { clear(); }
    finally { setLoading(false); }
  }, [clear]);

  useEffect(() => {
    // Auth restoration is the effect's external synchronization responsibility.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
  }, [restore]);

  useEffect(() => {
    const expired = () => { clear(); router.replace("/login"); };
    window.addEventListener("auth:expired", expired);
    return () => window.removeEventListener("auth:expired", expired);
  }, [clear, router]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "ma_refresh") {
        if (!event.newValue) {
          clear();
          router.replace("/login");
        } else if (event.newValue && event.newValue !== event.oldValue) {
          void restore();
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [clear, restore, router]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
    const response = await authService.login({ email, password });
    setAccessToken(response.data.access);
    storeRefreshToken(response.data.refresh, rememberMe);
    // Login already returns the authenticated profile. Reusing it avoids a
    // second remote database round-trip before the dashboard can open.
    const profile = response.data.user;
    if (!profile.is_active) { clear(); throw new Error("This account is disabled."); }
    if (!isUserRole(profile.role)) { clear(); throw new Error("The account has an unsupported role."); }
    setUser(profile); router.replace(getDashboardPath(profile.role));
  }, [clear, router]);

  const logout = useCallback(async () => {
    const refresh = getStoredRefreshToken();
    try { if (refresh) await authService.logout(refresh); } finally { clear(); router.replace("/login"); }
  }, [clear, router]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }
