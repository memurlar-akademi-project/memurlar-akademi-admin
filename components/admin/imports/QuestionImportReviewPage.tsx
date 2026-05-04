"use client";

import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheckBig, Trash2 } from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPaginationMeta, AdminQuestionImport, AdminQuestionImportItem } from "@/lib/types";

type Props = {
  importId: number;
};

type TopicOptionItem = {
  id: number;
  name: string;
  subject: {
    id: number;
    name: string;
  } | null;
};

type EditableItem = {
  topic_id: number;
  question_type: "multiple_choice" | "true_false";
  difficulty: "easy" | "medium" | "hard";
  status: "active" | "passive" | "draft";
  question_text: string;
  correct_answer_text: string;
  explanation_text: string;
  review_status: "pending_review" | "rejected";
  options: Array<{
    label: string;
    option_text: string;
    is_correct: boolean;
  }>;
};

const fixedOptionLabels = ["A", "B", "C", "D", "E"] as const;

function normalizeReviewOptions(
  options?: EditableItem["options"] | AdminQuestionImportItem["options"] | null,
): EditableItem["options"] {
  const optionMap = new Map((options ?? []).map((option) => [option.label, option]));

  return fixedOptionLabels.map((label, index) => {
    const existing = optionMap.get(label);

    return {
      label,
      option_text: existing?.option_text ?? "",
      is_correct: existing?.is_correct ?? index === 0,
    };
  });
}

function toEditableItem(item: AdminQuestionImportItem): EditableItem {
  return {
    topic_id: item.topic_id,
    question_type: item.question_type,
    difficulty: item.difficulty,
    status: item.review_status === "pending_review" && item.status === "draft" ? "active" : item.status,
    question_text: item.question_text,
    correct_answer_text: item.correct_answer_text,
    explanation_text: item.explanation_text,
    review_status: item.review_status === "rejected" ? "rejected" : "pending_review",
    options: item.question_type === "multiple_choice" ? normalizeReviewOptions(item.options) : [],
  };
}

function toImportItemPayload(draft: EditableItem): Omit<EditableItem, "options"> & { options?: EditableItem["options"] } {
  const payload: Omit<EditableItem, "options"> & { options?: EditableItem["options"] } = {
    topic_id: draft.topic_id,
    question_type: draft.question_type,
    difficulty: draft.difficulty,
    status: draft.status,
    question_text: draft.question_text,
    correct_answer_text: draft.correct_answer_text,
    explanation_text: draft.explanation_text,
    review_status: draft.review_status,
  };

  if (draft.question_type === "multiple_choice") {
    payload.options = draft.options;
  }

  return payload;
}

export function QuestionImportReviewPage({ importId }: Props) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();

  const [questionImport, setQuestionImport] = useState<AdminQuestionImport | null>(null);
  const [topics, setTopics] = useState<TopicOptionItem[]>([]);
  const [itemsMeta, setItemsMeta] = useState<AdminPaginationMeta | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(40);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditableItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkSelectedItemIds, setBulkSelectedItemIds] = useState<number[]>([]);
  const queueItemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const loadImport = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);

    try {
      const response = await adminApiRequest<{
        import: AdminQuestionImport;
        items_meta: AdminPaginationMeta;
        topics: TopicOptionItem[];
      }>(`/admin/question-imports/${importId}?page=${itemsPage}&per_page=${itemsPageSize}`, { token });

      setQuestionImport(response.data.import);
      setTopics(response.data.topics);
      setItemsMeta(response.data.items_meta ?? parsePagination(response.meta.pagination));

      const firstPending =
        response.data.import.items?.find((item) => item.review_status === "pending_review") ??
        response.data.import.items?.[0] ??
        null;

      setSelectedItemId(firstPending?.id ?? null);
      setDraft(firstPending ? toEditableItem(firstPending) : null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Import yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [importId, itemsPage, itemsPageSize, token]);

  useEffect(() => {
    void loadImport();
  }, [loadImport]);

  const items = useMemo(() => questionImport?.items ?? [], [questionImport]);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );
  const selectedIndex = useMemo(
    () => items.findIndex((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  const totalCount = questionImport?.total_count ?? items.length;
  const pendingCount = questionImport?.pending_count ?? items.filter((item) => item.review_status === "pending_review").length;
  const importedCount = questionImport?.imported_count ?? items.filter((item) => item.review_status === "imported").length;
  const rejectedCount = questionImport?.rejected_count ?? items.filter((item) => item.review_status === "rejected").length;
  const pendingItemIds = useMemo(
    () => items.filter((item) => item.review_status === "pending_review").map((item) => item.id),
    [items],
  );
  const pendingItemIdSet = useMemo(() => new Set(pendingItemIds), [pendingItemIds]);
  const selectedBulkCount = bulkSelectedItemIds.filter((itemId) => pendingItemIdSet.has(itemId)).length;
  const allPendingSelected = pendingItemIds.length > 0 && selectedBulkCount === pendingItemIds.length;
  const progressPercent = totalCount > 0 ? Math.round((importedCount / totalCount) * 100) : 0;
  const selectedGlobalIndex = selectedIndex === -1 ? 0 : (itemsMeta?.from ?? 1) + selectedIndex;
  const currentTopic = topics.find((topic) => topic.id === draft?.topic_id) ?? selectedItem?.topic ?? null;
  const correctOptionLabel =
    draft?.question_type === "multiple_choice"
      ? draft.options.find((option) => option.is_correct)?.label ?? draft.correct_answer_text ?? "-"
      : draft?.correct_answer_text === "true"
        ? "Doğru"
        : draft?.correct_answer_text === "false"
          ? "Yanlış"
          : draft?.correct_answer_text ?? "-";

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [topics],
  );

  useEffect(() => {
    if (!selectedItem) {
      setDraft(null);
      return;
    }

    setDraft(toEditableItem(selectedItem));
  }, [selectedItem]);

  useEffect(() => {
    setBulkSelectedItemIds((current) => current.filter((itemId) => pendingItemIdSet.has(itemId)));
  }, [pendingItemIdSet]);

  function applyImportPatch(
    nextImport: AdminQuestionImport,
    updatedItems: AdminQuestionImportItem[],
    options: { moveToNextPending?: boolean; previousItemId?: number } = {},
  ) {
    const updatedById = new Map(updatedItems.map((item) => [item.id, item]));
    const patchedItems = (questionImport?.items ?? []).map((item) => updatedById.get(item.id) ?? item);

    setQuestionImport({
      ...nextImport,
      items: patchedItems,
    });

    const currentExists = patchedItems.find((item) => item.id === selectedItemId);
    let nextSelected: AdminQuestionImportItem | null = null;

    if (options.moveToNextPending) {
      const previousIndex = patchedItems.findIndex((item) => item.id === options.previousItemId);
      const searchStart = previousIndex === -1 ? 0 : previousIndex + 1;
      const afterPrevious = patchedItems.slice(searchStart).find((item) => item.review_status === "pending_review");
      const beforePrevious = patchedItems.slice(0, Math.max(searchStart, 0)).find(
        (item) => item.review_status === "pending_review",
      );

      nextSelected = afterPrevious ?? beforePrevious ?? null;

      if (!nextSelected && itemsMeta && itemsMeta.current_page < itemsMeta.last_page) {
        setItemsPage((current) => current + 1);
        return;
      }
    } else {
      nextSelected =
        currentExists ??
        patchedItems.find((item) => item.review_status === "pending_review") ??
        patchedItems[0] ??
        null;
    }

    setSelectedItemId(nextSelected?.id ?? null);
    setDraft(nextSelected ? toEditableItem(nextSelected) : null);
  }

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    queueItemRefs.current[selectedItemId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedItemId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedItem || !draft) {
      return;
    }

    setSaving(true);

    try {
      const response = await adminApiRequest<{
        import: AdminQuestionImport;
        item: AdminQuestionImportItem;
      }>(`/admin/question-imports/${importId}/items/${selectedItem.id}`, {
        token,
        method: "PUT",
        body: toImportItemPayload(draft),
      });

      applyImportPatch(response.data.import, [response.data.item]);

      showToast({
        tone: "success",
        title: "Import sorusu kaydedildi",
        description: response.data.item.topic?.name ?? "Review alanı",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Kaydetme başarısız",
        description: submitError instanceof Error ? submitError.message : "Soru güncellenemedi.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!token || !selectedItem || !draft) {
      return;
    }

    setSaving(true);

    try {
      const saveResponse = await adminApiRequest<{
        import: AdminQuestionImport;
        item: AdminQuestionImportItem;
      }>(`/admin/question-imports/${importId}/items/${selectedItem.id}`, {
        token,
        method: "PUT",
        body: toImportItemPayload({ ...draft, status: "active" }),
      });

      const approveResponse = await adminApiRequest<{
        import: AdminQuestionImport;
        item: AdminQuestionImportItem;
        duplicate_count?: number;
      }>(`/admin/question-imports/${importId}/items/${selectedItem.id}/approve`, {
        token,
        method: "POST",
      });

      applyImportPatch(approveResponse.data.import, [approveResponse.data.item], {
        moveToNextPending: true,
        previousItemId: selectedItem.id,
      });

      const wasDuplicate = approveResponse.data.item.review_status === "rejected";
      showToast({
        tone: wasDuplicate ? "warning" : "success",
        title: wasDuplicate ? "Duplicate soru içeri alınmadı" : "Soru içe aktarıldı",
        description: wasDuplicate
          ? approveResponse.data.item.review_note ?? "Bu soru zaten mevcut."
          : saveResponse.data.item.topic?.name ?? "Soru havuzu",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Onay başarısız",
        description: submitError instanceof Error ? submitError.message : "Soru içe aktarılamadı.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!token || !selectedItem) {
      return;
    }

    setSaving(true);

    try {
      const response = await adminApiRequest<{
        import: AdminQuestionImport;
        item: AdminQuestionImportItem;
      }>(
        `/admin/question-imports/${importId}/items/${selectedItem.id}`,
        {
          token,
          method: "DELETE",
        },
      );

      applyImportPatch(response.data.import, [response.data.item], {
        moveToNextPending: true,
        previousItemId: selectedItem.id,
      });

      showToast({
        tone: "success",
        title: "Soru review listesinden çıkarıldı",
        description: selectedItem.topic?.name ?? "Import alanı",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Soru çıkarılamadı",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleBulkSelection(itemId: number) {
    if (!pendingItemIdSet.has(itemId)) {
      return;
    }

    setBulkSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((selectedId) => selectedId !== itemId) : [...current, itemId],
    );
  }

  function toggleAllPendingSelection() {
    setBulkSelectedItemIds(allPendingSelected ? [] : pendingItemIds);
  }

  async function handleBulkApprove() {
    if (!token) {
      return;
    }

    const itemIds = bulkSelectedItemIds.filter((itemId) => pendingItemIdSet.has(itemId));
    if (itemIds.length === 0) {
      return;
    }

    setSaving(true);

    try {
      if (selectedItem && draft && itemIds.includes(selectedItem.id) && selectedItem.review_status === "pending_review") {
        await adminApiRequest<{
          import: AdminQuestionImport;
          item: AdminQuestionImportItem;
        }>(`/admin/question-imports/${importId}/items/${selectedItem.id}`, {
          token,
          method: "PUT",
          body: toImportItemPayload({ ...draft, status: "active" }),
        });
      }

      const response = await adminApiRequest<{
        approved_count: number;
        duplicate_count?: number;
        import: AdminQuestionImport;
      }>(`/admin/question-imports/${importId}/items/bulk-approve`, {
        token,
        method: "POST",
        body: { item_ids: itemIds },
      });

      await loadImport();
      setBulkSelectedItemIds([]);

      showToast({
        tone: response.data.duplicate_count ? "warning" : "success",
        title: "Seçili sorular işlendi",
        description: response.data.duplicate_count
          ? `${response.data.approved_count} soru eklendi, ${response.data.duplicate_count} duplicate içeri alınmadı.`
          : `${response.data.approved_count} soru aktif olarak soru havuzuna eklendi.`,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Toplu onay başarısız",
        description: submitError instanceof Error ? submitError.message : "Seçili sorular içe aktarılamadı.",
      });
    } finally {
      setSaving(false);
    }
  }

  function moveSelection(offset: -1 | 1) {
    if (!selectedItem) {
      return;
    }

    const index = items.findIndex((item) => item.id === selectedItem.id);
    if (index === -1) {
      return;
    }

    const next = items[index + offset];
    if (!next) {
      return;
    }

    setSelectedItemId(next.id);
  }

  function renderRejectTrigger(): ReactNode {
    return (
      <span className="inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-[var(--color-admin-danger)] transition hover:-translate-y-0.5">
        <Trash2 size={16} />
        Sil
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <AdminTableCard>
        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Soru Import Review
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
                Import #{importId}
              </h2>
            </div>
            <button
              className="rounded-2xl border border-[var(--color-admin-line)] px-4 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
              onClick={() => router.push("/sorular/import")}
              type="button"
            >
              Importlara Dön
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Toplam", totalCount],
              ["Bekleyen", questionImport?.pending_count ?? pendingCount],
              ["İçe Aktarılan", questionImport?.imported_count ?? importedCount],
              ["Reddedilen", rejectedCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">{label}</p>
                <p className="mt-1 text-xl font-extrabold text-[var(--color-admin-ink)]">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--color-admin-muted)]">
              <span>Onay ilerlemesi</span>
              <span>%{progressPercent}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-admin-panel-soft)]">
              <div className="h-full rounded-full bg-[var(--color-admin-success)] transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
      </AdminTableCard>

      {loading ? (
        <AdminTableCard>
          <div className="px-5 py-8 text-sm font-semibold text-[var(--color-admin-muted)]">Import yükleniyor...</div>
        </AdminTableCard>
      ) : error ? (
        <AdminTableCard>
          <div className="px-5 py-8 text-sm font-semibold text-[var(--color-admin-danger)]">{error}</div>
        </AdminTableCard>
      ) : (
        <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" onSubmit={handleSave}>
          <AdminTableCard>
            <div className="space-y-5 px-5 py-5">
              {!draft || !selectedItem ? (
                <div className="rounded-[22px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-8 text-sm text-[var(--color-admin-muted)]">
                  İncelemek için bir soru seç.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--color-admin-accent-soft)] px-3 py-1 text-xs font-extrabold text-[var(--color-admin-accent)]">
                        Soru {Math.max(selectedGlobalIndex, 1)} / {totalCount}
                      </span>
                      <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                        {selectedItem.review_status === "imported" ? "İçe aktarıldı" : selectedItem.review_status === "rejected" ? "Reddedildi" : "Review bekliyor"}
                      </span>
                      <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                        Doğru cevap: {correctOptionLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)] disabled:opacity-40"
                        disabled={selectedIndex <= 0}
                        onClick={() => moveSelection(-1)}
                        type="button"
                      >
                        <ChevronLeft size={16} />
                        Önceki
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)] disabled:opacity-40"
                        disabled={selectedIndex === -1 || selectedIndex >= items.length - 1}
                        onClick={() => moveSelection(1)}
                        type="button"
                      >
                        Sonraki
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {selectedItem.review_note ? (
                    <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                      {selectedItem.review_note}
                    </div>
                  ) : null}

                  <div className="rounded-[26px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-admin-muted)]">
                      <span>{currentTopic?.subject?.name ?? selectedItem.topic?.subject?.name ?? "Ders"}</span>
                      <span>•</span>
                      <span>{currentTopic?.name ?? selectedItem.topic?.name ?? selectedItem.topic_name_snapshot}</span>
                    </div>
                    <textarea
                      className="w-full resize-none border-0 bg-transparent text-xl font-extrabold leading-9 tracking-[-0.03em] text-[var(--color-admin-ink)] outline-none"
                      onChange={(event) =>
                        setDraft((current) => (current ? { ...current, question_text: event.target.value } : current))
                      }
                      rows={4}
                      value={draft.question_text}
                    />
                  </div>

                  {draft.question_type === "multiple_choice" ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                          Şıklar
                        </h3>
                        <span className="text-xs text-[var(--color-admin-muted)]">Doğru cevabı soldaki rozet belirler.</span>
                      </div>

                      {draft.options.map((option, index) => (
                        <div
                          key={`${option.label}-${index}`}
                          className={`grid gap-3 rounded-[22px] border p-3 transition md:grid-cols-[56px_minmax(0,1fr)] ${
                            option.is_correct
                              ? "border-[var(--color-admin-success)] bg-[var(--color-admin-success-soft)]"
                              : "border-[var(--color-admin-line)] bg-white"
                          }`}
                        >
                          <button
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black transition ${
                              option.is_correct
                                ? "bg-[var(--color-admin-success)] text-white"
                                : "bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-muted)] hover:bg-[var(--color-admin-accent-soft)] hover:text-[var(--color-admin-accent)]"
                            }`}
                            onClick={() =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      options: current.options.map((entry, entryIndex) => ({
                                        ...entry,
                                        is_correct: entryIndex === index,
                                      })),
                                    }
                                  : current,
                              )
                            }
                            type="button"
                          >
                            {option.label}
                          </button>
                          <input
                            className="admin-input h-12"
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      options: current.options.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, option_text: event.target.value } : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            value={option.option_text}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <label className="block space-y-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                      Açıklama
                    </span>
                    <textarea
                      className="admin-input min-h-[180px] leading-6"
                      onChange={(event) =>
                        setDraft((current) =>
                          current ? { ...current, explanation_text: event.target.value } : current,
                        )
                      }
                      value={draft.explanation_text}
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-admin-line)] pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-2xl border border-[var(--color-admin-line)] px-4 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                        disabled={saving}
                        type="submit"
                      >
                        Kaydet
                      </button>
                      <ConfirmDialog
                        busy={saving}
                        confirmLabel="Sil"
                        description="Bu soru canlı soru kaydına dönüşmez ve review listesinden çıkarılır."
                        disabled={saving || selectedItem.review_status === "imported"}
                        onConfirm={handleReject}
                        title="Bu soruyu review listesinden çıkar"
                        tone="danger"
                        trigger={renderRejectTrigger()}
                      />
                    </div>

                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-admin-success)] bg-[var(--color-admin-success-soft)] px-5 py-2 text-sm font-semibold text-[var(--color-admin-success)] transition hover:-translate-y-0.5 disabled:opacity-50"
                      disabled={saving || selectedItem.review_status === "imported"}
                      onClick={handleApprove}
                      type="button"
                    >
                      <CircleCheckBig size={16} />
                      Onayla ve Sıradakine Geç
                    </button>
                  </div>
                </>
              )}
            </div>
          </AdminTableCard>

          <div className="space-y-4">
            <AdminTableCard>
              <div className="space-y-4 px-5 py-5">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                    Soru Ayarları
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                    Konu, zorluk ve canlıya alınacak cevap bilgisi.
                  </p>
                </div>

                {draft ? (
                  <>
                    <label className="block space-y-2">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                        Konu
                      </span>
                      <AdminSearchSelect
                        emptyText="Konu bulunamadı."
                        hideLabel
                        label="Konu"
                        onChange={(next) => {
                          if (next === null) {
                            return;
                          }

                          setDraft((current) => (current ? { ...current, topic_id: next } : current));
                        }}
                        options={topicOptions}
                        placeholder="Konu seç"
                        value={draft.topic_id}
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <label className="block space-y-2">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                          Zorluk
                        </span>
                        <select
                          className="admin-input h-11"
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, difficulty: event.target.value as EditableItem["difficulty"] } : current,
                            )
                          }
                          value={draft.difficulty}
                        >
                          <option value="easy">Kolay</option>
                          <option value="medium">Orta</option>
                          <option value="hard">Zor</option>
                        </select>
                      </label>

                      <label className="block space-y-2">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                          Durum
                        </span>
                        <select
                          className="admin-input h-11"
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, status: event.target.value as EditableItem["status"] } : current,
                            )
                          }
                          value={draft.status}
                        >
                          <option value="draft">Taslak</option>
                          <option value="active">Aktif</option>
                          <option value="passive">Pasif</option>
                        </select>
                      </label>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                        Doğru Cevap Metni
                      </span>
                      <input
                        className="admin-input h-11"
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, correct_answer_text: event.target.value } : current,
                          )
                        }
                        value={draft.correct_answer_text}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </AdminTableCard>

            <AdminTableCard>
              <div className="px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      Soru Kuyruğu
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                      Deneme gibi sırayla gez.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                      {pendingCount} bekliyor
                    </span>
                    <button
                      className="rounded-2xl border border-[var(--color-admin-success)] bg-[var(--color-admin-success-soft)] px-3 py-2 text-xs font-extrabold text-[var(--color-admin-success)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                      disabled={saving || selectedBulkCount === 0}
                      onClick={handleBulkApprove}
                      type="button"
                    >
                      Seçili {selectedBulkCount} soruyu onayla
                    </button>
                  </div>
                </div>

                {pendingItemIds.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--color-admin-muted)]">
                      <input
                        checked={allPendingSelected}
                        className="h-4 w-4 accent-[var(--color-admin-accent)]"
                        disabled={saving}
                        onChange={toggleAllPendingSelection}
                        type="checkbox"
                      />
                      Bu sayfadaki bekleyenleri seç
                    </label>
                    <button
                      className="text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-accent)] disabled:opacity-40"
                      disabled={saving || selectedBulkCount === 0}
                      onClick={() => setBulkSelectedItemIds([])}
                      type="button"
                    >
                      Seçimi temizle
                    </button>
                  </div>
                ) : null}

                {itemsMeta ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-[var(--color-admin-line)] bg-white px-3 py-2">
                    <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
                      {itemsMeta.from ?? 0}-{itemsMeta.to ?? 0} / {itemsMeta.total} soru
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-admin-ink)] outline-none"
                        onChange={(event) => {
                          setItemsPageSize(Number(event.target.value));
                          setItemsPage(1);
                          setBulkSelectedItemIds([]);
                        }}
                        value={itemsPageSize}
                      >
                        {[20, 40, 80, 100].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:opacity-40"
                        disabled={itemsMeta.current_page <= 1 || saving}
                        onClick={() => {
                          setBulkSelectedItemIds([]);
                          setItemsPage((current) => Math.max(1, current - 1));
                        }}
                        type="button"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
                        {itemsMeta.current_page}/{Math.max(itemsMeta.last_page, 1)}
                      </span>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:opacity-40"
                        disabled={itemsMeta.current_page >= itemsMeta.last_page || saving}
                        onClick={() => {
                          setBulkSelectedItemIds([]);
                          setItemsPage((current) => Math.min(itemsMeta.last_page, current + 1));
                        }}
                        type="button"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {items.map((item, index) => {
                    const globalIndex = (itemsMeta?.from ?? 1) + index;
                    const isActive = item.id === selectedItemId;
                    const isPending = item.review_status === "pending_review";
                    const isBulkSelected = bulkSelectedItemIds.includes(item.id) && isPending;
                    const statusClass =
                      item.review_status === "imported"
                        ? "bg-[var(--color-admin-success-soft)] text-[var(--color-admin-success)]"
                        : item.review_status === "rejected"
                          ? "bg-red-50 text-[var(--color-admin-danger)]"
                          : "bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-muted)]";

                    return (
                      <div
                        key={item.id}
                        ref={(element) => {
                          queueItemRefs.current[item.id] = element;
                        }}
                        className={`flex w-full items-center gap-2 rounded-[18px] border px-3 py-3 text-left transition ${
                          isActive
                            ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)]"
                            : "border-[var(--color-admin-line)] bg-white hover:border-[var(--color-admin-accent)]"
                        }`}
                      >
                        <label className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border ${
                          isPending
                            ? "border-[var(--color-admin-line)] bg-white"
                            : "border-transparent bg-[var(--color-admin-panel-soft)] opacity-45"
                        }`}>
                          <input
                            aria-label={`${globalIndex}. soruyu toplu onay için seç`}
                            checked={isBulkSelected}
                            className="h-4 w-4 accent-[var(--color-admin-accent)]"
                            disabled={!isPending || saving}
                            onChange={() => toggleBulkSelection(item.id)}
                            type="checkbox"
                          />
                        </label>
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedItemId(item.id)}
                          type="button"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${statusClass}`}>
                              {globalIndex}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-[var(--color-admin-muted)]">
                                {item.topic?.name ?? item.topic_name_snapshot}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-[var(--color-admin-ink)]">
                                {item.question_text}
                              </p>
                              {item.review_note ? (
                                <p className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
                                  {item.review_note}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AdminTableCard>
          </div>
        </form>
      )}
    </div>
  );
}

function parsePagination(value: unknown): AdminPaginationMeta | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const meta = value as Partial<AdminPaginationMeta>;

  if (
    typeof meta.current_page !== "number" ||
    typeof meta.per_page !== "number" ||
    typeof meta.total !== "number" ||
    typeof meta.last_page !== "number"
  ) {
    return null;
  }

  return {
    current_page: meta.current_page,
    per_page: meta.per_page,
    total: meta.total,
    last_page: meta.last_page,
    from: typeof meta.from === "number" ? meta.from : null,
    to: typeof meta.to === "number" ? meta.to : null,
  };
}
