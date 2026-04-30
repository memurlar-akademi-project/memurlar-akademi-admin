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
import type { AdminTopic, AdminTopicTest } from "@/lib/types";

export default function TopicTestsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminTopicTest>({
    endpoint: "/admin/tests",
    responseKey: "tests",
  });
  const { items: topics } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });

  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [topics],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (selectedTopicId !== null && item.topic_id !== selectedTopicId) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.title, item.topic?.name, item.topic?.subject?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, selectedTopicId, statusFilter]);

  async function handleStatusChange(item: AdminTopicTest, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      const response = await adminApiRequest<{ test: AdminTopicTest }>(`/admin/tests/${item.id}`, {
        token,
        method: "PUT",
        body: {
          topic_id: item.topic_id,
          title: item.title,
          slug: item.slug ?? null,
          status: checked ? "active" : "passive",
          duration_min: item.duration_min,
          instructions: item.instructions ?? null,
          question_ids: item.question_ids ?? [],
        },
      });

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? response.data.test : entry)),
      );
      showToast({
        tone: "success",
        title: checked ? "Test aktife alındı" : "Test pasife alındı",
        description: item.topic?.name ?? "Konu havuzu",
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

  async function handleDelete(item: AdminTopicTest) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      await adminApiRequest(`/admin/tests/${item.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Test silindi",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Test silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnDef<AdminTopicTest>[] = [
    {
      accessorKey: "title",
      header: "Test",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[460px]">
          <p className="overflow-hidden text-sm font-bold leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {row.original.title}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.topic?.subject?.name ?? "Ders yok"} · {row.original.topic?.name ?? "Konu yok"}
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
            href={`/testler/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={row.original.status === "active" ? "Bu test öğrenci tarafında listelenmez." : "Bu test tekrar aktif hale getirilir."}
            onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
            title={row.original.status === "active" ? "Test pasife alınsın mı?" : "Test aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Testi Sil"
            description="Kayıt kalıcı olarak silinir."
            onConfirm={() => handleDelete(row.original)}
            title="Test silinsin mi?"
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
                  placeholder="Test başlığı, ders veya konu ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Konu seç"
                  compact
                  emptyText="Konu bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={setSelectedTopicId}
                  options={topicOptions}
                  placeholder="Konu seç"
                  value={selectedTopicId}
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
                aria-label="Yeni Test"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35 hover:text-[var(--color-admin-accent)]"
                href="/testler/yeni"
                title="Yeni Test"
              >
                <Plus size={16} />
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{filteredRows.length} test</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            {selectedTopicId !== null ? <AdminListToolbarMetaPill>Konu filtresi açık</AdminListToolbarMetaPill> : null}
          </AdminListToolbarMeta>
        </AdminListToolbar>

        {loading ? (
          <AdminTableSkeleton />
        ) : error ? (
          <div className="px-5 py-10 text-sm text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Henüz test kaydı yok." />
        )}
      </AdminTableCard>
    </div>
  );
}
