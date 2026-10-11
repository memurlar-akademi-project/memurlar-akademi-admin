"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { adminApiRequest } from "@/lib/admin-api";

type Status = "open" | "in_progress" | "resolved";
type SupportRow = {
  id: number;
  kind: "support" | "bug";
  category: string;
  message: string;
  device: Record<string, string | null> | null;
  reply_email: string;
  status: Status;
  review_note: string | null;
  revision: number;
  created_at: string;
  user: { id: number; name: string } | null;
  exam_id: number | null;
};
const statusLabels: Record<Status, string> = {
  open: "Yeni",
  in_progress: "İnceleniyor",
  resolved: "Tamamlandı",
};

export default function SupportPage() {
  const { token } = useAdminAuth(),
    { setTitle } = useAdminPageMeta();
  const [filter, setFilter] = useState<Status | "all">("open"),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0);
  const [state, setState] = useState<{
    owner: string | null;
    rows: SupportRow[];
    lastPage: number;
    loading: boolean;
    error: string;
  }>({ owner: null, rows: [], lastPage: 1, loading: true, error: "" });
  useEffect(() => {
    setTitle("Destek Talepleri");
    return () => setTitle(null);
  }, [setTitle]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    adminApiRequest<{ requests: SupportRow[] }>(
      `/admin/support-requests?page=${page}${filter === "all" ? "" : `&status=${filter}`}`,
      { token },
    )
      .then((result) => {
        if (!cancelled)
          setState({
            owner: token,
            rows: result.data.requests,
            lastPage: Number(result.meta?.last_page ?? 1),
            loading: false,
            error: "",
          });
      })
      .catch((error) => {
        if (!cancelled)
          setState({
            owner: token,
            rows: [],
            lastPage: 1,
            loading: false,
            error:
              error instanceof Error ? error.message : "Talepler yüklenemedi.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [token, filter, page, reload]);
  const refresh = () => {
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    setReload((value) => value + 1);
  };
  const rows = state.owner === token ? state.rows : [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Destek Talepleri</h1>
          <p className="text-sm text-slate-500">
            Mobil destek mesajları ve uygulama sorun bildirimleri.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2"
          onClick={refresh}
          disabled={state.loading}
        >
          <RefreshCcw size={16} />
          Yenile
        </button>
      </div>
      <div className="flex gap-3">
        <label className="text-sm">
          Durum
          <select
            aria-label="Talep durumu"
            className="ml-2 rounded-xl border bg-white p-2"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as Status | "all");
              setPage(1);
              setState((previous) => ({
                ...previous,
                loading: true,
                rows: [],
              }));
            }}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="all">Tümü</option>
          </select>
        </label>
      </div>
      {state.loading ? (
        <div className="flex items-center gap-2 p-6">
          <Loader2 size={18} className="animate-spin" />
          Yükleniyor
        </div>
      ) : state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {state.error}
        </p>
      ) : rows.length ? (
        <div className="space-y-4">
          {rows.map(
            (row) =>
              token && (
                <SupportCard
                  key={`${token}:${row.id}:${row.revision}`}
                  row={row}
                  token={token}
                  onSaved={refresh}
                />
              ),
          )}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          Bu filtrede destek talebi bulunmuyor.
        </div>
      )}
      <div className="flex items-center justify-between">
        <button
          disabled={page <= 1 || state.loading}
          onClick={() => {
            setPage((value) => value - 1);
            setState((previous) => ({ ...previous, loading: true, rows: [] }));
          }}
          className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
        >
          Önceki
        </button>
        <span className="text-sm text-slate-500">
          Sayfa {page} / {state.lastPage}
        </span>
        <button
          disabled={page >= state.lastPage || state.loading}
          onClick={() => {
            setPage((value) => value + 1);
            setState((previous) => ({ ...previous, loading: true, rows: [] }));
          }}
          className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
        >
          Sonraki
        </button>
      </div>
    </div>
  );
}
function SupportCard({
  row,
  token,
  onSaved,
}: {
  row: SupportRow;
  token: string;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(row.status),
    [note, setNote] = useState(row.review_note ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await adminApiRequest(`/admin/support-requests/${row.id}`, {
        token,
        method: "PUT",
        body: {
          status,
          review_note: note.trim() || null,
          expected_revision: row.revision,
        },
      });
      if (live.current) onSaved();
    } catch (caught) {
      if (live.current)
        setError(
          caught instanceof Error ? caught.message : "Talep kaydedilemedi.",
        );
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  };
  return (
    <article className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            #{row.id} · {row.kind === "bug" ? "Sorun bildirimi" : "Destek"} ·{" "}
            {row.category}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {row.user?.name ?? "Kullanıcı"} ·{" "}
            {new Date(row.created_at).toLocaleString("tr-TR")}
          </p>
        </div>
        <a
          className="text-sm text-blue-700 underline"
          href={`mailto:${row.reply_email}`}
        >
          {row.reply_email}
        </a>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">
        {row.message}
      </p>
      {row.device && (
        <dl className="flex flex-wrap gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          {Object.entries(row.device)
            .filter(([, value]) => value != null)
            .map(([key, value]) => (
              <div key={key}>
                <dt className="font-semibold">{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      )}
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <label className="text-sm">
          Durum
          <select
            disabled={busy}
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
            className="mt-1 block w-full rounded-xl border p-2"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          İç değerlendirme notu
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
            maxLength={5000}
            rows={3}
            className="mt-1 block w-full rounded-xl border p-3"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        İç not kullanıcıya gönderilmez. Yanıtı e-posta adresinden ilettikten
        sonra durumu güncelleyebilirsin.
      </p>
      {!!error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={
          busy ||
          (status === row.status && note.trim() === (row.review_note ?? ""))
        }
        onClick={() => void save()}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </article>
  );
}
