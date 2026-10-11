"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { adminApiRequest } from "@/lib/admin-api";
import {
  readDeletionScope,
  type DeletionScope,
} from "@/lib/account-deletion-scope";

const rules = {
  CASCADE: "Bağlı kayıtla birlikte silinir",
  "SET NULL": "Bağlantı boşalır; kayıt kalır",
  RESTRICT: "Silme işlemini engeller",
  "NO ACTION": "Silme işlemini engeller",
};
export function DeletionScopeDetails({
  token,
  requestId,
  userId,
  revision,
}: {
  token: string;
  requestId: string;
  userId: number;
  revision: number;
}) {
  const [data, setData] = useState<DeletionScope | null>(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [onlyPresent, setOnlyPresent] = useState(true);
  const lock = useRef(false),
    live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const inspect = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setOpen(true);
    setError("");
    setData(null);
    try {
      const result = await adminApiRequest<unknown>(
        `/admin/account-deletion-requests/${requestId}/scope`,
        { token },
      );
      const scope = readDeletionScope(result.data, requestId, userId, revision);
      if (live.current) setData(scope);
    } catch (failure) {
      if (live.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "İlişkili kayıtlar kontrol edilemedi.",
        );
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  };
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <button
        type="button"
        disabled={busy}
        aria-expanded={open}
        onClick={() => void inspect()}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <ScanSearch size={16} />
        )}
        {busy
          ? "Kontrol ediliyor…"
          : data
            ? "İlişkili kayıtları yeniden kontrol et"
            : "İlişkili kayıtları kontrol et"}
      </button>
      {open && (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {data && (
            <>
              <p className="text-sm leading-6 text-slate-600">{data.notice}</p>
              <p className="text-xs text-slate-500">
                Kontrol: {new Date(data.inspected_at).toLocaleString("tr-TR")} ·
                Hesap {data.account_exists ? "mevcut" : "bulunamadı"}
              </p>
              {data.issues.length > 0 && (
                <ul className="list-disc space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 pl-8 text-sm text-amber-900">
                  {data.issues.map((issue, index) => (
                    <li key={`${issue.code}:${index}`}>{issue.label}</li>
                  ))}
                </ul>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyPresent}
                  onChange={(event) => setOnlyPresent(event.target.checked)}
                />
                Yalnız kayıt bulunan veya ek kontrol gereken satırlar
              </label>
              {data.groups.map((group) => {
                const rows = data.rows.filter(
                  (row) =>
                    row.group === group.id &&
                    (!onlyPresent || row.count === null || row.count > 0),
                );
                return rows.length ? (
                  <div key={group.id} className="space-y-2">
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <div className="overflow-x-auto rounded-xl border bg-white">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b bg-slate-100 text-xs text-slate-600">
                          <tr>
                            <th scope="col" className="p-3">
                              Kayıt
                            </th>
                            <th scope="col" className="p-3">
                              Sayı
                            </th>
                            <th scope="col" className="p-3">
                              Mevcut bağlantı davranışı
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr
                              key={row.key}
                              className="border-b last:border-0"
                            >
                              <th scope="row" className="p-3 font-normal">
                                {row.label}
                              </th>
                              <td className="p-3 tabular-nums">
                                {row.count ?? "Doğrulanamadı"}
                              </td>
                              <td className="p-3 text-xs text-slate-500">
                                {row.delete_rule
                                  ? rules[row.delete_rule]
                                  : row.relation === "file"
                                    ? "Dosya ayrıca incelenir"
                                    : "Bağımsız bağlantı"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null;
              })}
            </>
          )}
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setOpen(false)}
          >
            Kontrolü gizle
          </button>
        </div>
      )}
    </section>
  );
}
