"use client";

import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheckBig, Trash2 } from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminQuestionImport, AdminQuestionImportItem } from "@/lib/types";

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
    status: item.status,
    question_text: item.question_text,
    correct_answer_text: item.correct_answer_text,
    explanation_text: item.explanation_text,
    review_status: item.review_status === "rejected" ? "rejected" : "pending_review",
    options: normalizeReviewOptions(item.options),
  };
}

export function QuestionImportReviewPage({ importId }: Props) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();

  const [questionImport, setQuestionImport] = useState<AdminQuestionImport | null>(null);
  const [topics, setTopics] = useState<TopicOptionItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditableItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadImport() {
      setLoading(true);

      try {
        const response = await adminApiRequest<{
          import: AdminQuestionImport;
          topics: TopicOptionItem[];
        }>(`/admin/question-imports/${importId}`, { token });

        if (cancelled) {
          return;
        }

        setQuestionImport(response.data.import);
        setTopics(response.data.topics);

        const firstPending =
          response.data.import.items?.find((item) => item.review_status === "pending_review") ??
          response.data.import.items?.[0] ??
          null;

        setSelectedItemId(firstPending?.id ?? null);
        setDraft(firstPending ? toEditableItem(firstPending) : null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Import yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadImport();

    return () => {
      cancelled = true;
    };
  }, [importId, token]);

  const items = useMemo(() => questionImport?.items ?? [], [questionImport]);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
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

  useEffect(() => {
    if (!selectedItem) {
      setDraft(null);
      return;
    }

    setDraft(toEditableItem(selectedItem));
  }, [selectedItem]);

  function applyImportState(nextImport: AdminQuestionImport) {
    setQuestionImport(nextImport);

    const updatedItems = nextImport.items ?? [];
    const currentExists = updatedItems.find((item) => item.id === selectedItemId);
    const nextSelected =
      currentExists ??
      updatedItems.find((item) => item.review_status === "pending_review") ??
      updatedItems[0] ??
      null;

    setSelectedItemId(nextSelected?.id ?? null);
    setDraft(nextSelected ? toEditableItem(nextSelected) : null);
  }

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
        body: draft,
      });

      applyImportState(response.data.import);

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
        body: draft,
      });

      const approveResponse = await adminApiRequest<{
        import: AdminQuestionImport;
        item: AdminQuestionImportItem;
      }>(`/admin/question-imports/${importId}/items/${selectedItem.id}/approve`, {
        token,
        method: "POST",
      });

      applyImportState(approveResponse.data.import);

      showToast({
        tone: "success",
        title: "Soru içe aktarıldı",
        description: saveResponse.data.item.topic?.name ?? "Soru havuzu",
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
      const response = await adminApiRequest<{ import: AdminQuestionImport }>(
        `/admin/question-imports/${importId}/items/${selectedItem.id}`,
        {
          token,
          method: "DELETE",
        },
      );

      applyImportState(response.data.import);

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
        <div className="grid gap-4 px-5 py-5 md:grid-cols-4">
          <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Toplam</p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
              {questionImport?.total_count ?? 0}
            </p>
          </div>
          <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Konu</p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
              {questionImport?.topic_count ?? 0}
            </p>
          </div>
          <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">İçe Aktarılan</p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
              {questionImport?.imported_count ?? 0}
            </p>
          </div>
          <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Bekleyen</p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
              {questionImport?.pending_count ?? 0}
            </p>
          </div>
        </div>
      </AdminTableCard>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <AdminTableCard>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                  Import Soruları
                </h3>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Soruları tek tek inceleyip onaylayabilirsin.
                </p>
              </div>
              <button
                className="rounded-2xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                onClick={() => router.push("/sorular/import")}
                type="button"
              >
                Importlara Dön
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                  Import yükleniyor...
                </div>
              ) : error ? (
                <div className="rounded-[18px] border border-red-100 bg-red-50 px-4 py-4 text-sm text-[var(--color-admin-danger)]">
                  {error}
                </div>
              ) : (
                items.map((item) => {
                  const isActive = item.id === selectedItemId;

                  return (
                    <button
                      key={item.id}
                      className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)]"
                          : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] hover:border-[var(--color-admin-accent)]"
                      }`}
                      onClick={() => setSelectedItemId(item.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-[var(--color-admin-line)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-admin-muted)]">
                          {item.review_status === "imported"
                            ? "İçe aktarıldı"
                            : item.review_status === "rejected"
                              ? "Reddedildi"
                              : "Bekliyor"}
                        </span>
                        <span className="text-[12px] text-[var(--color-admin-muted)]">
                          {item.topic?.name ?? item.topic_name_snapshot}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-[var(--color-admin-ink)]">
                        {item.question_text}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </AdminTableCard>

        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" onSubmit={handleSave}>
            {!draft || !selectedItem ? (
              <div className="rounded-[18px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-6 text-sm text-[var(--color-admin-muted)]">
                İncelemek için bir soru seç.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <label className="block space-y-2 md:col-span-2">
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
                    Soru Metni
                  </span>
                  <textarea
                    className="admin-input min-h-[140px] leading-6"
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, question_text: event.target.value } : current))
                    }
                    value={draft.question_text}
                  />
                </label>

                {draft.question_type === "multiple_choice" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                        Şıklar
                      </h3>
                      <span className="text-xs text-[var(--color-admin-muted)]">5 şık sabit, doğru cevabı işaretle</span>
                    </div>

                    {draft.options.map((option, index) => (
                      <div key={`${option.label}-${index}`} className="grid gap-3 md:grid-cols-[80px_minmax(0,1fr)_120px]">
                        <div className="flex h-11 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-sm font-black text-[var(--color-admin-ink)]">
                          {option.label}
                        </div>
                        <input
                          className="admin-input h-11"
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
                        <button
                          className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                            option.is_correct
                              ? "border-[var(--color-admin-success)] bg-[var(--color-admin-success-soft)] text-[var(--color-admin-success)]"
                              : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-muted)] hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
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
                          Doğru Cevap
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

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
                      className="rounded-2xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                      disabled={saving}
                      type="submit"
                    >
                      Kaydet
                    </button>

                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-admin-success)] bg-[var(--color-admin-success-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-success)] transition hover:-translate-y-0.5"
                      disabled={saving || selectedItem.review_status === "imported"}
                      onClick={handleApprove}
                      type="button"
                    >
                      <CircleCheckBig size={16} />
                      Onayla
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

                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                      onClick={() => moveSelection(-1)}
                      type="button"
                    >
                      <ChevronLeft size={16} />
                      Önceki
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                      onClick={() => moveSelection(1)}
                      type="button"
                    >
                      Sonraki
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        </AdminTableCard>
      </div>

    </div>
  );
}
