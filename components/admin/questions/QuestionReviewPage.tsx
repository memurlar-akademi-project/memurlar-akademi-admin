"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PauseCircle,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPaginationMeta, AdminQuestion, AdminSubject, AdminTopic } from "@/lib/types";

type QuestionOptionDraft = {
  label: string;
  option_text: string;
  is_correct: boolean;
};

type QuestionDraft = {
  topic_id: string;
  question_type: string;
  q_version: string;
  difficulty: string;
  status: string;
  is_free: boolean;
  free_preview_order: string;
  is_past_exam_question: boolean;
  question_text: string;
  correct_answer_text: string;
  explanation_text: string;
  review_flags: string[];
  review_note: string;
  published_at: string;
  options: QuestionOptionDraft[];
};

const optionLabels = ["A", "B", "C", "D", "E"];
const feedbackOptions = [
  { value: "obvious_answer", label: "Cevap çok açık belli" },
  { value: "bad_question_form", label: "Soru şekli doğru değil" },
  { value: "low_quality", label: "Soru kaliteli değil" },
  { value: "needs_rewrite", label: "Yeniden yazılmalı" },
  { value: "wrong_answer", label: "Cevap hatalı olabilir" },
];
const defaultOptions = (): QuestionOptionDraft[] =>
  optionLabels.map((label, index) => ({
    label,
    option_text: "",
    is_correct: index === 0,
  }));

function normalizeOptions(options?: QuestionOptionDraft[] | null): QuestionOptionDraft[] {
  const optionMap = new Map((options ?? []).map((option) => [option.label, option]));

  return optionLabels.map((label, index) => {
    const existing = optionMap.get(label);

    return {
      label,
      option_text: existing?.option_text ?? "",
      is_correct: existing?.is_correct ?? index === 0,
    };
  });
}

function toDateValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toDraft(question: AdminQuestion): QuestionDraft {
  return {
    topic_id: String(question.topic_id),
    question_type: question.question_type,
    q_version: question.q_version ? String(question.q_version) : "",
    difficulty: question.difficulty,
    status: question.status,
    is_free: Boolean(question.is_free),
    free_preview_order: question.free_preview_order ? String(question.free_preview_order) : "",
    is_past_exam_question: Boolean(question.is_past_exam_question),
    question_text: question.question_text ?? "",
    correct_answer_text: question.correct_answer_text ?? (question.question_type === "true_false" ? "true" : "A"),
    explanation_text: question.explanation_text ?? "",
    review_flags: question.review_flags ?? [],
    review_note: question.review_note ?? "",
    published_at: toDateValue(question.published_at),
    options:
      question.question_type === "multiple_choice"
        ? normalizeOptions(
            question.options?.map((option) => ({
              label: option.label,
              option_text: option.option_text,
              is_correct: option.is_correct,
            })),
          )
        : [],
  };
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

function statusTone(status: string) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

function statusLabel(status: string) {
  if (status === "active") {
    return "Aktif";
  }

  if (status === "draft") {
    return "Taslak";
  }

  return "Pasif";
}

export function QuestionReviewPage() {
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("active");
  const [qVersionFilter, setQVersionFilter] = useState<"all" | "5">("all");
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number | null }>({ loaded: 0, total: null });
  const [error, setError] = useState<string | null>(null);

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const subjectTopics = useMemo(
    () => topics.filter((topic) => topic.subject_id === selectedSubjectId),
    [selectedSubjectId, topics],
  );
  const currentQuestion = questions[currentIndex] ?? null;
  const completionPercent = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  useEffect(() => {
    setTitle("Soru İnceleme");

    return () => setTitle(null);
  }, [setTitle]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoadingBase(true);
      setError(null);

      try {
        const [subjectsResponse, topicsResponse] = await Promise.all([
          adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
        ]);

        if (cancelled) {
          return;
        }

        const nextSubjects = subjectsResponse.data.subjects;
        const nextTopics = topicsResponse.data.topics;
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const requestedSubjectId = Number(params.get("subject_id"));
        const requestedTopicId = Number(params.get("topic_id"));
        const requestedStatus = params.get("status");
        const firstSubjectWithTopic = nextSubjects.find((subject) => nextTopics.some((topic) => topic.subject_id === subject.id));
        const validRequestedSubject = nextSubjects.find((subject) => subject.id === requestedSubjectId);
        const initialSubject = validRequestedSubject ?? firstSubjectWithTopic ?? nextSubjects[0] ?? null;
        const validRequestedTopic = nextTopics.find((topic) => topic.id === requestedTopicId && topic.subject_id === initialSubject?.id);

        setSubjects(nextSubjects);
        setTopics(nextTopics);
        setSelectedSubjectId(initialSubject?.id ?? null);
        setSelectedTopicId(validRequestedTopic?.id ?? null);

        if (requestedStatus === "active" || requestedStatus === "draft" || requestedStatus === "passive") {
          setStatusFilter(requestedStatus);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Soru inceleme verileri yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoadingBase(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (selectedTopicId && !subjectTopics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(null);
    }
  }, [selectedTopicId, subjectTopics]);

  useEffect(() => {
    if (!token || !selectedSubjectId) {
      setQuestions([]);
      setDraft(null);
      setCurrentIndex(0);
      return;
    }

    let cancelled = false;

    async function loadQuestions() {
      setLoadingQuestions(true);
      setError(null);
      setLoadProgress({ loaded: 0, total: null });

      try {
        const loadedQuestions: AdminQuestion[] = [];
        let page = 1;
        let lastPage = 1;

        do {
          const params = new URLSearchParams({
            page: String(page),
            per_page: "500",
            subject_id: String(selectedSubjectId),
            question_type: "multiple_choice",
          });

          if (selectedTopicId) {
            params.set("topic_id", String(selectedTopicId));
          }

          if (statusFilter !== "all") {
            params.set("status", statusFilter);
          }

          if (qVersionFilter !== "all") {
            params.set("q_version", qVersionFilter);
          }

          const response = await adminApiRequest<{ questions: AdminQuestion[] }>(`/admin/questions?${params.toString()}`, { token });
          const pagination = parsePagination(response.meta.pagination);

          loadedQuestions.push(...response.data.questions);
          lastPage = pagination?.last_page ?? page;

          if (!cancelled) {
            setLoadProgress({ loaded: loadedQuestions.length, total: pagination?.total ?? loadedQuestions.length });
          }

          page += 1;
        } while (page <= lastPage);

        if (cancelled) {
          return;
        }

        setQuestions(loadedQuestions);
        setCurrentIndex(0);
        setDraft(loadedQuestions[0] ? toDraft(loadedQuestions[0]) : null);
      } catch (loadError) {
        if (!cancelled) {
          setQuestions([]);
          setDraft(null);
          setCurrentIndex(0);
          setError(loadError instanceof Error ? loadError.message : "Sorular yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoadingQuestions(false);
        }
      }
    }

    void loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [qVersionFilter, selectedSubjectId, selectedTopicId, statusFilter, token]);

  function goToIndex(nextIndex: number) {
    const boundedIndex = Math.min(Math.max(nextIndex, 0), questions.length - 1);
    const nextQuestion = questions[boundedIndex];

    setCurrentIndex(boundedIndex);
    setDraft(nextQuestion ? toDraft(nextQuestion) : null);
  }

  function setOption(label: string, patch: Partial<QuestionOptionDraft>) {
    setDraft((current) => (
      current
        ? {
            ...current,
            options: current.options.map((option) => (
              option.label === label ? { ...option, ...patch } : option
            )),
          }
        : current
    ));
  }

  function setCorrectOption(label: string) {
    setDraft((current) => (
      current
        ? {
            ...current,
            correct_answer_text: label,
            options: current.options.map((option) => ({
              ...option,
              is_correct: option.label === label,
            })),
          }
        : current
    ));
  }

  function toggleFeedback(value: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextFlags = current.review_flags.includes(value)
        ? current.review_flags.filter((item) => item !== value)
        : [...current.review_flags, value];

      return { ...current, review_flags: nextFlags };
    });
  }

  function buildPayload(statusOverride?: string) {
    if (!draft) {
      return null;
    }

    return {
      topic_id: Number(draft.topic_id),
      question_type: draft.question_type,
      q_version: draft.q_version ? Number(draft.q_version) : null,
      difficulty: draft.difficulty,
      status: statusOverride ?? draft.status,
      is_free: draft.is_free,
      free_preview_order: draft.free_preview_order ? Number(draft.free_preview_order) : null,
      is_past_exam_question: draft.is_past_exam_question,
      question_text: draft.question_text,
      correct_answer_text:
        draft.question_type === "true_false"
          ? draft.correct_answer_text
          : draft.options.find((option) => option.is_correct)?.label ?? "A",
      explanation_text: draft.explanation_text,
      review_flags: draft.review_flags,
      review_note: draft.review_note.trim() || null,
      published_at: draft.published_at || null,
      options:
        draft.question_type === "multiple_choice"
          ? draft.options.map((option) => ({
              label: option.label,
              option_text: option.option_text,
              is_correct: option.is_correct,
            }))
          : [],
    };
  }

  async function saveCurrent(statusOverride?: "active" | "draft" | "passive") {
    if (!token || !currentQuestion || !draft) {
      return;
    }

    const payload = buildPayload(statusOverride);
    if (!payload) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ question: AdminQuestion }>(`/admin/questions/${currentQuestion.id}`, {
        token,
        method: "PUT",
        body: payload,
      });

      const nextQuestion = response.data.question;
      setQuestions((current) =>
        current.map((question) => (question.id === nextQuestion.id ? nextQuestion : question)),
      );
      setDraft(toDraft(nextQuestion));

      showToast({
        tone: "success",
        title: statusOverride ? `Soru ${statusLabel(statusOverride).toLocaleLowerCase("tr")} yapıldı` : "Soru kaydedildi",
        description: nextQuestion.topic?.name ?? "Soru havuzu",
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Soru kaydedilemedi.";
      setError(message);
      showToast({ tone: "error", title: "Kayıt başarısız", description: message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrent() {
    if (!token || !currentQuestion) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await adminApiRequest(`/admin/questions/${currentQuestion.id}`, {
        token,
        method: "DELETE",
      });

      const nextQuestions = questions.filter((question) => question.id !== currentQuestion.id);
      const nextIndex = Math.min(currentIndex, Math.max(nextQuestions.length - 1, 0));

      setQuestions(nextQuestions);
      setCurrentIndex(nextIndex);
      setDraft(nextQuestions[nextIndex] ? toDraft(nextQuestions[nextIndex]) : null);
      showToast({ tone: "success", title: "Soru silindi", description: currentQuestion.topic?.name ?? "Soru havuzu" });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Soru silinemedi.";
      setError(message);
      showToast({ tone: "error", title: "Silme başarısız", description: message });
    } finally {
      setDeleting(false);
    }
  }

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: subject.code ? `${subject.code} · ${subject.topic_count} konu` : `${subject.topic_count} konu`,
      })),
    [subjects],
  );
  const topicOptions = useMemo(
    () =>
      subjectTopics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name ?? selectedSubject?.name,
      })),
    [selectedSubject?.name, subjectTopics],
  );

  return (
    <div className="min-h-[calc(100vh-120px)] space-y-5">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end gap-3 rounded-[24px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-4 shadow-sm">
        <div className="min-w-[260px] flex-1">
          <AdminSearchSelect
            emptyText="Ders bulunamadı."
            label="Ders"
            onChange={(value) => {
              setSelectedSubjectId(value);
              setSelectedTopicId(null);
            }}
            options={subjectOptions}
            placeholder="Ders ara"
            value={selectedSubjectId}
          />
        </div>

        <div className="min-w-[260px] flex-1">
          <AdminSearchSelect
            emptyText="Bu derste konu bulunamadı."
            label="Konu"
            onChange={setSelectedTopicId}
            options={topicOptions}
            placeholder="Konu ara"
            value={selectedTopicId}
          />
        </div>

        <label className="block min-w-[180px] space-y-2">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
            Durum
          </span>
          <select
            className="admin-input h-11"
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            value={statusFilter}
          >
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="draft">Taslak</option>
            <option value="passive">Pasif</option>
          </select>
        </label>

        <label className="block min-w-[190px] space-y-2">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
            Versiyon
          </span>
          <select
            className="admin-input h-11"
            onChange={(event) => setQVersionFilter(event.target.value as typeof qVersionFilter)}
            value={qVersionFilter}
          >
            <option value="all">Tüm versiyonlar</option>
            <option value="5">v5 yeni üretim</option>
          </select>
        </label>

        <Link className="admin-button admin-button-secondary mb-[1px]" href="/sorular">
          <ArrowLeft size={16} />
          Liste
        </Link>
      </div>

      <div className="mx-auto w-full max-w-6xl">
        {error ? (
          <div className="mb-4 rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-danger)]">
            {error}
          </div>
        ) : null}

        {loadingBase || loadingQuestions ? (
          <div className="rounded-[32px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-8 text-center shadow-sm">
            <Loader2 className="mx-auto animate-spin text-[var(--color-admin-accent)]" size={34} />
            <h2 className="mt-4 text-lg font-extrabold text-[var(--color-admin-ink)]">Sorular yükleniyor</h2>
            <p className="mt-2 text-sm font-medium text-[var(--color-admin-muted)]">
              {loadProgress.total
                ? `${loadProgress.loaded}/${loadProgress.total} soru alındı.`
                : "Dersin soru havuzu hazırlanıyor."}
            </p>
          </div>
        ) : !currentQuestion || !draft ? (
          <div className="rounded-[32px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-12 text-center">
            <h2 className="text-lg font-extrabold text-[var(--color-admin-ink)]">Bu filtrede soru yok</h2>
            <p className="mt-2 text-sm text-[var(--color-admin-muted)]">Ders, konu veya durum filtresini değiştirerek tekrar deneyebilirsin.</p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-[34px] border border-[var(--color-admin-line)] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
              <button
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)] disabled:cursor-not-allowed disabled:opacity-35"
                disabled={currentIndex === 0 || saving || deleting}
                onClick={() => goToIndex(currentIndex - 1)}
                type="button"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(draft.status)}`}>
                    {statusLabel(draft.status)}
                  </span>
                  {draft.review_flags.length > 0 ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                      {draft.review_flags.length} feedback
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    Soru {currentIndex + 1}/{questions.length}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                    {draft.question_type === "multiple_choice" ? "Çoktan seçmeli" : "Doğru / Yanlış"}
                  </span>
                  {draft.q_version ? (
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
                      v{draft.q_version}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-[var(--color-admin-muted)]">
                  {currentQuestion.topic?.subject?.name ?? selectedSubject?.name ?? "Ders"} · {currentQuestion.topic?.name ?? "Konu"}
                </p>
                <div className="mx-auto mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[var(--color-admin-accent)] transition-all" style={{ width: `${completionPercent}%` }} />
                </div>
              </div>

              <button
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)] disabled:cursor-not-allowed disabled:opacity-35"
                disabled={currentIndex >= questions.length - 1 || saving || deleting}
                onClick={() => goToIndex(currentIndex + 1)}
                type="button"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="px-5 py-6 sm:px-8 lg:px-10">
              <div className="space-y-6">
                <label className="block space-y-3">
                  <span className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">Soru</span>
                  <textarea
                    className="min-h-[150px] w-full resize-y rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-lg font-bold leading-8 text-slate-950 outline-none transition focus:border-[var(--color-admin-accent)] focus:ring-4 focus:ring-[var(--color-admin-accent)]/10"
                    onChange={(event) => setDraft((current) => (current ? { ...current, question_text: event.target.value } : current))}
                    value={draft.question_text}
                  />
                </label>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Soru feedbackleri
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Bu işaretler soruyu silmez; sonradan birlikte kalite tartışması yapmak için kayıt altına alınır.
                      </p>
                    </div>
                    {draft.review_flags.length > 0 ? (
                      <button
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 transition hover:text-slate-900"
                        onClick={() => setDraft((current) => (current ? { ...current, review_flags: [] } : current))}
                        type="button"
                      >
                        Temizle
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {feedbackOptions.map((option) => {
                      const active = draft.review_flags.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                            active
                              ? "border-rose-300 bg-rose-100 text-rose-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-700"
                          }`}
                          onClick={() => toggleFeedback(option.value)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    className="mt-4 min-h-[76px] w-full resize-y rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                    onChange={(event) => setDraft((current) => (current ? { ...current, review_note: event.target.value } : current))}
                    placeholder="İstersen bu soruyla ilgili kısa not düş: neden açık, hangi şık sorunlu, neyi tartışalım?"
                    value={draft.review_note}
                  />
                </div>

                {draft.question_type === "multiple_choice" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">Şıklar</span>
                      <span className="text-xs font-semibold text-slate-500">Doğru cevabı soldaki harften seç.</span>
                    </div>

                    <div className="grid gap-3">
                      {draft.options.map((option) => (
                        <div
                          key={option.label}
                          className={`grid gap-3 rounded-[24px] border p-3 sm:grid-cols-[52px_minmax(0,1fr)] ${
                            option.is_correct ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50/60"
                          }`}
                        >
                          <button
                            className={`flex h-12 w-12 items-center justify-center rounded-full border text-base font-black transition ${
                              option.is_correct
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                            }`}
                            onClick={() => setCorrectOption(option.label)}
                            type="button"
                          >
                            {option.label}
                          </button>
                          <input
                            className="min-h-12 rounded-[18px] border border-transparent bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[var(--color-admin-accent)] focus:ring-4 focus:ring-[var(--color-admin-accent)]/10"
                            onChange={(event) => setOption(option.label, { option_text: event.target.value })}
                            value={option.option_text}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">Cevap</span>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { value: "true", label: "Doğru" },
                        { value: "false", label: "Yanlış" },
                      ].map((item) => (
                        <button
                          key={item.value}
                          className={`rounded-2xl border px-5 py-3 text-sm font-black transition ${
                            draft.correct_answer_text === item.value
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                          onClick={() => setDraft((current) => (current ? { ...current, correct_answer_text: item.value } : current))}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="block space-y-3">
                  <span className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">Çözüm / Açıklama</span>
                  <textarea
                    className="min-h-[110px] w-full resize-y rounded-[24px] border border-slate-200 bg-slate-50/70 px-5 py-4 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-[var(--color-admin-accent)] focus:bg-white focus:ring-4 focus:ring-[var(--color-admin-accent)]/10"
                    onChange={(event) => setDraft((current) => (current ? { ...current, explanation_text: event.target.value } : current))}
                    value={draft.explanation_text}
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-4">
                  <label className="space-y-2">
                    <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Konu</span>
                    <select
                      className="admin-input h-11 bg-white"
                      onChange={(event) => setDraft((current) => (current ? { ...current, topic_id: event.target.value } : current))}
                      value={draft.topic_id}
                    >
                      {subjectTopics.map((topic) => (
                        <option key={topic.id} value={topic.id}>{topic.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Zorluk</span>
                    <select
                      className="admin-input h-11 bg-white"
                      onChange={(event) => setDraft((current) => (current ? { ...current, difficulty: event.target.value } : current))}
                      value={draft.difficulty}
                    >
                      <option value="easy">Kolay</option>
                      <option value="medium">Orta</option>
                      <option value="hard">Zor</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Durum</span>
                    <select
                      className="admin-input h-11 bg-white"
                      onChange={(event) => setDraft((current) => (current ? { ...current, status: event.target.value } : current))}
                      value={draft.status}
                    >
                      <option value="active">Aktif</option>
                      <option value="draft">Taslak</option>
                      <option value="passive">Pasif</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Yayın</span>
                    <input
                      className="admin-input h-11 bg-white"
                      onChange={(event) => setDraft((current) => (current ? { ...current, published_at: event.target.value } : current))}
                      type="date"
                      value={draft.published_at}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                  <button className="admin-button admin-button-primary" disabled={saving || deleting} onClick={() => void saveCurrent()} type="button">
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Kaydet
                  </button>

                  <button
                    className="admin-button admin-button-secondary"
                    disabled={saving || deleting}
                    onClick={() => void saveCurrent("active")}
                    type="button"
                  >
                    <CheckCircle2 size={16} />
                    Aktife Al
                  </button>

                  <button
                    className="admin-button admin-button-secondary"
                    disabled={saving || deleting}
                    onClick={() => void saveCurrent("passive")}
                    type="button"
                  >
                    <PauseCircle size={16} />
                    Pasife Al
                  </button>

                  <ConfirmDialog
                    busy={deleting}
                    confirmLabel="Soruyu Sil"
                    description="Bu soru kalıcı olarak silinir. Bağlı şık kayıtları da kaldırılır."
                    onConfirm={deleteCurrent}
                    title="Soru silinsin mi?"
                    trigger={
                      <span className="admin-button admin-button-danger">
                        <Trash2 size={16} />
                        Sil
                      </span>
                    }
                  />

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      className="admin-button admin-button-secondary"
                      disabled={currentIndex === 0 || saving || deleting}
                      onClick={() => goToIndex(currentIndex - 1)}
                      type="button"
                    >
                      <ArrowLeft size={16} />
                      Önceki
                    </button>
                    <button
                      className="admin-button admin-button-secondary"
                      disabled={currentIndex >= questions.length - 1 || saving || deleting}
                      onClick={() => goToIndex(currentIndex + 1)}
                      type="button"
                    >
                      Sonraki
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
