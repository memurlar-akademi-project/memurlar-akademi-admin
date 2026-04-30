"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpDown, CheckCircle2, FileText, FileUp, PauseCircle, RefreshCcw, SquarePen, Trash2 } from "lucide-react";
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
import type { AdminSubject, AdminTopic } from "@/lib/types";

export default function TopicsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const searchParams = useSearchParams();
  const subjectIdFilter = searchParams.get("subjectId");

  const { items, setItems, loading, error, refresh } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });

  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjectIdFilter ? Number(subjectIdFilter) : null,
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [sortMode, setSortMode] = useState<"default" | "order" | "content">("default");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const subjectName = useMemo(() => {
    if (!selectedSubjectId) {
      return null;
    }

    return subjects.find((item) => item.id === selectedSubjectId)?.name ?? null;
  }, [selectedSubjectId, subjects]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    const nextRows = items.filter((item) => {
      if (selectedSubjectId && item.subject_id !== selectedSubjectId) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.name, item.slug, item.subject?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });

    if (sortMode === "order") {
      return [...nextRows].sort((left, right) => left.sort_order - right.sort_order);
    }

    if (sortMode === "content") {
      return [...nextRows].sort((left, right) => (right.content_count ?? 0) - (left.content_count ?? 0));
    }

    return nextRows;
  }, [items, query, selectedSubjectId, sortMode, statusFilter]);

  async function handleStatusChange(topic: AdminTopic, checked: boolean) {
    if (!token) {
      return;
    }

    setTogglingId(topic.id);

    try {
      const response = await adminApiRequest<{ topic: AdminTopic }>(`/admin/topics/${topic.id}`, {
        token,
        method: "PUT",
        body: {
          status: checked ? "active" : "passive",
        },
      });

      setItems((current) =>
        current.map((item) => (item.id === topic.id ? response.data.topic : item)),
      );
      showToast({
        tone: "success",
        title: checked ? "Konu aktife alındı" : "Konu pasife alındı",
        description: topic.name,
      });
    } catch (loadError) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: loadError instanceof Error ? loadError.message : topic.name,
      });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(topic: AdminTopic) {
    if (!token) {
      return;
    }

    setDeletingId(topic.id);

    try {
      await adminApiRequest(`/admin/topics/${topic.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((item) => item.id !== topic.id));
      showToast({
        tone: "success",
        title: "Konu silindi",
        description: topic.name,
      });
    } catch (loadError) {
      showToast({
        tone: "error",
        title: "Konu silinemedi",
        description: loadError instanceof Error ? loadError.message : topic.name,
      });
    } finally {
      setDeletingId(null);
    }
  }

  const columns: ColumnDef<AdminTopic>[] = [
    {
      accessorKey: "name",
      header: "Konu",
      cell: ({ row }) => (
        <div className="min-w-[240px]">
          <p className="font-bold text-[var(--color-admin-ink)]">{row.original.name}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">#{row.original.id} · {row.original.slug}</p>
          <AdminReadinessHint readiness={row.original.readiness} />
        </div>
      ),
    },
    {
      accessorKey: "subject",
      header: "Ders",
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.subject?.name ?? "-"}</p>
      ),
    },
    {
      accessorKey: "sort_order",
      header: "Sıra",
      enableSorting: true,
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.sort_order}</p>
      ),
    },
    {
      accessorKey: "content_version",
      header: "İçerik",
      enableSorting: true,
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.content_version ? `v${row.original.content_version}` : "-"}
        </p>
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
            href={`/konu-icerikleri?subjectId=${row.original.subject_id}&topicId=${row.original.id}`}
          >
            İçerik
            <ArrowRight size={14} />
          </Link>
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/konular/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={togglingId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={
              row.original.status === "active"
                ? "Bu konuyu pasife almak içerik ve soru akışını etkileyebilir."
                : "Bu konuyu tekrar aktif hale getirebilirsin."
            }
            onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
            title={row.original.status === "active" ? "Konu pasife alınsın mı?" : "Konu aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={deletingId === row.original.id}
            confirmLabel="Sil"
            description="Bu konuya bağlı içerik, soru ve diğer ilişkiler de etkilenebilir. Eminsen devam et."
            onConfirm={() => handleDelete(row.original)}
            title="Konu silinsin mi?"
            tone="danger"
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

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: `${subject.topic_count} konu`,
      })),
    [subjects],
  );

  return (
    <div className="space-y-4">
      <AdminTableCard>
        <AdminListToolbar>
          <AdminListToolbarRow>
            <AdminListToolbarFields>
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[280px]">
                <input
                  className="admin-input h-10 text-sm"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Konu adı veya slug ara"
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
                  placeholder="Ders ara"
                  value={selectedSubjectId}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[190px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "draft" | "passive")}
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
                    { value: "order", label: "Konu sırası" },
                    { value: "content", label: "İçerik durumu" },
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
                <Link
                  aria-label="Konu import"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35 hover:text-[var(--color-admin-accent)]"
                  href="/konular/import"
                  title="Konu import"
                >
                  <FileUp size={16} />
                </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            {subjectName ? (
              <AdminListToolbarMetaPill>
                {subjectName}
              </AdminListToolbarMetaPill>
            ) : null}
            <AdminListToolbarMetaPill>
              {items.length} kayıt
            </AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => (item.content_count ?? 0) > 0).length} içerikli
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
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Aramanla eşleşen konu bulunamadı." />
        )}
      </AdminTableCard>
    </div>
  );
}
