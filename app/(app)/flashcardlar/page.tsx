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
import type { AdminFlashcard, AdminSubject, AdminTopic } from "@/lib/types";

export default function HapBilgilerPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminFlashcard>({
    endpoint: "/admin/flashcards",
    responseKey: "flashcards",
  });
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: topics } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });

  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const filteredTopics = useMemo(
    () =>
      selectedSubjectId === "all"
        ? topics
        : topics.filter((topic) => String(topic.subject_id) === selectedSubjectId),
    [selectedSubjectId, topics],
  );

  const topicOptions = useMemo(
    () =>
      filteredTopics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [filteredTopics],
  );

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: `${subject.topic_count} konu`,
      })),
    [subjects],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (selectedSubjectId !== "all" && item.topic?.subject?.id !== Number(selectedSubjectId)) {
        return false;
      }

      if (selectedTopicId !== null && item.topic_id !== selectedTopicId) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.front_text, item.back_text, item.topic?.name, item.topic?.subject?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, selectedSubjectId, selectedTopicId, statusFilter]);

  async function handleStatusChange(item: AdminFlashcard, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      const response = await adminApiRequest<{ flashcard: AdminFlashcard }>(`/admin/flashcards/${item.id}`, {
        token,
        method: "PUT",
        body: {
          topic_id: item.topic_id,
          front_text: item.front_text,
          back_text: item.back_text,
          status: checked ? "active" : "passive",
          is_free: Boolean(item.is_free),
        },
      });

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? response.data.flashcard : entry)),
      );
      showToast({
        tone: "success",
        title: checked ? "Hap bilgi aktife alındı" : "Hap bilgi pasife alındı",
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

  async function handleDelete(item: AdminFlashcard) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      await adminApiRequest(`/admin/flashcards/${item.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Hap bilgi silindi",
        description: item.topic?.name ?? "Konu havuzu",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Hap bilgi silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnDef<AdminFlashcard>[] = [
    {
      accessorKey: "front_text",
      header: "Hap Bilgi",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[520px]">
          <p className="overflow-hidden text-sm font-bold leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {row.original.front_text}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.topic?.subject?.name ?? "Ders yok"} · {row.original.topic?.name ?? "Konu yok"}
          </p>
          <AdminReadinessHint readiness={row.original.readiness} />
        </div>
      ),
    },
    {
      accessorKey: "back_text",
      header: "Arka Yüz",
      cell: ({ row }) => (
        <p className="max-w-[360px] overflow-hidden text-sm leading-6 text-[var(--color-admin-muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {row.original.back_text}
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
          {row.original.status === "active" ? "Aktif" : row.original.status === "draft" ? "Taslak" : "Pasif"}
        </span>
      ),
    },
    {
      accessorKey: "is_free",
      header: "Erişim",
      cell: ({ row }) => (
        <span className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.is_free ? "Free" : "Üyelik"}
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
            href={`/flashcardlar/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={row.original.status === "active" ? "Bu hap bilgi öğrenci akışından çıkarılır." : "Bu hap bilgi tekrar aktif hale getirilir."}
            onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
            title={row.original.status === "active" ? "Hap bilgi pasife alınsın mı?" : "Hap bilgi aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Hap Bilgiyi Sil"
            description="Kayıt kalıcı olarak silinir."
            onConfirm={() => handleDelete(row.original)}
            title="Hap bilgi silinsin mi?"
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
                  placeholder="Hap bilgi metni, ders veya konu ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[240px]">
                <AdminSearchSelect
                  buttonPlaceholder="Ders seç"
                  compact
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={(value) => {
                    setSelectedSubjectId(value === null ? "all" : String(value));
                    setSelectedTopicId(null);
                  }}
                  options={subjectOptions}
                  placeholder="Ders ara"
                  value={selectedSubjectId === "all" ? null : Number(selectedSubjectId)}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Konu seç"
                  compact
                  emptyText="Filtreye uygun konu bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={setSelectedTopicId}
                  options={topicOptions}
                  placeholder="Konu ara"
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
                <Link className="admin-button admin-button-primary" href="/flashcardlar/yeni">
                  <Plus size={16} />
                </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{filteredRows.length} hap bilgi</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.is_free).length} free
            </AdminListToolbarMetaPill>
          </AdminListToolbarMeta>
        </AdminListToolbar>

        {loading ? (
          <AdminTableSkeleton rows={8} />
        ) : error ? (
          <div className="px-5 py-8 text-sm text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Filtrelere uygun hap bilgi bulunamadı." />
        )}
      </AdminTableCard>
    </div>
  );
}
