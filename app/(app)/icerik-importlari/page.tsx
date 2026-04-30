"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Eye, FileUp, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { adminApiRequest } from "@/lib/admin-api";
import { useAdminList } from "@/hooks/useAdminList";
import type { AdminContentImport } from "@/lib/types";

function renderStatus(importItem: AdminContentImport) {
  if (importItem.processing_status === "approved") {
    return "Onaylandı";
  }

  if (importItem.processing_status === "failed") {
    return "Hata";
  }

  if (importItem.processing_status === "review") {
    return "İnceleme";
  }

  if (importItem.processing_status === "processing") {
    return "İşleniyor";
  }

  return "Sırada";
}

export default function ContentImportsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminContentImport>({
    endpoint: "/admin/content-imports",
    responseKey: "imports",
  });

  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "docx_upload" | "google_doc_link">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "queued" | "processing" | "review" | "approved" | "failed">("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(importItem: AdminContentImport) {
    if (!token) {
      return;
    }

    setDeletingId(importItem.id);

    try {
      await adminApiRequest(`/admin/content-imports/${importItem.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        tone: "success",
        title: "Import silindi",
        description: importItem.source_title ?? importItem.original_filename ?? "İçerik importu",
      });

      setItems((current) => current.filter((item) => item.id !== importItem.id));
    } catch (deleteError) {
      showToast({
        tone: "error",
        title: "Import silinemedi",
        description: deleteError instanceof Error ? deleteError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (sourceFilter !== "all" && item.source_type !== sourceFilter) {
        return false;
      }

      if (statusFilter !== "all" && item.processing_status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [
        item.source_title,
        item.candidate_subject_name,
        item.original_filename,
        item.target_exam?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, sourceFilter, statusFilter]);

  const columns: ColumnDef<AdminContentImport>[] = [
    {
      accessorKey: "source_title",
      header: "Kaynak",
      cell: ({ row }) => (
        <div className="min-w-[260px]">
          <p className="font-bold text-[var(--color-admin-ink)]">
            {row.original.source_title ?? row.original.original_filename ?? "Başlıksız import"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.source_type === "docx_upload" ? "DOCX Yükleme" : "Google Docs Linki"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "candidate_subject_name",
      header: "Ders Adayı",
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.final_subject?.name ?? row.original.selected_subject?.name ?? row.original.candidate_subject_name ?? "-"}
        </p>
      ),
    },
    {
      accessorKey: "topic_count",
      header: "Konu",
      cell: ({ row }) => (
        <p className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.accepted_topic_count}/{row.original.topic_count}
        </p>
      ),
    },
    {
      accessorKey: "processing_status",
      header: "Durum",
      cell: ({ row }) => {
        const status = row.original.processing_status;

        return (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
              status === "approved"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status === "review"
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : status === "failed"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-100 text-slate-600"
            }`}
          >
            {renderStatus(row.original)}
          </span>
        );
      },
    },
    {
      accessorKey: "updated_at",
      header: "Güncelleme",
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
            href={`/icerik-importlari/${row.original.id}/incele`}
          >
            İncele
            <Eye size={14} />
          </Link>
          <ConfirmDialog
            busy={deletingId === row.original.id}
            confirmLabel="Sil"
            description="Bu import kaydı ve staging konuları silinecek. Onaylanmış importlar silinemez."
            disabled={row.original.processing_status === "approved"}
            onConfirm={() => handleDelete(row.original)}
            title="Import silinsin mi?"
            trigger={
              <span className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">
                Sil
                <Trash2 size={14} />
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <div className="w-full max-w-sm">
                <input
                  className="admin-input"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Import ara"
                  value={query}
                />
              </div>

              <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2.5 text-sm text-[var(--color-admin-muted)]">
                <select
                  className="bg-transparent text-sm font-medium text-[var(--color-admin-ink)] outline-none"
                  onChange={(event) => setSourceFilter(event.target.value as "all" | "docx_upload" | "google_doc_link")}
                  value={sourceFilter}
                >
                  <option value="all">Tüm kaynaklar</option>
                  <option value="docx_upload">DOCX</option>
                  <option value="google_doc_link">Google Docs</option>
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2.5 text-sm text-[var(--color-admin-muted)]">
                <select
                  className="bg-transparent text-sm font-medium text-[var(--color-admin-ink)] outline-none"
                  onChange={(event) => setStatusFilter(event.target.value as "all" | "queued" | "processing" | "review" | "approved" | "failed")}
                  value={statusFilter}
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="queued">Sırada</option>
                  <option value="processing">İşleniyor</option>
                  <option value="review">İnceleme</option>
                  <option value="approved">Onaylandı</option>
                  <option value="failed">Hata</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="admin-button admin-button-secondary" onClick={refresh} type="button">
                <RefreshCcw size={16} />
                Yenile
              </button>
              <Link className="admin-button admin-button-primary" href="/icerik-importlari/yeni">
                <Plus size={17} />
                Yeni Import
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <AdminTableSkeleton rows={6} />
        ) : (
          <AdminDataGrid
            columns={columns}
            data={filteredItems}
            emptyState={error ?? "Henüz import kaydı yok."}
          />
        )}
      </AdminTableCard>

      <div className="grid gap-4 md:grid-cols-3">
        <AdminTableCard>
          <div className="flex items-start gap-3 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <FileUp size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Kaynak
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                DOCX yükleme ve Google Docs linki aynı import hattına düşer.
              </p>
            </div>
          </div>
        </AdminTableCard>

        <AdminTableCard>
          <div className="flex items-start gap-3 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Review
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                Konular ve ilk içerik taslakları review ekranında düzenlenip onaylanır.
              </p>
            </div>
          </div>
        </AdminTableCard>

        <AdminTableCard>
          <div className="flex items-start gap-3 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <CircleAlert size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Canlıya Yazım
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                Onay olmadan canlı ders, konu ve içerik kayıtları oluşturulmaz.
              </p>
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
