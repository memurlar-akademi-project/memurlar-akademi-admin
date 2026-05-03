"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPaginationMeta } from "@/lib/types";

type Options<T> = {
  endpoint: string;
  responseKey: string;
  params?: Record<string, number | string | boolean | null | undefined>;
  transform?: (items: T[]) => T[];
};

export function useAdminList<T>({
  endpoint,
  responseKey,
  params,
  transform,
}: Options<T>) {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<AdminPaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsKey = JSON.stringify(params ?? {});

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestEndpoint = withQueryParams(endpoint, params);
      const response = await adminApiRequest<Record<string, T[]>>(requestEndpoint, { token });
      const nextItems = response.data[responseKey] ?? [];
      setItems(transform ? transform(nextItems) : nextItems);
      setPagination(parsePagination(response.meta.pagination));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Liste yüklenirken hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, paramsKey, responseKey, token, transform]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    setItems,
    pagination,
    loading,
    error,
    refresh,
  };
}

function withQueryParams(
  endpoint: string,
  params?: Record<string, number | string | boolean | null | undefined>,
): string {
  if (!params) {
    return endpoint;
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();

  if (!query) {
    return endpoint;
  }

  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query}`;
}

function parsePagination(value: unknown): AdminPaginationMeta | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const meta = value as Partial<AdminPaginationMeta>;

  if (
    typeof meta.current_page !== "number" ||
    typeof meta.per_page !== "number" ||
    typeof meta.total !== "number" ||
    typeof meta.last_page !== "number"
  ) {
    return null;
  }

  return {
    current_page: meta.current_page,
    per_page: meta.per_page,
    total: meta.total,
    last_page: meta.last_page,
    from: typeof meta.from === "number" ? meta.from : null,
    to: typeof meta.to === "number" ? meta.to : null,
  };
}
