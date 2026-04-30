"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type AdminPageMetaContextValue = {
  title: string | null;
  setTitle: (title: string | null) => void;
};

const AdminPageMetaContext = createContext<AdminPageMetaContextValue | null>(null);

export function AdminPageMetaProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      title,
      setTitle,
    }),
    [title],
  );

  return (
    <AdminPageMetaContext.Provider value={value}>
      {children}
    </AdminPageMetaContext.Provider>
  );
}

export function useAdminPageMeta() {
  const context = useContext(AdminPageMetaContext);

  if (!context) {
    throw new Error("useAdminPageMeta must be used within AdminPageMetaProvider");
  }

  return context;
}
