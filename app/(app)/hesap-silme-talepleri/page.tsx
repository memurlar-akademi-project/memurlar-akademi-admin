"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { adminApiRequest } from "@/lib/admin-api";
import { DeletionScopeDetails } from "@/components/account-deletion/DeletionScopeDetails";
import { DeletionPreparationDetails } from "@/components/account-deletion/DeletionPreparationDetails";
import { DeletionCleanupDetails } from "@/components/account-deletion/DeletionCleanupDetails";
import { DeletionRunDetails } from "@/components/account-deletion/DeletionRunDetails";
import { deletionUserFilter } from "@/lib/account-deletion-request-filter";

type Status = "pending" | "processing" | "withdrawn" | "completed";
type DeletionRow = {
  id: string;
  user_id: number;
  status: Status;
  reason: "exam_ended" | "content" | "other_source" | "other";
  source: "ios" | "android" | "web";
  requested_at: string;
  due_at: string;
  withdrawn_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  revision: number;
  can_withdraw: boolean;
};
const statuses: Record<Status, string> = {
  pending: "Yeni",
  processing: "İşleme alındı",
  withdrawn: "Kullanıcı geri çekti",
  completed: "Tamamlandı",
};
const reasons: Record<DeletionRow["reason"], string> = {
  exam_ended: "Sınavım bitti",
  content: "İçerik ihtiyacımı karşılamadı",
  other_source: "Başka bir kaynak kullanıyorum",
  other: "Diğer",
};
const date = (value: string) => new Date(value).toLocaleString("tr-TR");

export default function DeletionRequestsPage() {
  return (
    <Suspense fallback={<p role="status">Talepler yükleniyor…</p>}>
      <DeletionRequestsContent />
    </Suspense>
  );
}

function DeletionRequestsContent() {
  const { token } = useAdminAuth();
  const searchParams = useSearchParams();
  const owner = deletionUserFilter(searchParams.getAll("user_id"));
  const { setTitle } = useAdminPageMeta();
  useEffect(() => {
    setTitle("Hesap Silme Talepleri");
    return () => setTitle(null);
  }, [setTitle]);
  if (owner.invalid)
    return (
      <div role="alert" className="space-y-3 rounded-xl border bg-white p-5">
        <p>Kullanıcı filtresi geçersiz. Talep listesi yüklenmedi.</p>
        <Link href="/hesap-silme-talepleri" className="underline">
          Tüm taleplere dön
        </Link>
      </div>
    );
  return token ? (
    <DeletionList
      key={`${token}:${owner.userId ?? "all"}`}
      token={token}
      userId={owner.userId}
    />
  ) : null;
}

function DeletionList({
  token,
  userId,
}: {
  token: string;
  userId: number | null;
}) {
  const [filter, setFilter] = useState<Status | "all">(
    userId === null ? "pending" : "all",
  );
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({
    rows: [] as DeletionRow[],
    lastPage: 1,
    total: 0,
    loading: true,
    error: "",
  });
  useEffect(() => {
    let cancelled = false;
    adminApiRequest<{ requests: DeletionRow[] }>(
      `/admin/account-deletion-requests?page=${page}${filter === "all" ? "" : `&status=${filter}`}${userId === null ? "" : `&user_id=${userId}`}`,
      { token },
    )
      .then((result) => {
        if (
          !Array.isArray(result.data.requests) ||
          (userId !== null &&
            result.data.requests.some((row) => row.user_id !== userId))
        )
          throw new Error("Talep listesi doğrulanamadı.");
        if (!cancelled)
          setState({
            rows: result.data.requests,
            lastPage: Number(result.meta?.last_page ?? 1),
            total: Number(result.meta?.total ?? 0),
            loading: false,
            error: "",
          });
      })
      .catch((error) => {
        if (!cancelled)
          setState({
            rows: [],
            lastPage: 1,
            total: 0,
            loading: false,
            error:
              error instanceof Error ? error.message : "Talepler yüklenemedi.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId, filter, page, reload]);
  const refresh = () => {
    setState((previous) => ({
      ...previous,
      rows: [],
      loading: true,
      error: "",
    }));
    setReload((value) => value + 1);
  };
  const changePage = (next: number) => {
    setState((previous) => ({
      ...previous,
      rows: [],
      loading: true,
      error: "",
    }));
    setPage(next);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hesap Silme Talepleri</h1>
          <p className="mt-1 text-sm text-slate-500">
            Web, iOS ve Android talepleri; son işlem tarihine göre sıralanır.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={state.loading}
          className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
        >
          <RefreshCcw size={16} />
          Yenile
        </button>
      </div>
      {userId !== null && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm">
          <span>Kullanıcı #{userId} · Bu hesaba ait talepler</span>
          <Link href="/hesap-silme-talepleri" className="underline">
            Kullanıcı filtresini kaldır
          </Link>
        </div>
      )}
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Buradan talebi incelemeye alabilir ve ekip içi not ekleyebilirsin. Bu
        işlem hesabı veya kullanıcı verilerini silmez. Geri çekilen talepler
        işleme alınamaz.
      </p>
      <label className="block text-sm">
        Durum
        <select
          aria-label="Hesap silme talebi durumu"
          value={filter}
          disabled={state.loading}
          className="ml-2 rounded-xl border bg-white p-2"
          onChange={(event) => {
            setFilter(event.target.value as Status | "all");
            changePage(1);
            refresh();
          }}
        >
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="all">Tümü</option>
        </select>
      </label>
      {state.loading ? (
        <div role="status" className="flex items-center gap-2 p-6">
          <Loader2 size={18} className="animate-spin" />
          Yükleniyor
        </div>
      ) : state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {state.error}
        </p>
      ) : state.rows.length ? (
        <div className="space-y-4">
          {state.rows.map((row) => (
            <DeletionCard
              key={`${row.id}:${row.revision}`}
              row={row}
              token={token}
              onSaved={refresh}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          Bu filtrede hesap silme talebi bulunmuyor.
        </div>
      )}
      <div className="flex items-center justify-between gap-3 text-sm">
        <button
          className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
          disabled={page <= 1 || state.loading}
          onClick={() => changePage(page - 1)}
        >
          Önceki
        </button>
        <span className="text-slate-500">
          Sayfa {page} / {state.lastPage}
          {!state.loading && !state.error ? ` · ${state.total} talep` : ""}
        </span>
        <button
          className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
          disabled={page >= state.lastPage || state.loading}
          onClick={() => changePage(page + 1)}
        >
          Sonraki
        </button>
      </div>
    </div>
  );
}

function DeletionCard({
  row,
  token,
  onSaved,
}: {
  row: DeletionRow;
  token: string;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [note, setNote] = useState(row.review_note ?? "");
  const [cleanupLocked, setCleanupLocked] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const editable = row.can_withdraw && (row.status === "pending" || row.status === "processing");
  const save = async () => {
    if (lock.current || !editable || cleanupLocked) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await adminApiRequest<{
        id: string;
        user_id: number;
        revision: number;
      }>(`/admin/account-deletion-requests/${row.id}`, {
        token,
        method: "PUT",
        body: {
          expected_revision: row.revision,
          status,
          review_note: note.trim() || null,
        },
      });
      if (
        result.data.id !== row.id ||
        result.data.user_id !== row.user_id ||
        result.data.revision !== row.revision + 1
      )
        throw new Error("Talebin güncel durumu doğrulanamadı. Listeyi yenile.");
      if (live.current) onSaved();
    } catch (failure) {
      if (live.current)
        setError(
          failure instanceof Error ? failure.message : "Talep kaydedilemedi.",
        );
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  };
  return (
    <article className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/kullanicilar/${row.user_id}/duzenle`}
            className="font-semibold text-blue-700 underline"
          >
            Kullanıcı #{row.user_id}
          </Link>
          <p className="mt-1 text-sm text-slate-500">
            {date(row.requested_at)} · {row.source.toUpperCase()}
          </p>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm">
          {statuses[row.status]}
        </span>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Ayrılma nedeni</dt>
          <dd className="mt-1">{reasons[row.reason]}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Son işlem tarihi</dt>
          <dd className="mt-1 font-semibold">{date(row.due_at)}</dd>
        </div>
        {row.withdrawn_at && (
          <div>
            <dt className="text-slate-500">Geri çekilme</dt>
            <dd className="mt-1">{date(row.withdrawn_at)}</dd>
          </div>
        )}
      </dl>
      <DeletionScopeDetails
        token={token}
        requestId={row.id}
        userId={row.user_id}
        revision={row.revision}
      />
      <DeletionPreparationDetails
        token={token}
        requestId={row.id}
        userId={row.user_id}
        revision={row.revision}
      />
      <DeletionRunDetails
        token={token}
        requestId={row.id}
        userId={row.user_id}
        revision={row.revision}
        onStarted={onSaved}
        onLocked={setCleanupLocked}
      />
      <DeletionCleanupDetails
        token={token}
        requestId={row.id}
        userId={row.user_id}
        revision={row.revision}
        onCompleted={onSaved}
      />
      {editable ? (
        <>
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <label className="text-sm">
              Durum
              <select
                value={status}
                disabled={busy || cleanupLocked}
                onChange={(event) => setStatus(event.target.value as Status)}
                className="mt-1 block w-full rounded-xl border p-2"
              >
                <option value="pending">Yeni</option>
                <option value="processing">İşleme alındı</option>
              </select>
            </label>
            <label className="text-sm">
              İç değerlendirme notu
              <textarea
                value={note}
                disabled={busy || cleanupLocked}
                onChange={(event) => setNote(event.target.value)}
                maxLength={5000}
                rows={3}
                className="mt-1 block w-full rounded-xl border p-3"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            İç not kullanıcıya gönderilmez. Hesap silme tamamlandı bildirimi
            oluşturulmaz.
          </p>
          {!!error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            onClick={() => void save()}
            disabled={
              busy || cleanupLocked ||
              (status === row.status && note.trim() === (row.review_note ?? ""))
            }
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </>
      ) : (
        row.review_note && (
          <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
            {row.review_note}
          </p>
        )
      )}
    </article>
  );
}
