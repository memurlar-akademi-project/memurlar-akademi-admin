"use client";

import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  ListChecks,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type {
  AdminExam,
  AdminMinistry,
  AdminPaginationMeta,
  AdminQuestion,
  AdminReadiness,
  AdminSubject,
  AdminTest,
  AdminTopic,
} from "@/lib/types";

type TestScope = "subject" | "topic";
type WizardStep = 0 | 1 | 2;

type Props = {
  mode: "create" | "edit";
  id?: number;
};

const steps = [
  { title: "Kapsam", description: "Ders, konu ve temel bilgiler" },
  { title: "Sorular", description: "Havuzdan sabit soru seti seç" },
  { title: "Kontrol", description: "Özeti incele ve kaydet" },
] as const;

const emptyReadiness: AdminReadiness = {
  can_activate: false,
  blocking_reasons: [],
  warnings: [],
};

const emptyForm = {
  exam_id: null as number | null,
  subject_id: null as number | null,
  topic_id: null as number | null,
  title: "",
  slug: "",
  status: "draft",
  duration_min: "20",
  instructions: "",
  question_ids: [] as number[],
};

export function UnifiedTestFormPage({ mode, id }: Props) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();

  const [step, setStep] = useState<WizardStep>(0);
  const [form, setForm] = useState(emptyForm);
  const [test, setTest] = useState<AdminTest | null>(null);
  const [ministries, setMinistries] = useState<AdminMinistry[]>([]);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPagination, setQuestionPagination] = useState<AdminPaginationMeta | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [questionSearch, setQuestionSearch] = useState("");
  const [previewQuestion, setPreviewQuestion] = useState<AdminQuestion | null>(null);
  const deferredQuestionSearch = useDeferredValue(questionSearch);
  const selectedIdsKey = form.question_ids.join(",");
  const activeScope: TestScope = form.topic_id ? "topic" : "subject";

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);

      try {
        const [ministriesResponse, examsResponse, subjectsResponse, topicsResponse] = await Promise.all([
          adminApiRequest<{ ministries: AdminMinistry[] }>("/admin/ministries", { token }),
          adminApiRequest<{ exams: AdminExam[] }>("/admin/exams", { token }),
          adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
        ]);

        if (cancelled) {
          return;
        }

        setMinistries(ministriesResponse.data.ministries);
        setExams(examsResponse.data.exams);
        setSubjects(subjectsResponse.data.subjects);
        setTopics(topicsResponse.data.topics);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Test katalogu yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (mode !== "edit" || !id || !token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTest() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ test: AdminTest }>(`/admin/tests/${id}`, { token });
        const item = response.data.test;

        if (cancelled) {
          return;
        }

        setTest(item);
        setForm({
          exam_id: item.exam_id ?? null,
          subject_id: item.subject?.id ?? item.subject_id,
          topic_id: item.topic?.id ?? item.topic_id ?? null,
          title: item.title,
          slug: item.slug ?? "",
          status: item.status ?? "draft",
          duration_min: String(item.duration_min ?? 20),
          instructions: item.instructions ?? "",
          question_ids: item.question_ids ?? [],
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Test kaydı yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTest();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    setTitle(form.title.trim() || "Test Düzenle");

    return () => setTitle(null);
  }, [form.title, mode, setTitle]);

  useEffect(() => {
    if (!form.subject_id) {
      return;
    }

    const subject = subjects.find((entry) => entry.id === form.subject_id);
    if (!subject) {
      return;
    }

    const topic = form.topic_id ? topics.find((entry) => entry.id === form.topic_id) : null;
    const examId = topic?.exam_ids?.[0] ?? form.exam_id ?? null;
    const exam = examId ? exams.find((entry) => entry.id === examId) : null;

    setSelectedExamId(examId);
    setSelectedMinistryId(exam?.ministry?.id ?? null);
  }, [exams, form.subject_id, form.topic_id, subjects, topics]);

  useEffect(() => {
    setQuestionPage(1);
  }, [deferredQuestionSearch, difficultyFilter, form.subject_id, form.topic_id]);

  useEffect(() => {
    if (!token || !form.subject_id) {
      setQuestions([]);
      setQuestionPagination(null);
      return;
    }

    let cancelled = false;

    async function loadQuestions() {
      setQuestionsLoading(true);

      try {
        const params = new URLSearchParams({
          subject_id: String(form.subject_id),
          status: "active",
          question_type: "multiple_choice",
          per_page: "100",
          page: String(questionPage),
        });

        if (form.topic_id) {
          params.set("topic_id", String(form.topic_id));
        } else if (form.exam_id) {
          params.set("exam_id", String(form.exam_id));
        }

        if (difficultyFilter !== "all") {
          params.set("difficulty", difficultyFilter);
        }

        const trimmedSearch = deferredQuestionSearch.trim();
        if (trimmedSearch) {
          params.set("search", trimmedSearch);
        }

        const response = await adminApiRequest<{ questions: AdminQuestion[] }>(`/admin/questions?${params.toString()}`, { token });

        if (cancelled) {
          return;
        }

        setQuestionPagination((response.meta.pagination as AdminPaginationMeta | undefined) ?? null);
        setQuestions((current) => {
          const selectedQuestionIds = new Set(form.question_ids);
          const baseQuestions = questionPage > 1
            ? current
            : current.filter((question) => selectedQuestionIds.has(question.id));
          const questionMap = new Map<number, AdminQuestion>(baseQuestions.map((question) => [question.id, question]));

          response.data.questions.forEach((question) => {
            questionMap.set(question.id, question);
          });

          return Array.from(questionMap.values());
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Soru havuzu yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setQuestionsLoading(false);
        }
      }
    }

    void loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [
    deferredQuestionSearch,
    difficultyFilter,
    form.subject_id,
    form.topic_id,
    form.exam_id,
    questionPage,
    token,
  ]);

  useEffect(() => {
    if (!token || !selectedIdsKey) {
      return;
    }

    const loadedQuestionIds = new Set(questions.map((question) => question.id));
    const missingQuestionIds = form.question_ids.filter((questionId) => !loadedQuestionIds.has(questionId));

    if (missingQuestionIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function hydrateSelectedQuestions() {
      try {
        const response = await adminApiRequest<{ questions: AdminQuestion[] }>(
          `/admin/questions?ids=${missingQuestionIds.join(",")}&per_page=100`,
          { token },
        );

        if (cancelled) {
          return;
        }

        setQuestions((current) => {
          const questionMap = new Map<number, AdminQuestion>(current.map((question) => [question.id, question]));

          response.data.questions.forEach((question) => {
            questionMap.set(question.id, question);
          });

          return Array.from(questionMap.values());
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Seçili sorular yüklenemedi.");
        }
      }
    }

    void hydrateSelectedQuestions();

    return () => {
      cancelled = true;
    };
  }, [form.question_ids, questions, selectedIdsKey, token]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === form.subject_id) ?? null,
    [form.subject_id, subjects],
  );

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === form.topic_id) ?? null,
    [form.topic_id, topics],
  );

  const filteredExams = useMemo(
    () => (selectedMinistryId === null ? exams : exams.filter((exam) => exam.ministry?.id === selectedMinistryId)),
    [exams, selectedMinistryId],
  );

  const filteredSubjects = useMemo(() => {
    if (selectedExamId !== null) {
      return subjects.filter((subject) =>
        topics.some((topic) => topic.subject_id === subject.id && (topic.exam_ids ?? []).includes(selectedExamId)),
      );
    }

    if (selectedMinistryId === null) {
      return subjects;
    }

    const visibleExamIds = new Set(filteredExams.map((exam) => exam.id));

    return subjects.filter((subject) =>
      topics.some((topic) => topic.subject_id === subject.id && (topic.exam_ids ?? []).some((examId) => visibleExamIds.has(examId))),
    );
  }, [filteredExams, selectedExamId, selectedMinistryId, subjects, topics]);

  const filteredTopics = useMemo(() => {
    if (!form.subject_id) {
      return [];
    }

    return topics.filter((topic) => {
      if (topic.subject_id !== form.subject_id) {
        return false;
      }

      if (selectedExamId !== null) {
        return (topic.exam_ids ?? []).includes(selectedExamId);
      }

      return true;
    });
  }, [form.subject_id, selectedExamId, topics]);

  const ministryOptions = useMemo(
    () => ministries.map((ministry) => ({ id: ministry.id, label: ministry.name, hint: `${ministry.exam_count} sınav` })),
    [ministries],
  );

  const examOptions = useMemo(
    () => filteredExams.map((exam) => ({ id: exam.id, label: exam.name, hint: exam.ministry?.name })),
    [filteredExams],
  );

  const subjectOptions = useMemo(
    () => filteredSubjects.map((subject) => ({ id: subject.id, label: subject.name, hint: `${subject.topic_count} konu` })),
    [filteredSubjects],
  );

  const topicOptions = useMemo(
    () => filteredTopics.map((topic) => ({ id: topic.id, label: topic.name, hint: topic.subject?.name })),
    [filteredTopics],
  );

  const selectedQuestions = useMemo(
    () =>
      form.question_ids
        .map((questionId) => questions.find((question) => question.id === questionId))
        .filter((question): question is AdminQuestion => Boolean(question)),
    [form.question_ids, questions],
  );

  const poolQuestions = useMemo(() => questions, [questions]);

  function handleSubjectChange(nextSubjectId: number | null) {
    setForm((current) => ({
      ...current,
      subject_id: nextSubjectId,
      topic_id: null,
      exam_id: selectedExamId,
      question_ids: [],
    }));
    setQuestionSearch("");
  }

  function handleTopicChange(nextTopicId: number | null) {
    setForm((current) => ({
      ...current,
      topic_id: nextTopicId,
      exam_id: nextTopicId ? null : selectedExamId,
      question_ids: [],
    }));
    setQuestionSearch("");
  }

  function toggleQuestion(questionId: number) {
    setForm((current) => ({
      ...current,
      question_ids: current.question_ids.includes(questionId)
        ? current.question_ids.filter((currentId) => currentId !== questionId)
        : [...current.question_ids, questionId],
    }));
  }

  function removeQuestion(questionId: number) {
    setForm((current) => ({
      ...current,
      question_ids: current.question_ids.filter((currentId) => currentId !== questionId),
    }));
  }

  function validateStep(nextStep: WizardStep): boolean {
    if (nextStep > 0 && (!form.subject_id || !form.title.trim() || !Number(form.duration_min))) {
      setError("Devam etmek için ders, test başlığı ve süre bilgilerini doldurmalısın.");
      setStep(0);
      return false;
    }

    if (nextStep > 0 && !form.topic_id && !form.exam_id) {
      setError("Ders geneli test için sınav seçimi zorunludur.");
      setStep(0);
      return false;
    }

    if (nextStep > 1 && form.question_ids.length === 0) {
      setError("Kontrol adımına geçmeden önce teste en az bir soru eklemelisin.");
      setStep(1);
      return false;
    }

    setError(null);
    return true;
  }

  function goToStep(nextStep: WizardStep) {
    if (validateStep(nextStep)) {
      setStep(nextStep);
    }
  }

  function goNext() {
    goToStep(Math.min(step + 1, 2) as WizardStep);
  }

  function goBack() {
    setError(null);
    setStep(Math.max(step - 1, 0) as WizardStep);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!validateStep(2)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ test: AdminTest }>(mode === "edit" ? `/admin/tests/${id}` : "/admin/tests", {
        token,
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          exam_id: form.topic_id ? null : form.exam_id,
          subject_id: form.subject_id,
          topic_id: form.topic_id,
          title: form.title,
          slug: form.slug || null,
          status: form.status,
          duration_min: Number(form.duration_min),
          instructions: form.instructions || null,
          question_ids: form.question_ids,
        },
      });

      setTest(response.data.test);
      showToast({
        tone: "success",
        title: mode === "edit" ? "Test güncellendi" : "Test oluşturuldu",
        description: activeScope === "topic" ? selectedTopic?.name ?? "Konu testi" : selectedSubject?.name ?? "Ders testi",
      });

      if (mode === "create") {
        router.replace(`/testler/${response.data.test.id}/duzenle`);
      }
    } catch (submitError) {
      const description = submitError instanceof Error ? submitError.message : "Test kaydı tamamlanamadı.";

      setError(description);
      showToast({
        tone: "error",
        title: "Kayıt tamamlanamadı",
        description,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminTableCard>
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">Test yükleniyor...</div>
      </AdminTableCard>
    );
  }

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <AdminTableCard>
          <div className="grid gap-5 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Test sihirbazı
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--color-admin-ink)]">
                {form.title.trim() || "Yeni test hazırlığı"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-admin-muted)]">
                Önce kapsamı belirle, sonra soru havuzundan net okuyarak seçim yap. Son adımda testin öğrenci tarafına nasıl çıkacağını kontrol et.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {steps.map((item, index) => {
                const active = step === index;
                const done = index === 0
                  ? Boolean(form.subject_id && form.title.trim())
                  : index === 1
                    ? form.question_ids.length > 0
                    : false;

                return (
                  <button
                    key={item.title}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-[var(--color-admin-accent)] bg-white shadow-sm"
                        : "border-[var(--color-admin-line)] bg-white/55 hover:border-[var(--color-admin-accent)]/35"
                    }`}
                    onClick={() => goToStep(index as WizardStep)}
                    type="button"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        done
                          ? "bg-emerald-500 text-white"
                          : active
                            ? "bg-[var(--color-admin-accent)] text-white"
                            : "bg-[var(--color-admin-panel)] text-[var(--color-admin-muted)]"
                      }`}
                    >
                      {done ? <Check size={14} /> : index + 1}
                    </span>
                    <span className="mt-2 block text-sm font-bold text-[var(--color-admin-ink)]">{item.title}</span>
                    <span className="mt-1 hidden text-xs leading-4 text-[var(--color-admin-muted)] sm:block">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-[var(--color-admin-danger)]">
              {error}
            </div>
          ) : null}

          {step === 0 ? (
            <ScopeStep
              activeScope={activeScope}
              catalogLoading={catalogLoading}
              difficultyFilter={difficultyFilter}
              examOptions={examOptions}
              form={form}
              handleSubjectChange={handleSubjectChange}
              handleTopicChange={handleTopicChange}
              ministryOptions={ministryOptions}
              onDifficultyChange={setDifficultyFilter}
              onFormChange={setForm}
              selectedExamId={selectedExamId}
              selectedMinistryId={selectedMinistryId}
              setSelectedExamId={setSelectedExamId}
              setSelectedMinistryId={setSelectedMinistryId}
              subjectOptions={subjectOptions}
              topicOptions={topicOptions}
            />
          ) : null}

          {step === 1 ? (
            <QuestionsStep
              difficultyFilter={difficultyFilter}
              form={form}
              poolQuestions={poolQuestions}
              questionPagination={questionPagination}
              questionSearch={questionSearch}
              questionsLoading={questionsLoading}
              removeQuestion={removeQuestion}
              selectedQuestions={selectedQuestions}
              setDifficultyFilter={setDifficultyFilter}
              setPreviewQuestion={setPreviewQuestion}
              setQuestionPage={setQuestionPage}
              setQuestionSearch={setQuestionSearch}
              toggleQuestion={toggleQuestion}
            />
          ) : null}

          {step === 2 ? (
            <ReviewStep
              activeScope={activeScope}
              form={form}
              questions={selectedQuestions}
              selectedSubject={selectedSubject}
              selectedTopic={selectedTopic}
              test={test}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-admin-line)] px-5 py-4">
            <button
              className="admin-button admin-button-secondary"
              disabled={step === 0}
              onClick={goBack}
              type="button"
            >
              <ArrowLeft size={16} />
              Geri
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="admin-button admin-button-secondary"
                onClick={() => router.push("/testler")}
                type="button"
              >
                Vazgeç
              </button>

              {step < 2 ? (
                <button className="admin-button admin-button-primary" onClick={goNext} type="button">
                  Devam
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button className="admin-button admin-button-primary" disabled={saving} type="submit">
                  {saving ? "Kaydediliyor..." : "Testi Kaydet"}
                  <CheckCircle2 size={16} />
                </button>
              )}
            </div>
          </div>
        </AdminTableCard>
      </form>

      {previewQuestion ? (
        <QuestionPreviewModal
          onClose={() => setPreviewQuestion(null)}
          onToggle={() => toggleQuestion(previewQuestion.id)}
          question={previewQuestion}
          selected={form.question_ids.includes(previewQuestion.id)}
        />
      ) : null}
    </>
  );
}

function ScopeStep({
  activeScope,
  catalogLoading,
  difficultyFilter,
  examOptions,
  form,
  handleSubjectChange,
  handleTopicChange,
  ministryOptions,
  onDifficultyChange,
  onFormChange,
  selectedExamId,
  selectedMinistryId,
  setSelectedExamId,
  setSelectedMinistryId,
  subjectOptions,
  topicOptions,
}: {
  activeScope: TestScope;
  catalogLoading: boolean;
  difficultyFilter: "all" | "easy" | "medium" | "hard";
  examOptions: Array<{ id: number; label: string; hint?: string }>;
  form: typeof emptyForm;
  handleSubjectChange: (nextSubjectId: number | null) => void;
  handleTopicChange: (nextTopicId: number | null) => void;
  ministryOptions: Array<{ id: number; label: string; hint?: string }>;
  onDifficultyChange: (next: "all" | "easy" | "medium" | "hard") => void;
  onFormChange: (next: typeof emptyForm | ((current: typeof emptyForm) => typeof emptyForm)) => void;
  selectedExamId: number | null;
  selectedMinistryId: number | null;
  setSelectedExamId: (next: number | null) => void;
  setSelectedMinistryId: (next: number | null) => void;
  subjectOptions: Array<{ id: number; label: string; hint?: string }>;
  topicOptions: Array<{ id: number; label: string; hint?: string }>;
}) {
  return (
    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Bakanlık">
            <AdminSearchSelect
              emptyText="Bakanlık bulunamadı."
              hideLabel
              label="Bakanlık"
              onChange={(next) => {
                setSelectedMinistryId(next);
                setSelectedExamId(null);
                onFormChange((current) => ({
                  ...current,
                  exam_id: null,
                  subject_id: null,
                  topic_id: null,
                  question_ids: [],
                }));
              }}
              options={ministryOptions}
              placeholder="Bakanlık ara"
              value={selectedMinistryId}
            />
          </Field>

          <Field label="Sınav">
            <AdminSearchSelect
              emptyText="Sınav bulunamadı."
              hideLabel
              label="Sınav"
              onChange={(next) => {
                setSelectedExamId(next);
                onFormChange((current) => ({
                  ...current,
                  exam_id: next,
                  subject_id: null,
                  topic_id: null,
                  question_ids: [],
                }));
              }}
              options={examOptions}
              placeholder="Sınav ara"
              value={selectedExamId}
            />
          </Field>

          <Field label="Ders">
            <AdminSearchSelect
              emptyText="Ders bulunamadı."
              hideLabel
              label="Ders"
              onChange={handleSubjectChange}
              options={subjectOptions}
              placeholder="Ders ara"
              value={form.subject_id}
            />
          </Field>

          <Field label="Konu">
            <AdminSearchSelect
              buttonPlaceholder="Ders geneli"
              emptyText="Konu bulunamadı."
              hideLabel
              label="Konu"
              onChange={handleTopicChange}
              options={topicOptions}
              placeholder="Konu ara"
              value={form.topic_id}
            />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_170px]">
          <Field label="Test Başlığı">
            <input
              className="admin-input h-11"
              onChange={(event) => onFormChange((current) => ({ ...current, title: event.target.value }))}
              placeholder="Örn. Genel Test"
              value={form.title}
            />
          </Field>

          <Field label="Süre">
            <input
              className="admin-input h-11"
              inputMode="numeric"
              onChange={(event) => onFormChange((current) => ({ ...current, duration_min: event.target.value }))}
              placeholder="20"
              value={form.duration_min}
            />
          </Field>

          <Field label="Durum">
            <select
              className="admin-input h-11"
              onChange={(event) => onFormChange((current) => ({ ...current, status: event.target.value }))}
              value={form.status}
            >
              <option value="active">Aktif</option>
              <option value="draft">Taslak</option>
              <option value="passive">Pasif</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
          <Field label="Slug">
            <input
              className="admin-input h-11"
              onChange={(event) => onFormChange((current) => ({ ...current, slug: event.target.value }))}
              placeholder="Boş bırakırsan otomatik oluşur"
              value={form.slug}
            />
          </Field>

          <Field label="Varsayılan Zorluk Filtresi">
            <select
              className="admin-input h-11"
              onChange={(event) => onDifficultyChange(event.target.value as typeof difficultyFilter)}
              value={difficultyFilter}
            >
              <option value="all">Tüm zorluklar</option>
              <option value="easy">Kolay</option>
              <option value="medium">Orta</option>
              <option value="hard">Zor</option>
            </select>
          </Field>
        </div>

        <Field label="Kısa Yönerge">
          <textarea
            className="admin-input min-h-28"
            onChange={(event) => onFormChange((current) => ({ ...current, instructions: event.target.value }))}
            placeholder="Kullanıcıya gösterilecek kısa açıklama"
            value={form.instructions}
          />
        </Field>
      </div>

      <div className="rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
          Kapsam sonucu
        </p>
        <div className="mt-4 rounded-2xl bg-white px-4 py-4">
          <p className="text-sm font-black text-[var(--color-admin-ink)]">
            {activeScope === "topic" ? "Konu testi" : "Ders geneli test"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
            Konu seçilirse test sadece o konuya bağlanır. Konu boş kalırsa seçili sınava özel Genel Test olarak kaydedilir.
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          <SummaryPill label="Katalog" value={catalogLoading ? "Yükleniyor" : "Hazır"} />
          <SummaryPill label="Başlık" value={form.title.trim() || "Eksik"} />
          <SummaryPill label="Süre" value={`${form.duration_min || 0} dk`} />
        </div>
      </div>
    </div>
  );
}

function QuestionsStep({
  difficultyFilter,
  form,
  poolQuestions,
  questionPagination,
  questionSearch,
  questionsLoading,
  removeQuestion,
  selectedQuestions,
  setDifficultyFilter,
  setPreviewQuestion,
  setQuestionPage,
  setQuestionSearch,
  toggleQuestion,
}: {
  difficultyFilter: "all" | "easy" | "medium" | "hard";
  form: typeof emptyForm;
  poolQuestions: AdminQuestion[];
  questionPagination: AdminPaginationMeta | null;
  questionSearch: string;
  questionsLoading: boolean;
  removeQuestion: (questionId: number) => void;
  selectedQuestions: AdminQuestion[];
  setDifficultyFilter: (next: "all" | "easy" | "medium" | "hard") => void;
  setPreviewQuestion: (question: AdminQuestion) => void;
  setQuestionPage: (next: number | ((current: number) => number)) => void;
  setQuestionSearch: (next: string) => void;
  toggleQuestion: (questionId: number) => void;
}) {
  const canLoadMore = questionPagination
    ? questionPagination.current_page < questionPagination.last_page
    : false;

  const showInitialLoader = questionsLoading && poolQuestions.length === 0;

  return (
    <div className="grid gap-0 xl:h-[calc(100vh-310px)] xl:min-h-[660px] xl:grid-cols-[minmax(0,1fr)_360px] xl:overflow-hidden">
      <div className="flex min-h-0 flex-col border-r border-[var(--color-admin-line)]">
        <div className="shrink-0 border-b border-[var(--color-admin-line)] bg-white/95 px-5 py-4 backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-admin-muted)]" size={17} />
              <input
                className="admin-input h-11 pl-11"
                onChange={(event) => setQuestionSearch(event.target.value)}
                placeholder="Soru metni, konu veya ders ara"
                value={questionSearch}
              />
            </label>

            <select
              className="admin-input h-11"
              onChange={(event) => setDifficultyFilter(event.target.value as typeof difficultyFilter)}
              value={difficultyFilter}
            >
              <option value="all">Tüm zorluklar</option>
              <option value="easy">Kolay</option>
              <option value="medium">Orta</option>
              <option value="hard">Zor</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-admin-muted)]">
            <span>{poolQuestions.length} soru listeleniyor</span>
            {questionPagination ? (
              <>
                <span className="h-1 w-1 rounded-full bg-[var(--color-admin-muted)]/40" />
                <span>
                  {questionPagination.to ?? poolQuestions.length}/{questionPagination.total} havuz
                </span>
              </>
            ) : null}
            <span className="h-1 w-1 rounded-full bg-[var(--color-admin-muted)]/40" />
            <span>{form.question_ids.length} soru seçildi</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3">
            {questionsLoading && poolQuestions.length > 0 ? (
              <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-xs font-semibold text-[var(--color-admin-muted)]">
                Havuz güncelleniyor, mevcut seçimlerin korunuyor...
              </div>
            ) : null}

            {showInitialLoader ? (
            <div className="rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-8 text-sm text-[var(--color-admin-muted)]">
              Soru havuzu yükleniyor...
            </div>
          ) : !form.subject_id ? (
            <div className="rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-8 text-sm text-[var(--color-admin-muted)]">
              Önce kapsam adımından ders seç.
            </div>
          ) : poolQuestions.length === 0 ? (
            <div className="rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-8 text-sm text-[var(--color-admin-muted)]">
              Bu filtrelerle eşleşen soru bulunamadı.
            </div>
          ) : (
            poolQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                onPreview={() => setPreviewQuestion(question)}
                onToggle={() => toggleQuestion(question.id)}
                question={question}
                selected={form.question_ids.includes(question.id)}
              />
            ))
          )}

            {canLoadMore ? (
              <button
                className="admin-button admin-button-secondary mx-auto mt-2"
                disabled={questionsLoading}
                onClick={() => setQuestionPage((current) => current + 1)}
                type="button"
              >
                {questionsLoading ? "Yükleniyor..." : "Daha fazla soru yükle"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col bg-[var(--color-admin-panel-soft)]">
        <div className="shrink-0 border-b border-[var(--color-admin-line)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Seçili set
              </p>
              <h3 className="mt-1 text-xl font-black text-[var(--color-admin-ink)]">
                {form.question_ids.length} soru
              </h3>
            </div>
            <ListChecks className="text-[var(--color-admin-accent)]" size={26} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="space-y-2">
            {selectedQuestions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-admin-line)] bg-white px-4 py-5 text-sm leading-6 text-[var(--color-admin-muted)]">
                Sorular burada sıralı görünecek. Soldaki kartlardan seçim yap.
              </p>
            ) : (
              selectedQuestions.map((question, index) => (
                <div key={question.id} className="rounded-2xl border border-[var(--color-admin-line)] bg-white px-3 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--color-admin-accent-soft)] text-xs font-black text-[var(--color-admin-accent)]">
                      {index + 1}
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setPreviewQuestion(question)} type="button">
                      <p className="overflow-hidden text-xs font-bold leading-5 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                        {question.question_text}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--color-admin-muted)]">
                        {question.topic?.name ?? "Konu yok"}
                      </p>
                    </button>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--color-admin-muted)] transition hover:bg-red-50 hover:text-[var(--color-admin-danger)]"
                      onClick={() => removeQuestion(question.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReviewStep({
  activeScope,
  form,
  questions,
  selectedSubject,
  selectedTopic,
  test,
}: {
  activeScope: TestScope;
  form: typeof emptyForm;
  questions: AdminQuestion[];
  selectedSubject: AdminSubject | null;
  selectedTopic: AdminTopic | null;
  test: AdminTest | null;
}) {
  return (
    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
            Son kontrol
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--color-admin-ink)]">
            {form.title || "Başlıksız test"}
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Kapsam" value={activeScope === "topic" ? "Konu testi" : "Ders geneli"} />
            <SummaryTile label="Ders" value={selectedSubject?.name ?? "Ders yok"} />
            <SummaryTile label="Konu" value={selectedTopic?.name ?? "Ders geneli"} />
            <SummaryTile label="Süre" value={`${form.duration_min} dk`} />
          </div>
          {form.instructions.trim() ? (
            <div className="mt-5 rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-[var(--color-admin-muted)]">
              {form.instructions}
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-[var(--color-admin-line)] bg-white">
          <div className="border-b border-[var(--color-admin-line)] px-5 py-4">
            <h3 className="text-sm font-black text-[var(--color-admin-ink)]">Seçili soru sırası</h3>
          </div>
          <div className="divide-y divide-[var(--color-admin-line)]/80">
            {questions.map((question, index) => (
              <div key={question.id} className="flex items-start gap-3 px-5 py-4">
                <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[var(--color-admin-panel-soft)] text-xs font-black text-[var(--color-admin-muted)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-6 text-[var(--color-admin-ink)]">{question.question_text}</p>
                  <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                    {question.topic?.subject?.name ?? "Ders"} · {question.topic?.name ?? "Konu"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <AdminReadinessPanel entityLabel="Test" readiness={test?.readiness ?? emptyReadiness} />
        <div className="rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
            Yayın durumu
          </p>
          <p className="mt-3 text-lg font-black text-[var(--color-admin-ink)]">
            {form.status === "active" ? "Aktif" : form.status === "draft" ? "Taslak" : "Pasif"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
            Aktif testler öğrenci tarafındaki test çöz listesinde görünür.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 py-3">
      <span className="text-xs font-semibold text-[var(--color-admin-muted)]">{label}</span>
      <span className="text-sm font-black text-[var(--color-admin-ink)]">{value}</span>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">{label}</p>
      <p className="mt-2 overflow-hidden text-sm font-black leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
        {value}
      </p>
    </div>
  );
}

function QuestionCard({
  onPreview,
  onToggle,
  question,
  selected,
}: {
  onPreview: () => void;
  onToggle: () => void;
  question: AdminQuestion;
  selected: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border bg-white p-4 transition ${
        selected
          ? "border-[var(--color-admin-accent)] shadow-[0_16px_40px_rgba(37,99,235,0.10)]"
          : "border-[var(--color-admin-line)] hover:border-[var(--color-admin-accent)]/35"
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          className={`mt-0.5 flex h-9 min-w-9 items-center justify-center rounded-2xl border transition ${
            selected
              ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent)] text-white"
              : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-muted)] hover:text-[var(--color-admin-accent)]"
          }`}
          onClick={onToggle}
          type="button"
        >
          {selected ? <Check size={17} /> : "+"}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
              #{question.id}
            </span>
            <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
              {question.difficulty === "easy" ? "Kolay" : question.difficulty === "medium" ? "Orta" : "Zor"}
            </span>
            <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
              {question.topic?.name ?? "Konu yok"}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-[var(--color-admin-ink)]">
            {question.question_text}
          </p>

          {question.options?.length ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {question.options.map((option) => (
                <button
                  key={`${question.id}-${option.label}-${option.option_text}`}
                  className={`min-w-0 rounded-2xl border px-3 py-2.5 text-left text-xs leading-5 transition ${
                    option.is_correct
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-ink)] hover:border-[var(--color-admin-accent)]/30"
                  }`}
                  onClick={onToggle}
                  type="button"
                >
                  <span className="font-black">{option.label}) </span>
                  <span className="font-semibold">{option.option_text}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-admin-muted)]">
              {question.topic?.subject?.name ?? "Ders yok"}
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs font-bold text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)]/40 hover:text-[var(--color-admin-accent)]"
              onClick={onPreview}
              type="button"
            >
              <Eye size={14} />
              Açıklama
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuestionPreviewModal({
  onClose,
  onToggle,
  question,
  selected,
}: {
  onClose: () => void;
  onToggle: () => void;
  question: AdminQuestion;
  selected: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-admin-line)] px-6 py-5">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
              Soru önizleme
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-admin-muted)]">
              {question.topic?.subject?.name ?? "Ders"} · {question.topic?.name ?? "Konu"}
            </p>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-92px)] overflow-y-auto px-6 py-6">
          <p className="text-lg font-bold leading-9 text-[var(--color-admin-ink)]">{question.question_text}</p>

          {question.options?.length ? (
            <div className="mt-6 grid gap-3">
              {question.options.map((option) => (
                <div
                  key={`${option.label}-${option.option_text}`}
                  className={`rounded-2xl border px-4 py-3 ${
                    option.is_correct
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-ink)]"
                  }`}
                >
                  <span className="font-black">{option.label}) </span>
                  <span className="font-semibold">{option.option_text}</span>
                </div>
              ))}
            </div>
          ) : null}

          {question.explanation_text ? (
            <div className="mt-6 rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Açıklama</p>
              <p className="mt-3 text-sm leading-7 text-[var(--color-admin-ink)]">{question.explanation_text}</p>
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <button className="admin-button admin-button-secondary" onClick={onClose} type="button">
              Kapat
            </button>
            <button className="admin-button admin-button-primary" onClick={onToggle} type="button">
              {selected ? "Seçimden Çıkar" : "Teste Ekle"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
