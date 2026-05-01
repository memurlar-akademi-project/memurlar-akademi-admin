"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminExam, AdminMinistry, AdminQuestion, AdminSubject, AdminSubjectTest, AdminTopic } from "@/lib/types";

const emptyForm = {
  subject_id: null as number | null,
  title: "",
  slug: "",
  status: "draft",
  duration_min: "20",
  instructions: "",
  question_ids: [] as number[],
};

export function SubjectTestFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const router = useRouter();
  const formId = `subject-test-form-${mode}${id ? `-${id}` : ""}`;
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const questionPoolRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [test, setTest] = useState<AdminSubjectTest | null>(null);
  const [ministries, setMinistries] = useState<AdminMinistry[]>([]);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadCatalog() {
      try {
        const [ministriesResponse, examsResponse, subjectsResponse, topicsResponse, questionsResponse] = await Promise.all([
          adminApiRequest<{ ministries: AdminMinistry[] }>("/admin/ministries", { token }),
          adminApiRequest<{ exams: AdminExam[] }>("/admin/exams", { token }),
          adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
          adminApiRequest<{ questions: AdminQuestion[] }>("/admin/questions", { token }),
        ]);

        if (cancelled) {
          return;
        }

        setMinistries(ministriesResponse.data.ministries);
        setExams(examsResponse.data.exams);
        setSubjects(subjectsResponse.data.subjects);
        setTopics(topicsResponse.data.topics);
        setQuestions(questionsResponse.data.questions);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Ders testi verileri yüklenemedi.");
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
        const response = await adminApiRequest<{ test: AdminSubjectTest }>(`/admin/subject-tests/${id}`, { token });
        const item = response.data.test;

        if (cancelled) {
          return;
        }

        setTest(item);
        setForm({
          subject_id: item.subject?.id ?? item.subject_id,
          title: item.title,
          slug: item.slug ?? "",
          status: item.status ?? "draft",
          duration_min: String(item.duration_min ?? 20),
          instructions: item.instructions ?? "",
          question_ids: item.question_ids ?? [],
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Ders testi yüklenemedi.");
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

    setTitle(form.title.trim() || "Ders Testi Düzenle");
    return () => setTitle(null);
  }, [form.title, mode, setTitle]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === form.subject_id) ?? null,
    [form.subject_id, subjects],
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

  const subjectQuestions = useMemo(
    () => questions.filter((question) => question.topic?.subject?.id === form.subject_id),
    [form.subject_id, questions],
  );

  const filteredQuestions = useMemo(
    () =>
      subjectQuestions.filter((question) => {
        if (question.question_type !== "multiple_choice") {
          return false;
        }
        if (question.status !== "active") {
          return false;
        }
        if (difficultyFilter !== "all" && question.difficulty !== difficultyFilter) {
          return false;
        }
        return true;
      }),
    [difficultyFilter, subjectQuestions],
  );

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

  const questionOptions = useMemo(
    () =>
      filteredQuestions.map((question) => ({
        id: question.id,
        label: question.question_text?.slice(0, 110) ?? "Soru",
        hint: `${question.topic?.name ?? "Konu yok"} · ${
          question.difficulty === "easy" ? "Kolay" : question.difficulty === "medium" ? "Orta" : "Zor"
        }`,
      })),
    [filteredQuestions],
  );

  const selectedQuestions = useMemo(
    () =>
      form.question_ids
        .map((questionId) => questions.find((question) => question.id === questionId))
        .filter((question): question is AdminQuestion => Boolean(question)),
    [form.question_ids, questions],
  );

  useEffect(() => {
    if (!form.subject_id) {
      if (form.question_ids.length > 0) {
        setForm((current) => ({ ...current, question_ids: [] }));
      }
      return;
    }

    const allowedIds = new Set(subjectQuestions.map((question) => question.id));
    const nextIds = form.question_ids.filter((questionId) => allowedIds.has(questionId));

    if (nextIds.length !== form.question_ids.length) {
      setForm((current) => ({ ...current, question_ids: nextIds }));
    }
  }, [form.question_ids, form.subject_id, subjectQuestions]);

  useEffect(() => {
    if (!form.subject_id) {
      return;
    }

    const subject = subjects.find((entry) => entry.id === form.subject_id);
    if (!subject) {
      return;
    }

    const examId = topics.find((topic) => topic.subject_id === subject.id)?.exam_ids?.[0] ?? null;
    setSelectedExamId(examId);
    const exam = examId ? exams.find((entry) => entry.id === examId) : null;
    setSelectedMinistryId(exam?.ministry?.id ?? null);
  }, [exams, form.subject_id, subjects, topics]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }
    if (!form.subject_id) {
      setError("Bir ders seçmelisin.");
      return;
    }
    if (form.question_ids.length === 0) {
      setError("Teste en az bir soru eklemelisin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ test: AdminSubjectTest }>(
        mode === "edit" ? `/admin/subject-tests/${id}` : "/admin/subject-tests",
        {
          token,
          method: mode === "edit" ? "PUT" : "POST",
          body: {
            subject_id: form.subject_id,
            title: form.title,
            slug: form.slug || null,
            status: form.status,
            duration_min: Number(form.duration_min),
            instructions: form.instructions || null,
            question_ids: form.question_ids,
          },
        },
      );

      setTest(response.data.test);
      showToast({
        tone: "success",
        title: mode === "edit" ? "Ders testi güncellendi" : "Ders testi oluşturuldu",
        description: selectedSubject?.name ?? "Ders havuzu",
      });

      if (mode === "create") {
        router.replace(`/ders-testleri/${response.data.test.id}/duzenle`);
      }
    } catch (submitError) {
      const description = submitError instanceof Error ? submitError.message : "Ders testi kaydedilemedi.";
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
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">Ders testi yükleniyor...</div>
      </AdminTableCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" id={formId} onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Bakanlık</span>
                <AdminSearchSelect
                  emptyText="Bakanlık bulunamadı."
                  hideLabel
                  label="Bakanlık"
                  onChange={(next) => {
                    setSelectedMinistryId(next);
                    setSelectedExamId(null);
                    setForm((current) => ({ ...current, subject_id: null, question_ids: [] }));
                  }}
                  options={ministryOptions}
                  placeholder="Bakanlık ara"
                  value={selectedMinistryId}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Sınav</span>
                <AdminSearchSelect
                  emptyText="Sınav bulunamadı."
                  hideLabel
                  label="Sınav"
                  onChange={(next) => {
                    setSelectedExamId(next);
                    setForm((current) => ({ ...current, subject_id: null, question_ids: [] }));
                  }}
                  options={examOptions}
                  placeholder="Sınav ara"
                  value={selectedExamId}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Ders</span>
                <AdminSearchSelect
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={(next) => setForm((current) => ({ ...current, subject_id: next, question_ids: [] }))}
                  options={subjectOptions}
                  placeholder="Ders ara"
                  value={form.subject_id}
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Test Başlığı</span>
                <input
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Örn. Anayasa Genel Tekrar Testi 1"
                  value={form.title}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Süre</span>
                <input
                  className="admin-input h-11"
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, duration_min: event.target.value }))}
                  placeholder="20"
                  value={form.duration_min}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Durum</span>
                <select
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  value={form.status}
                >
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Slug</span>
              <input
                className="admin-input h-11"
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="Boş bırakırsan otomatik üretilir"
                value={form.slug}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Yönerge</span>
              <textarea
                className="admin-textarea min-h-[120px]"
                onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
                placeholder="İsteğe bağlı kısa test yönergesi"
                value={form.instructions}
              />
            </label>

            <div className="rounded-3xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--color-admin-ink)]">Soru havuzu</p>
                  <p className="text-xs text-[var(--color-admin-muted)]">
                    Seçili derse ait aktif çoktan seçmeli sorular burada listelenir.
                  </p>
                </div>
                <select
                  className="admin-input h-10 w-[180px]"
                  onChange={(event) => setDifficultyFilter(event.target.value as "all" | "easy" | "medium" | "hard")}
                  value={difficultyFilter}
                >
                  <option value="all">Tüm zorluklar</option>
                  <option value="easy">Kolay</option>
                  <option value="medium">Orta</option>
                  <option value="hard">Zor</option>
                </select>
              </div>

              <div className="mt-4" ref={questionPoolRef}>
                <AdminMultiSelect
                  emptyStateText={form.subject_id ? "Seçili derste uygun soru bulunamadı." : "Önce bir ders seç."}
                  helperText={!form.subject_id ? "Soru havuzunu görmek için önce ders seç." : undefined}
                  label="Sorular"
                  onChange={(next) => setForm((current) => ({ ...current, question_ids: next }))}
                  options={questionOptions}
                  searchPlaceholder="Soru ara ve seç"
                  value={form.question_ids}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedQuestions.map((question) => (
                  <button
                    key={question.id}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-admin-line)] bg-white px-3 py-2 text-left text-xs font-medium text-[var(--color-admin-ink)]"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        question_ids: current.question_ids.filter((questionId) => questionId !== question.id),
                      }))
                    }
                    type="button"
                  >
                    <span className="max-w-[420px] truncate">
                      {question.topic?.name ? `${question.topic.name} · ` : ""}
                      {question.question_text}
                    </span>
                    <X size={14} />
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            ) : null}
          </form>
        </AdminTableCard>
      </div>

      <div className="space-y-4">
        <AdminReadinessPanel
          entityLabel="Ders testi"
          readiness={test?.readiness ?? { can_activate: false, blocking_reasons: [], warnings: [] }}
        />

        <AdminTableCard>
          <div className="space-y-3 px-5 py-5">
            <div>
              <p className="text-sm font-bold text-[var(--color-admin-ink)]">Özet</p>
              <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                Ders geneli testler, birden fazla konudan soru toplayan sabit setlerdir.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-soft)] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Ders</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{selectedSubject?.name ?? "Seçilmedi"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Soru sayısı</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{form.question_ids.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Süre</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{form.duration_min || "0"} dk</span>
              </div>
            </div>
          </div>
        </AdminTableCard>

        <AdminFormActionsCard cancelHref="/ders-testleri" formId={formId} saving={saving} submitLabel="Kaydet" />
      </div>
    </div>
  );
}
