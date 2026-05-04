"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, RotateCcw, X } from "lucide-react";
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
        const response = await adminApiRequest<SubjectsResponse>("/admin/subjects", { token });
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
      setRejectModalOpen(false);

      try {
        const nextQuestions = await fetchApprovalQueue(currentToken, currentSubjectId);

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
  }, [selectedSubjectId, token]);

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

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedSubjects.map((subject) => {
              const totalQuestions = subject.question_count ?? 0;
              const approvedCount = subject.approved_question_count ?? 0;
              const rejectedCount = subject.rejected_question_count ?? 0;
              const pendingCount = subject.pending_approval_question_count ?? 0;
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
            onApprove={() => void approveCurrent()}
            onNext={goNext}
            onPrevious={goPrevious}
            onReject={() => setRejectModalOpen(true)}
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

async function fetchApprovalQueue(token: string, subjectId: number): Promise<AdminQuestion[]> {
  const questions: AdminQuestion[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const params = new URLSearchParams({
      subject_id: String(subjectId),
      approval_status: "unreviewed",
      order: "approval_queue",
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
  onNext,
  onPrevious,
  onReject,
  question,
  total,
}: {
  busy: boolean;
  currentIndex: number;
  onApprove: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReject: () => void;
  question: AdminQuestion;
  total: number;
}) {
  const correctOption = question.options?.find((option) => option.is_correct);

  return (
    <div className="relative w-full max-w-5xl px-20 pt-16">
      <button
        aria-label="Önceki soru"
        className="absolute left-4 top-0 flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 text-sm font-black text-[var(--color-admin-ink)] shadow-sm transition hover:border-[var(--color-admin-accent)] disabled:opacity-25"
        disabled={busy || currentIndex === 0}
        onClick={onPrevious}
        type="button"
      >
        <ArrowLeft size={18} />
        Önceki
      </button>

      <button
        className="absolute left-1/2 top-0 flex h-11 -translate-x-[calc(100%+0.35rem)] items-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:opacity-45"
        disabled={busy}
        onClick={onReject}
        title="Geri gönder"
        type="button"
      >
        <RotateCcw size={17} />
        Geri gönder
      </button>

      <button
        className="absolute left-1/2 top-0 flex h-11 translate-x-[0.35rem] items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-45"
        disabled={busy}
        onClick={onApprove}
        title="Onayla"
        type="button"
      >
        <Check size={18} />
        Onayla
      </button>

      <article className="rounded-[28px] border border-[var(--color-admin-line)] bg-white px-7 py-6 shadow-[var(--color-admin-shadow)]">
        <div>
          <h2 className="text-[1.28rem] font-extrabold leading-snug tracking-[-0.03em] text-[var(--color-admin-ink)]">
            {question.question_text}
          </h2>

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

          {question.explanation_text ? (
            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Açıklama</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-sky-950">
                {question.explanation_text}
              </p>
            </div>
          ) : null}
        </div>
      </article>

      <button
        aria-label="Sonraki soru"
        className="absolute right-4 top-0 flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 text-sm font-black text-[var(--color-admin-ink)] shadow-sm transition hover:border-[var(--color-admin-accent)] disabled:opacity-25"
        disabled={busy || currentIndex >= total - 1}
        onClick={onNext}
        type="button"
      >
        Sonraki
        <ArrowRight size={18} />
      </button>
    </div>
  );
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
