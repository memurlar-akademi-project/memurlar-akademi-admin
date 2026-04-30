"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiRequest } from "@/lib/admin-api";

type Options<T> = {
  endpoint: string;
  responseKey: string;
  transform?: (items: T[]) => T[];
};

export function useAdminList<T>({
  endpoint,
  responseKey,
  transform,
}: Options<T>) {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await adminApiRequest<Record<string, T[]>>(endpoint, { token });
      const nextItems = response.data[responseKey] ?? [];
      setItems(transform ? transform(nextItems) : nextItems);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Liste yüklenirken hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, responseKey, token, transform]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    setItems,
    loading,
    error,
    refresh,
  };
}
