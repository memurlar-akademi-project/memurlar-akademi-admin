"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Search, UsersRound } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import {
  AdminListToolbar,
  AdminListToolbarActions,
  AdminListToolbarField,
  AdminListToolbarFields,
  AdminListToolbarIconButton,
  AdminListToolbarMeta,
  AdminListToolbarMetaPill,
  AdminListToolbarRow,
} from "@/components/admin/crud/AdminListToolbar";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminLiveExamParticipant, AdminPaginationMeta } from "@/lib/types";

type ParticipantPayload = { participants: AdminLiveExamParticipant[] };

const statusLabels: Record<AdminLiveExamParticipant["status"], string> = {
  registered: "Kayıtlı",
  in_progress: "Sınavda",
  submitted: "Teslim etti",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes} dk ${remainder} sn`;
}

function statusStyle(status: AdminLiveExamParticipant["status"]) {
  if (status === "submitted") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (status === "in_progress") return "border-emerald-200 bg-emerald-50 text-emerald-700";

  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function LiveExamParticipants({ eventId }: { eventId: number }) {
  const { token } = useAdminAuth();
  const [participants, setParticipants] = useState<AdminLiveExamParticipant[]>([]);
  const [pagination, setPagination] = useState<AdminPaginationMeta | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    if (status !== "all") params.set("status", status);

    try {
      const response = await adminApiRequest<ParticipantPayload>(
        `/admin/live-exams/${eventId}/participants?${params.toString()}`,
        { token },
      );
      setParticipants(response.data.participants);
      setPagination(response.meta.pagination as AdminPaginationMeta);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Katılımcılar alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, eventId, page, pageSize, status, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<ColumnDef<AdminLiveExamParticipant>[]>(() => [
    {
      id: "participant",
      header: "Katılımcı",
      cell: ({ row }) => (
        <div className="min-w-[220px]">
          <p className="text-sm font-bold text-[var(--color-admin-ink)]">{row.original.user.name}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{row.original.user.email}</p>
          <p className="mt-0.5 text-xs text-[var(--color-admin-muted)]">{row.original.user.phone ?? "Telefon yok"}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) => (
        <div className="min-w-[112px]">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusStyle(row.original.status)}`}>
            {statusLabels[row.original.status]}
          </span>
          {row.original.answered_count !== null ? (
            <p className="mt-2 text-xs font-medium text-[var(--color-admin-muted)]">{row.original.answered_count} yanıt</p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "registered_at",
      header: "Kayıt zamanı",
      cell: ({ row }) => <span className="whitespace-nowrap text-sm font-semibold">{formatDate(row.original.registered_at)}</span>,
    },
    {
      accessorKey: "started_at",
      header: "Başlama",
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDate(row.original.started_at)}</span>,
    },
    {
      accessorKey: "submitted_at",
      header: "Teslim",
      cell: ({ row }) => (
        <div className="min-w-[130px]">
          <p className="whitespace-nowrap text-sm">{formatDate(row.original.submitted_at)}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{formatDuration(row.original.spent_seconds)}</p>
        </div>
      ),
    },
    {
      id: "result",
      header: "Sonuç",
      cell: ({ row }) => row.original.result ? (
        <div className="min-w-[100px]">
          <p className="text-sm font-bold">{row.original.result.net.toLocaleString("tr-TR")} net</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">#{row.original.result.rank} sıra</p>
        </div>
      ) : <span className="text-sm text-[var(--color-admin-muted)]">—</span>,
    },
  ], []);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black"><UsersRound size={19} className="text-amber-600" />Katılımcılar</h2>
          <p className="mt-1 text-sm text-[var(--color-admin-muted)]">Kayıt olan adayları ve sınav durumlarını takip et.</p>
        </div>
        <span className="text-sm font-bold text-[var(--color-admin-muted)]">{pagination?.total ?? 0} kişi</span>
      </div>

      <AdminTableCard>
        <AdminListToolbar>
          <AdminListToolbarRow>
            <AdminListToolbarFields>
              <AdminListToolbarField className="relative min-w-[240px] flex-1 sm:max-w-[420px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-admin-muted)]" size={15} />
                <input
                  className="admin-input h-10 pl-9 text-sm"
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  placeholder="Ad, e-posta veya telefon ara"
                  value={search}
                />
              </AdminListToolbarField>
              <AdminListToolbarField className="min-w-[180px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm"
                  onChange={(event) => { setStatus(event.target.value); setPage(1); }}
                  value={status}
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="registered">Kayıtlı</option>
                  <option value="in_progress">Sınavda</option>
                  <option value="submitted">Teslim etti</option>
                </select>
              </AdminListToolbarField>
            </AdminListToolbarFields>
            <AdminListToolbarActions>
              <AdminListToolbarIconButton onClick={() => void load()} title="Katılımcıları yenile">
                <RefreshCw size={15} />
              </AdminListToolbarIconButton>
            </AdminListToolbarActions>
          </AdminListToolbarRow>
          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{pagination?.total ?? 0} katılımcı</AdminListToolbarMetaPill>
            {status !== "all" ? <AdminListToolbarMetaPill>{statusLabels[status as AdminLiveExamParticipant["status"]]}</AdminListToolbarMetaPill> : null}
          </AdminListToolbarMeta>
        </AdminListToolbar>

        {loading ? <AdminTableSkeleton /> : error ? (
          <div className="px-5 py-10 text-sm font-semibold text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid
            columns={columns}
            data={participants}
            emptyState="Filtrelerle eşleşen bir katılımcı bulunamadı."
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
