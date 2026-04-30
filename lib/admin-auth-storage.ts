import type { AdminSession } from "@/lib/types";

const STORAGE_KEY = "memurlar-akademi-admin-session";
const COOKIE_KEY = "memurlar-akademi-admin-token";

export function loadAdminSessionStorage(): AdminSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (raw) {
    try {
      return JSON.parse(raw) as AdminSession;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return null;
}

export function persistAdminSessionStorage(session: AdminSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.document.cookie = `${COOKIE_KEY}=${encodeURIComponent(session.token)}; path=/; max-age=604800; samesite=lax`;
}

export function clearAdminSessionStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
}
