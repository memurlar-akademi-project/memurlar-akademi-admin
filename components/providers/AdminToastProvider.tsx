"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

type ToastTone = "success" | "error";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type AdminToastContextValue = {
  showToast: (input: Omit<ToastItem, "id">) => void;
};

const AdminToastContext = createContext<AdminToastContextValue | null>(null);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function showToast(input: Omit<ToastItem, "id">) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const nextToast = { id, ...input };

    setToasts((current) => [...current, nextToast]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  const value = useMemo<AdminToastContextValue>(
    () => ({
      showToast,
    }),
    [],
  );

  return (
    <AdminToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-5 top-5 z-[80] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto overflow-hidden rounded-2xl border bg-[var(--color-admin-panel)] shadow-sm ${
              toast.tone === "success"
                ? "border-emerald-200"
                : "border-rose-200"
            }`}
          >
            <div
              className={`h-1 ${
                toast.tone === "success" ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <div className="flex items-start gap-3 px-4 py-4">
              <div
                className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${
                  toast.tone === "success"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {toast.tone === "success" ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--color-admin-ink)]">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                className="text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                type="button"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  const context = useContext(AdminToastContext);

  if (!context) {
    throw new Error("useAdminToast must be used within AdminToastProvider.");
  }

  return context;
}
