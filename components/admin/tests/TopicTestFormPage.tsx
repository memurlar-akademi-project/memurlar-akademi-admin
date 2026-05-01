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
import type { AdminExam, AdminMinistry, AdminQuestion, AdminSubject, AdminTopic, AdminTopicTest } from "@/lib/types";

const emptyForm = {
  topic_id: null as number | null,
  title: "",
  slug: "",
  status: "draft",
  duration_min: "20",
  instructions: "",
  question_ids: [] as number[],
};

export function TopicTestFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const router = useRouter();
  const formId = `topic-test-form-${mode}${id ? `-${id}` : ""}`;
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const questionPoolRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [test, setTest] = useState<AdminTopicTest | null>(null);
  const [ministries, setMinistries] = useState<AdminMinistry[]>([]);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMinistryId, setSelectedMinistryId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadCatalog() {
      setTopicsLoading(true);
      setQuestionsLoading(true);

      try {
        const [
          ministriesResponse,
          examsResponse,
          subjectsResponse,
          topicsResponse,
          questionsResponse,
        ] = await Promise.all([
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
          setError(loadError instanceof Error ? loadError.message : "Test verileri yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setTopicsLoading(false);
          setQuestionsLoading(false);
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
        const response = await adminApiRequest<{ test: AdminTopicTest }>(`/admin/tests/${id}`, { token });
        const item = response.data.test;

        if (cancelled) {
          return;
        }

        setTest(item);
        setForm({
          topic_id: item.topic?.id ?? item.topic_id,
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

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === form.topic_id) ?? null,
    [form.topic_id, topics],
  );

  const filteredExams = useMemo(
    () =>
      selectedMinistryId === null
        ? exams
        : exams.filter((exam) => exam.ministry?.id === selectedMinistryId),
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

  const filteredTopics = useMemo(
    () => {
      const visibleExamIds = new Set(filteredExams.map((exam) => exam.id));

      return topics.filter((topic) => {
        if (selectedSubjectId !== null && topic.subject_id !== selectedSubjectId) {
          return false;
        }

        if (!filteredSubjects.some((subject) => subject.id === topic.subject_id)) {
          return false;
        }

        if (selectedExamId !== null) {
          return (topic.exam_ids ?? []).includes(selectedExamId);
        }

        if (selectedMinistryId !== null) {
          return (topic.exam_ids ?? []).some((examId) => visibleExamIds.has(examId));
        }

        return true;
      });
    },
    [filteredExams, filteredSubjects, selectedExamId, selectedMinistryId, selectedSubjectId, topics],
  );

  const topicOptions = useMemo(
    () =>
      filteredTopics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [filteredTopics],
  );

  const ministryOptions = useMemo(
    () =>
      ministries.map((ministry) => ({
        id: ministry.id,
        label: ministry.name,
        hint: `${ministry.exam_count} sınav`,
      })),
    [ministries],
  );

  const examOptions = useMemo(
    () =>
      filteredExams.map((exam) => ({
        id: exam.id,
        label: exam.name,
        hint: exam.ministry?.name,
      })),
    [filteredExams],
  );

  const subjectOptions = useMemo(
    () =>
      filteredSubjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: `${subject.topic_count} konu`,
      })),
    [filteredSubjects],
  );

  const topicQuestions = useMemo(
    () => questions.filter((question) => question.topic?.id === form.topic_id),
    [form.topic_id, questions],
  );

  const filteredQuestions = useMemo(
    () =>
      topicQuestions.filter((question) => {
        if (question.question_type !== "multiple_choice") {
          return false;
        }

        if (difficultyFilter !== "all" && question.difficulty !== difficultyFilter) {
          return false;
        }

        if (question.status !== "active") {
          return false;
        }

        return true;
      }),
    [difficultyFilter, topicQuestions],
  );

  const questionOptions = useMemo(
    () =>
      filteredQuestions.map((question) => ({
        id: question.id,
        label: question.question_text?.slice(0, 110) ?? "Soru",
        hint: `${question.question_type === "multiple_choice" ? "Test" : "Doğru / Yanlış"} · ${
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
    if (!form.topic_id) {
      if (form.question_ids.length > 0) {
        setForm((current) => ({ ...current, question_ids: [] }));
      }

      return;
    }

    const allowedIds = new Set(topicQuestions.map((question) => question.id));
    const nextIds = form.question_ids.filter((questionId) => allowedIds.has(questionId));

    if (nextIds.length !== form.question_ids.length) {
      setForm((current) => ({ ...current, question_ids: nextIds }));
    }
  }, [form.question_ids, form.topic_id, topicQuestions]);

  useEffect(() => {
    if (!form.topic_id) {
      return;
    }

    const topic = topics.find((entry) => entry.id === form.topic_id);
    if (!topic) {
      return;
    }

    setSelectedSubjectId(topic.subject_id);
    const examId = topic.exam_ids?.[0] ?? null;
    setSelectedExamId(examId);
    const exam = examId ? exams.find((entry) => entry.id === examId) : null;
    setSelectedMinistryId(exam?.ministry?.id ?? null);
  }, [exams, form.topic_id, topics]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!form.topic_id) {
      setError("Bir konu seçmelisin.");
      return;
    }

    if (form.question_ids.length === 0) {
      setError("Teste en az bir soru eklemelisin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ test: AdminTopicTest }>(
        mode === "edit" ? `/admin/tests/${id}` : "/admin/tests",
        {
          token,
          method: mode === "edit" ? "PUT" : "POST",
          body: {
            topic_id: form.topic_id,
            title: form.title,
            slug: form.slug || null,
            status: form.status,
            duration_min: Number(form.duration_min),
            instructions: form.instructions || null,
            question_ids: form.question_ids,
          },
        },
      );

      showToast({
        tone: "success",
        title: mode === "edit" ? "Test güncellendi" : "Test oluşturuldu",
        description: selectedTopic?.name ?? "Konu havuzu",
      });
      setTest(response.data.test);

      if (mode === "create") {
        router.replace(`/testler/${response.data.test.id}/duzenle`);
      }
    } catch (submitError) {
      const description =
        submitError instanceof Error ? submitError.message : "Test kaydı tamamlanamadı.";

      showToast({
        tone: "error",
        title: "Kayıt tamamlanamadı",
        description,
      });
      setError(description);
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" id={formId} onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Bakanlık
                </span>
                <AdminSearchSelect
                  emptyText="Bakanlık bulunamadı."
                  hideLabel
                  label="Bakanlık"
                  onChange={(next) => {
                    setSelectedMinistryId(next);
                    setSelectedExamId(null);
                    setSelectedSubjectId(null);
                    setForm((current) => ({ ...current, topic_id: null, question_ids: [] }));
                  }}
                  options={ministryOptions}
                  placeholder="Bakanlık ara"
                  value={selectedMinistryId}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Sınav
                </span>
                <AdminSearchSelect
                  emptyText="Sınav bulunamadı."
                  hideLabel
                  label="Sınav"
                  onChange={(next) => {
                    setSelectedExamId(next);
                    setSelectedSubjectId(null);
                    setForm((current) => ({ ...current, topic_id: null, question_ids: [] }));
                  }}
                  options={examOptions}
                  placeholder="Sınav ara"
                  value={selectedExamId}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Ders
                </span>
                <AdminSearchSelect
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={(next) => {
                    setSelectedSubjectId(next);
                    setForm((current) => ({ ...current, topic_id: null, question_ids: [] }));
                  }}
                  options={subjectOptions}
                  placeholder="Ders ara"
                  value={selectedSubjectId}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Konu
                </span>
                <AdminSearchSelect
                  emptyText="Konu bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={(next) =>
                    setForm((current) => ({
                      ...current,
                      topic_id: next,
                      question_ids: [],
                    }))
                  }
                  options={topicOptions}
                  placeholder="Konu ara"
                  value={form.topic_id}
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-[220px_220px]">

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Süre
                </span>
                <input
                  className="admin-input h-11"
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, duration_min: event.target.value }))}
                  placeholder="20"
                  value={form.duration_min}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Durum
                </span>
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
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Test Başlığı
              </span>
              <input
                className="admin-input h-11"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Örn. Disiplin Hükümleri Test 1"
                value={form.title}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Slug
              </span>
              <input
                className="admin-input h-11"
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="Otomatik oluşabilir"
                value={form.slug}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Kısa Yönerge
              </span>
              <textarea
                className="admin-input min-h-28"
                onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
                placeholder="Kullanıcıya gösterilecek kısa açıklama veya çözüm notu"
                value={form.instructions}
              />
            </label>

            <div ref={questionPoolRef}>
              <AdminMultiSelect
              emptyStateText={
                form.topic_id
                  ? "Bu filtrelerle eşleşen soru bulunamadı."
                  : "Önce konu seçerek soru havuzunu daralt."
              }
              helperText="Teste sadece seçili konuya ait aktif test soruları eklenebilir. Kullanıcı tarafında sıralama random akabilir; burada asıl amaç doğru soru havuzunu kurmak."
              hideSelectedFromOptions
              label="Teste Dahil Edilen Sorular"
              onChange={(question_ids) => setForm((current) => ({ ...current, question_ids }))}
              options={questionOptions}
              searchPlaceholder="Soru ara"
              selectedSummaryLabel="soru seçildi"
              showSelectedChips={false}
              value={form.question_ids}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-1">
              <label className="block max-w-[320px] space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Zorluk
                </span>
                <select
                  className="admin-input h-11"
                  onChange={(event) =>
                    setDifficultyFilter(event.target.value as typeof difficultyFilter)
                  }
                  value={difficultyFilter}
                >
                  <option value="all">Tüm zorluklar</option>
                  <option value="easy">Kolay</option>
                  <option value="medium">Orta</option>
                  <option value="hard">Zor</option>
                </select>
              </label>

            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-[var(--color-admin-ink)]">Seçili Sorular</label>
                <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">
                  Teste giren soruları burada net görürsün. İstersen buradan da çıkarabilirsin.
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
                {selectedQuestions.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                    Henüz soru eklenmedi.
                  </p>
                ) : (
                  selectedQuestions.map((question, index) => (
                    <div
                      key={question.id}
                      className={`flex items-start gap-3 px-4 py-3 ${
                        index !== selectedQuestions.length - 1
                          ? "border-b border-[var(--color-admin-line)]/80"
                          : ""
                      }`}
                    >
                      <div className="flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[11px] font-bold text-[var(--color-admin-muted)]">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="overflow-hidden text-sm font-semibold leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                          {question.question_text}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                          {question.question_type === "multiple_choice" ? "Test" : "Doğru / Yanlış"} ·{" "}
                          {question.difficulty === "easy"
                            ? "Kolay"
                            : question.difficulty === "medium"
                              ? "Orta"
                              : "Zor"}
                        </p>
                      </div>
                      <button
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-danger)]"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            question_ids: current.question_ids.filter((id) => id !== question.id),
                          }))
                        }
                        type="button"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                {error}
              </div>
            ) : null}
          </form>
        </AdminTableCard>
      </div>

      <div className="space-y-4">
        <AdminFormActionsCard cancelHref="/testler" formId={formId} saving={saving} submitLabel="Kaydet" />

        {mode === "edit" && test?.readiness ? (
          <AdminTableCard>
            <AdminReadinessPanel
              actions={[
                {
                  label: "Soru Havuzuna Git",
                  onClick: () => questionPoolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                },
              ]}
              entityLabel="Test"
              readiness={test.readiness}
            />
          </AdminTableCard>
        ) : null}

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Özet
            </h3>

            <div className="mt-4 rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                {selectedTopic?.subject?.name ?? "Ders"} · {selectedTopic?.name ?? "Konu"}
              </p>
              <p className="mt-3 text-base font-bold leading-7 text-[var(--color-admin-ink)]">
                {form.title || "Test başlığı burada görünecek."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                    Soru Sayısı
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--color-admin-ink)]">{form.question_ids.length}</p>
                </div>
                <div className="rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                    Soru Havuzu
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--color-admin-ink)]">
                    {topicQuestions.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm text-[var(--color-admin-muted)]">
              {topicsLoading || questionsLoading
                ? "Konu ve soru havuzu yükleniyor..."
                : "Testler konu bazlı sabit şablonlar olarak çalışır. Kullanıcı tarafındaki test çöz listesi bu hazır testlerden beslenecek."}
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
