"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpDown, CheckCircle2, PauseCircle, Plus, RefreshCcw, SquarePen } from "lucide-react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import { AdminFilterMenu } from "@/components/admin/crud/AdminFilterMenu";
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
import { AdminReadinessHint } from "@/components/admin/crud/AdminReadinessHint";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminExam, AdminMinistry } from "@/lib/types";

export default function ExamsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const searchParams = useSearchParams();
  const ministryIdFilter = searchParams.get("ministryId");

  const { items, setItems, loading, error, refresh } = useAdminList<AdminExam>({
    endpoint: "/admin/exams",
    responseKey: "exams",
  });
  const { items: ministries } = useAdminList<AdminMinistry>({
    endpoint: "/admin/ministries",
    responseKey: "ministries",
  });

  const [query, setQuery] = useState("");
  const [selectedMinistryId, setSelectedMinistryId] = useState(ministryIdFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [sortMode, setSortMode] = useState<"default" | "upcoming" | "members">("default");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const ministryName = useMemo(() => {
    if (!selectedMinistryId || selectedMinistryId === "all") {
      return null;
    }

    const match = ministries.find((item) => item.id === Number(selectedMinistryId));
    return match?.name ?? null;
  }, [ministries, selectedMinistryId]);

  const ministryOptions = useMemo(
    () =>
      ministries.map((ministry) => ({
        id: ministry.id,
        label: ministry.name,
        hint: `${ministry.exam_count} sinav`,
      })),
    [ministries],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    const nextRows = items.filter((item) => {
      if (selectedMinistryId !== "all" && item.ministry?.id !== Number(selectedMinistryId)) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const haystack = [item.name, item.slug, item.ministry?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");

      return haystack.includes(normalized);
    });

    if (sortMode === "members") {
      return [...nextRows].sort(
        (left, right) => right.active_membership_count - left.active_membership_count,
      );
    }

    if (sortMode === "upcoming") {
      return [...nextRows].sort((left, right) => {
        const now = Date.now();
        const leftDate = left.exam_date ? new Date(left.exam_date).getTime() : Number.POSITIVE_INFINITY;
        const rightDate = right.exam_date ? new Date(right.exam_date).getTime() : Number.POSITIVE_INFINITY;

        const leftDistance = leftDate >= now ? leftDate - now : Number.POSITIVE_INFINITY;
        const rightDistance = rightDate >= now ? rightDate - now : Number.POSITIVE_INFINITY;

        return leftDistance - rightDistance;
      });
    }

    return nextRows;
  }, [items, query, selectedMinistryId, sortMode, statusFilter]);

  async function handleStatusChange(exam: AdminExam, checked: boolean) {
    if (!token) {
      return;
    }

    setTogglingId(exam.id);

    try {
      const response = await adminApiRequest<{ exam: AdminExam }>(`/admin/exams/${exam.id}`, {
        token,
        method: "PUT",
        body: {
          status: checked ? "active" : "passive",
        },
      });

      setItems((current) =>
        current.map((item) => (item.id === exam.id ? response.data.exam : item)),
      );
      showToast({
        tone: "success",
        title: checked ? "Sınav aktife alındı" : "Sınav pasife alındı",
        description: exam.name,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: error instanceof Error ? error.message : exam.name,
      });
    } finally {
      setTogglingId(null);
    }
  }

  function formatExamDate(exam: AdminExam) {
    if (exam.exam_date) {
      return new Date(exam.exam_date).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }

    if (exam.year) {
      return String(exam.year);
    }

    return "Belirsiz";
  }

  const columns: ColumnDef<AdminExam>[] = [
    {
      accessorKey: "name",
      header: "Sınav",
      cell: ({ row }) => (
        <div className="min-w-[240px]">
          <p className="font-bold text-[var(--color-admin-ink)]">{row.original.name}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.ministry?.name ?? "Bakanlık yok"} · {row.original.slug}
          </p>
          <AdminReadinessHint readiness={row.original.readiness} />
        </div>
      ),
    },
    {
      accessorKey: "exam_date",
      header: "Tarih",
      enableSorting: true,
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">{formatExamDate(row.original)}</p>
      ),
    },
    {
      accessorKey: "price",
      header: "Abonelik Ücreti",
      enableSorting: true,
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.price.toLocaleString("tr-TR")} TL
        </p>
      ),
    },
    {
      accessorKey: "active_membership_count",
      header: "Aktif Üye",
      enableSorting: true,
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.active_membership_count}
        </p>
      ),
    },
    {
      accessorKey: "topic_count",
      header: "Konu",
      enableSorting: true,
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.topic_count}</p>
      ),
    },
    {
      accessorKey: "is_active_for_signup",
      header: "Kayıt",
      cell: ({ row }) => (
        <span
          className="inline-flex rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]"
        >
          {row.original.is_active_for_signup ? "Açık" : "Kapalı"}
        </span>
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
      id: "actions",
      header: "Aksiyon",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/konular?examId=${row.original.id}`}
          >
            Konular
            <ArrowRight size={14} />
          </Link>
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/sinavlar/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={togglingId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={
              row.original.status === "active"
                ? "Bu sınavı pasife almak listeleme ve ilişki kurma akışını etkiler."
                : "Bu sınavı tekrar aktif hale getirebilirsin."
            }
            onConfirm={() =>
              handleStatusChange(row.original, row.original.status !== "active")
            }
            title={
              row.original.status === "active"
                ? "Sınav pasife alınsın mı?"
                : "Sınav aktife alınsın mı?"
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
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[280px]">
                <input
                  className="admin-input h-10 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Sınav ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Bakanlık seç"
                  compact
                  emptyText="Bakanlık bulunamadı."
                  hideLabel
                  label="Bakanlık"
                  onChange={(value) => setSelectedMinistryId(value === null ? "all" : String(value))}
                  options={ministryOptions}
                  placeholder="Bakanlık ara"
                  value={selectedMinistryId === "all" ? null : Number(selectedMinistryId)}
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

              <AdminListToolbarField className="self-end pb-[1px]">
                <AdminFilterMenu
                  compact
                  icon={<ArrowUpDown size={15} />}
                  label="Sıralama"
                  onChange={setSortMode}
                  options={[
                    { value: "default", label: "Varsayılan" },
                    { value: "upcoming", label: "Yaklaşan sınavlar" },
                    { value: "members", label: "Aktif üye sayısı" },
                  ]}
                  showSelectedLabel={false}
                  value={sortMode}
                />
              </AdminListToolbarField>
            </AdminListToolbarFields>

            <AdminListToolbarActions>
              <AdminListToolbarIconButton onClick={refresh} title="Yenile">
                <RefreshCcw size={15} />
              </AdminListToolbarIconButton>
              <Link className="admin-button admin-button-primary" href="/sinavlar/yeni">
                <Plus size={16} />
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            {ministryName ? (
              <AdminListToolbarMetaPill>{ministryName}</AdminListToolbarMetaPill>
            ) : null}
            <AdminListToolbarMetaPill>{items.length} kayıt</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.is_active_for_signup).length} açık kayıt
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
            emptyState="Aramanla eşleşen sınav bulunamadı."
          />
        )}
      </AdminTableCard>
    </div>
  );
}
