"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, PauseCircle, Plus, RefreshCcw, SquarePen } from "lucide-react";
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
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminMinistry } from "@/lib/types";

export default function MinistriesPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminMinistry>({
    endpoint: "/admin/ministries",
    responseKey: "ministries",
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const haystack = [item.name, item.slug]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");

      return haystack.includes(normalized);
    });
  }, [items, query, statusFilter]);

  async function handleStatusChange(ministry: AdminMinistry, checked: boolean) {
    if (!token) {
      return;
    }

    setTogglingId(ministry.id);

    try {
      const response = await adminApiRequest<{ ministry: AdminMinistry }>(`/admin/ministries/${ministry.id}`, {
        token,
        method: "PUT",
        body: {
          status: checked ? "active" : "passive",
        },
      });

      setItems((current) =>
        current.map((item) => (item.id === ministry.id ? response.data.ministry : item)),
      );
      showToast({
        tone: "success",
        title: checked ? "Bakanlık aktife alındı" : "Bakanlık pasife alındı",
        description: ministry.name,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: error instanceof Error ? error.message : ministry.name,
      });
    } finally {
      setTogglingId(null);
    }
  }

  const columns: ColumnDef<AdminMinistry>[] = [
      {
        accessorKey: "name",
        header: "Bakanlık",
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="font-bold text-[var(--color-admin-ink)]">{row.original.name}</p>
            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
              #{row.original.id} · {row.original.slug}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "exam_count",
        header: "Sınav",
        enableSorting: true,
        cell: ({ row }) => (
          <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.exam_count}</p>
        ),
      },
      {
        accessorKey: "status",
        header: "Durum",
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
              row.original.status === "active"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : row.original.status === "draft"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-slate-100 text-slate-600"
            }`}
          >
            {row.original.status === "active"
              ? "Aktif"
              : row.original.status === "draft"
                ? "Taslak"
                : "Pasif"}
          </span>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Güncelleme",
        enableSorting: true,
        cell: ({ row }) => (
          <p className="font-semibold text-[var(--color-admin-ink)]">
            {row.original.updated_at
              ? new Date(row.original.updated_at).toLocaleDateString("tr-TR")
              : "-"}
          </p>
        ),
      },
      {
        id: "actions",
        header: "Aksiyon",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
              href={`/sinavlar?ministryId=${row.original.id}`}
            >
              Sınavlar
              <ArrowRight size={14} />
            </Link>
            <Link
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
              href={`/bakanliklar/${row.original.id}/duzenle`}
            >
              <SquarePen size={16} />
            </Link>
            <ConfirmDialog
              busy={togglingId === row.original.id}
              confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
              description={
                row.original.status === "active"
                  ? "Bu bakanlığı pasife almak bağlı sınav akışlarını etkileyebilir."
                  : "Bu bakanlığı tekrar aktif hale getirebilirsin."
              }
              onConfirm={() =>
                handleStatusChange(row.original, row.original.status !== "active")
              }
              title={
                row.original.status === "active"
                  ? "Bakanlık pasife alınsın mı?"
                  : "Bakanlık aktife alınsın mı?"
              }
              tone={row.original.status === "active" ? "danger" : "primary"}
              trigger={
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                  {row.original.status === "active" ? (
                    <PauseCircle size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </span>
              }
            />
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
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[300px]">
                <input
                  className="admin-input h-10 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Bakanlık ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[190px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "draft" | "passive")}
                  value={statusFilter}
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="passive">Pasif</option>
                </select>
              </AdminListToolbarField>
            </AdminListToolbarFields>

            <AdminListToolbarActions>
              <AdminListToolbarIconButton onClick={refresh} title="Yenile">
                <RefreshCcw size={15} />
              </AdminListToolbarIconButton>
              <Link className="admin-button admin-button-primary" href="/bakanliklar/yeni">
                <Plus size={16} />
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{items.length} kayıt</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "draft").length} taslak
            </AdminListToolbarMetaPill>
          </AdminListToolbarMeta>
        </AdminListToolbar>

        {error ? (
          <div className="border-b border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-5 py-4 text-sm text-[var(--color-admin-danger)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="p-5">
            <AdminTableSkeleton rows={8} />
          </div>
        ) : (
          <AdminDataGrid
            columns={columns}
            data={filteredRows}
            emptyState="Aramanla eşleşen bakanlık bulunamadı."
          />
        )}
      </AdminTableCard>
    </div>
  );
}
