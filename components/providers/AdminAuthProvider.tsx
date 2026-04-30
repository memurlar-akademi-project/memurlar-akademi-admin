"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { adminApiRequest } from "@/lib/admin-api";
import {
  clearAdminSessionStorage,
  loadAdminSessionStorage,
  persistAdminSessionStorage,
} from "@/lib/admin-auth-storage";
import type { AdminLoginRequest, AdminSession } from "@/lib/types";

type AdminAuthContextValue = {
  session: AdminSession | null;
  token: string | null;
  isBootstrapping: boolean;
  login: (payload: AdminLoginRequest) => Promise<void>;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = loadAdminSessionStorage();

      if (!stored) {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      if (!cancelled) {
        setSession(stored);
      }

      try {
        const response = await adminApiRequest<{ user: AdminSession["user"] }>("/admin/me", {
          token: stored.token,
        });

        if (cancelled) {
          return;
        }

        const nextSession = {
          ...stored,
          user: response.data.user,
        };

        persistAdminSessionStorage(nextSession);
        setSession(nextSession);
      } catch {
        if (!cancelled) {
          clearAdminSessionStorage();
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(payload: AdminLoginRequest) {
    const response = await adminApiRequest<{
      token: string;
      token_type: string;
      user: AdminSession["user"];
    }>("/admin/auth/login", {
      method: "POST",
      body: payload,
    });

    const nextSession: AdminSession = {
      token: response.data.token,
      tokenType: response.data.token_type,
      user: response.data.user,
    };

    persistAdminSessionStorage(nextSession);
    setSession(nextSession);
  }

  function logout() {
    clearAdminSessionStorage();
    setSession(null);
  }

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      session,
      token: session?.token ?? null,
      isBootstrapping,
      login,
      logout,
    }),
    [isBootstrapping, session],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider.");
  }

  return context;
}
