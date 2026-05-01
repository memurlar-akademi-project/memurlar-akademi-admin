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
import type { AdminExam, AdminSubject } from "@/lib/types";

export default function SubjectsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const searchParams = useSearchParams();
  const examIdFilter = searchParams.get("examId");

  const { items, setItems, loading, error, refresh } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: exams } = useAdminList<AdminExam>({
    endpoint: "/admin/exams",
    responseKey: "exams",
  });

  const [query, setQuery] = useState("");
  const [selectedExamId, setSelectedExamId] = useState(examIdFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [sortMode, setSortMode] = useState<"default" | "topics" | "exams">("default");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const examName = useMemo(() => {
    if (!selectedExamId || selectedExamId === "all") {
      return null;
    }

    return exams.find((item) => item.id === Number(selectedExamId))?.name ?? null;
  }, [exams, selectedExamId]);

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

    const nextRows = items.filter((item) => {
      if (selectedExamId !== "all" && !item.exam_ids.includes(Number(selectedExamId))) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.code, item.name, item.slug].filter(Boolean).join(" ").toLocaleLowerCase("tr").includes(normalized);
    });

    if (sortMode === "topics") {
      return [...nextRows].sort((left, right) => right.topic_count - left.topic_count);
    }

    if (sortMode === "exams") {
      return [...nextRows].sort((left, right) => right.exam_count - left.exam_count);
    }

    return nextRows;
  }, [items, query, selectedExamId, sortMode, statusFilter]);

  async function handleStatusChange(subject: AdminSubject, checked: boolean) {
    if (!token) {
      return;
    }

    setTogglingId(subject.id);

    try {
      const response = await adminApiRequest<{ subject: AdminSubject }>(`/admin/subjects/${subject.id}`, {
        token,
        method: "PUT",
        body: {
          status: checked ? "active" : "passive",
        },
      });

      setItems((current) =>
        current.map((item) => (item.id === subject.id ? response.data.subject : item)),
      );
      showToast({
        tone: "success",
        title: checked ? "Ders aktife alındı" : "Ders pasife alındı",
        description: subject.name,
      });
    } catch (loadError) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: loadError instanceof Error ? loadError.message : subject.name,
      });
    } finally {
      setTogglingId(null);
    }
  }

  const columns: ColumnDef<AdminSubject>[] = [
    {
      accessorKey: "name",
      header: "Ders",
      cell: ({ row }) => (
        <div className="min-w-[240px]">
          <div className="flex flex-wrap items-center gap-2">
            {row.original.code ? (
              <span className="rounded-full bg-[var(--color-admin-accent-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--color-admin-accent)]">
                {row.original.code}
              </span>
            ) : null}
            <p className="font-bold text-[var(--color-admin-ink)]">{row.original.name}</p>
          </div>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">#{row.original.id} · {row.original.slug}</p>
          <AdminReadinessHint readiness={row.original.readiness} />
        </div>
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
            href={`/konular?subjectId=${row.original.id}`}
          >
            Konular
            <ArrowRight size={14} />
          </Link>
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/dersler/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={togglingId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={
              row.original.status === "active"
                ? "Bu dersi pasife almak bağlı konu ve sınav akışlarını etkileyebilir."
                : "Bu dersi tekrar aktif hale getirebilirsin."
            }
            onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
            title={row.original.status === "active" ? "Ders pasife alınsın mı?" : "Ders aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
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
                <input className="admin-input h-10 text-sm" onChange={(e) => setQuery(e.target.value)} placeholder="Ders ara" value={query} />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Sınav seç"
                  compact
                  emptyText="Sınav bulunamadı."
                  hideLabel
                  label="Sınav"
                  onChange={(value) => setSelectedExamId(value === null ? "all" : String(value))}
                  options={examOptions}
                  placeholder="Sınav ara"
                  value={selectedExamId === "all" ? null : Number(selectedExamId)}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[190px]">
                <select className="admin-input h-10 appearance-none pr-9 text-sm leading-none" onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "draft" | "passive")} value={statusFilter}>
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
                    { value: "topics", label: "Konu sayısı" },
                    { value: "exams", label: "Bağlı sınav sayısı" },
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
              <Link className="admin-button admin-button-primary" href="/dersler/yeni">
                <Plus size={16} />
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            {examName ? (
              <AdminListToolbarMetaPill>{examName}</AdminListToolbarMetaPill>
            ) : null}
            <AdminListToolbarMetaPill>{items.length} kayıt</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.reduce((sum, item) => sum + item.topic_count, 0)} konu
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
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Aramanla eşleşen ders bulunamadı." />
        )}
      </AdminTableCard>
    </div>
  );
}
