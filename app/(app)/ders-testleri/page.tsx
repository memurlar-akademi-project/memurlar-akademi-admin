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
import { AdminReadinessHint } from "@/components/admin/crud/AdminReadinessHint";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminSubject, AdminSubjectTest } from "@/lib/types";

export default function SubjectTestsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminSubjectTest>({
    endpoint: "/admin/subject-tests",
    responseKey: "tests",
  });
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });

  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const subjectOptions = useMemo(
    () => subjects.map((subject) => ({ id: subject.id, label: subject.name, hint: `${subject.topic_count} konu` })),
    [subjects],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (selectedSubjectId !== null && item.subject_id !== selectedSubjectId) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }

      return [item.title, item.subject?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, selectedSubjectId, statusFilter]);

  async function handleStatusChange(item: AdminSubjectTest, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyId(item.id);
    try {
      const response = await adminApiRequest<{ test: AdminSubjectTest }>(`/admin/subject-tests/${item.id}`, {
        token,
        method: "PUT",
        body: {
          subject_id: item.subject_id,
          title: item.title,
          slug: item.slug ?? null,
          status: checked ? "active" : "passive",
          duration_min: item.duration_min,
          instructions: item.instructions ?? null,
          question_ids: item.question_ids ?? [],
        },
      });

      setItems((current) => current.map((entry) => (entry.id === item.id ? response.data.test : entry)));
      showToast({
        tone: "success",
        title: checked ? "Ders testi aktife alındı" : "Ders testi pasife alındı",
        description: item.subject?.name ?? "Ders havuzu",
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

  async function handleDelete(item: AdminSubjectTest) {
    if (!token) {
      return;
    }

    setBusyId(item.id);
    try {
      await adminApiRequest(`/admin/subject-tests/${item.id}`, { token, method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Ders testi silindi",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Ders testi silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnDef<AdminSubjectTest>[] = [
    {
      accessorKey: "title",
      header: "Test",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[460px]">
          <p className="overflow-hidden text-sm font-bold leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {row.original.title}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.subject?.name ?? "Ders yok"}
          </p>
          <AdminReadinessHint readiness={row.original.readiness} />
        </div>
      ),
    },
    {
      accessorKey: "question_count",
      header: "Soru",
      cell: ({ row }) => <span className="font-semibold text-[var(--color-admin-ink)]">{row.original.question_count}</span>,
    },
    {
      accessorKey: "duration_min",
      header: "Süre",
      cell: ({ row }) => <span className="text-sm font-semibold text-[var(--color-admin-ink)]">{row.original.duration_min} dk</span>,
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
            href={`/ders-testleri/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={row.original.status === "active" ? "Bu ders testi öğrenci tarafında listelenmez." : "Bu ders testi tekrar aktif hale getirilir."}
            onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
            title={row.original.status === "active" ? "Ders testi pasife alınsın mı?" : "Ders testi aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Ders Testini Sil"
            description="Kayıt kalıcı olarak silinir."
            onConfirm={() => handleDelete(row.original)}
            title="Ders testi silinsin mi?"
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
                  placeholder="Test başlığı veya ders ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Ders seç"
                  compact
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={setSelectedSubjectId}
                  options={subjectOptions}
                  placeholder="Ders seç"
                  value={selectedSubjectId}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="w-[170px]">
                <select className="admin-input h-10 text-sm" onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}>
                  <option value="all">Tüm durumlar</option>
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="passive">Pasif</option>
                </select>
              </AdminListToolbarField>
            </AdminListToolbarFields>

            <AdminListToolbarActions>
              <AdminListToolbarIconButton onClick={() => void refresh()} title="Yenile">
                <RefreshCcw size={16} />
              </AdminListToolbarIconButton>
              <Link href="/ders-testleri/yeni" className="admin-primary-button h-10 px-4 text-sm">
                <Plus size={16} />
                Yeni Ders Testi
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarRow>
            <AdminListToolbarMeta>
              <AdminListToolbarMetaPill>{filteredRows.length} kayıt</AdminListToolbarMetaPill>
            </AdminListToolbarMeta>
          </AdminListToolbarRow>
        </AdminListToolbar>

        {loading ? (
          <AdminTableSkeleton />
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState={error ?? "Henüz ders testi yok."} />
        )}
      </AdminTableCard>
    </div>
  );
}
