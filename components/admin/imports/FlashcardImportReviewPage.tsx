"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Trash2 } from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminFlashcardImport, AdminFlashcardImportItem, AdminPaginationMeta } from "@/lib/types";

type Props = {
  importId: number;
};

type EditableItem = {
  topic_id: number;
  front_text: string;
  back_text: string;
  status: "active" | "passive" | "draft";
  sort_order: number | null;
  is_free: boolean;
};

function toEditableItem(item: AdminFlashcardImportItem): EditableItem {
  return {
    topic_id: item.topic_id,
    front_text: item.front_text,
    back_text: item.back_text,
    status: item.status,
    sort_order: item.sort_order ?? null,
    is_free: Boolean(item.is_free),
  };
}

export function FlashcardImportReviewPage({ importId }: Props) {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [flashcardImport, setFlashcardImport] = useState<AdminFlashcardImport | null>(null);
  const [itemsMeta, setItemsMeta] = useState<AdminPaginationMeta | null>(null);
  const [topics, setTopics] = useState<Array<{ id: number; name: string; subject?: { id: number; name: string } | null }>>([]);
  const [selectedItem, setSelectedItem] = useState<AdminFlashcardImportItem | null>(null);
  const [draft, setDraft] = useState<EditableItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImport = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await adminApiRequest<{
        import: AdminFlashcardImport;
        items_meta?: AdminPaginationMeta;
        topics: Array<{ id: number; name: string; subject?: { id: number; name: string } | null }>;
      }>(`/admin/flashcard-imports/${importId}?per_page=all`, { token });

      setFlashcardImport(response.data.import);
      setItemsMeta(response.data.items_meta ?? null);
      setTopics(response.data.topics);

      const firstPending = response.data.import.items?.find((item) => item.review_status === "pending_review") ?? response.data.import.items?.[0] ?? null;
      setSelectedItem(firstPending);
      setDraft(firstPending ? toEditableItem(firstPending) : null);
      setSelectedIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Bilgi kartı importu yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [importId, token]);

  useEffect(() => {
    void loadImport();
  }, [loadImport]);

  const items = useMemo(() => flashcardImport?.items ?? [], [flashcardImport]);
  const pendingItems = useMemo(() => items.filter((item) => item.review_status === "pending_review"), [items]);
  const selectedPendingIds = useMemo(
    () => selectedIds.filter((id) => pendingItems.some((item) => item.id === id)),
    [pendingItems, selectedIds],
  );

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [topics],
  );

  function selectItem(item: AdminFlashcardImportItem) {
    setSelectedItem(item);
    setDraft(toEditableItem(item));
  }

  function applyImportPatch(nextImport: AdminFlashcardImport, updatedItems: AdminFlashcardImportItem[]) {
    const updatedById = new Map(updatedItems.map((item) => [item.id, item]));
    const patchedItems = (flashcardImport?.items ?? []).map((item) => updatedById.get(item.id) ?? item);

    setFlashcardImport({
      ...nextImport,
      items: patchedItems,
    });

    if (selectedItem && updatedById.has(selectedItem.id)) {
      const updatedSelected = updatedById.get(selectedItem.id) ?? null;
      setSelectedItem(updatedSelected);
      setDraft(updatedSelected ? toEditableItem(updatedSelected) : null);
    }
  }

  async function saveSelected() {
    if (!token || !selectedItem || !draft) {
      return;
    }

    setSaving(true);

    try {
      const response = await adminApiRequest<{
        import: AdminFlashcardImport;
        item: AdminFlashcardImportItem;
      }>(`/admin/flashcard-imports/${importId}/items/${selectedItem.id}`, {
        token,
        method: "PUT",
        body: draft,
      });

      applyImportPatch(response.data.import, [response.data.item]);
      showToast({ tone: "success", title: "Bilgi kartı kaydedildi" });
    } catch (saveError) {
      showToast({
        tone: "error",
        title: "Kaydedilemedi",
        description: saveError instanceof Error ? saveError.message : "Bilgi kartı güncellenemedi.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function approveSelected() {
    if (!token || !selectedItem || !draft) {
      return;
    }

    setSaving(true);

    try {
      const saveResponse = await adminApiRequest<{
        import: AdminFlashcardImport;
        item: AdminFlashcardImportItem;
      }>(`/admin/flashcard-imports/${importId}/items/${selectedItem.id}`, {
        token,
        method: "PUT",
        body: draft,
      });

      const approveResponse = await adminApiRequest<{
        import: AdminFlashcardImport;
        item: AdminFlashcardImportItem;
        duplicate_count?: number;
      }>(`/admin/flashcard-imports/${importId}/items/${selectedItem.id}/approve`, {
        token,
        method: "POST",
      });

      applyImportPatch(approveResponse.data.import, [approveResponse.data.item]);
      setSelectedIds((current) => current.filter((id) => id !== selectedItem.id));

      const nextPending = (flashcardImport?.items ?? [])
        .map((item) => (item.id === selectedItem.id ? approveResponse.data.item : item))
        .find((item) => item.review_status === "pending_review" && item.id !== selectedItem.id);

      if (nextPending) {
        setSelectedItem(nextPending);
        setDraft(toEditableItem(nextPending));
      }

      const wasDuplicate = approveResponse.data.item.review_status === "rejected";
      showToast({
        tone: wasDuplicate ? "warning" : "success",
        title: wasDuplicate ? "Duplicate kart içeri alınmadı" : "Bilgi kartı içe aktarıldı",
        description: wasDuplicate
          ? approveResponse.data.item.review_note ?? "Bu bilgi kartı zaten mevcut."
          : saveResponse.data.item.topic?.name ?? selectedItem.topic_name_snapshot,
      });
    } catch (approveError) {
      showToast({
        tone: "error",
        title: "Onaylanamadı",
        description: approveError instanceof Error ? approveError.message : "Bilgi kartı içe aktarılamadı.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function rejectSelected() {
    if (!token || !selectedItem) {
      return;
    }

    setSaving(true);

    try {
      const response = await adminApiRequest<{
        import: AdminFlashcardImport;
        item: AdminFlashcardImportItem;
      }>(`/admin/flashcard-imports/${importId}/items/${selectedItem.id}`, {
        token,
        method: "DELETE",
      });

      applyImportPatch(response.data.import, [response.data.item]);
      setSelectedIds((current) => current.filter((id) => id !== selectedItem.id));
      showToast({ tone: "success", title: "Bilgi kartı reddedildi" });
    } catch (rejectError) {
      showToast({
        tone: "error",
        title: "Reddedilemedi",
        description: rejectError instanceof Error ? rejectError.message : "Bilgi kartı reddedilemedi.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function bulkApproveSelected() {
    if (!token || selectedPendingIds.length === 0) {
      return;
    }

    setSaving(true);

    try {
      const response = await adminApiRequest<{
        import: AdminFlashcardImport;
        approved_count: number;
        duplicate_count?: number;
      }>(
        `/admin/flashcard-imports/${importId}/items/bulk-approve`,
        {
          token,
          method: "POST",
          body: { item_ids: selectedPendingIds },
        },
      );

      await loadImport();
      setSelectedIds([]);
      showToast({
        tone: response.data.duplicate_count ? "warning" : "success",
        title: "Seçili bilgi kartları içe aktarıldı",
        description: response.data.duplicate_count
          ? `${response.data.approved_count} kart içe aktarıldı, ${response.data.duplicate_count} duplicate içeri alınmadı.`
          : `${response.data.approved_count} kart içe aktarıldı.`,
      });
    } catch (bulkError) {
      showToast({
        tone: "error",
        title: "Toplu onay başarısız",
        description: bulkError instanceof Error ? bulkError.message : "Seçili bilgi kartları onaylanamadı.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminTableCard>
        <div className="px-5 py-8 text-sm font-semibold text-[var(--color-admin-muted)]">Import yükleniyor...</div>
      </AdminTableCard>
    );
  }

  if (error || !flashcardImport) {
    return (
      <AdminTableCard>
        <div className="px-5 py-8 text-sm font-semibold text-[var(--color-admin-danger)]">
          {error ?? "Import kaydı bulunamadı."}
        </div>
      </AdminTableCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-admin-muted)]">
            <Link className="inline-flex items-center gap-1 hover:text-[var(--color-admin-ink)]" href="/flashcardlar/import">
              <ChevronLeft size={16} />
              Importlara Dön
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[var(--color-admin-ink)]">
            Bilgi Kartı Import #{importId}
          </h1>
        </div>

        <button
          className="admin-button admin-button-primary"
          disabled={saving || selectedPendingIds.length === 0}
          onClick={bulkApproveSelected}
          type="button"
        >
          Seçili {selectedPendingIds.length} Kartı Onayla
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Toplam", flashcardImport.total_count],
          ["Bekleyen", flashcardImport.pending_count],
          ["İçe Aktarılan", flashcardImport.imported_count],
          ["Reddedilen", flashcardImport.rejected_count],
        ].map(([label, value]) => (
          <AdminTableCard key={label}>
            <div className="px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">{label}</p>
              <p className="mt-2 text-2xl font-black text-[var(--color-admin-ink)]">{value}</p>
            </div>
          </AdminTableCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)]">
        <AdminTableCard>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-admin-line)] px-5 py-4">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Kartlar
              </h2>
              <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                {itemsMeta?.total ?? items.length} kayıt, {flashcardImport.topic_count} konu.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-admin-muted)]">
              <input
                checked={pendingItems.length > 0 && selectedPendingIds.length === pendingItems.length}
                onChange={(event) => {
                  setSelectedIds(event.target.checked ? pendingItems.map((item) => item.id) : []);
                }}
                type="checkbox"
              />
              Tüm bekleyen
            </label>
          </div>

          <div className="max-h-[720px] overflow-auto px-3 py-3">
            {items.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const canSelect = item.review_status === "pending_review";

              return (
                <button
                  className={`mb-2 w-full rounded-[18px] border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-panel-soft)]"
                      : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] hover:border-[var(--color-admin-accent)]"
                  }`}
                  key={item.id}
                  onClick={() => selectItem(item)}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <input
                      checked={selectedIds.includes(item.id)}
                      className="mt-1"
                      disabled={!canSelect}
                      onChange={(event) => {
                        event.stopPropagation();
                        setSelectedIds((current) =>
                          event.target.checked
                            ? Array.from(new Set([...current, item.id]))
                            : current.filter((id) => id !== item.id),
                        );
                      }}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-[var(--color-admin-ink)]">{item.front_text}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-admin-muted)]">{item.back_text}</p>
                      <p className="mt-2 text-[11px] font-semibold text-[var(--color-admin-muted)]">
                        {item.topic?.subject?.name ?? "Ders"} · {item.topic?.name ?? item.topic_name_snapshot}
                      </p>
                      {item.review_note ? (
                        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                          {item.review_note}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-[var(--color-admin-line)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-admin-muted)]">
                      {item.review_status === "imported" ? "Aktarıldı" : item.review_status === "rejected" ? "Red" : "Bekliyor"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </AdminTableCard>

        <AdminTableCard>
          {selectedItem && draft ? (
            <div className="space-y-5 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-[var(--color-admin-ink)]">Kart Düzenle</h2>
                  <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                    {selectedItem.topic?.subject?.name ?? "Ders"} · {selectedItem.topic?.name ?? selectedItem.topic_name_snapshot}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                  {selectedItem.review_status}
                </span>
              </div>

              {selectedItem.review_note ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  {selectedItem.review_note}
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Konu
                </span>
                <AdminSearchSelect
                  emptyText="Konu bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={(topicId) => setDraft((current) => (current ? { ...current, topic_id: topicId ?? current.topic_id } : current))}
                  options={topicOptions}
                  placeholder="Konu seç"
                  value={draft.topic_id}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Durum
                  </span>
                  <select
                    className="admin-input h-11"
                    onChange={(event) => setDraft((current) => (current ? { ...current, status: event.target.value as EditableItem["status"] } : current))}
                    value={draft.status}
                  >
                    <option value="active">Aktif</option>
                    <option value="draft">Taslak</option>
                    <option value="passive">Pasif</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Sıra
                  </span>
                  <input
                    className="admin-input h-11"
                    min={1}
                    onChange={(event) => {
                      const value = event.target.value === "" ? null : Number(event.target.value);
                      setDraft((current) => (current ? { ...current, sort_order: value } : current));
                    }}
                    type="number"
                    value={draft.sort_order ?? ""}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Ön Yüz
                </span>
                <textarea
                  className="admin-input min-h-24"
                  onChange={(event) => setDraft((current) => (current ? { ...current, front_text: event.target.value } : current))}
                  value={draft.front_text}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Arka Yüz
                </span>
                <textarea
                  className="admin-input min-h-32"
                  onChange={(event) => setDraft((current) => (current ? { ...current, back_text: event.target.value } : current))}
                  value={draft.back_text}
                />
              </label>

              <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
                <input
                  checked={draft.is_free}
                  onChange={(event) => setDraft((current) => (current ? { ...current, is_free: event.target.checked } : current))}
                  type="checkbox"
                />
                Free akışta da göster
              </label>

              <div className="rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Önizleme
                </p>
                <p className="mt-3 text-lg font-black text-[var(--color-admin-ink)]">{draft.front_text}</p>
                <p className="mt-3 rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3 text-sm leading-6 text-[var(--color-admin-ink)]">
                  {draft.back_text}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="admin-button admin-button-soft" disabled={saving || selectedItem.review_status === "imported"} onClick={saveSelected} type="button">
                  Kaydet
                </button>
                <button className="admin-button admin-button-primary" disabled={saving || selectedItem.review_status !== "pending_review"} onClick={approveSelected} type="button">
                  <Check size={16} />
                  Onayla
                </button>
                <button className="admin-button admin-button-danger" disabled={saving || selectedItem.review_status === "imported"} onClick={rejectSelected} type="button">
                  <Trash2 size={16} />
                  Reddet
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-8 text-sm font-semibold text-[var(--color-admin-muted)]">
              Düzenlemek için soldan bir kart seç.
            </div>
          )}
        </AdminTableCard>
      </div>
    </div>
  );
}
