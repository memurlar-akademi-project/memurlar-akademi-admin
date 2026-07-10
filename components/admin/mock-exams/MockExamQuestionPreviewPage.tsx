"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, ChevronLeft, FileQuestion, PencilRuler } from "lucide-react";
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
      if (!selectedId || busy || questionsLoading) {
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

  async function removeQuestionFromMockExam(question: AdminQuestion) {
    if (!token || !selectedMockExam || busy || mode !== "exam") {
      return;
    }

    const currentIds = selectedMockExam.question_ids ?? [];
    const nextIds = currentIds.filter((id) => id !== question.id);

    if (nextIds.length === currentIds.length) {
      showToast({
        tone: "error",
        title: "Soru bulunamadı",
        description: "Bu soru denemenin soru listesinde görünmüyor.",
      });
      return;
    }

    if (nextIds.length === 0) {
      showToast({
        tone: "error",
        title: "Son soru çıkarılamaz",
        description: "Denemeyi tamamen kaldırmak istiyorsan denemeler listesinden silmelisin.",
      });
      return;
    }

    const nextStatus = selectedMockExam.status === "active" ? "draft" : selectedMockExam.status ?? "draft";

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
        const nextQuestions = current.filter((item) => item.id !== question.id);
        setCurrentIndex((index) => Math.min(index, Math.max(nextQuestions.length - 1, 0)));

        return nextQuestions;
      });
      showToast({
        tone: nextStatus === "draft" && selectedMockExam.status === "active" ? "warning" : "success",
        title: "Soru denemeden çıkarıldı",
        description:
          nextStatus === "draft" && selectedMockExam.status === "active"
            ? "Soru sayısı eksildiği için deneme taslağa alındı."
            : selectedMockExam.title,
      });
    } catch (removeError) {
      showToast({
        tone: "error",
        title: "Soru çıkarılamadı",
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
            deleteDescription="Soru kaydı silinmez; sadece bu denemenin soru listesinden çıkarılır."
            deleteTitle="Soru denemeden çıkarılsın mı?"
            onDelete={() => void removeQuestionFromMockExam(currentQuestion)}
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
