"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AdminMultiSelect } from "@/components/admin/AdminMultiSelect";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminExam, AdminMockExam, AdminQuestion } from "@/lib/types";

const emptyForm = {
  exam_id: null as number | null,
  title: "",
  slug: "",
  status: "draft",
  duration_min: "110",
  scheduled_at: "",
  is_tr_general: false,
  question_ids: [] as number[],
};

export function MockExamFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const router = useRouter();
  const formId = `mock-exam-form-${mode}${id ? `-${id}` : ""}`;
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();

  const [form, setForm] = useState(emptyForm);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadCatalog() {
      setExamsLoading(true);
      setQuestionsLoading(true);

      try {
        const [examsResponse, questionsResponse] = await Promise.all([
          adminApiRequest<{ exams: AdminExam[] }>("/admin/exams", { token }),
          adminApiRequest<{ questions: AdminQuestion[] }>("/admin/questions", { token }),
        ]);

        if (cancelled) {
          return;
        }

        setExams(examsResponse.data.exams);
        setQuestions(questionsResponse.data.questions);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Deneme verileri yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setExamsLoading(false);
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

    async function loadExam() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ mock_exam: AdminMockExam }>(`/admin/mock-exams/${id}`, { token });
        const item = response.data.mock_exam;

        if (cancelled) {
          return;
        }

        setForm({
          exam_id: item.exam?.id ?? item.exam_id ?? null,
          title: item.title,
          slug: item.slug ?? "",
          status: item.status ?? "draft",
          duration_min: String(item.duration_min ?? 110),
          scheduled_at: "",
          is_tr_general: Boolean(item.is_tr_general),
          question_ids: item.question_ids ?? [],
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Deneme kaydı yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadExam();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    setTitle(form.title.trim() || "Deneme Düzenle");

    return () => setTitle(null);
  }, [form.title, mode, setTitle]);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === form.exam_id) ?? null,
    [exams, form.exam_id],
  );

  const examOptions = useMemo(
    () =>
      exams.map((exam) => ({
        id: exam.id,
        label: exam.name,
        hint: exam.ministry?.name,
      })),
    [exams],
  );

  const examSubjectIds = useMemo(
    () => new Set(selectedExam?.subject_ids ?? []),
    [selectedExam],
  );

  const examSubjects = useMemo(
    () => {
      const subjectMap = new Map<number, { id: number; name: string }>();

      questions.forEach((question) => {
        const subject = question.topic?.subject;

        if (!subject) {
          return;
        }

        if (!(selectedExam?.subject_ids ?? []).includes(subject.id)) {
          return;
        }

        if (!subjectMap.has(subject.id)) {
          subjectMap.set(subject.id, { id: subject.id, name: subject.name });
        }
      });

      return Array.from(subjectMap.values());
    },
    [questions, selectedExam?.subject_ids],
  );

  const examQuestions = useMemo(
    () =>
      questions.filter((question) => {
        const subjectId = question.topic?.subject?.id;
        return subjectId ? examSubjectIds.has(subjectId) : false;
      }),
    [examSubjectIds, questions],
  );

  const topicOptions = useMemo(() => {
    const topicMap = new Map<number, { id: number; label: string; hint?: string }>();

    examQuestions.forEach((question) => {
      if (!question.topic?.id) {
        return;
      }

      if (selectedSubjectId !== null && question.topic.subject?.id !== selectedSubjectId) {
        return;
      }

      if (!topicMap.has(question.topic.id)) {
        topicMap.set(question.topic.id, {
          id: question.topic.id,
          label: question.topic.name,
          hint: question.topic.subject?.name,
        });
      }
    });

    return Array.from(topicMap.values());
  }, [examQuestions, selectedSubjectId]);

  const subjectOptions = useMemo(
    () =>
      examSubjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
      })),
    [examSubjects],
  );

  const filteredQuestions = useMemo(
    () =>
      examQuestions.filter((question) => {
        if (question.question_type !== "multiple_choice") {
          return false;
        }

        if (question.status !== "active") {
          return false;
        }

        if (selectedTopicId !== null && question.topic?.id !== selectedTopicId) {
          return false;
        }

        if (selectedSubjectId !== null && question.topic?.subject?.id !== selectedSubjectId) {
          return false;
        }

        if (difficultyFilter !== "all" && question.difficulty !== difficultyFilter) {
          return false;
        }

        return true;
      }),
    [difficultyFilter, examQuestions, selectedSubjectId, selectedTopicId],
  );

  const questionOptions = useMemo(
    () =>
      filteredQuestions.map((question) => ({
        id: question.id,
        label: question.question_text?.slice(0, 110) ?? "Soru",
        hint: `${question.topic?.subject?.name ?? "Ders"} · ${question.topic?.name ?? "Konu"}`,
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

  const topicDistribution = useMemo(() => {
    const distribution = new Map<string, { subjectName: string; topicName: string; count: number }>();

    selectedQuestions.forEach((question) => {
      const subjectName = question.topic?.subject?.name ?? "Ders yok";
      const topicName = question.topic?.name ?? "Konu yok";
      const key = `${subjectName}::${topicName}`;
      const current = distribution.get(key);

      if (current) {
        current.count += 1;
      } else {
        distribution.set(key, { subjectName, topicName, count: 1 });
      }
    });

    return Array.from(distribution.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.topicName.localeCompare(b.topicName, "tr");
    });
  }, [selectedQuestions]);

  useEffect(() => {
    if (!form.exam_id) {
      if (form.question_ids.length > 0) {
        setForm((current) => ({ ...current, question_ids: [] }));
      }

      setSelectedTopicId(null);
      setSelectedSubjectId(null);
      return;
    }

    const allowedIds = new Set(examQuestions.map((question) => question.id));
    const nextIds = form.question_ids.filter((questionId) => allowedIds.has(questionId));

    if (nextIds.length !== form.question_ids.length) {
      setForm((current) => ({ ...current, question_ids: nextIds }));
    }
  }, [examQuestions, form.exam_id, form.question_ids]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!form.exam_id) {
      setError("Bir sınav seçmelisin.");
      return;
    }

    if (form.question_ids.length === 0) {
      setError("Denemeye en az bir soru eklemelisin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ mock_exam: AdminMockExam }>(
        mode === "edit" ? `/admin/mock-exams/${id}` : "/admin/mock-exams",
        {
          token,
          method: mode === "edit" ? "PUT" : "POST",
          body: {
            exam_id: form.exam_id,
            title: form.title,
            slug: form.slug || null,
            status: form.status,
            duration_min: Number(form.duration_min),
            is_tr_general: form.is_tr_general,
            question_ids: form.question_ids,
          },
        },
      );

      showToast({
        tone: "success",
        title: mode === "edit" ? "Deneme güncellendi" : "Deneme oluşturuldu",
        description: selectedExam?.name ?? "Sınav havuzu",
      });

      if (mode === "create") {
        router.replace(`/denemeler/${response.data.mock_exam.id}/duzenle`);
      }
    } catch (submitError) {
      const description =
        submitError instanceof Error ? submitError.message : "Deneme kaydı tamamlanamadı.";

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
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">Deneme yükleniyor...</div>
      </AdminTableCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" id={formId} onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Sınav
                </span>
                <AdminSearchSelect
                  emptyText="Sınav bulunamadı."
                  hideLabel
                  label="Sınav"
                  onChange={(next) =>
                    setForm((current) => ({
                      ...current,
                      exam_id: next,
                    }))
                  }
                  options={examOptions}
                  placeholder="Sınav ara"
                  value={form.exam_id}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Süre
                </span>
                <input
                  className="admin-input h-11"
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, duration_min: event.target.value }))}
                  placeholder="110"
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
                Deneme Başlığı
              </span>
              <input
                className="admin-input h-11"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Örn. Adalet Bakanlığı Genel Deneme 1"
                value={form.title}
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-1">
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
            </div>

            <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
              <input
                checked={form.is_tr_general}
                onChange={(event) => setForm((current) => ({ ...current, is_tr_general: event.target.checked }))}
                type="checkbox"
              />
              TR geneli deneme olarak işaretle
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Ders Filtresi
                </span>
                <AdminSearchSelect
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={(next) => {
                    setSelectedSubjectId(next);
                    setSelectedTopicId(null);
                  }}
                  options={subjectOptions}
                  placeholder="Ders seç"
                  value={selectedSubjectId}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Konu Filtresi
                </span>
                <AdminSearchSelect
                  emptyText="Konu bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={setSelectedTopicId}
                  options={topicOptions}
                  placeholder="Konu seç"
                  value={selectedTopicId}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Zorluk
                </span>
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
              </label>

            </div>

            <AdminMultiSelect
              emptyStateText={
                form.exam_id
                  ? "Bu filtrelerle eşleşen soru bulunamadı."
                  : "Önce sınav seçerek soru havuzunu daralt."
              }
              helperText="Denemeye sadece seçilen sınava bağlı derslerin aktif test sorularından ekleme yapılır. Aktif bir deneme tam 80 sorudan oluşmalıdır."
              hideSelectedFromOptions
              label="Denemeye Dahil Edilen Sorular"
              onChange={(question_ids) => setForm((current) => ({ ...current, question_ids }))}
              options={questionOptions}
              searchPlaceholder="Soru ara"
              selectedSummaryLabel="soru seçildi"
              showSelectedChips={false}
              value={form.question_ids}
            />

            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-[var(--color-admin-ink)]">Seçili Sorular</label>
                <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">
                  Denemeye giren sorular burada net görünür. İstersen buradan da çıkarabilirsin.
                </p>
              </div>

              <div className="max-h-[420px] overflow-y-auto rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
                {selectedQuestions.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-[var(--color-admin-muted)]">Henüz soru eklenmedi.</p>
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
                          {question.topic?.subject?.name ?? "Ders"} · {question.topic?.name ?? "Konu"}
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
        <AdminFormActionsCard cancelHref="/denemeler" formId={formId} saving={saving} submitLabel="Kaydet" />

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Dağılım
            </h3>

            <div className="mt-4 rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                {selectedExam?.name ?? "Sınav seçilmedi"}
              </p>
              <p className="mt-3 text-base font-bold leading-7 text-[var(--color-admin-ink)]">
                {form.title || "Deneme başlığı burada görünecek."}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                    Seçili Soru
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--color-admin-ink)]">{form.question_ids.length}</p>
                </div>
                <div className="rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                    Sınav Havuzu
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--color-admin-ink)]">{examQuestions.length}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
              <div className="border-b border-[var(--color-admin-line)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--color-admin-ink)]">Konu Bazlı Soru Dağılımı</p>
                <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                  Gerçek sınavdaki konu dağılımını buradan anlık takip edebilirsin.
                </p>
              </div>

              {topicDistribution.length === 0 ? (
                <p className="px-4 py-4 text-sm text-[var(--color-admin-muted)]">Henüz soru seçilmedi.</p>
              ) : (
                topicDistribution.map((item, index) => (
                  <div
                    key={`${item.subjectName}-${item.topicName}`}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      index !== topicDistribution.length - 1 ? "border-b border-[var(--color-admin-line)]/80" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-admin-ink)]">
                        {item.topicName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{item.subjectName}</p>
                    </div>
                    <div className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-1 text-sm font-bold text-[var(--color-admin-ink)]">
                      {item.count}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm text-[var(--color-admin-muted)]">
              {examsLoading || questionsLoading
                ? "Sınav ve soru havuzu yükleniyor..."
                : "Aktif bir deneme tam 80 sorudan oluşur. 80 altı veya üstü kayıtlar draft/pasif kalmalıdır."}
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
