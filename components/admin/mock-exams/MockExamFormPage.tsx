"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Wand2, X } from "lucide-react";
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

type MockExamAutoDraftResponse = {
  question_ids: number[];
  questions: AdminQuestion[];
  summary: {
    target_count: number;
    selected_count: number;
    missing_count: number;
    sections: Array<{
      section_id: number | null;
      title: string;
      target_count: number;
      selected_count: number;
      available_count: number;
      subjects: Array<{
        subject_id: number;
        subject_name?: string | null;
        target_count: number;
        selected_count: number;
        available_count: number;
      }>;
    }>;
  };
};

function isMockCandidate(question: AdminQuestion) {
  return (
    question.question_type === "multiple_choice" &&
    question.status === "active" &&
    question.approval_status === "approved"
  );
}

function sortMockCandidates(left: AdminQuestion, right: AdminQuestion) {
  const leftIsMock = left.question_bank_type === "mock_exam";
  const rightIsMock = right.question_bank_type === "mock_exam";

  if (leftIsMock !== rightIsMock) {
    return leftIsMock ? -1 : 1;
  }

  return left.id - right.id;
}

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
  const [autoDrafting, setAutoDrafting] = useState(false);
  const [autoDraftSummary, setAutoDraftSummary] = useState<MockExamAutoDraftResponse["summary"] | null>(null);
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
        const examsResponse = await adminApiRequest<{ exams: AdminExam[] }>("/admin/exams", { token });

        if (cancelled) {
          return;
        }

        setExams(examsResponse.data.exams);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Sınav verileri yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setExamsLoading(false);
        }
      }

      try {
        const questionsResponse = await adminApiRequest<{ questions: AdminQuestion[] }>(
          "/admin/questions?per_page=1000&approval_status=approved&status=active&question_type=multiple_choice",
          { token },
        );

        if (cancelled) {
          return;
        }

        setQuestions(questionsResponse.data.questions);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Deneme soru havuzu yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
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
  const expectedMockQuestionCount = selectedExam?.total_question_count ?? 80;

  const examOptions = useMemo(
    () =>
      exams.map((exam) => ({
        id: exam.id,
        label: exam.name,
        hint: exam.ministry?.name,
      })),
    [exams],
  );

  const examTopicIds = useMemo(
    () => new Set(selectedExam?.topic_ids ?? []),
    [selectedExam],
  );

  const examSectionSubjectIds = useMemo(() => {
    const next = new Set<number>();

    selectedExam?.sections.forEach((section) => {
      section.subject_ids.forEach((subjectId) => next.add(subjectId));
      section.subjects.forEach((subject) => next.add(subject.id));
    });

    return next;
  }, [selectedExam?.sections]);

  const examSubjects = useMemo(
    () => {
      const subjectMap = new Map<number, { id: number; name: string }>();

      questions.forEach((question) => {
        const subject = question.topic?.subject;

        if (!subject) {
          return;
        }

        const topicId = question.topic?.id;
        const subjectId = question.topic?.subject?.id;

        if (
          (!topicId || !examTopicIds.has(topicId)) &&
          (!subjectId || !examSectionSubjectIds.has(subjectId))
        ) {
          return;
        }

        if (!subjectMap.has(subject.id)) {
          subjectMap.set(subject.id, { id: subject.id, name: subject.name });
        }
      });

      return Array.from(subjectMap.values());
    },
    [examSectionSubjectIds, examTopicIds, questions],
  );

  const examQuestions = useMemo(
    () =>
      questions.filter((question) => {
        const topicId = question.topic?.id;
        const subjectId = question.topic?.subject?.id;

        return Boolean(
          (topicId && examTopicIds.has(topicId)) ||
            (subjectId && examSectionSubjectIds.has(subjectId)),
        );
      }),
    [examSectionSubjectIds, examTopicIds, questions],
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
        if (!isMockCandidate(question)) {
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
      }).sort(sortMockCandidates),
    [difficultyFilter, examQuestions, selectedSubjectId, selectedTopicId],
  );

  const localAutoDraft = useMemo(() => {
    const sections = selectedExam?.sections ?? [];
    const usedQuestionIds = new Set<number>();
    const selectedQuestionIds: number[] = [];
    const summarySections: MockExamAutoDraftResponse["summary"]["sections"] = [];
    const candidates = examQuestions.filter(isMockCandidate);

    const pickQuestions = (subjectIds: number[], targetCount: number) => {
      const subjectIdSet = new Set(subjectIds);
      const pool = candidates
        .filter((question) => {
          if (usedQuestionIds.has(question.id)) {
            return false;
          }

          if (subjectIdSet.size === 0) {
            return true;
          }

          const subjectId = question.topic?.subject?.id;
          return subjectId ? subjectIdSet.has(subjectId) : false;
        })
        .sort(sortMockCandidates)
        .slice(0, targetCount);

      pool.forEach((question) => {
        usedQuestionIds.add(question.id);
        selectedQuestionIds.push(question.id);
      });

      return pool;
    };

    if (sections.length > 0) {
      sections.forEach((section) => {
        const sectionSubjectIds = Array.from(new Set([
          ...section.subject_ids,
          ...section.subjects.map((subject) => subject.id),
        ]));
        const targetCount = section.question_count;
        const picked = pickQuestions(sectionSubjectIds, targetCount);

        summarySections.push({
          section_id: section.id,
          title: section.title,
          target_count: targetCount,
          selected_count: picked.length,
          available_count: candidates.filter((question) => {
            const subjectId = question.topic?.subject?.id;
            return sectionSubjectIds.length === 0 || (subjectId ? sectionSubjectIds.includes(subjectId) : false);
          }).length,
          subjects: section.subjects.map((subject) => {
            const subjectPickedCount = picked.filter((question) => question.topic?.subject?.id === subject.id).length;
            const subjectAvailableCount = candidates.filter((question) => question.topic?.subject?.id === subject.id).length;

            return {
              subject_id: subject.id,
              subject_name: subject.name,
              target_count: section.subjects.length > 0 ? Math.floor(targetCount / section.subjects.length) : targetCount,
              selected_count: subjectPickedCount,
              available_count: subjectAvailableCount,
            };
          }),
        });
      });
    } else {
      const picked = pickQuestions([], expectedMockQuestionCount);

      summarySections.push({
        section_id: null,
        title: "Genel",
        target_count: expectedMockQuestionCount,
        selected_count: picked.length,
        available_count: candidates.length,
        subjects: [],
      });
    }

    const targetCount = summarySections.reduce((total, section) => total + section.target_count, 0);
    const selectedCount = selectedQuestionIds.length;

    return {
      question_ids: selectedQuestionIds,
      summary: {
        target_count: targetCount,
        selected_count: selectedCount,
        missing_count: Math.max(targetCount - selectedCount, 0),
        sections: summarySections,
      },
    };
  }, [examQuestions, expectedMockQuestionCount, selectedExam?.sections]);

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

  async function createAutoDraft() {
    if (!token || !form.exam_id) {
      setError("Önce bir sınav seçmelisin.");
      return;
    }

    setAutoDrafting(true);
    setError(null);

    try {
      const response = await adminApiRequest<MockExamAutoDraftResponse>("/admin/mock-exams/auto-draft", {
        token,
        method: "POST",
        body: { exam_id: form.exam_id },
      });

      setQuestions((current) => {
        const questionMap = new Map(current.map((question) => [question.id, question]));
        response.data.questions.forEach((question) => questionMap.set(question.id, question));
        return Array.from(questionMap.values());
      });
      const nextQuestionIds =
        response.data.summary.missing_count > 0 && localAutoDraft.question_ids.length > response.data.question_ids.length
          ? localAutoDraft.question_ids
          : response.data.question_ids;
      const nextSummary =
        response.data.summary.missing_count > 0 && localAutoDraft.question_ids.length > response.data.question_ids.length
          ? localAutoDraft.summary
          : response.data.summary;

      setForm((current) => ({
        ...current,
        question_ids: nextQuestionIds,
        duration_min: String(selectedExam?.duration_min ?? current.duration_min),
        title: current.title.trim() || `${selectedExam?.name ?? "Sınav"} Deneme 1`,
      }));
      setAutoDraftSummary(nextSummary);

      showToast({
        tone: nextSummary.missing_count > 0 ? "warning" : "success",
        title: "Deneme taslağı oluşturuldu",
        description:
          nextSummary.missing_count > 0
            ? `${nextSummary.selected_count}/${nextSummary.target_count} soru seçildi. Eksik havuz var.`
            : `${nextSummary.selected_count} soru blueprint'e göre seçildi.`,
      });
    } catch (draftError) {
      if (localAutoDraft.question_ids.length > 0) {
        setForm((current) => ({
          ...current,
          question_ids: localAutoDraft.question_ids,
          duration_min: String(selectedExam?.duration_min ?? current.duration_min),
          title: current.title.trim() || `${selectedExam?.name ?? "Sınav"} Deneme 1`,
        }));
        setAutoDraftSummary(localAutoDraft.summary);
        showToast({
          tone: localAutoDraft.summary.missing_count > 0 ? "warning" : "success",
          title: "Deneme taslağı oluşturuldu",
          description:
            localAutoDraft.summary.missing_count > 0
              ? `${localAutoDraft.summary.selected_count}/${localAutoDraft.summary.target_count} soru mevcut havuzdan seçildi.`
              : `${localAutoDraft.summary.selected_count} soru mevcut havuzdan seçildi.`,
        });
      } else {
        const message = draftError instanceof Error ? draftError.message : "Deneme taslağı oluşturulamadı.";
        setError(message);
        showToast({ tone: "error", title: "Taslak oluşturulamadı", description: message });
      }
    } finally {
      setAutoDrafting(false);
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
                      duration_min: String(exams.find((exam) => exam.id === next)?.duration_min ?? current.duration_min),
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

            <section className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Blueprint taslağı</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--color-admin-muted)]">
                    Sınavdaki soru dağılımına göre onaylı deneme sorularını, eksik kalırsa normal soruları seçer.
                  </p>
                </div>
                <button
                  className="admin-button admin-button-primary h-10 px-3 py-2 text-xs"
                  disabled={!form.exam_id || autoDrafting}
                  onClick={() => void createAutoDraft()}
                  type="button"
                >
                  {autoDrafting ? <Loader2 className="animate-spin" size={15} /> : <Wand2 size={15} />}
                  Taslak oluştur
                </button>
              </div>

              {autoDraftSummary ? (
                <div className="mt-4 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <SummaryMetric label="Hedef" value={autoDraftSummary.target_count} />
                    <SummaryMetric label="Seçilen" value={autoDraftSummary.selected_count} />
                    <SummaryMetric
                      label="Eksik"
                      tone={autoDraftSummary.missing_count > 0 ? "warn" : "ok"}
                      value={autoDraftSummary.missing_count}
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-2xl border border-[var(--color-admin-line)] bg-white">
                    {autoDraftSummary.sections.map((section) => (
                      <div
                        className="border-b border-[var(--color-admin-line)]/80 px-3 py-2 last:border-b-0"
                        key={`${section.section_id ?? "general"}-${section.title}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-xs font-extrabold text-[var(--color-admin-ink)]">
                            {section.title}
                          </p>
                          <p className="text-xs font-bold text-[var(--color-admin-muted)]">
                            {section.selected_count}/{section.target_count}
                          </p>
                        </div>
                        {section.subjects.length > 0 ? (
                          <p className="mt-1 text-[11px] font-semibold text-[var(--color-admin-muted)]">
                            {section.subjects
                              .map(
                                (subject) =>
                                  `${subject.subject_name ?? "Ders"} ${subject.selected_count}/${subject.target_count}`,
                              )
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

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
              helperText={`Denemeye seçilen sınava bağlı derslerin aktif/onaylı sorularından ekleme yapılır. Deneme soruları önceliklidir; eksikse normal sorular da kullanılabilir. Aktif bir deneme tam ${expectedMockQuestionCount} sorudan oluşmalıdır.`}
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
                : `Aktif bir deneme tam ${expectedMockQuestionCount} sorudan oluşur. Bu sayının altı veya üstü kayıtlar draft/pasif kalmalıdır.`}
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "ok";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-50 text-amber-700"
      : tone === "ok"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-white text-[var(--color-admin-ink)]";

  return (
    <div className={`rounded-2xl px-3 py-3 text-center ${toneClass}`}>
      <p className="text-base font-extrabold">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em]">{label}</p>
    </div>
  );
}
