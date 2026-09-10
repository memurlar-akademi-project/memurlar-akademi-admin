"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import { AdminListToolbar, AdminListToolbarActions, AdminListToolbarIconButton, AdminListToolbarMeta, AdminListToolbarMetaPill, AdminListToolbarRow } from "@/components/admin/crud/AdminListToolbar";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminLiveExamParticipant, AdminPaginationMeta } from "@/lib/types";

type RankingPayload = { participants: AdminLiveExamParticipant[] };

function formatDuration(seconds: number) {
  const minutes = Math.floor(Math.max(seconds, 0) / 60);
  const remainder = Math.max(seconds, 0) % 60;
  return `${minutes} dk ${remainder} sn`;
}

export function LiveExamRankings({ eventId, published }: { eventId: number; published: boolean }) {
  const { token } = useAdminAuth();
  const [rankings, setRankings] = useState<AdminLiveExamParticipant[]>([]);
  const [pagination, setPagination] = useState<AdminPaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(pageSize), sort: "rank" });
      const response = await adminApiRequest<RankingPayload>(`/admin/live-exams/${eventId}/participants?${params.toString()}`, { token });
      setRankings(response.data.participants);
      setPagination(response.meta.pagination as AdminPaginationMeta);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sıralama alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [eventId, page, pageSize, token]);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo<ColumnDef<AdminLiveExamParticipant>[]>(() => [
    {
      id: "rank",
      header: "Sıra",
      cell: ({ row }) => (
        <span className="inline-flex min-w-11 items-center justify-center rounded-full bg-amber-50 px-3 py-1.5 text-sm font-black text-amber-700">
          #{row.original.result?.rank ?? "—"}
        </span>
      ),
    },
    {
      id: "participant",
      header: "Aday",
      cell: ({ row }) => (
        <div className="min-w-[210px]">
          <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">{row.original.user.name}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{row.original.user.email}</p>
        </div>
      ),
    },
    {
      id: "counts",
      header: "Doğru / Yanlış / Boş",
      cell: ({ row }) => row.original.result ? (
        <div className="flex min-w-[180px] items-center gap-2 text-sm font-bold">
          <span className="text-emerald-700">{row.original.result.correct_count ?? 0} D</span>
          <span className="text-red-600">{row.original.result.wrong_count ?? 0} Y</span>
          <span className="text-[var(--color-admin-muted)]">{row.original.result.empty_count ?? 0} B</span>
          {(row.original.result.cancelled_count ?? 0) > 0 ? <span className="text-amber-700">{row.original.result.cancelled_count} İ</span> : null}
        </div>
      ) : "—",
    },
    {
      id: "score",
      header: "Puan",
      cell: ({ row }) => <span className="text-base font-black">{row.original.result?.score.toLocaleString("tr-TR") ?? "—"}</span>,
    },
    {
      id: "duration",
      header: "Süre",
      cell: ({ row }) => <span className="whitespace-nowrap text-sm font-semibold">{formatDuration(row.original.result?.spent_seconds ?? row.original.spent_seconds)}</span>,
    },
  ], []);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black"><Trophy size={19} className="text-amber-600" />{published ? "Kesin Sıralama" : "Taslak Sıralama"}</h2>
          <p className="mt-1 text-sm text-[var(--color-admin-muted)]">Yanlışlar doğruyu götürmez. Puan eşitliğinde doğru sayısı, ardından daha kısa tamamlama süresi önceliklidir.</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {published ? "Yayınlandı" : "Henüz yayınlanmadı"}
        </span>
      </div>

      <AdminTableCard>
        <AdminListToolbar>
          <AdminListToolbarRow>
            <AdminListToolbarMeta>
              <AdminListToolbarMetaPill><BarChart3 size={13} />{pagination?.total ?? 0} sonuç</AdminListToolbarMetaPill>
            </AdminListToolbarMeta>
            <AdminListToolbarActions>
              <AdminListToolbarIconButton onClick={() => void load()} title="Sıralamayı yenile"><RefreshCw size={15} /></AdminListToolbarIconButton>
            </AdminListToolbarActions>
          </AdminListToolbarRow>
        </AdminListToolbar>

        {loading ? <AdminTableSkeleton /> : error ? (
          <div className="px-5 py-10 text-sm font-semibold text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid
            columns={columns}
            data={rankings}
            emptyState="Henüz oluşturulmuş bir sıralama bulunmuyor."
            pagination={pagination ? {
              ...pagination,
              onPageChange: setPage,
              onPageSizeChange: (nextPageSize) => { setPageSize(nextPageSize); setPage(1); },
            } : undefined}
          />
        )}
      </AdminTableCard>
    </section>
  );
}
