"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, PauseCircle, Plus, RefreshCcw, SquarePen, Trash2 } from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
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
import type { AdminExam, AdminMockExam } from "@/lib/types";

export default function MockExamsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminMockExam>({
    endpoint: "/admin/mock-exams",
    responseKey: "mock_exams",
  });
  const { items: exams } = useAdminList<AdminExam>({
    endpoint: "/admin/exams",
    responseKey: "exams",
  });

  const [query, setQuery] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const examOptions = useMemo(
    () =>
      exams.map((exam) => ({
        id: exam.id,
        label: exam.name,
        hint: exam.ministry?.name,
      })),
    [exams],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (selectedExamId !== null && item.exam?.id !== selectedExamId) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.title, item.exam?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, selectedExamId, statusFilter]);

  async function handleStatusChange(item: AdminMockExam, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      const response = await adminApiRequest<{ mock_exam: AdminMockExam }>(`/admin/mock-exams/${item.id}`, {
        token,
        method: "PUT",
        body: {
          exam_id: item.exam?.id,
          title: item.title,
          slug: item.slug ?? null,
          status: checked ? "active" : "passive",
          duration_min: item.duration_min,
          scheduled_at: item.scheduled_at ?? null,
          is_tr_general: Boolean(item.is_tr_general),
          is_free: Boolean(item.is_free),
          question_ids: item.question_ids ?? [],
        },
      });

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? response.data.mock_exam : entry)),
      );
      showToast({
        tone: "success",
        title: checked ? "Deneme aktife alındı" : "Deneme pasife alındı",
        description: item.exam?.name ?? "Sınav havuzu",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: AdminMockExam) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      await adminApiRequest(`/admin/mock-exams/${item.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Deneme silindi",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Deneme silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnDef<AdminMockExam>[] = [
    {
      accessorKey: "title",
      header: "Deneme",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="overflow-hidden text-sm font-bold leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {row.original.title}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{row.original.exam?.name ?? "Sınav yok"}</p>
        </div>
      ),
    },
    {
      accessorKey: "question_count",
      header: "Soru",
      cell: ({ row }) => (
        <span className="font-semibold text-[var(--color-admin-ink)]">{row.original.question_count}</span>
      ),
    },
    {
      accessorKey: "duration_min",
      header: "Süre",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[var(--color-admin-ink)]">{row.original.duration_min} dk</span>
      ),
    },
    {
      accessorKey: "is_free",
      header: "Erişim",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            row.original.is_free
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-indigo-200 bg-indigo-50 text-indigo-700"
          }`}
        >
          {row.original.is_free ? "Free açık" : "Premium"}
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
          {row.original.status === "active" ? "Aktif" : row.original.status === "draft" ? "Taslak" : "Pasif"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksiyon",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/denemeler/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={
              row.original.status === "active"
                ? "Bu deneme öğrenci tarafında listelenmez."
                : "Bu deneme tekrar aktif hale getirilir."
            }
            onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
            title={row.original.status === "active" ? "Deneme pasife alınsın mı?" : "Deneme aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Denemeyi Sil"
            description="Kayıt kalıcı olarak silinir."
            onConfirm={() => handleDelete(row.original)}
            title="Deneme silinsin mi?"
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-danger)] hover:text-[var(--color-admin-danger)]">
                <Trash2 size={16} />
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
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[320px]">
                <input
                  className="admin-input h-10 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Deneme başlığı veya sınav ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Sınav seç"
                  compact
                  emptyText="Sınav bulunamadı."
                  hideLabel
                  label="Sınav"
                  onChange={setSelectedExamId}
                  options={examOptions}
                  placeholder="Sınav seç"
                  value={selectedExamId}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[190px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
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
              <Link
                aria-label="Yeni Deneme"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35 hover:text-[var(--color-admin-accent)]"
                href="/denemeler/yeni"
                title="Yeni Deneme"
              >
                <Plus size={16} />
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{filteredRows.length} deneme</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            {selectedExamId !== null ? <AdminListToolbarMetaPill>Sınav filtresi açık</AdminListToolbarMetaPill> : null}
          </AdminListToolbarMeta>
        </AdminListToolbar>

        {loading ? (
          <AdminTableSkeleton />
        ) : error ? (
          <div className="px-5 py-10 text-sm text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Henüz deneme kaydı yok." />
        )}
      </AdminTableCard>
    </div>
  );
}
