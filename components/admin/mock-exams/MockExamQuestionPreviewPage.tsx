"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, Check, ChevronLeft, FileQuestion, Loader2, PencilRuler, Search, X } from "lucide-react";
import { AdminQuestionTextBlock } from "@/components/admin/questions/AdminQuestionTextBlock";
import {
  CenteredLoader,
  ErrorMessage,
  QuestionPreviewCard,
  type EditableQuestionDraft,
} from "@/components/admin/questions/QuestionPreviewPage";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminExam, AdminMockExam, AdminPaginationMeta, AdminQuestion } from "@/lib/types";

type Props = {
  mode: "pool" | "exam";
};

type QuestionsResponse = {
  questions: AdminQuestion[];
};

type ExamsResponse = {
  exams: AdminExam[];
};

type MockExamsResponse = {
  mock_exams: AdminMockExam[];
};

const pageCopy = {
  pool: {
    eyebrow: "Deneme Soruları Preview",
    title: "Sınav seç, deneme soru havuzunu gez",
    description:
      "Seçili sınav kapsamındaki deneme sorularını tam ekran kontrol edip hızlıca düzenleyebilirsin.",
    empty: "Bu sınav için deneme soru havuzu boş.",
    selectorLabel: "Sınav seç",
    backHref: "/denemeler",
  },
  exam: {
    eyebrow: "Deneme Preview",
    title: "Deneme seç, içindeki soruları sırayla gez",
    description:
      "Seçtiğin denemedeki soru sırasını birebir görür, her sorunun metin ve şıklarını aynı ekranda düzenleyebilirsin.",
    empty: "Bu denemede soru bulunamadı.",
    selectorLabel: "Deneme seç",
    backHref: "/denemeler",
  },
} satisfies Record<Props["mode"], {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  selectorLabel: string;
  backHref: string;
}>;

export function MockExamQuestionPreviewPage({ mode }: Props) {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [mockExams, setMockExams] = useState<AdminMockExam[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectorLoading, setSelectorLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<AdminQuestion | null>(null);
  const [replacementCandidates, setReplacementCandidates] = useState<AdminQuestion[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementQuery, setReplacementQuery] = useState("");
  const [selectedReplacementId, setSelectedReplacementId] = useState<number | null>(null);
  const copy = pageCopy[mode];

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedId) ?? null,
    [exams, selectedId],
  );
  const selectedMockExam = useMemo(
    () => mockExams.find((mockExam) => mockExam.id === selectedId) ?? null,
    [mockExams, selectedId],
  );
  const selectorItems = useMemo(() => {
    if (mode === "pool") {
      return [...exams]
        .filter((exam) => exam.status !== "passive")
        .sort((left, right) => left.name.localeCompare(right.name, "tr"));
    }

    return [...mockExams].sort((left, right) => {
      const examCompare = (left.exam?.name ?? "").localeCompare(right.exam?.name ?? "", "tr");

      return examCompare || left.title.localeCompare(right.title, "tr");
    });
  }, [exams, mockExams, mode]);
  const currentQuestion = questions[currentIndex] ?? null;
  const total = questions.length;
  const filteredReplacementCandidates = useMemo(() => {
    const normalized = replacementQuery.trim().toLocaleLowerCase("tr");

    if (!normalized) {
      return replacementCandidates;
    }

    return replacementCandidates.filter((question) =>
      [
        question.question_text,
        question.topic?.name,
        question.topic?.subject?.name,
        question.question_bank_type === "mock_exam" ? "deneme" : "normal",
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized),
    );
  }, [replacementCandidates, replacementQuery]);
  const selectedReplacement = useMemo(
    () => replacementCandidates.find((question) => question.id === selectedReplacementId) ?? filteredReplacementCandidates[0] ?? null,
    [filteredReplacementCandidates, replacementCandidates, selectedReplacementId],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;

    async function loadSelectors() {
      setSelectorLoading(true);
      setError(null);

      try {
        if (mode === "pool") {
          const response = await adminApiRequest<ExamsResponse>("/admin/exams", { token });

          if (!ignore) {
            setExams(response.data.exams);
          }
        } else {
          const response = await adminApiRequest<MockExamsResponse>("/admin/mock-exams", { token });

          if (!ignore) {
            setMockExams(response.data.mock_exams);
          }
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Liste yüklenemedi.");
        }
      } finally {
        if (!ignore) {
          setSelectorLoading(false);
        }
      }
    }

    void loadSelectors();

    return () => {
      ignore = true;
    };
  }, [mode, token]);

  useEffect(() => {
    if (!token || !selectedId) {
      setQuestions([]);
      setCurrentIndex(0);

      return;
    }

    const currentToken = token;
    const currentSelectedId = selectedId;
    let ignore = false;

    async function loadQuestions() {
      setQuestionsLoading(true);
      setError(null);

      try {
        const nextQuestions = mode === "pool"
          ? await fetchMockQuestionPool(currentToken, currentSelectedId)
          : await fetchMockExamQuestions(currentToken, selectedMockExam);

        if (!ignore) {
          setQuestions(nextQuestions);
          setCurrentIndex(0);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Sorular yüklenemedi.");
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
  }, [mode, selectedId, selectedMockExam, token]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (!selectedId || busy || questionsLoading || replacementTarget) {
        return;
      }

      if (event.key === "ArrowLeft") {
        goPrevious();
      }

      if (event.key === "ArrowRight") {
        goNext();
      }
    }

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  });

  function goPrevious() {
    setCurrentIndex((current) => Math.max(current - 1, 0));
  }

  function goNext() {
    setCurrentIndex((current) => Math.min(current + 1, Math.max(total - 1, 0)));
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
        description: mode === "pool" ? "Deneme soru havuzu kaydedildi." : "Deneme içindeki soru kaydedildi.",
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

  async function openReplacementModal(question: AdminQuestion) {
    if (!token || !selectedMockExam || busy || mode !== "exam") {
      return;
    }

    setReplacementTarget(question);
    setReplacementCandidates([]);
    setReplacementQuery("");
    setSelectedReplacementId(null);
    setReplacementLoading(true);

    try {
      const candidates = await fetchReplacementCandidates({
        token,
        question,
        mockExam: selectedMockExam,
        mockExams,
      });

      setReplacementCandidates(candidates);
      setSelectedReplacementId(candidates[0]?.id ?? null);
    } catch (loadError) {
      showToast({
        tone: "error",
        title: "Öneriler yüklenemedi",
        description: loadError instanceof Error ? loadError.message : "Yerine eklenecek soru listesi alınamadı.",
      });
      setReplacementTarget(null);
    } finally {
      setReplacementLoading(false);
    }
  }

  async function replaceQuestionInMockExam(replacement: AdminQuestion) {
    if (!token || !selectedMockExam || !replacementTarget || busy || mode !== "exam") {
      return;
    }

    const currentIds = selectedMockExam.question_ids ?? [];
    const targetIndex = currentIds.findIndex((id) => id === replacementTarget.id);

    if (targetIndex === -1) {
      showToast({
        tone: "error",
        title: "Soru bulunamadı",
        description: "Bu soru denemenin soru listesinde görünmüyor.",
      });
      return;
    }

    const nextIds = currentIds.map((id, index) => (index === targetIndex ? replacement.id : id));
    const nextStatus = selectedMockExam.status ?? "draft";

    setBusy(true);

    try {
      const response = await adminApiRequest<{ mock_exam: AdminMockExam }>(`/admin/mock-exams/${selectedMockExam.id}`, {
        token,
        method: "PUT",
        body: {
          exam_id: selectedMockExam.exam_id ?? selectedMockExam.exam?.id,
          title: selectedMockExam.title,
          slug: selectedMockExam.slug ?? null,
          status: nextStatus,
          duration_min: selectedMockExam.duration_min,
          sort_order: selectedMockExam.sort_order ?? 1,
          scheduled_at: selectedMockExam.scheduled_at ?? null,
          is_tr_general: Boolean(selectedMockExam.is_tr_general),
          is_free: Boolean(selectedMockExam.is_free),
          question_ids: nextIds,
        },
      });

      const updatedMockExam: AdminMockExam = {
        ...selectedMockExam,
        ...response.data.mock_exam,
        exam: response.data.mock_exam.exam ?? selectedMockExam.exam,
        status: nextStatus,
        question_count: nextIds.length,
        question_ids: nextIds,
      };

      setMockExams((current) =>
        current.map((item) => (item.id === selectedMockExam.id ? updatedMockExam : item)),
      );
      setQuestions((current) => {
        const nextQuestions = current.map((item) => (item.id === replacementTarget.id ? replacement : item));
        setCurrentIndex(targetIndex);

        return nextQuestions;
      });
      showToast({
        tone: "success",
        title: "Soru değiştirildi",
        description: `${replacementTarget.topic?.subject?.name ?? "Ders"} için yeni soru denemeye eklendi.`,
      });
      setReplacementTarget(null);
      setReplacementCandidates([]);
      setReplacementQuery("");
      setSelectedReplacementId(null);
    } catch (removeError) {
      showToast({
        tone: "error",
        title: "Soru değiştirilemedi",
        description: removeError instanceof Error ? removeError.message : "Deneme güncellenemedi.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (selectorLoading) {
    return <CenteredLoader label={mode === "pool" ? "Sınavlar yükleniyor..." : "Denemeler yükleniyor..."} />;
  }

  if (!selectedId) {
    return (
      <div className="space-y-5">
        {error ? <ErrorMessage message={error} /> : null}
        <section className="admin-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--color-admin-muted)]">
                {copy.eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
                {copy.title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-[var(--color-admin-muted)]">
                {copy.description}
              </p>
            </div>
            <Link className="admin-button admin-button-secondary" href={copy.backHref}>
              <BookOpenCheck size={16} />
              Denemelere dön
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {selectorItems.map((item) => (
              <button
                className="group rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-admin-accent)]"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[var(--color-admin-accent-soft)] px-2.5 py-1 text-xs font-black text-[var(--color-admin-accent)]">
                        {mode === "pool" ? "Sınav" : "Deneme"}
                      </span>
                      <span className="truncate text-sm font-extrabold text-[var(--color-admin-ink)]">
                        {selectorTitle(item, mode)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                      {selectorMeta(item, mode)}
                    </p>
                  </div>
                  <ArrowRight className="shrink-0 text-[var(--color-admin-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--color-admin-accent)]" size={18} />
                </div>
              </button>
            ))}
          </div>

          {selectorItems.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-5 text-sm font-semibold text-[var(--color-admin-muted)]">
              {copy.selectorLabel} için kayıt bulunamadı.
            </div>
          ) : null}
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
          onClick={() => setSelectedId(null)}
          type="button"
        >
          <ChevronLeft size={14} />
          {mode === "pool" ? "Sınav değiştir" : "Deneme değiştir"}
        </button>
        <div className="text-right">
          <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">
            {mode === "pool" ? selectedExam?.name ?? "Seçili sınav" : selectedMockExam?.title ?? "Seçili deneme"}
          </p>
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
            deleteConfirmLabel="Denemeden Çıkar"
            deleteDescription="Soru kaydı silinmez; aynı ders içinden seçeceğin yeni soru bu sıraya yerleşir."
            deleteTitle="Bu sorunun yerine başka soru seçilsin mi?"
            onDelete={() => void openReplacementModal(currentQuestion)}
            onNext={goNext}
            onPrevious={goPrevious}
            onSave={(draft) => saveQuestionEdits(currentQuestion, draft)}
            question={currentQuestion}
            showDelete={mode === "exam"}
            total={total}
          />
        ) : (
          <div className="max-w-xl rounded-[30px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-8 py-10 text-center shadow-[var(--color-admin-shadow)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--color-admin-accent)] text-white">
              {mode === "pool" ? <FileQuestion size={26} /> : <PencilRuler size={26} />}
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-[var(--color-admin-ink)]">{copy.empty}</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--color-admin-muted)]">
              {mode === "pool"
                ? "Deneme sorusu importu veya soru formunda deneme havuzu işaretini kontrol edebilirsin."
                : "Denemenin soru listesini düzenleme ekranından oluşturabilirsin."}
            </p>
            <button className="admin-button admin-button-secondary mx-auto mt-6" onClick={() => setSelectedId(null)} type="button">
              Başka seçim yap
            </button>
          </div>
        )}
      </div>

      {replacementTarget ? (
        <ReplacementModal
          busy={busy}
          candidates={filteredReplacementCandidates}
          loading={replacementLoading}
          onClose={() => {
            if (busy) {
              return;
            }

            setReplacementTarget(null);
            setReplacementCandidates([]);
            setReplacementQuery("");
            setSelectedReplacementId(null);
          }}
          onQueryChange={setReplacementQuery}
          onReplace={(candidate) => void replaceQuestionInMockExam(candidate)}
          onSelect={setSelectedReplacementId}
          query={replacementQuery}
          selected={selectedReplacement}
          selectedId={selectedReplacementId}
          target={replacementTarget}
        />
      ) : null}
    </div>
  );
}

async function fetchMockQuestionPool(token: string, examId: number) {
  const questions: AdminQuestion[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const params = new URLSearchParams({
      exam_id: String(examId),
      question_type: "multiple_choice",
      question_bank_type: "mock_exam",
      per_page: "500",
      page: String(page),
    });

    const response = await adminApiRequest<QuestionsResponse>(`/admin/questions?${params.toString()}`, { token });
    questions.push(...response.data.questions);

    const pagination = parsePagination(response.meta.pagination);
    lastPage = pagination?.last_page ?? page;
    page += 1;
  } while (page <= lastPage);

  return sortQuestionsForPreview(questions);
}

async function fetchMockExamQuestions(token: string, mockExam: AdminMockExam | null) {
  const ids = mockExam?.question_ids ?? [];

  if (ids.length === 0) {
    return [];
  }

  const response = await adminApiRequest<QuestionsResponse>(
    `/admin/questions?ids=${encodeURIComponent(ids.join(","))}&per_page=500`,
    { token },
  );
  const order = new Map(ids.map((id, index) => [id, index]));

  return [...response.data.questions].sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

async function fetchReplacementCandidates({
  token,
  question,
  mockExam,
  mockExams,
}: {
  token: string;
  question: AdminQuestion;
  mockExam: AdminMockExam;
  mockExams: AdminMockExam[];
}) {
  const examId = mockExam.exam_id ?? mockExam.exam?.id;
  const subjectId = question.topic?.subject?.id;

  if (!examId || !subjectId) {
    return [];
  }

  const usedByOtherMockExams = new Set(
    mockExams
      .filter((item) => item.id !== mockExam.id)
      .flatMap((item) => item.question_ids ?? []),
  );
  const currentMockExamIds = new Set(mockExam.question_ids ?? []);
  const [mockCandidates, practiceCandidates] = await Promise.all([
    fetchReplacementCandidatePage(token, examId, subjectId, "mock_exam"),
    fetchReplacementCandidatePage(token, examId, subjectId, "practice"),
  ]);

  return mockCandidates
    .concat(practiceCandidates)
    .filter((candidate) => candidate.id !== question.id)
    .filter((candidate) => !currentMockExamIds.has(candidate.id))
    .filter((candidate) => !usedByOtherMockExams.has(candidate.id))
    .filter((candidate, index, source) => source.findIndex((item) => item.id === candidate.id) === index)
    .sort((left, right) => {
      const bankCompare = bankRank(left) - bankRank(right);

      if (bankCompare !== 0) {
        return bankCompare;
      }

      const leftTopic = left.topic?.name ?? "";
      const rightTopic = right.topic?.name ?? "";

      return leftTopic.localeCompare(rightTopic, "tr") || left.id - right.id;
    });
}

async function fetchReplacementCandidatePage(
  token: string,
  examId: number,
  subjectId: number,
  bankType: "mock_exam" | "practice",
) {
  const questions: AdminQuestion[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const params = new URLSearchParams({
      exam_id: String(examId),
      subject_id: String(subjectId),
      question_type: "multiple_choice",
      question_bank_type: bankType,
      status: "active",
      approval_status: "approved",
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

function bankRank(question: AdminQuestion) {
  return question.question_bank_type === "mock_exam" ? 0 : 1;
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

function sortQuestionsForPreview(questions: AdminQuestion[]) {
  return [...questions].sort((left, right) => {
    const leftSubject = left.topic?.subject?.name ?? "";
    const rightSubject = right.topic?.subject?.name ?? "";
    const subjectCompare = leftSubject.localeCompare(rightSubject, "tr");

    if (subjectCompare !== 0) {
      return subjectCompare;
    }

    const leftTopic = left.topic?.name ?? "";
    const rightTopic = right.topic?.name ?? "";

    return leftTopic.localeCompare(rightTopic, "tr") || left.topic_id - right.topic_id || left.id - right.id;
  });
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
    question_bank_type: question.question_bank_type ?? "mock_exam",
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

function selectorTitle(item: AdminExam | AdminMockExam, mode: Props["mode"]) {
  return mode === "pool" ? (item as AdminExam).name : (item as AdminMockExam).title;
}

function selectorMeta(item: AdminExam | AdminMockExam, mode: Props["mode"]) {
  if (mode === "pool") {
    const exam = item as AdminExam;

    return `${exam.total_question_count ?? 0} hedef soru · ${exam.ministry?.name ?? "Bakanlık yok"}`;
  }

  const mockExam = item as AdminMockExam;

  return `${mockExam.question_count} soru · ${mockExam.exam?.name ?? "Sınav yok"}`;
}

function ReplacementModal({
  busy,
  candidates,
  loading,
  onClose,
  onQueryChange,
  onReplace,
  onSelect,
  query,
  selected,
  selectedId,
  target,
}: {
  busy: boolean;
  candidates: AdminQuestion[];
  loading: boolean;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onReplace: (candidate: AdminQuestion) => void;
  onSelect: (id: number) => void;
  query: string;
  selected: AdminQuestion | null;
  selectedId: number | null;
  target: AdminQuestion;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-admin-line)] px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
              Yerine soru seç
            </p>
            <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[var(--color-admin-ink)]">
              {target.topic?.subject?.name ?? "Aynı ders"} içinden aday sorular
            </h2>
            <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
              Eski soru silinmez; seçtiğin soru denemede aynı sıraya yerleşir.
            </p>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:opacity-45"
            disabled={busy}
            onClick={onClose}
            type="button"
            aria-label="Modalı kapat"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-[var(--color-admin-line)] lg:border-b-0 lg:border-r">
            <div className="border-b border-[var(--color-admin-line)] px-4 py-3">
              <label className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 text-sm font-semibold text-[var(--color-admin-muted)]">
                <Search size={15} />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[var(--color-admin-ink)] outline-none placeholder:text-[var(--color-admin-muted)]"
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Soru, konu veya kaynak ara"
                  value={query}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 py-4 text-sm font-bold text-[var(--color-admin-muted)]">
                  <Loader2 className="animate-spin" size={16} />
                  Aday sorular yükleniyor...
                </div>
              ) : candidates.length > 0 ? (
                <div className="space-y-2">
                  {candidates.map((candidate) => {
                    const isSelected = selectedId === candidate.id;

                    return (
                      <button
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)]"
                            : "border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] hover:border-[var(--color-admin-accent)]/45"
                        }`}
                        key={candidate.id}
                        onClick={() => onSelect(candidate.id)}
                        type="button"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--color-admin-accent)]">
                            {candidate.question_bank_type === "mock_exam" ? "Deneme" : "Normal"}
                          </span>
                          {isSelected ? <Check size={15} className="text-[var(--color-admin-accent)]" /> : null}
                        </div>
                        <AdminQuestionTextBlock compact text={candidate.question_text ?? "Soru metni yok"} />
                        <p className="mt-2 text-[11px] font-bold text-[var(--color-admin-muted)]">
                          #{candidate.id} · {candidate.topic?.name ?? "Konu yok"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-5 text-sm font-semibold text-[var(--color-admin-muted)]">
                  Bu ders için kullanılabilir alternatif soru bulunamadı.
                </div>
              )}
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto px-5 py-5">
            {selected ? (
              <QuestionReadOnlyPreview question={selected} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-8 text-center text-sm font-semibold text-[var(--color-admin-muted)]">
                Önizlemek için bir aday soru seç.
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-admin-line)] px-5 py-4">
          <p className="text-xs font-bold text-[var(--color-admin-muted)]">
            {candidates.length} uygun aday
          </p>
          <div className="flex items-center gap-2">
            <button className="admin-button admin-button-secondary" disabled={busy} onClick={onClose} type="button">
              Vazgeç
            </button>
            <button
              className="admin-button admin-button-primary"
              disabled={busy || loading || !selected}
              onClick={() => {
                if (selected) {
                  onReplace(selected);
                }
              }}
              type="button"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Bu soruyla değiştir
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function QuestionReadOnlyPreview({ question }: { question: AdminQuestion }) {
  const sortedOptions = [...(question.options ?? [])].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
  const explanationRows = [
    ["Dayanak", question.explanation_basis ?? question.explanation?.basis],
    ["İlgili hüküm", question.explanation_relevant_provision ?? question.explanation?.relevant_provision],
    ["Cevap bağlantısı", question.explanation_answer_link ?? question.explanation?.answer_link],
  ].filter(([, value]) => value && String(value).trim());

  return (
    <article className="rounded-[24px] border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-5 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--color-admin-line)] bg-white px-3 py-1 text-[11px] font-black text-[var(--color-admin-muted)]">
          #{question.id}
        </span>
        <span className="rounded-full border border-[var(--color-admin-line)] bg-white px-3 py-1 text-[11px] font-black text-[var(--color-admin-muted)]">
          {question.topic?.subject?.name ?? "Ders yok"} · {question.topic?.name ?? "Konu yok"}
        </span>
        <span className="rounded-full border border-[var(--color-admin-line)] bg-white px-3 py-1 text-[11px] font-black text-[var(--color-admin-muted)]">
          {question.question_bank_type === "mock_exam" ? "Deneme sorusu" : "Normal soru"}
        </span>
      </div>

      <AdminQuestionTextBlock text={question.question_text ?? "Soru metni yok"} />

      <div className="mt-5 grid gap-2">
        {sortedOptions.map((option) => (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              option.is_correct
                ? "border-emerald-300 bg-emerald-50"
                : "border-[var(--color-admin-line)] bg-white"
            }`}
            key={`${question.id}-${option.label}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                option.is_correct ? "bg-emerald-500 text-white" : "bg-slate-100 text-[var(--color-admin-muted)]"
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

      {explanationRows.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50">
          {explanationRows.map(([label, value]) => (
            <div className="grid gap-1 border-b border-sky-100 px-4 py-3 last:border-b-0 md:grid-cols-[135px_1fr]" key={label}>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">{label}</p>
              <p className="whitespace-pre-line text-sm font-semibold leading-6 text-sky-950">{value}</p>
            </div>
          ))}
        </div>
      ) : question.explanation_text ? (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <p className="whitespace-pre-line text-sm font-semibold leading-6 text-sky-950">{question.explanation_text}</p>
        </div>
      ) : null}
    </article>
  );
}
