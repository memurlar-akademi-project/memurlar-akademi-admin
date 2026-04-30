"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, PauseCircle, Plus, RefreshCcw, SquarePen, Trash2 } from "lucide-react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPodcastLesson, AdminSubject } from "@/lib/types";

export default function PodcastPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminPodcastLesson>({
    endpoint: "/admin/podcast/lessons",
    responseKey: "lessons",
  });
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });

  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "passive">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (selectedSubjectId !== "all" && item.subject?.id !== Number(selectedSubjectId)) {
        return false;
      }

      if (statusFilter !== "all" && (item.is_active ? "active" : "passive") !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.name, item.code, item.subject?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, selectedSubjectId, statusFilter]);

  async function handleStatusChange(item: AdminPodcastLesson, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      const response = await adminApiRequest<{ lesson: AdminPodcastLesson }>(`/admin/podcast/lessons/${item.id}`, {
        token,
        method: "PUT",
        body: {
          subject_id: item.subject?.id ?? item.subject_id ?? null,
          code: item.code,
          name: item.name,
          sort_order: item.sort_order ?? 1,
          is_active: checked,
        },
      });

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? response.data.lesson : entry)),
      );
      showToast({
        tone: "success",
        title: checked ? "Podcast dersi aktife alındı" : "Podcast dersi pasife alındı",
        description: item.name,
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

  async function handleDelete(item: AdminPodcastLesson) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      await adminApiRequest(`/admin/podcast/lessons/${item.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Podcast dersi silindi",
        description: item.name,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Podcast dersi silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnDef<AdminPodcastLesson>[] = [
    {
      accessorKey: "name",
      header: "Podcast Dersi",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{row.original.name}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.subject?.name ?? "Ders bağlantısı yok"} · Kod: {row.original.code}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "episode_count",
      header: "Bölüm",
      cell: ({ row }) => <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.episode_count}</p>,
    },
    {
      accessorKey: "sort_order",
      header: "Sıra",
      cell: ({ row }) => <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.sort_order ?? "-"}</p>,
    },
    {
      accessorKey: "is_active",
      header: "Durum",
      cell: ({ row }) => (
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
          row.original.is_active
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-100 text-slate-600"
        }`}>
          {row.original.is_active ? "Aktif" : "Pasif"}
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
            href={`/podcast/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.is_active ? "Pasife Al" : "Aktife Al"}
            description={row.original.is_active ? "Bu podcast dersi öğrenci akışından çıkarılır." : "Bu podcast dersi tekrar aktif hale getirilir."}
            onConfirm={() => handleStatusChange(row.original, !row.original.is_active)}
            title={row.original.is_active ? "Podcast dersi pasife alınsın mı?" : "Podcast dersi aktife alınsın mı?"}
            tone={row.original.is_active ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.is_active ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Podcast Dersini Sil"
            description="Bu kayıt kalıcı olarak silinir."
            onConfirm={() => handleDelete(row.original)}
            title="Podcast dersi silinsin mi?"
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
        <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="block min-w-0 flex-1 space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Arama
                </span>
                <input
                  className="admin-input h-11 max-w-[480px]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Podcast dersi, kod veya bağlı ders ara"
                  value={query}
                />
              </label>
              <div className="flex items-center gap-2">
                <button className="admin-button admin-button-secondary" onClick={refresh} type="button">
                  <RefreshCcw size={16} />
                  Yenile
                </button>
                <Link className="admin-button admin-button-primary" href="/podcast/yeni">
                  <Plus size={16} />
                  Yeni Podcast Dersi
                </Link>
              </div>
            </div>

            <div className="rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]/65 p-3">
              <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr]">
                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Bağlı Ders
                  </span>
                  <select
                    className="admin-input h-11"
                    onChange={(event) => setSelectedSubjectId(event.target.value)}
                    value={selectedSubjectId}
                  >
                    <option value="all">Tüm dersler</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Durum
                  </span>
                  <select
                    className="admin-input h-11"
                    onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                    value={statusFilter}
                  >
                    <option value="all">Tüm durumlar</option>
                    <option value="active">Aktif</option>
                    <option value="passive">Pasif</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <AdminTableSkeleton rows={8} />
        ) : error ? (
          <div className="px-5 py-8 text-sm text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Filtrelere uygun podcast dersi bulunamadı." />
        )}
      </AdminTableCard>
    </div>
  );
}
