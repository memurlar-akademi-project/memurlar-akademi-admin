"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronLeft,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPaginationMeta, AdminQuestion, AdminSubject } from "@/lib/types";

type QuestionsResponse = {
  questions: AdminQuestion[];
};

type SubjectsResponse = {
  subjects: AdminSubject[];
};

export type EditableQuestionDraft = {
  question_text: string;
  options: Array<{
    label: string;
    option_text: string;
    is_correct: boolean;
  }>;
  explanation_text: string;
  explanation_basis: string;
  explanation_relevant_provision: string;
  explanation_answer_link: string;
};

export function QuestionPreviewPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects],
  );
  const sortedSubjects = useMemo(
    () =>
      [...subjects]
        .filter((subject) => (subject.question_count ?? 0) > 0)
        .sort((left, right) => (right.question_count ?? 0) - (left.question_count ?? 0) || left.name.localeCompare(right.name, "tr")),
    [subjects],
  );
  const currentQuestion = questions[currentIndex] ?? null;
  const total = questions.length;

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;

    async function loadSubjects() {
      setSubjectsLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<SubjectsResponse>("/admin/subjects?question_type=multiple_choice", { token });

        if (!ignore) {
          setSubjects(response.data.subjects.filter((subject) => subject.topic_count > 0));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Dersler alınamadı.");
        }
      } finally {
        if (!ignore) {
          setSubjectsLoading(false);
        }
      }
    }

    void loadSubjects();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedSubjectId) {
      setQuestions([]);
      setCurrentIndex(0);

      return;
    }

    const currentToken = token;
    const currentSubjectId = selectedSubjectId;
    let ignore = false;

    async function loadQuestions() {
      setQuestionsLoading(true);
      setError(null);

      try {
        const nextQuestions = await fetchSubjectQuestions(currentToken, currentSubjectId);

        if (!ignore) {
          setQuestions(sortQuestionsForPreview(nextQuestions));
          setCurrentIndex(0);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Sorular alınamadı.");
        }
      } finally {
        if (!ignore) {
          setQuestionsLoading(false);
        }
      }
    }

    void loadQuestions();

    return () => {
      ignore = true;
    };
  }, [selectedSubjectId, token]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (!selectedSubjectId || busy || questionsLoading) {
        return;
      }

      if (event.key === "ArrowLeft") {
        setCurrentIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === "ArrowRight") {
        setCurrentIndex((current) => Math.min(current + 1, Math.max(total - 1, 0)));
      }
    }

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [busy, questionsLoading, selectedSubjectId, total]);

  function goPrevious() {
    setCurrentIndex((current) => Math.max(current - 1, 0));
  }

  function goNext() {
    setCurrentIndex((current) => Math.min(current + 1, Math.max(total - 1, 0)));
  }

  async function deleteCurrent() {
    if (!token || !currentQuestion || busy) {
      return;
    }

    const question = currentQuestion;
    setBusy(true);

    try {
      await adminApiRequest(`/admin/questions/${question.id}`, {
        token,
        method: "DELETE",
      });

      setQuestions((current) => {
        const next = current.filter((item) => item.id !== question.id);
        setCurrentIndex((index) => Math.min(index, Math.max(next.length - 1, 0)));

        return next;
      });
      setSubjects((current) =>
        current.map((subject) =>
          subject.id === selectedSubjectId
            ? { ...subject, question_count: Math.max((subject.question_count ?? 0) - 1, 0) }
            : subject,
        ),
      );
      showToast({
        tone: "success",
        title: "Soru silindi",
        description: question.topic?.name ?? selectedSubject?.name ?? "Soru preview",
      });
    } catch (deleteError) {
      showToast({
        tone: "error",
        title: "Silme başarısız",
        description: deleteError instanceof Error ? deleteError.message : "Soru silinemedi.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestionEdits(question: AdminQuestion, draft: EditableQuestionDraft) {
    if (!token || busy) {
      return false;
    }

    setBusy(true);

    try {
      const response = await adminApiRequest<{ question: AdminQuestion }>(`/admin/questions/${question.id}`, {
        token,
        method: "PUT",
        body: buildQuestionUpdatePayload(question, draft),
      });

      setQuestions((current) => current.map((item) => (item.id === question.id ? response.data.question : item)));
      showToast({
        tone: "success",
        title: "Soru güncellendi",
        description: "Preview akışındaki soru kaydedildi.",
      });

      return true;
    } catch (saveError) {
      showToast({
        tone: "error",
        title: "Soru kaydedilemedi",
        description: saveError instanceof Error ? saveError.message : "Düzenleme kaydedilemedi.",
      });

      return false;
    } finally {
      setBusy(false);
    }
  }

  if (subjectsLoading) {
    return <CenteredLoader label="Dersler yükleniyor..." />;
  }

  if (!selectedSubjectId) {
    return (
      <div className="space-y-5">
        {error ? <ErrorMessage message={error} /> : null}
        <section className="admin-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--color-admin-muted)]">
                Soru Preview
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
                Ders seç, soruları sırayla gez
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-[var(--color-admin-muted)]">
                Seçtiğin dersteki çoktan seçmeli sorular konu ve kayıt sırasına göre gelir. Bu ekran sadece hızlı gözden geçirme içindir; onay mekanizması yoktur.
              </p>
            </div>
            <Link className="admin-button admin-button-secondary" href="/sorular">
              <BookOpenCheck size={16} />
              Listeye dön
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedSubjects.map((subject) => (
              <button
                className="group rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-admin-accent)]"
                key={subject.id}
                onClick={() => setSelectedSubjectId(subject.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {subject.code ? (
                        <span className="rounded-full bg-[var(--color-admin-accent-soft)] px-2.5 py-1 text-xs font-black text-[var(--color-admin-accent)]">
                          {subject.code}
                        </span>
                      ) : null}
                      <span className="truncate text-sm font-extrabold text-[var(--color-admin-ink)]">
                        {subject.name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                      {subject.question_count ?? 0} soru · {subject.topic_count} konu
                    </p>
                  </div>
                  <ArrowRight className="shrink-0 text-[var(--color-admin-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--color-admin-accent)]" size={18} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-9rem)]">
      {error ? <ErrorMessage message={error} /> : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-bold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
          disabled={busy}
          onClick={() => setSelectedSubjectId(null)}
          type="button"
        >
          <ChevronLeft size={14} />
          Ders değiştir
        </button>
        <div className="text-right">
          <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">{selectedSubject?.name ?? "Seçili ders"}</p>
          <p className="text-xs font-bold text-[var(--color-admin-muted)]">
            {questionsLoading ? "Yükleniyor" : `${currentIndex + (total > 0 ? 1 : 0)} / ${total}`}
          </p>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-13.5rem)] items-center justify-center">
        {questionsLoading ? (
          <CenteredLoader label="Sorular hazırlanıyor..." />
        ) : currentQuestion ? (
          <QuestionPreviewCard
            busy={busy}
            currentIndex={currentIndex}
            key={currentQuestion.id}
            onDelete={() => void deleteCurrent()}
            onNext={goNext}
            onPrevious={goPrevious}
            onSave={(draft) => saveQuestionEdits(currentQuestion, draft)}
            question={currentQuestion}
            total={total}
          />
        ) : (
          <div className="max-w-xl rounded-[30px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-8 py-10 text-center shadow-[var(--color-admin-shadow)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--color-admin-accent)] text-white">
              <Check size={26} />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-[var(--color-admin-ink)]">Bu derste soru bulunamadı</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--color-admin-muted)]">
              Ders listesinde sayı görünüp burada boşsa backend filtrelerini kontrol etmek gerekir.
            </p>
            <button className="admin-button admin-button-secondary mx-auto mt-6" onClick={() => setSelectedSubjectId(null)} type="button">
              Başka ders seç
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function QuestionPreviewCard({
  busy,
  currentIndex,
  onDelete,
  onNext,
  onPrevious,
  onSave,
  question,
  deleteConfirmLabel = "Soruyu Sil",
  deleteDescription = "Soru kalıcı olarak silinir. Bağlı şık kayıtları da kaldırılır.",
  deleteTitle = "Soru silinsin mi?",
  showDelete = true,
  total,
}: {
  busy: boolean;
  currentIndex: number;
  onDelete: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSave: (draft: EditableQuestionDraft) => Promise<boolean>;
  question: AdminQuestion;
  deleteConfirmLabel?: string;
  deleteDescription?: string;
  deleteTitle?: string;
  showDelete?: boolean;
  total: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableQuestionDraft>(() => createQuestionDraft(question));
  const [editError, setEditError] = useState<string | null>(null);
  const correctOption = question.options?.find((option) => option.is_correct);
  const explanationBasis = normalizedExplanationPart(question.explanation_basis ?? question.explanation?.basis);
  const explanationRelevantProvision = normalizedExplanationPart(
    question.explanation_relevant_provision ?? question.explanation?.relevant_provision,
  );
  const explanationAnswerLink = normalizedExplanationPart(question.explanation_answer_link ?? question.explanation?.answer_link);
  const explanationRows = [
    { label: "Dayanak", value: explanationBasis },
    { label: "İlgili hüküm", value: explanationRelevantProvision },
    { label: "Cevap bağlantısı", value: explanationAnswerLink },
  ].filter((item) => item.value);
  const hasStructuredExplanation = explanationRows.length > 0;
  const fallbackExplanation = hasStructuredExplanation ? "" : normalizedExplanationPart(question.explanation_text);
  const controlsDisabled = busy || editing;

  async function handleSave() {
    const validationError = validateDraft(draft);

    if (validationError) {
      setEditError(validationError);
      return;
    }

    const saved = await onSave(draft);
    if (saved) {
      setEditing(false);
      setEditError(null);
    }
  }

  function updateDraftOption(label: string, patch: Partial<EditableQuestionDraft["options"][number]>) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) => (option.label === label ? { ...option, ...patch } : option)),
    }));
  }

  function setCorrectOption(label: string) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) => ({
        ...option,
        is_correct: option.label === label,
      })),
    }));
  }

  return (
    <div className="relative w-full max-w-5xl px-4 pt-16 md:px-20">
      <button
        aria-label="Önceki soru"
        className="absolute left-4 top-0 flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 text-sm font-black text-[var(--color-admin-ink)] shadow-sm transition hover:border-[var(--color-admin-accent)] disabled:opacity-25"
        disabled={controlsDisabled || currentIndex === 0}
        onClick={onPrevious}
        type="button"
      >
        <ArrowLeft size={18} />
        Önceki
      </button>

      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-2">
        <button
          className="flex h-11 items-center gap-2 rounded-2xl bg-[var(--color-admin-accent)] px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-45"
          disabled={controlsDisabled}
          onClick={() => setEditing(true)}
          type="button"
        >
          <Pencil size={17} />
          Edit
        </button>
        {showDelete ? (
          <ConfirmDialog
            busy={busy}
            confirmLabel={deleteConfirmLabel}
            description={deleteDescription}
            disabled={controlsDisabled}
            onConfirm={onDelete}
            title={deleteTitle}
            trigger={
              <span className="flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-950">
                <Trash2 size={17} />
                Delete
              </span>
            }
          />
        ) : null}
      </div>

      <article className="rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-7 py-6 shadow-[var(--color-admin-shadow)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
              #{question.id} · {question.topic?.name ?? "Konu yok"}
              {question.q_version ? ` · v${question.q_version}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={question.status} />
              {question.approval_status ? <SoftBadge>{question.approval_status === "approved" ? "Onaylı" : "Geri gönderilmiş"}</SoftBadge> : null}
              {question.is_past_exam_question ? <SoftBadge>Çıkmış soru</SoftBadge> : null}
              {question.is_free ? <SoftBadge>Free preview</SoftBadge> : null}
            </div>
            {editing ? (
              <p className="mt-2 text-xs font-bold text-amber-700">
                Düzenleme modunda gezinme ve silme kapalıdır; önce kaydet veya vazgeç.
              </p>
            ) : null}
          </div>

          {editing ? (
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-black text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:opacity-45"
                disabled={busy}
                onClick={() => {
                  setDraft(createQuestionDraft(question));
                  setEditError(null);
                  setEditing(false);
                }}
                type="button"
              >
                <X size={14} />
                Vazgeç
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-admin-accent)] px-3 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:opacity-45"
                disabled={busy}
                onClick={() => void handleSave()}
                type="button"
              >
                <Save size={14} />
                Kaydet
              </button>
            </div>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-4">
            {editError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {editError}
              </div>
            ) : null}

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                Soru kökü
              </span>
              <textarea
                className="admin-input mt-2 min-h-36 resize-y text-base font-bold leading-7"
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, question_text: event.target.value }))}
                value={draft.question_text}
              />
            </label>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Şıklar</p>
              <div className="mt-2 grid gap-2.5">
                {draft.options.map((option) => (
                  <div
                    className={`grid gap-2 rounded-2xl border px-4 py-3 md:grid-cols-[44px_1fr] ${
                      option.is_correct
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]"
                    }`}
                    key={option.label}
                  >
                    <button
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black transition ${
                        option.is_correct
                          ? "bg-emerald-500 text-white"
                          : "bg-white text-[var(--color-admin-muted)] hover:text-[var(--color-admin-accent)]"
                      }`}
                      disabled={busy}
                      onClick={() => setCorrectOption(option.label)}
                      title="Doğru cevap yap"
                      type="button"
                    >
                      {option.label}
                    </button>
                    <input
                      className="admin-input text-sm font-semibold"
                      disabled={busy}
                      onChange={(event) => updateDraftOption(option.label, { option_text: event.target.value })}
                      value={option.option_text}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Çözüm / Açıklama</p>
              <div className="mt-3 grid gap-3">
                <EditableExplanationField
                  disabled={busy}
                  label="Dayanak"
                  onChange={(value) => setDraft((current) => ({ ...current, explanation_basis: value }))}
                  value={draft.explanation_basis}
                />
                <EditableExplanationField
                  disabled={busy}
                  label="İlgili hüküm"
                  onChange={(value) => setDraft((current) => ({ ...current, explanation_relevant_provision: value }))}
                  value={draft.explanation_relevant_provision}
                />
                <EditableExplanationField
                  disabled={busy}
                  label="Cevap bağlantısı"
                  onChange={(value) => setDraft((current) => ({ ...current, explanation_answer_link: value }))}
                  value={draft.explanation_answer_link}
                />
                <EditableExplanationField
                  disabled={busy}
                  label="Düz açıklama"
                  onChange={(value) => setDraft((current) => ({ ...current, explanation_text: value }))}
                  value={draft.explanation_text}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <QuestionTextBlock text={question.question_text ?? ""} />

            <div className="mt-5 grid gap-2.5">
              {(question.options ?? []).map((option) => (
                <div
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                    option.is_correct
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]"
                  }`}
                  key={`${question.id}-${option.label}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      option.is_correct ? "bg-emerald-500 text-white" : "bg-white text-[var(--color-admin-muted)]"
                    }`}
                  >
                    {option.label}
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-6 text-[var(--color-admin-ink)]">
                    {option.option_text}
                  </p>
                </div>
              ))}
            </div>

            {correctOption ? <p className="mt-3 text-xs font-bold text-emerald-700">Doğru cevap: {correctOption.label}</p> : null}

            {hasStructuredExplanation || fallbackExplanation ? (
              <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Çözüm / Açıklama</p>
                {hasStructuredExplanation ? (
                  <div className="mt-3 divide-y divide-sky-100 overflow-hidden rounded-xl border border-sky-100 bg-white/70">
                    {explanationRows.map((row) => (
                      <div className="grid gap-1 px-3 py-2.5 md:grid-cols-[145px_1fr] md:gap-3" key={row.label}>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">{row.label}</p>
                        <p className="whitespace-pre-line text-sm font-semibold leading-6 text-sky-950">{row.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-sky-950">{fallbackExplanation}</p>
                )}
              </div>
            ) : null}
          </>
        )}
      </article>

      <button
        aria-label="Sonraki soru"
        className="absolute right-4 top-0 flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 text-sm font-black text-[var(--color-admin-ink)] shadow-sm transition hover:border-[var(--color-admin-accent)] disabled:opacity-25"
        disabled={controlsDisabled || currentIndex >= total - 1}
        onClick={onNext}
        type="button"
      >
        Sonraki
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

async function fetchSubjectQuestions(token: string, subjectId: number): Promise<AdminQuestion[]> {
  const questions: AdminQuestion[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const params = new URLSearchParams({
      subject_id: String(subjectId),
      question_type: "multiple_choice",
      per_page: "500",
      page: String(page),
    });

    const response = await adminApiRequest<QuestionsResponse>(`/admin/questions?${params.toString()}`, { token });
    questions.push(...response.data.questions);

    const pagination = parsePagination(response.meta.pagination);
    lastPage = pagination?.last_page ?? page;
    page += 1;
  } while (page <= lastPage);

  return questions;
}

function sortQuestionsForPreview(questions: AdminQuestion[]) {
  return [...questions].sort((left, right) => {
    const leftTopic = left.topic?.name ?? "";
    const rightTopic = right.topic?.name ?? "";

    return leftTopic.localeCompare(rightTopic, "tr") || left.topic_id - right.topic_id || left.id - right.id;
  });
}

function parsePagination(value: unknown): AdminPaginationMeta | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const meta = value as Partial<AdminPaginationMeta>;

  if (typeof meta.last_page !== "number") {
    return null;
  }

  return meta as AdminPaginationMeta;
}

function normalizedExplanationPart(value?: string | null) {
  const normalized = (value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}

function createQuestionDraft(question: AdminQuestion): EditableQuestionDraft {
  return {
    question_text: question.question_text ?? "",
    options: normalizeDraftOptions(question),
    explanation_text: question.explanation_text ?? "",
    explanation_basis: question.explanation_basis ?? question.explanation?.basis ?? "",
    explanation_relevant_provision:
      question.explanation_relevant_provision ?? question.explanation?.relevant_provision ?? "",
    explanation_answer_link: question.explanation_answer_link ?? question.explanation?.answer_link ?? "",
  };
}

function normalizeDraftOptions(question: AdminQuestion): EditableQuestionDraft["options"] {
  const sourceOptions = question.options?.length
    ? [...question.options].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    : ["A", "B", "C", "D", "E"].map((label) => ({
        label,
        option_text: "",
        is_correct: question.correct_answer_text === label,
      }));

  return sourceOptions.map((option) => ({
    label: option.label,
    option_text: option.option_text,
    is_correct: option.is_correct,
  }));
}

function buildQuestionUpdatePayload(question: AdminQuestion, draft: EditableQuestionDraft) {
  const correctOption = draft.options.find((option) => option.is_correct);
  const explanationText = buildExplanationText(draft);

  return {
    topic_id: question.topic_id,
    question_type: question.question_type,
    q_version: question.q_version ?? null,
    difficulty: question.difficulty,
    status: question.status,
    is_free: question.is_free ?? false,
    free_preview_order: question.free_preview_order ?? null,
    is_past_exam_question: question.is_past_exam_question ?? false,
    question_text: draft.question_text.trim(),
    correct_answer_text: correctOption?.option_text.trim() || question.correct_answer_text || "",
    explanation_text: explanationText,
    explanation_basis: draft.explanation_basis.trim() || null,
    explanation_relevant_provision: draft.explanation_relevant_provision.trim() || null,
    explanation_answer_link: draft.explanation_answer_link.trim() || null,
    review_flags: question.review_flags ?? [],
    review_note: question.review_note ?? null,
    approval_status: question.approval_status ?? null,
    published_at: question.published_at ?? null,
    options: draft.options.map((option) => ({
      label: option.label,
      option_text: option.option_text.trim(),
      is_correct: option.is_correct,
    })),
  };
}

function buildExplanationText(draft: EditableQuestionDraft) {
  const rows = [
    ["Dayanak", draft.explanation_basis],
    ["İlgili Hüküm", draft.explanation_relevant_provision],
    ["Cevap Bağlantısı", draft.explanation_answer_link],
  ]
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value.length > 0);

  if (rows.length > 0) {
    return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  }

  return draft.explanation_text.trim();
}

function validateDraft(draft: EditableQuestionDraft) {
  if (!draft.question_text.trim()) {
    return "Soru kökü boş olamaz.";
  }

  if (draft.options.length !== 5) {
    return "Çoktan seçmeli soruda 5 şık olmalı.";
  }

  if (draft.options.some((option) => !option.option_text.trim())) {
    return "Şık metinleri boş olamaz.";
  }

  if (draft.options.filter((option) => option.is_correct).length !== 1) {
    return "Tek bir doğru cevap seçmelisin.";
  }

  if (!buildExplanationText(draft)) {
    return "Açıklama için en az bir alan doldurulmalı.";
  }

  return null;
}

function EditableExplanationField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">{label}</span>
      <textarea
        className="admin-input mt-1 min-h-20 resize-y text-sm font-semibold leading-6"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

const ROMAN_MARKER = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/u;

function QuestionTextBlock({ text }: { text: string }) {
  const parsed = parseQuestionText(text);

  if (parsed.premises.length === 0) {
    return (
      <h2 className="whitespace-pre-line text-[1.28rem] font-extrabold leading-snug tracking-[-0.03em] text-[var(--color-admin-ink)]">
        {text}
      </h2>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]">
        {parsed.premises.map((premise) => (
          <div className="border-b border-[var(--color-admin-line)] px-4 py-3 last:border-b-0" key={premise.marker}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 min-w-8 items-center justify-center rounded-full bg-white text-xs font-black text-[var(--color-admin-accent)] shadow-sm">
                {premise.marker}
              </span>
              <p className="text-sm font-bold leading-7 text-[var(--color-admin-ink)]">{premise.content}</p>
            </div>
          </div>
        ))}
      </div>

      {parsed.prompt ? (
        <h2 className="text-[1.28rem] font-extrabold leading-snug tracking-[-0.03em] text-[var(--color-admin-ink)]">
          {parsed.prompt}
        </h2>
      ) : null}
    </div>
  );
}

function parseQuestionText(text: string) {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1 && lines[0] && ROMAN_MARKER.test(lines[0])) {
    const premises: Array<{ marker: string; content: string }> = [];
    const promptLines: string[] = [];

    lines.forEach((line) => {
      const match = line.match(ROMAN_MARKER);
      if (match && promptLines.length === 0) {
        premises.push({
          marker: match[1],
          content: line.replace(ROMAN_MARKER, "").trim(),
        });
        return;
      }

      promptLines.push(line);
    });

    return {
      premises,
      prompt: promptLines.join(" "),
    };
  }

  const inlinePremise = parseInlinePremises(text);
  if (inlinePremise.premises.length > 1) {
    return inlinePremise;
  }

  return {
    premises: [],
    prompt: text,
  };
}

function parseInlinePremises(text: string) {
  const matches = [...text.matchAll(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/gu)];

  if (matches.length < 2 || matches[0]?.index !== 0) {
    return {
      premises: [],
      prompt: text,
    };
  }

  const premises: Array<{ marker: string; content: string }> = [];
  let prompt = "";

  matches.forEach((match, index) => {
    const marker = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const nextStart = matches[index + 1]?.index;
    let raw = text.slice(start, nextStart ?? text.length).trim();

    if (index === matches.length - 1) {
      const split = raw.match(
        /^([\s\S]+?[.!?])\s+((?:T\.C\.|Türkiye Cumhuriyeti|[0-9]{3,4}\s+sayılı|[A-ZÇĞİÖŞÜ][\s\S]{0,140}?(?:Kanunu|Yönetmeliği|Anayasası))[\s\S]*)$/u,
      );

      if (split) {
        raw = split[1].trim();
        prompt = split[2].trim();
      }
    }

    premises.push({
      marker,
      content: raw,
    });
  });

  return {
    premises,
    prompt,
  };
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "draft"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${className}`}>
      {status === "active" ? "Aktif" : status === "draft" ? "Taslak" : "Pasif"}
    </span>
  );
}

function SoftBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-1 text-[11px] font-black text-[var(--color-admin-muted)]">
      {children}
    </span>
  );
}

export function CenteredLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
      <div className="rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-8 py-7 text-center shadow-[var(--color-admin-shadow)]">
        <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-admin-line)] border-t-[var(--color-admin-accent)]" />
        <p className="mt-4 text-sm font-bold text-[var(--color-admin-muted)]">{label}</p>
      </div>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
      {message}
    </div>
  );
}
