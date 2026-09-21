"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Crown, Download, LoaderCircle, PauseCircle, Plus, RefreshCcw, SquarePen, Trash2, UserCheck } from "lucide-react";
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
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiDownload, adminApiRequest } from "@/lib/admin-api";
import type { AdminUser } from "@/lib/types";

type ExamOption = {
  id: number;
  name: string;
  ministry_name: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Henüz yok";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function UsersPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "passive">("all");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<"all" | "free" | "paid">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const { items, setItems, loading, error, refresh, pagination } = useAdminList<AdminUser>({
    endpoint: "/admin/users",
    responseKey: "users",
    params: {
      page,
      per_page: pageSize,
      search: deferredQuery.trim(),
      status: statusFilter,
      exam_id: selectedExamId,
      membership_type: membershipTypeFilter,
    },
  });

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, membershipTypeFilter, selectedExamId, statusFilter]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadExams() {
      try {
        const response = await adminApiRequest<{ exams: ExamOption[] }>("/admin/users/options/exams", { token });

        if (!cancelled) {
          setExams(response.data.exams);
        }
      } catch {
        if (!cancelled) {
          setExams([]);
        }
      }
    }

    void loadExams();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const examOptions = useMemo(
    () =>
      exams.map((exam) => ({
        id: exam.id,
        label: exam.name,
        hint: exam.ministry_name ?? undefined,
      })),
    [exams],
  );

  const summary = useMemo(() => {
    return items.reduce(
      (totals, item) => ({
        active: totals.active + (item.status === "active" ? 1 : 0),
        paid: totals.paid + (item.membership?.type === "paid" ? 1 : 0),
        answered: totals.answered + item.activity.answered_question_count,
        completedMocks: totals.completedMocks + item.activity.completed_mock_exam_count,
      }),
      { active: 0, paid: 0, answered: 0, completedMocks: 0 },
    );
  }, [items]);

  async function handleStatusChange(item: AdminUser, nextStatus: "active" | "passive") {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      const response = await adminApiRequest<{ user: AdminUser }>(`/admin/users/${item.id}`, {
        token,
        method: "PUT",
        body: {
          status: nextStatus,
          membership_status: nextStatus,
        },
      });

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? response.data.user : entry)),
      );
      showToast({
        tone: "success",
        title: nextStatus === "active" ? "Kullanıcı aktife alındı" : "Kullanıcı pasife alındı",
        description: item.email,
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

  async function handleDelete(item: AdminUser) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      await adminApiRequest(`/admin/users/${item.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Kullanıcı silindi",
        description: item.email,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Kullanıcı silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport() {
    if (!token || exporting) {
      return;
    }

    const exportParams = new URLSearchParams();
    const search = query.trim();

    if (search) exportParams.set("search", search);
    if (statusFilter !== "all") exportParams.set("status", statusFilter);
    if (selectedExamId !== null) exportParams.set("exam_id", String(selectedExamId));
    if (membershipTypeFilter !== "all") exportParams.set("membership_type", membershipTypeFilter);

    const exportPath = `/admin/users/export${exportParams.size > 0 ? `?${exportParams.toString()}` : ""}`;
    setExporting(true);

    try {
      const { blob, filename } = await adminApiDownload(exportPath, token);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const fallbackDate = new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      anchor.href = objectUrl;
      anchor.download = filename ?? `kullanicilar-${fallbackDate}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

      showToast({
        tone: "success",
        title: "Kullanıcı listesi indirildi",
        description: `${pagination?.total ?? items.length} filtrelenmiş kullanıcı CSV dosyasına aktarıldı.`,
      });
    } catch (exportError) {
      showToast({
        tone: "error",
        title: "Kullanıcılar dışa aktarılamadı",
        description: exportError instanceof Error ? exportError.message : "Dosya indirilemedi.",
      });
    } finally {
      setExporting(false);
    }
  }

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: "name",
      header: "Kullanıcı",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[360px]">
          <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{row.original.name}</p>
          <p className="mt-1 truncate text-xs text-[var(--color-admin-muted)]">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "membership",
      header: "Sınav / Üyelik",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-semibold text-[var(--color-admin-ink)]">
            {row.original.membership?.exam?.name ?? "Sınav yok"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {(row.original.membership?.type ?? "-").toUpperCase()} · {row.original.membership?.status ?? "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "order_count",
      header: "Kullanım",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-semibold text-[var(--color-admin-ink)]">
            {row.original.activity.answered_question_count} soru · %{row.original.activity.accuracy_rate}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.activity.completed_mock_exam_count} deneme · {row.original.activity.completed_topic_count} konu
          </p>
        </div>
      ),
    },
    {
      accessorKey: "orders",
      header: "Ticari",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.order_count} sipariş</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{row.original.total_spent} TL</p>
        </div>
      ),
    },
    {
      accessorKey: "last_activity_at",
      header: "Son Hareket",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-semibold text-[var(--color-admin-ink)]">{formatDate(row.original.last_activity_at)}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.is_currently_active ? "Şu an aktif" : "Pasif oturum"}
          </p>
        </div>
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
              : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {row.original.status === "active" ? "Aktif" : "Pasif"}
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
            href={`/kullanicilar/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={row.original.status === "active" ? "Bu kullanıcı artık giriş yapamaz." : "Bu kullanıcı tekrar sisteme erişebilir."}
            onConfirm={() => handleStatusChange(row.original, row.original.status === "active" ? "passive" : "active")}
            title={row.original.status === "active" ? "Kullanıcı pasife alınsın mı?" : "Kullanıcı aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Kullanıcıyı Sil"
            description="Kullanıcıya ait kayıtlar da silinir. Bu işlem geri alınamaz."
            onConfirm={() => handleDelete(row.original)}
            title="Kullanıcı silinsin mi?"
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
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Toplam Kullanıcı", value: pagination?.total ?? items.length, icon: UserCheck },
          { label: "Bu Sayfada Aktif", value: summary.active, icon: CheckCircle2 },
          { label: "Bu Sayfada Premium", value: summary.paid, icon: Crown },
          { label: "Bu Sayfada Çözülen", value: summary.answered, icon: RefreshCcw },
        ].map((card) => (
          <div
            className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-4"
            key={card.label}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--color-admin-muted)]">{card.label}</p>
                <p className="mt-1 text-2xl font-black text-[var(--color-admin-ink)]">{card.value}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                <card.icon size={18} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <AdminTableCard>
        <AdminListToolbar>
          <AdminListToolbarRow>
            <AdminListToolbarFields>
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[320px]">
                <input
                  className="admin-input h-10 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ad, e-posta veya sınav ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[240px]">
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

              <AdminListToolbarField className="min-w-[150px] sm:max-w-[180px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "passive")}
                  value={statusFilter}
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[150px] sm:max-w-[180px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setMembershipTypeFilter(event.target.value as "all" | "free" | "paid")}
                  value={membershipTypeFilter}
                >
                  <option value="all">Tüm üyelikler</option>
                  <option value="paid">Premium</option>
                  <option value="free">Free</option>
                </select>
              </AdminListToolbarField>
            </AdminListToolbarFields>

            <AdminListToolbarActions>
              <button
                className="admin-button admin-button-secondary h-10 gap-2 px-3 text-sm"
                disabled={exporting || loading}
                onClick={() => void handleExport()}
                type="button"
              >
                {exporting ? <LoaderCircle className="animate-spin" size={16} /> : <Download size={16} />}
                {exporting ? "Hazırlanıyor" : "Dışa aktar"}
              </button>
              <AdminListToolbarIconButton
                aria-label="Listeyi yenile"
                onClick={() => void refresh()}
                title="Yenile"
              >
                <RefreshCcw size={16} />
              </AdminListToolbarIconButton>
              <Link className="admin-button admin-button-primary h-10 gap-2 px-3 text-sm" href="/kullanicilar/yeni">
                <Plus size={16} />
                Kullanıcı
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{pagination?.total ?? items.length} kullanıcı</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>{items.length} kayıt bu sayfada</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>Server-side filtreleme aktif</AdminListToolbarMetaPill>
          </AdminListToolbarMeta>
        </AdminListToolbar>
      </AdminTableCard>

      {loading ? (
        <AdminTableSkeleton />
      ) : (
        <AdminDataGrid
          columns={columns}
          data={items}
          emptyState="Arama veya filtre sonucuna uygun kullanıcı bulunamadı."
          pagination={
            pagination
              ? {
                  ...pagination,
                  onPageChange: setPage,
                  onPageSizeChange: (nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPage(1);
                  },
                }
              : undefined
          }
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
