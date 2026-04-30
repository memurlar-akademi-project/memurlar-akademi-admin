"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RefreshCcw, SquarePen } from "lucide-react";
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
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import type { AdminOrder } from "@/lib/types";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: AdminOrder["status"]) {
  switch (status) {
    case "completed":
      return "Tamamlandı";
    case "pending":
      return "Beklemede";
    case "failed":
      return "Başarısız";
    case "cancelled":
      return "İptal";
    case "refunded":
      return "İade";
    default:
      return status;
  }
}

export default function OrdersPage() {
  const { items, loading, error, refresh } = useAdminList<AdminOrder>({
    endpoint: "/admin/orders",
    responseKey: "orders",
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminOrder["status"]>("all");

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.order_no, item.user?.name, item.user?.email, item.plan?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, statusFilter]);

  const columns: ColumnDef<AdminOrder>[] = [
    {
      accessorKey: "order_no",
      header: "Sipariş",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[320px]">
          <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{row.original.order_no}</p>
          <p className="mt-1 truncate text-xs text-[var(--color-admin-muted)]">
            {row.original.user?.name ?? "Kullanıcı yok"} · {row.original.user?.email ?? "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[var(--color-admin-ink)]">
          {row.original.plan?.name ?? "Plan yok"}
        </span>
      ),
    },
    {
      accessorKey: "total_amount",
      header: "Tutar",
      cell: ({ row }) => <span className="text-sm font-semibold text-[var(--color-admin-ink)]">{row.original.total_amount} TL</span>,
    },
    {
      accessorKey: "ordered_at",
      header: "Tarih",
      cell: ({ row }) => <span className="text-sm text-[var(--color-admin-muted)]">{formatDate(row.original.ordered_at)}</span>,
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            row.original.status === "completed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : row.original.status === "pending"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : row.original.status === "failed"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {statusLabel(row.original.status)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksiyon",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/siparisler/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminTableCard>
        <AdminListToolbar>
          <AdminListToolbarRow>
            <AdminListToolbarFields>
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[320px]">
                <input
                  className="admin-input h-10 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Sipariş no, kullanıcı veya plan ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[150px] sm:max-w-[180px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setStatusFilter(event.target.value as "all" | AdminOrder["status"])}
                  value={statusFilter}
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="pending">Beklemede</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="failed">Başarısız</option>
                  <option value="cancelled">İptal</option>
                  <option value="refunded">İade</option>
                </select>
              </AdminListToolbarField>
            </AdminListToolbarFields>

            <AdminListToolbarActions>
              <AdminListToolbarIconButton
                aria-label="Listeyi yenile"
                onClick={() => void refresh()}
                title="Yenile"
              >
                <RefreshCcw size={16} />
              </AdminListToolbarIconButton>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{filteredRows.length} sipariş listeleniyor</AdminListToolbarMetaPill>
          </AdminListToolbarMeta>
        </AdminListToolbar>
      </AdminTableCard>

      {loading ? (
        <AdminTableSkeleton />
      ) : (
        <AdminDataGrid
          columns={columns}
          data={filteredRows}
          emptyState="Filtreye uygun sipariş kaydı bulunamadı."
        />
      )}

      {error ? (
        <div className="rounded-2xl border border-[var(--color-admin-danger)]/20 bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
