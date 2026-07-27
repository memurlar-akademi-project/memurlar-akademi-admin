import type { ApiEnvelope } from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api/v1";

const inflight = new Map<string, Promise<unknown>>();

type RequestOptions = {
  token?: string | null;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown | FormData;
};

export async function adminApiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const url = `${API_BASE_URL}${path}`;
  const method = options.method ?? "GET";
  const isFormData = options.body instanceof FormData;
  const bodyKey = isFormData
    ? `form-data:${Array.from((options.body as FormData).keys()).join(",")}`
    : JSON.stringify(options.body ?? null);
  const key = `${method}:${url}:${bodyKey}:${options.token ?? ""}`;

  if (inflight.has(key)) {
    return inflight.get(key) as Promise<ApiEnvelope<T>>;
  }

  const headers: Record<string, string> = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const request = fetch(url, {
    method,
    headers,
    body: options.body
      ? isFormData
        ? (options.body as FormData)
        : JSON.stringify(options.body)
      : undefined,
    cache: "no-store",
  })
    .then(async (response) => {
      const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

      if (!response.ok || !json) {
        throw new Error(json?.message ?? "API isteği başarısız oldu.");
      }

      if (!json.success) {
        throw new Error(json.message ?? "API isteği başarısız oldu.");
      }

      return json;
    })
    .catch((error) => {
      if (error instanceof TypeError) {
        throw new Error("Sunucuya ulaşılamadı. Backend servisi, CORS ayarı veya ağ bağlantısını kontrol et.");
      }

      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);

  return request as Promise<ApiEnvelope<T>>;
}

export async function adminApiBlob(path: string, token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Görsel önizlemesi yüklenemedi.");
  }

  return response.blob();
}
