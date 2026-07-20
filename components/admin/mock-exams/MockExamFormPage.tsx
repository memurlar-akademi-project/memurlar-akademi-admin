"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Wand2, X } from "lucide-react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { AdminQuestionTextBlock } from "@/components/admin/questions/AdminQuestionTextBlock";
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
  is_free: false,
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

type QuestionSearchParams = {
  questionBankType?: "practice" | "mock_exam";
  subjectId?: number;
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

function uniqueQuestions(questions: AdminQuestion[]) {
  return Array.from(new Map(questions.map((question) => [question.id, question])).values());
}

async function fetchApprovedQuestions(token: string, params: QuestionSearchParams = {}) {
  const searchParams = new URLSearchParams({
    per_page: "1000",
    approval_status: "approved",
    status: "active",
    question_type: "multiple_choice",
  });

  if (params.questionBankType) {
    searchParams.set("question_bank_type", params.questionBankType);
  }

  if (params.subjectId) {
    searchParams.set("subject_id", String(params.subjectId));
  }

  const response = await adminApiRequest<{ questions: AdminQuestion[] }>(`/admin/questions?${searchParams.toString()}`, { token });

  return response.data.questions;
}

function buildLocalDraft(
  selectedExam: AdminExam | null,
  examQuestions: AdminQuestion[],
  expectedMockQuestionCount: number,
  unavailableQuestionIds = new Set<number>(),
) {
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

        if (unavailableQuestionIds.has(question.id)) {
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
  const [mockExams, setMockExams] = useState<AdminMockExam[]>([]);
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
  const [replacementQuestionId, setReplacementQuestionId] = useState<number | null>(null);
  const [activeSelectedQuestionIndex, setActiveSelectedQuestionIndex] = useState(0);
  const [activeAddableQuestionIndex, setActiveAddableQuestionIndex] = useState(0);
  const [activeReplacementQuestionIndex, setActiveReplacementQuestionIndex] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    const authToken = token;
    let cancelled = false;

    async function loadCatalog() {
      setExamsLoading(true);
      setQuestionsLoading(true);

      try {
        const [examsResponse, mockExamsResponse] = await Promise.all([
          adminApiRequest<{ exams: AdminExam[] }>("/admin/exams", { token: authToken }),
          adminApiRequest<{ mock_exams: AdminMockExam[] }>("/admin/mock-exams?per_page=1000", { token: authToken }),
        ]);

        if (cancelled) {
          return;
        }

        setExams(examsResponse.data.exams);
        setMockExams(mockExamsResponse.data.mock_exams);
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
        const [mockQuestions, practiceQuestions] = await Promise.all([
          fetchApprovedQuestions(authToken, { questionBankType: "mock_exam" }),
          fetchApprovedQuestions(authToken, { questionBankType: "practice" }),
        ]);

        if (cancelled) {
          return;
        }

        setQuestions(uniqueQuestions([...mockQuestions, ...practiceQuestions]));
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
          is_free: Boolean(item.is_free),
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

  const unavailableQuestionIds = useMemo(() => {
    const next = new Set<number>();

    mockExams.forEach((mockExam) => {
      if (mode === "edit" && mockExam.id === id) {
        return;
      }

      mockExam.question_ids?.forEach((questionId) => next.add(questionId));
    });

    return next;
  }, [id, mockExams, mode]);

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
      examSubjects.map((subject) => {
        const selectedCount = form.question_ids.filter((questionId) => {
          const question = questions.find((item) => item.id === questionId);
          return question?.topic?.subject?.id === subject.id;
        }).length;
        const availableCount = examQuestions.filter(
          (question) =>
            isMockCandidate(question) &&
            !unavailableQuestionIds.has(question.id) &&
            question.topic?.subject?.id === subject.id,
        ).length;

        return {
          id: subject.id,
          label: `${subject.name} (${selectedCount}/${availableCount})`,
          hint: `Seçili ${selectedCount} · Havuz ${availableCount}`,
        };
      }),
    [examQuestions, examSubjects, form.question_ids, questions, unavailableQuestionIds],
  );

  const filteredQuestions = useMemo(
    () =>
      examQuestions.filter((question) => {
        if (!isMockCandidate(question)) {
          return false;
        }

        if (unavailableQuestionIds.has(question.id)) {
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
    [difficultyFilter, examQuestions, selectedSubjectId, selectedTopicId, unavailableQuestionIds],
  );

  const localAutoDraft = useMemo(() => {
    return buildLocalDraft(selectedExam, examQuestions, expectedMockQuestionCount, unavailableQuestionIds);
  }, [examQuestions, expectedMockQuestionCount, selectedExam, unavailableQuestionIds]);

  const selectedQuestions = useMemo(
    () =>
      form.question_ids
        .map((questionId) => questions.find((question) => question.id === questionId))
        .filter((question): question is AdminQuestion => Boolean(question)),
    [form.question_ids, questions],
  );

  const selectedQuestionIds = useMemo(() => new Set(form.question_ids), [form.question_ids]);

  const visibleSelectedQuestions = useMemo(
    () =>
      selectedQuestions.filter((question) => {
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
    [difficultyFilter, selectedQuestions, selectedSubjectId, selectedTopicId],
  );

  const addableQuestions = useMemo(
    () => filteredQuestions.filter((question) => !selectedQuestionIds.has(question.id)).slice(0, 24),
    [filteredQuestions, selectedQuestionIds],
  );

  const activeSelectedQuestion = visibleSelectedQuestions[activeSelectedQuestionIndex] ?? null;
  const activeAddableQuestion = addableQuestions[activeAddableQuestionIndex] ?? null;
  const activeReplacementCandidates = activeSelectedQuestion ? replacementCandidatesFor(activeSelectedQuestion) : [];
  const activeReplacementQuestion = activeReplacementCandidates[activeReplacementQuestionIndex] ?? null;

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

    const allowedIds = new Set(
      examQuestions
        .filter((question) => !unavailableQuestionIds.has(question.id))
        .map((question) => question.id),
    );
    const nextIds = form.question_ids.filter((questionId) => allowedIds.has(questionId));

    if (nextIds.length !== form.question_ids.length) {
      setForm((current) => ({ ...current, question_ids: nextIds }));
    }
  }, [examQuestions, form.exam_id, form.question_ids, unavailableQuestionIds]);

  useEffect(() => {
    setActiveSelectedQuestionIndex(0);
    setActiveAddableQuestionIndex(0);
    setActiveReplacementQuestionIndex(0);
  }, [difficultyFilter, selectedSubjectId, selectedTopicId]);

  useEffect(() => {
    setActiveSelectedQuestionIndex((current) => clampIndex(current, visibleSelectedQuestions.length));
  }, [visibleSelectedQuestions.length]);

  useEffect(() => {
    setActiveAddableQuestionIndex((current) => clampIndex(current, addableQuestions.length));
  }, [addableQuestions.length]);

  useEffect(() => {
    setActiveReplacementQuestionIndex((current) => clampIndex(current, activeReplacementCandidates.length));
  }, [activeReplacementCandidates.length, replacementQuestionId]);

  function addQuestion(questionId: number) {
    setForm((current) => {
      if (current.question_ids.includes(questionId)) {
        return current;
      }

      return { ...current, question_ids: [...current.question_ids, questionId] };
    });
  }

  function removeQuestion(questionId: number) {
    setForm((current) => ({
      ...current,
      question_ids: current.question_ids.filter((currentId) => currentId !== questionId),
    }));
    setReplacementQuestionId((current) => (current === questionId ? null : current));
  }

  function replaceQuestion(previousQuestionId: number, nextQuestionId: number) {
    setForm((current) => ({
      ...current,
      question_ids: current.question_ids.map((questionId) =>
        questionId === previousQuestionId ? nextQuestionId : questionId,
      ),
    }));
    setReplacementQuestionId(null);
  }

  function replacementCandidatesFor(question: AdminQuestion) {
    const subjectId = question.topic?.subject?.id;
    const topicId = question.topic?.id;
    const sameTopic = filteredQuestions.filter(
      (candidate) => candidate.id !== question.id && !selectedQuestionIds.has(candidate.id) && candidate.topic?.id === topicId,
    );
    const sameSubject = filteredQuestions.filter(
      (candidate) =>
        candidate.id !== question.id &&
        !selectedQuestionIds.has(candidate.id) &&
        candidate.topic?.subject?.id === subjectId &&
        candidate.topic?.id !== topicId,
    );

    return uniqueQuestions([...sameTopic, ...sameSubject, ...addableQuestions]).slice(0, 8);
  }

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
            is_free: form.is_free,
            question_ids: form.question_ids,
          },
        },
      );
      const savedMockExam = response.data.mock_exam;

      setForm((current) => ({ ...current, question_ids: savedMockExam.question_ids ?? form.question_ids }));
      setMockExams((current) => [savedMockExam, ...current.filter((mockExam) => mockExam.id !== savedMockExam.id)]);

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
      let fallbackDraft = localAutoDraft;

      if (response.data.summary.missing_count > 0) {
        const missingSubjectIds = response.data.summary.sections.flatMap((section) =>
          section.subjects
            .filter((subject) => subject.selected_count < subject.target_count)
            .map((subject) => subject.subject_id),
        );

        if (missingSubjectIds.length > 0) {
          const extraQuestionGroups = await Promise.all(
            Array.from(new Set(missingSubjectIds)).flatMap((subjectId) => [
              fetchApprovedQuestions(token, { questionBankType: "mock_exam", subjectId }),
              fetchApprovedQuestions(token, { questionBankType: "practice", subjectId }),
            ]),
          );

          const extraQuestions = uniqueQuestions(extraQuestionGroups.flat());

          if (extraQuestions.length > 0) {
            const mergedQuestions = uniqueQuestions([...questions, ...response.data.questions, ...extraQuestions]);
            const expandedDraft = buildLocalDraft(
              selectedExam,
              mergedQuestions,
              expectedMockQuestionCount,
              unavailableQuestionIds,
            );
            fallbackDraft = expandedDraft;

            setQuestions(mergedQuestions);
          }
        }
      }

      const backendQuestionIds = response.data.question_ids.filter((questionId) => !unavailableQuestionIds.has(questionId));
      const backendSummary = {
        ...response.data.summary,
        selected_count: backendQuestionIds.length,
        missing_count: Math.max(response.data.summary.target_count - backendQuestionIds.length, 0),
      };
      const nextQuestionIds =
        backendSummary.missing_count > 0 && fallbackDraft.question_ids.length > backendQuestionIds.length
          ? fallbackDraft.question_ids
          : backendQuestionIds;
      const nextSummary =
        backendSummary.missing_count > 0 && fallbackDraft.question_ids.length > backendQuestionIds.length
          ? fallbackDraft.summary
          : backendSummary;

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

            <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
              <input
                checked={form.is_free}
                onChange={(event) => setForm((current) => ({ ...current, is_free: event.target.checked }))}
                type="checkbox"
              />
              Ücretsiz üyelerin başlatabileceği deneme olarak işaretle
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

            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Soru çalışma alanı</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--color-admin-muted)]">
                    Filtrelediğin dersteki seçili sorular tam metin görünür; buradan ekleme, çıkarma ve değiştirme yapılır.
                  </p>
                </div>
                <div className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-1.5 text-xs font-black text-[var(--color-admin-ink)]">
                  {form.question_ids.length}/{expectedMockQuestionCount} soru
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
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
                      setSelectedTopicId(null);
                      setReplacementQuestionId(null);
                    }}
                    options={subjectOptions}
                    placeholder="Tüm dersler"
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
                    onChange={(next) => {
                      setSelectedTopicId(next);
                      setReplacementQuestionId(null);
                    }}
                    options={topicOptions}
                    placeholder="Tüm konular"
                    value={selectedTopicId}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Zorluk
                  </span>
                  <select
                    className="admin-input h-11"
                    onChange={(event) => {
                      setDifficultyFilter(event.target.value as typeof difficultyFilter);
                      setReplacementQuestionId(null);
                    }}
                    value={difficultyFilter}
                  >
                    <option value="all">Tümü</option>
                    <option value="easy">Kolay</option>
                    <option value="medium">Orta</option>
                    <option value="hard">Zor</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                {selectedQuestions.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-8 text-center text-sm font-semibold text-[var(--color-admin-muted)]">
                    Henüz soru seçilmedi. Taslak oluşturabilir veya alttaki havuzdan soru ekleyebilirsin.
                  </div>
                ) : visibleSelectedQuestions.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-8 text-center text-sm font-semibold text-[var(--color-admin-muted)]">
                    Bu filtrede seçili soru yok. Filtreyi temizleyebilir veya havuzdan soru ekleyebilirsin.
                  </div>
                ) : activeSelectedQuestion ? (
                  <QuestionCarouselFrame
                    count={visibleSelectedQuestions.length}
                    index={activeSelectedQuestionIndex}
                    onNext={() =>
                      setActiveSelectedQuestionIndex((current) => wrapIndex(current + 1, visibleSelectedQuestions.length))
                    }
                    onPrevious={() =>
                      setActiveSelectedQuestionIndex((current) => wrapIndex(current - 1, visibleSelectedQuestions.length))
                    }
                  >
                    <QuestionWorkCard
                      index={form.question_ids.indexOf(activeSelectedQuestion.id) + 1}
                      onRemove={() => removeQuestion(activeSelectedQuestion.id)}
                      onReplace={() => {
                        setReplacementQuestionId((current) =>
                          current === activeSelectedQuestion.id ? null : activeSelectedQuestion.id,
                        );
                        setActiveReplacementQuestionIndex(0);
                      }}
                      question={activeSelectedQuestion}
                      replacing={replacementQuestionId === activeSelectedQuestion.id}
                    >
                      {replacementQuestionId === activeSelectedQuestion.id ? (
                        <ReplacementCarousel
                          candidate={activeReplacementQuestion}
                          count={activeReplacementCandidates.length}
                          index={activeReplacementQuestionIndex}
                          onClose={() => setReplacementQuestionId(null)}
                          onNext={() =>
                            setActiveReplacementQuestionIndex((current) =>
                              wrapIndex(current + 1, activeReplacementCandidates.length),
                            )
                          }
                          onPrevious={() =>
                            setActiveReplacementQuestionIndex((current) =>
                              wrapIndex(current - 1, activeReplacementCandidates.length),
                            )
                          }
                          onSelect={(candidateId) => replaceQuestion(activeSelectedQuestion.id, candidateId)}
                        />
                      ) : null}
                    </QuestionWorkCard>
                  </QuestionCarouselFrame>
                ) : null}
              </div>

              <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-admin-line)] px-4 py-3">
                  <div>
                    <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Bu filtrede eklenebilir sorular</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                      Deneme soruları önce, normal onaylı sorular sonra listelenir.
                    </p>
                  </div>
                  <span className="text-xs font-black text-[var(--color-admin-muted)]">{addableQuestions.length} aday</span>
                </div>
                {addableQuestions.length === 0 ? (
                  <p className="px-4 py-5 text-sm font-semibold text-[var(--color-admin-muted)]">
                    Bu filtrede eklenebilir soru kalmadı.
                  </p>
                ) : activeAddableQuestion ? (
                  <div className="px-4 py-4">
                    <QuestionCarouselFrame
                      count={addableQuestions.length}
                      index={activeAddableQuestionIndex}
                      onNext={() =>
                        setActiveAddableQuestionIndex((current) => wrapIndex(current + 1, addableQuestions.length))
                      }
                      onPrevious={() =>
                        setActiveAddableQuestionIndex((current) => wrapIndex(current - 1, addableQuestions.length))
                      }
                    >
                      <QuestionCandidateCard
                        actionLabel="Ekle"
                        icon={<Plus size={14} />}
                        onSelect={() => addQuestion(activeAddableQuestion.id)}
                        question={activeAddableQuestion}
                      />
                    </QuestionCarouselFrame>
                  </div>
                ) : null}
              </div>
            </section>

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

function QuestionWorkCard({
  children,
  index,
  onRemove,
  onReplace,
  question,
  replacing,
}: {
  children?: ReactNode;
  index: number;
  onRemove: () => void;
  onReplace: () => void;
  question: AdminQuestion;
  replacing: boolean;
}) {
  return (
    <article className="rounded-[18px] border border-[var(--color-admin-line)] bg-white px-4 py-4 shadow-sm shadow-black/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <QuestionMeta index={index} question={question} />
        <div className="flex items-center gap-2">
          <button
            className="admin-button h-9 px-3 py-2 text-xs"
            onClick={onReplace}
            type="button"
          >
            <RefreshCw size={14} />
            {replacing ? "Adayları kapat" : "Değiştir"}
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-danger)]"
            onClick={onRemove}
            title="Soruyu çıkar"
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <QuestionBody question={question} />
      {children}
    </article>
  );
}

function QuestionCarouselFrame({
  children,
  count,
  index,
  onNext,
  onPrevious,
}: {
  children: ReactNode;
  count: number;
  index: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const hasMultiple = count > 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2">
        <button
          className="admin-button h-9 px-3 py-2 text-xs"
          disabled={!hasMultiple}
          onClick={onPrevious}
          type="button"
        >
          <ChevronLeft size={15} />
          Önceki
        </button>
        <span className="text-xs font-black text-[var(--color-admin-muted)]">
          {count === 0 ? "0 / 0" : `${index + 1} / ${count}`}
        </span>
        <button
          className="admin-button h-9 px-3 py-2 text-xs"
          disabled={!hasMultiple}
          onClick={onNext}
          type="button"
        >
          Sonraki
          <ChevronRight size={15} />
        </button>
      </div>
      {children}
    </div>
  );
}

function ReplacementCarousel({
  candidate,
  count,
  index,
  onClose,
  onNext,
  onPrevious,
  onSelect,
}: {
  candidate: AdminQuestion | null;
  count: number;
  index: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSelect: (questionId: number) => void;
}) {
  return (
    <div className="mt-4 rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
          Değişim adayları
        </p>
        <button
          className="text-xs font-bold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
          onClick={onClose}
          type="button"
        >
          Kapat
        </button>
      </div>
      {candidate ? (
        <QuestionCarouselFrame count={count} index={index} onNext={onNext} onPrevious={onPrevious}>
          <QuestionCandidateCard
            actionLabel="Bu soruyla değiştir"
            icon={<RefreshCw size={14} />}
            onSelect={() => onSelect(candidate.id)}
            question={candidate}
          />
        </QuestionCarouselFrame>
      ) : (
        <p className="rounded-[14px] border border-dashed border-[var(--color-admin-line)] bg-white px-4 py-5 text-sm font-semibold text-[var(--color-admin-muted)]">
          Bu filtrede uygun yedek soru yok.
        </p>
      )}
    </div>
  );
}

function QuestionCandidateCard({
  actionLabel,
  icon,
  onSelect,
  question,
}: {
  actionLabel: string;
  icon: ReactNode;
  onSelect: () => void;
  question: AdminQuestion;
}) {
  return (
    <div className="grid gap-4 rounded-[16px] border border-[var(--color-admin-line)] bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_150px]">
      <div className="min-w-0">
        <QuestionMeta question={question} />
        <QuestionBody question={question} compact />
      </div>
      <div className="flex items-start justify-end">
        <button
          className="admin-button admin-button-primary h-10 px-3 py-2 text-xs"
          onClick={onSelect}
          type="button"
        >
          {icon}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function QuestionBody({ compact = false, question }: { compact?: boolean; question: AdminQuestion }) {
  const sortedOptions = [...(question.options ?? [])].sort(
    (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.label.localeCompare(right.label, "tr"),
  );

  return (
    <div className={`${compact ? "mt-3 space-y-3" : "mt-4 space-y-4"}`}>
      <AdminQuestionTextBlock compact={compact} text={question.question_text || "Soru metni yok"} />

      {sortedOptions.length > 0 ? (
        <div className={`grid ${compact ? "gap-1.5" : "gap-2"}`}>
          {sortedOptions.map((option) => (
            <div
              className={`flex items-start gap-3 rounded-[14px] border px-3 ${
                compact ? "py-2 text-xs leading-5" : "py-2.5 text-sm leading-6"
              } ${
                option.is_correct
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-ink)]"
              }`}
              key={`${question.id}-${option.label}`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-black">
                {option.label}
              </span>
              <span className="min-w-0 flex-1">{option.option_text}</span>
              {option.is_correct ? <Check className="mt-1 shrink-0" size={15} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuestionMeta({ index, question }: { index?: number; question: AdminQuestion }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {index ? (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-[11px] font-black text-[var(--color-admin-muted)]">
          {index}
        </span>
      ) : null}
      <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2.5 py-1 text-[11px] font-black text-[var(--color-admin-ink)]">
        {question.topic?.subject?.name ?? "Ders yok"}
      </span>
      <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
        {question.topic?.name ?? "Konu yok"}
      </span>
      <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
        {questionBankLabel(question.question_bank_type)}
      </span>
      <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
        {difficultyLabel(question.difficulty)}
      </span>
    </div>
  );
}

function questionBankLabel(value?: string) {
  return value === "mock_exam" ? "Deneme" : "Normal";
}

function difficultyLabel(value?: string) {
  if (value === "easy") {
    return "Kolay";
  }

  if (value === "hard") {
    return "Zor";
  }

  return "Orta";
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  return ((index % length) + length) % length;
}
