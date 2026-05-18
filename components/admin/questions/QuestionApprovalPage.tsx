"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Pencil, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPaginationMeta, AdminQuestion, AdminSubject } from "@/lib/types";

type FeedbackValue =
  | "obvious_answer"
  | "bad_question_form"
  | "low_quality"
  | "needs_rewrite"
  | "wrong_answer";

type QuestionsResponse = {
  questions: AdminQuestion[];
};

type EditableQuestionDraft = {
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

type SubjectsResponse = {
  subjects: AdminSubject[];
};

const feedbackOptions: Array<{ value: FeedbackValue; label: string; description: string }> = [
  {
    value: "obvious_answer",
    label: "Cevap çok açık belli",
    description: "Doğru seçenek, soru kökünden veya şıklardan fazla kolay seçiliyor.",
  },
  {
    value: "bad_question_form",
    label: "Soru şekli doğru değil",
    description: "Soru kökü, ifade biçimi veya seçenek düzeni sınav formatına uymuyor.",
  },
  {
    value: "low_quality",
    label: "Soru kaliteli değil",
    description: "Soru ölçme değeri düşük, fazla yüzeysel veya zayıf kalıyor.",
  },
  {
    value: "needs_rewrite",
    label: "Yeniden yazılmalı",
    description: "Fikir doğru olabilir ama soru komple elden geçirilmeli.",
  },
  {
    value: "wrong_answer",
    label: "Cevap hatalı olabilir",
    description: "Doğru cevap, şık veya açıklama tarafında şüphe var.",
  },
];

export function QuestionApprovalPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [qVersionFilter, setQVersionFilter] = useState<"all" | "5">("all");
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects],
  );
  const sortedSubjects = useMemo(
    () =>
      [...subjects].sort((left, right) => {
        const leftPending = left.pending_approval_question_count ?? 0;
        const rightPending = right.pending_approval_question_count ?? 0;
        const leftReviewed = (left.approved_question_count ?? 0) + (left.rejected_question_count ?? 0);
        const rightReviewed = (right.approved_question_count ?? 0) + (right.rejected_question_count ?? 0);

        if ((leftPending === 0) !== (rightPending === 0)) {
          return leftPending === 0 ? 1 : -1;
        }

        return rightReviewed - leftReviewed || left.name.localeCompare(right.name, "tr");
      }),
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
        const params = new URLSearchParams({
          question_type: "multiple_choice",
        });

        if (qVersionFilter !== "all") {
          params.set("q_version", qVersionFilter);
        }

        const response = await adminApiRequest<SubjectsResponse>(`/admin/subjects?${params.toString()}`, { token });
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
  }, [qVersionFilter, token]);

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
      setRejectModalOpen(false);

      try {
        const nextQuestions = await fetchApprovalQueue(currentToken, currentSubjectId, qVersionFilter);

        if (!ignore) {
          setQuestions(nextQuestions);
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
  }, [qVersionFilter, selectedSubjectId, token]);

  function goPrevious() {
    setCurrentIndex((current) => Math.max(current - 1, 0));
  }

  function goNext() {
    setCurrentIndex((current) => Math.min(current + 1, Math.max(total - 1, 0)));
  }

  async function approveCurrent() {
    if (!currentQuestion) {
      return;
    }

    await updateCurrentApproval(currentQuestion, "approved");
  }

  async function rejectCurrent(feedback: FeedbackValue) {
    if (!currentQuestion) {
      return;
    }

    await updateCurrentApproval(currentQuestion, "rejected", [feedback]);
  }

  async function rejectCurrentWithNote(note: string) {
    if (!currentQuestion) {
      return;
    }

    await updateCurrentApproval(currentQuestion, "rejected", [], note);
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

      removeQuestionFromQueue(question.id);
      decrementSubjectQuestionCounts(question);
      setRejectModalOpen(false);
      showToast({
        tone: "success",
        title: "Soru silindi",
        description: question.topic?.subject?.name ?? selectedSubject?.name ?? "Soru kuyruğu",
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

      setQuestions((current) =>
        current.map((item) => (item.id === question.id ? response.data.question : item)),
      );
      showToast({
        tone: "success",
        title: "Soru güncellendi",
        description: "Değişiklikler onay kuyruğundaki soruya işlendi.",
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

  async function updateCurrentApproval(
    question: AdminQuestion,
    approvalStatus: "approved" | "rejected",
    reviewFlags: FeedbackValue[] = [],
    reviewNote: string | null = null,
  ) {
    if (!token || busy) {
      return;
    }

    setBusy(true);

    try {
      await adminApiRequest<{ question: AdminQuestion }>(`/admin/questions/${question.id}/approval`, {
        token,
        method: "POST",
        body: {
          approval_status: approvalStatus,
          review_flags: reviewFlags,
          review_note: reviewNote,
        },
      });

      removeQuestionFromQueue(question.id);
      setRejectModalOpen(false);
      showToast({
        tone: approvalStatus === "approved" ? "success" : "warning",
        title: approvalStatus === "approved" ? "Soru onaylandı" : "Soru geri gönderildi",
        description: question.topic?.subject?.name ?? selectedSubject?.name ?? "Soru kuyruğu",
      });
    } catch (saveError) {
      showToast({
        tone: "error",
        title: "İşlem kaydedilemedi",
        description: saveError instanceof Error ? saveError.message : "Soru onay durumu güncellenemedi.",
      });
    } finally {
      setBusy(false);
    }
  }

  function removeQuestionFromQueue(questionId: number) {
    setQuestions((current) => {
      const next = current.filter((question) => question.id !== questionId);
      setCurrentIndex((index) => Math.min(index, Math.max(next.length - 1, 0)));

      return next;
    });
  }

  function decrementSubjectQuestionCounts(question: AdminQuestion) {
    const subjectId = question.topic?.subject?.id ?? selectedSubjectId;

    if (!subjectId) {
      return;
    }

    setSubjects((current) =>
      current.map((subject) => {
        if (subject.id !== subjectId) {
          return subject;
        }

        return {
          ...subject,
          question_count: Math.max((subject.question_count ?? 0) - 1, 0),
          pending_approval_question_count: Math.max((subject.pending_approval_question_count ?? 0) - 1, 0),
        };
      }),
    );
  }

  if (subjectsLoading) {
    return (
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
        <div className="rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-8 py-7 text-center shadow-[var(--color-admin-shadow)]">
          <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-admin-line)] border-t-[var(--color-admin-accent)]" />
          <p className="mt-4 text-sm font-bold text-[var(--color-admin-muted)]">Dersler yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!selectedSubjectId) {
    return (
      <div className="space-y-5">
        {error ? <ErrorMessage message={error} /> : null}
        <section className="admin-card p-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--color-admin-muted)]">
              Soru onay kuyruğu
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
              Önce ders seç
            </h1>
            <p className="mt-1 text-sm font-medium text-[var(--color-admin-muted)]">
              Seçtiğin derse ait onay durumu belirlenmemiş sorular sırayla gelecek.
            </p>
          </div>

          <div className="mt-5 max-w-xs">
            <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
              Üretim versiyonu
            </label>
            <select
              className="admin-input mt-2 h-11 appearance-none pr-9 text-sm font-bold"
              onChange={(event) => setQVersionFilter(event.target.value as typeof qVersionFilter)}
              value={qVersionFilter}
            >
              <option value="all">Tüm sorular</option>
              <option value="5">Sadece v5 yeni üretim</option>
            </select>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedSubjects.map((subject) => {
              const totalQuestions = subject.question_count ?? 0;
              const approvedCount = subject.approved_question_count ?? 0;
              const rejectedCount = subject.rejected_question_count ?? 0;
              const pendingCount = subject.pending_approval_question_count ?? 0;
              const revisedPendingCount = subject.revised_pending_approval_question_count ?? 0;
              const reviewedCount = approvedCount + rejectedCount;
              const progressPct = totalQuestions > 0 ? Math.round((reviewedCount / totalQuestions) * 100) : 0;
              const completed = pendingCount === 0;

              return (
                <button
                  className={`group rounded-2xl border px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                    completed
                      ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
                      : "border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] hover:border-[var(--color-admin-accent)]"
                  }`}
                  key={subject.id}
                  onClick={() => setSelectedSubjectId(subject.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {subject.code ? (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                            completed
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                          }`}>
                            {subject.code}
                          </span>
                        ) : null}
                        <span className={`truncate text-sm font-extrabold ${
                          completed ? "text-emerald-950" : "text-[var(--color-admin-ink)]"
                        }`}>
                          {subject.name}
                        </span>
                      </div>
                      <p className={`mt-1 text-xs font-semibold ${
                        completed ? "text-emerald-700" : "text-[var(--color-admin-muted)]"
                      }`}>
                        {pendingCount} bekleyen · {approvedCount} onay · {rejectedCount} geri
                      </p>
                      {revisedPendingCount > 0 ? (
                        <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800">
                          {revisedPendingCount} revize tekrar onayda
                        </span>
                      ) : null}
                    </div>
                    <ArrowRight className={`shrink-0 transition group-hover:translate-x-1 ${
                      completed ? "text-emerald-600" : "text-[var(--color-admin-muted)] group-hover:text-[var(--color-admin-accent)]"
                    }`} size={18} />
                  </div>

                  <div className={`mt-3 h-2 overflow-hidden rounded-full ${
                    completed ? "bg-emerald-100" : "bg-white"
                  }`}>
                    <div
                      className={`h-full rounded-full ${completed ? "bg-emerald-500" : "bg-[var(--color-admin-accent)]"}`}
                      style={{ width: `${Math.min(progressPct, 100)}%` }}
                    />
                  </div>
                  <p className={`mt-2 text-[11px] font-black ${
                    completed ? "text-emerald-700" : "text-[var(--color-admin-muted)]"
                  }`}>
                    {reviewedCount}/{totalQuestions} incelendi
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-9rem)]">
      {error ? <ErrorMessage message={error} /> : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-bold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
          disabled={busy}
          onClick={() => setSelectedSubjectId(null)}
          type="button"
        >
          <ChevronLeft size={14} />
          Ders değiştir
        </button>
        <p className="text-xs font-bold text-[var(--color-admin-muted)]">
          {qVersionFilter !== "all" ? `v${qVersionFilter} · ` : ""}
          {questionsLoading ? "Yükleniyor" : `${currentIndex + (total > 0 ? 1 : 0)} / ${total}`}
        </p>
      </div>

      <div className="flex min-h-[calc(100vh-13.5rem)] items-center justify-center">
        {questionsLoading ? (
          <div className="rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-8 py-7 text-center shadow-[var(--color-admin-shadow)]">
            <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-admin-line)] border-t-[var(--color-admin-accent)]" />
            <p className="mt-4 text-sm font-bold text-[var(--color-admin-muted)]">Onay kuyruğu hazırlanıyor...</p>
          </div>
        ) : currentQuestion ? (
          <QuestionCard
            busy={busy}
            currentIndex={currentIndex}
            key={currentQuestion.id}
            onApprove={() => void approveCurrent()}
            onDelete={() => void deleteCurrent()}
            onNext={goNext}
            onPrevious={goPrevious}
            onReject={() => setRejectModalOpen(true)}
            onSave={(draft) => saveQuestionEdits(currentQuestion, draft)}
            question={currentQuestion}
            total={total}
          />
        ) : (
          <div className="max-w-xl rounded-[30px] border border-emerald-200 bg-emerald-50 px-8 py-10 text-center shadow-[var(--color-admin-shadow)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-500 text-white">
              <Check size={26} />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-emerald-950">Bu derste bekleyen soru yok</h2>
            <p className="mt-2 text-sm font-semibold text-emerald-700">
              Onay durumu belirlenmemiş tüm sorular bitmiş görünüyor.
            </p>
            <button className="admin-button admin-button-secondary mx-auto mt-6" onClick={() => setSelectedSubjectId(null)} type="button">
              Başka ders seç
            </button>
          </div>
        )}
      </div>

      {rejectModalOpen && currentQuestion ? (
        <RejectModal
          busy={busy}
          onClose={() => setRejectModalOpen(false)}
          onReject={(feedback) => void rejectCurrent(feedback)}
          onRejectWithNote={(note) => void rejectCurrentWithNote(note)}
          question={currentQuestion}
        />
      ) : null}
    </div>
  );
}

async function fetchApprovalQueue(token: string, subjectId: number, qVersionFilter: "all" | "5"): Promise<AdminQuestion[]> {
  const questions: AdminQuestion[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const params = new URLSearchParams({
      subject_id: String(subjectId),
      question_type: "multiple_choice",
      status: "active",
      approval_status: "unreviewed",
      order: "approval_queue",
      per_page: "500",
      page: String(page),
    });
    if (qVersionFilter !== "all") {
      params.set("q_version", qVersionFilter);
    }

    const response = await adminApiRequest<QuestionsResponse>(`/admin/questions?${params.toString()}`, { token });
    questions.push(...response.data.questions);

    const pagination = parsePagination(response.meta.pagination);
    lastPage = pagination?.last_page ?? page;
    page += 1;
  } while (page <= lastPage);

  return questions;
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

function QuestionCard({
  busy,
  currentIndex,
  onApprove,
  onDelete,
  onNext,
  onPrevious,
  onReject,
  onSave,
  question,
  total,
}: {
  busy: boolean;
  currentIndex: number;
  onApprove: () => void;
  onDelete: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReject: () => void;
  onSave: (draft: EditableQuestionDraft) => Promise<boolean>;
  question: AdminQuestion;
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
  const isRevisedPending = question.approval_revision_status === "revised_pending_review";
  const previousReviewNote = normalizedExplanationPart(question.review_note);

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
    <div className="relative w-full max-w-5xl px-20 pt-16">
      <button
        aria-label="Önceki soru"
        className="absolute left-4 top-0 flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 text-sm font-black text-[var(--color-admin-ink)] shadow-sm transition hover:border-[var(--color-admin-accent)] disabled:opacity-25"
        disabled={controlsDisabled || currentIndex === 0}
        onClick={onPrevious}
        type="button"
      >
        <ArrowLeft size={18} />
        Önceki
      </button>

      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-2">
        <button
          className="flex h-11 items-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:opacity-45"
          disabled={controlsDisabled}
          onClick={onReject}
          title="Geri gönder"
          type="button"
        >
          <RotateCcw size={17} />
          Geri gönder
        </button>

        <button
          className="flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-950 disabled:opacity-45"
          disabled={controlsDisabled}
          onClick={onDelete}
          title="Sil"
          type="button"
        >
          <Trash2 size={17} />
          Sil
        </button>

        <button
          className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-45"
          disabled={controlsDisabled}
          onClick={onApprove}
          title="Onayla"
          type="button"
        >
          <Check size={18} />
          Onayla
        </button>
      </div>

      <article className="rounded-[28px] border border-[var(--color-admin-line)] bg-white px-7 py-6 shadow-[var(--color-admin-shadow)]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                #{question.id} · {question.topic?.name ?? "Konu yok"}
                {question.q_version ? ` · v${question.q_version}` : ""}
              </p>
              {isRevisedPending ? (
                <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-800">
                  Düzenlendi, tekrar onayda
                </span>
              ) : null}
              {editing ? (
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Düzenleme modunda onay/ret/sil kapalıdır; önce kaydet veya vazgeç.
                </p>
              ) : null}
            </div>

            {editing ? (
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-white px-3 py-2 text-xs font-black text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:opacity-45"
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
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-black text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]"
                disabled={busy}
                onClick={() => setEditing(true)}
                type="button"
              >
                <Pencil size={14} />
                Düzenle
              </button>
            )}
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
                  className="admin-input mt-2 min-h-36 resize-y bg-white text-base font-bold leading-7"
                  disabled={busy}
                  onChange={(event) => setDraft((current) => ({ ...current, question_text: event.target.value }))}
                  value={draft.question_text}
                />
              </label>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                  Şıklar
                </p>
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
                        className="admin-input bg-white text-sm font-semibold"
                        disabled={busy}
                        onChange={(event) => updateDraftOption(option.label, { option_text: event.target.value })}
                        value={option.option_text}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs font-bold text-[var(--color-admin-muted)]">
                  Doğru cevabı değiştirmek için şık harfinin yuvarlağına tıkla.
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">
                  Çözüm / Açıklama
                </p>
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
              {isRevisedPending || previousReviewNote || question.approval_revision_note ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-800">
                    Revizyon bilgisi
                  </p>
                  {question.approval_revision_note ? (
                    <p className="mt-1 whitespace-pre-line text-sm font-bold leading-6 text-amber-950">
                      {question.approval_revision_note}
                    </p>
                  ) : null}
                  {previousReviewNote ? (
                    <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-amber-900">
                      <span className="font-black">Önceki geri gönderim notu:</span> {previousReviewNote}
                    </p>
                  ) : null}
                </div>
              ) : null}

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

              {correctOption ? (
                <p className="mt-3 text-xs font-bold text-emerald-700">Doğru cevap: {correctOption.label}</p>
              ) : null}

              {hasStructuredExplanation || fallbackExplanation ? (
                <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Çözüm / Açıklama</p>
                  {hasStructuredExplanation ? (
                    <div className="mt-3 divide-y divide-sky-100 overflow-hidden rounded-xl border border-sky-100 bg-white/70">
                      {explanationRows.map((row) => (
                        <div className="grid gap-1 px-3 py-2.5 md:grid-cols-[145px_1fr] md:gap-3" key={row.label}>
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">
                            {row.label}
                          </p>
                          <p className="whitespace-pre-line text-sm font-semibold leading-6 text-sky-950">
                            {row.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-sky-950">
                      {fallbackExplanation}
                    </p>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </article>

      <button
        aria-label="Sonraki soru"
        className="absolute right-4 top-0 flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 text-sm font-black text-[var(--color-admin-ink)] shadow-sm transition hover:border-[var(--color-admin-accent)] disabled:opacity-25"
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
        className="admin-input mt-1 min-h-20 resize-y bg-white text-sm font-semibold leading-6"
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
              <p className="text-sm font-bold leading-7 text-[var(--color-admin-ink)]">
                {premise.content}
              </p>
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

function RejectModal({
  busy,
  onClose,
  onReject,
  onRejectWithNote,
  question,
}: {
  busy: boolean;
  onClose: () => void;
  onReject: (feedback: FeedbackValue) => void;
  onRejectWithNote: (note: string) => void;
  question: AdminQuestion;
}) {
  const [customFeedback, setCustomFeedback] = useState("");
  const canSubmitCustom = customFeedback.trim().length > 0 && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-5 shadow-[var(--color-admin-shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-admin-muted)]">
              Geri gönder
            </p>
            <h3 className="mt-2 text-xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
              Feedback seç
            </h3>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--color-admin-muted)]">
              #{question.id} · {question.question_text}
            </p>
          </div>
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {feedbackOptions.map((option) => (
            <button
              className="group flex w-full items-start gap-3 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-55"
              disabled={busy}
              key={option.value}
              onClick={() => onReject(option.value)}
              type="button"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white">
                <RotateCcw size={15} />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-[var(--color-admin-ink)]">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs font-semibold leading-5 text-[var(--color-admin-muted)]">
                  {option.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] p-3">
          <label className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
            Özel feedback
          </label>
          <textarea
            className="admin-input mt-2 min-h-24 resize-none bg-white text-sm"
            disabled={busy}
            onChange={(event) => setCustomFeedback(event.target.value)}
            placeholder="Hazır seçenek yetmiyorsa buraya yaz..."
            value={customFeedback}
          />
          <button
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:opacity-45"
            disabled={!canSubmitCustom}
            onClick={() => onRejectWithNote(customFeedback.trim())}
            type="button"
          >
            <RotateCcw size={16} />
            Bu notla geri gönder
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
      {message}
    </div>
  );
}
