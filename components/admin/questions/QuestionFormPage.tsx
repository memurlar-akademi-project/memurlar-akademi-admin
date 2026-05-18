"use client";

import { HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminQuestion, AdminSubject, AdminTopic } from "@/lib/types";

type QuestionOptionForm = {
  label: string;
  option_text: string;
  is_correct: boolean;
};

const optionLabels = ["A", "B", "C", "D", "E"];

const defaultOptions = (): QuestionOptionForm[] => [
  { label: "A", option_text: "", is_correct: true },
  { label: "B", option_text: "", is_correct: false },
  { label: "C", option_text: "", is_correct: false },
  { label: "D", option_text: "", is_correct: false },
  { label: "E", option_text: "", is_correct: false },
];

function normalizeMultipleChoiceOptions(options?: QuestionOptionForm[] | null): QuestionOptionForm[] {
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

const emptyForm = {
  topic_id: "",
  question_type: "multiple_choice",
  q_version: "",
  difficulty: "medium",
  status: "active",
  is_free: false,
  free_preview_order: "",
  is_past_exam_question: false,
  question_text: "",
  correct_answer_text: "",
  explanation_text: "",
  explanation_basis: "",
  explanation_relevant_provision: "",
  explanation_answer_link: "",
  review_flags: [] as string[],
  review_note: null as string | null,
  published_at: "",
  options: defaultOptions(),
};

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

export function QuestionFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `question-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const optionsSectionRef = useRef<HTMLElement | null>(null);
  const explanationSectionRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [question, setQuestion] = useState<AdminQuestion | null>(null);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTopic = useMemo(
    () => topics.find((topic) => String(topic.id) === form.topic_id) ?? null,
    [form.topic_id, topics],
  );
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedTopic?.subject?.id) ?? null,
    [selectedTopic, subjects],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(mode === "edit");
      setError(null);

      try {
        const [subjectsResponse, topicsResponse, questionResponse] = await Promise.all([
          adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
          mode === "edit" && id
            ? adminApiRequest<{ question: AdminQuestion }>(`/admin/questions/${id}`, { token })
            : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setSubjects(subjectsResponse.data.subjects);
        setTopics(topicsResponse.data.topics);

        if (questionResponse?.data.question) {
          const question = questionResponse.data.question;
          setQuestion(question);
          setForm({
            topic_id: String(question.topic_id),
            question_type: question.question_type,
            q_version: question.q_version ? String(question.q_version) : "",
            difficulty: question.difficulty,
            status: question.status,
            is_free: Boolean(question.is_free),
            free_preview_order: question.free_preview_order ? String(question.free_preview_order) : "",
            is_past_exam_question: Boolean(question.is_past_exam_question),
            question_text: question.question_text ?? "",
            correct_answer_text: question.correct_answer_text ?? "",
            explanation_text: question.explanation_text ?? "",
            explanation_basis: question.explanation_basis ?? question.explanation?.basis ?? "",
            explanation_relevant_provision: question.explanation_relevant_provision ?? question.explanation?.relevant_provision ?? "",
            explanation_answer_link: question.explanation_answer_link ?? question.explanation?.answer_link ?? "",
            review_flags: question.review_flags ?? [],
            review_note: question.review_note ?? null,
            published_at: toDateValue(question.published_at),
            options:
              question.question_type === "multiple_choice"
                ? normalizeMultipleChoiceOptions(
                    question.options?.map((option) => ({
                      label: option.label,
                      option_text: option.option_text,
                      is_correct: option.is_correct,
                    })),
                  )
                : [],
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Soru bilgisi yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    const preview = form.question_text.trim();
    setTitle(preview ? preview.slice(0, 72) : "Soru Düzenle");

    return () => setTitle(null);
  }, [form.question_text, mode, setTitle]);

  function handleQuestionTypeChange(question_type: string) {
    setForm((current) => ({
      ...current,
      question_type,
      correct_answer_text: question_type === "true_false" ? "true" : "",
      options:
        question_type === "multiple_choice"
          ? normalizeMultipleChoiceOptions(current.options.length ? current.options : defaultOptions())
          : [],
    }));
  }

  function setOption(index: number, patch: Partial<QuestionOptionForm>) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    }));
  }

  function setCorrectOption(label: string) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) => ({
        ...option,
        is_correct: option.label === label,
      })),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ question: AdminQuestion }>(
        mode === "edit" ? `/admin/questions/${id}` : "/admin/questions",
        {
          token,
          method: mode === "edit" ? "PUT" : "POST",
          body: {
            topic_id: Number(form.topic_id),
            question_type: form.question_type,
            q_version: form.q_version ? Number(form.q_version) : null,
            difficulty: form.difficulty,
            status: form.status,
            is_free: form.is_free,
            free_preview_order: form.free_preview_order ? Number(form.free_preview_order) : null,
            is_past_exam_question: form.is_past_exam_question,
            question_text: form.question_text,
            correct_answer_text:
              form.question_type === "true_false"
                ? form.correct_answer_text
                : form.options.find((option) => option.is_correct)?.label ?? "A",
            explanation_text: form.explanation_text,
            explanation_basis: form.explanation_basis,
            explanation_relevant_provision: form.explanation_relevant_provision,
            explanation_answer_link: form.explanation_answer_link,
            review_flags: form.review_flags,
            review_note: form.review_note,
            published_at: form.published_at || null,
            options:
              form.question_type === "multiple_choice"
                ? form.options.map((option) => ({
                    label: option.label,
                    option_text: option.option_text,
                    is_correct: option.is_correct,
                  }))
                : [],
          },
        },
      );

      showToast({
        tone: "success",
        title: mode === "edit" ? "Soru güncellendi" : "Soru oluşturuldu",
        description: response.data.question.topic?.name ?? "Soru havuzu",
      });

      setQuestion(response.data.question);

      if (mode === "edit") {
        return;
      }

      router.push("/sorular");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Soru kaydedilemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: mode === "edit" ? "Soru güncellenemedi" : "Soru oluşturulamadı",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminTableCard>
        <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                <HelpCircle size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  Soru Editörü
                </h2>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Yeni soru veya mevcut soru düzenleme akışı.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="admin-button admin-button-secondary"
                onClick={() => router.push("/sorular")}
                type="button"
              >
                İptal
              </button>
              <button
                className="admin-button admin-button-primary"
                disabled={saving}
                form={formId}
                type="submit"
              >
                {saving ? "Kaydediliyor" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-6">
          {loading ? (
            <div className="space-y-4">
              <div className="admin-skeleton h-12" />
              <div className="admin-skeleton h-12" />
              <div className="admin-skeleton h-24" />
              <div className="admin-skeleton h-64" />
            </div>
          ) : (
            <form className="space-y-6" id={formId} onSubmit={handleSubmit}>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                    <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                      <label className="block space-y-2.5">
                        <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Soru metni</span>
                        <textarea
                          className="admin-input min-h-[140px] resize-y"
                          onChange={(event) => setForm((current) => ({ ...current, question_text: event.target.value }))}
                          placeholder="Soru metnini buraya yaz"
                          value={form.question_text}
                        />
                      </label>

                      <div className="grid gap-4 md:grid-cols-4">
                        <label className="block space-y-2.5">
                          <AdminSearchSelect
                            emptyText="Konu bulunamadı."
                            label="Konu"
                            onChange={(next) => setForm((current) => ({ ...current, topic_id: next ? String(next) : "" }))}
                            options={topics.map((topic) => ({
                              id: topic.id,
                              label: topic.name,
                              hint: topic.subject?.name ?? undefined,
                            }))}
                            placeholder="Konu ara"
                            value={form.topic_id ? Number(form.topic_id) : null}
                          />
                        </label>

                        <label className="block space-y-2.5">
                          <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Zorluk</span>
                          <select
                            className="admin-input h-12"
                            onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))}
                            value={form.difficulty}
                          >
                            <option value="easy">Kolay</option>
                            <option value="medium">Orta</option>
                            <option value="hard">Zor</option>
                          </select>
                        </label>

                        <label className="block space-y-2.5">
                          <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Tür</span>
                          <select
                            className="admin-input h-12"
                            onChange={(event) => handleQuestionTypeChange(event.target.value)}
                            value={form.question_type}
                          >
                            <option value="multiple_choice">Test</option>
                            <option value="true_false">Doğru / Yanlış</option>
                          </select>
                        </label>

                        <label className="block space-y-2.5">
                          <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Üretim versiyonu</span>
                          <input
                            className="admin-input h-12"
                            min={1}
                            onChange={(event) => setForm((current) => ({ ...current, q_version: event.target.value }))}
                            placeholder="Örn. 5"
                            type="number"
                            value={form.q_version}
                          />
                        </label>
                      </div>
                    </section>

                    {form.question_type === "multiple_choice" ? (
                      <section
                        className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4"
                        ref={optionsSectionRef}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-[13px] font-semibold text-[var(--color-admin-ink)]">Şıklar — 5 şık sabit, doğru cevabı işaretleyin</h3>
                        </div>

                        <div className="space-y-3">
                          {form.options.map((option) => (
                            <div
                              key={option.label}
                              className={`grid gap-3 rounded-[18px] border px-4 py-3 md:grid-cols-[42px_minmax(0,1fr)] ${
                                option.is_correct
                                  ? "border-emerald-500 bg-emerald-50/60"
                                  : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]"
                              }`}
                            >
                              <button
                                className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-extrabold transition ${
                                  option.is_correct
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-ink)]"
                                }`}
                                onClick={() => setCorrectOption(option.label)}
                                type="button"
                              >
                                {option.label}
                              </button>

                              <div className="flex items-center gap-2">
                                <input
                                  className="admin-input h-11 flex-1"
                                  onChange={(event) =>
                                    setOption(
                                      form.options.findIndex((item) => item.label === option.label),
                                      { option_text: event.target.value },
                                    )
                                  }
                                  placeholder={`${option.label} şıkkı`}
                                  value={option.option_text}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : (
                      <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                        <h3 className="text-[13px] font-semibold text-[var(--color-admin-ink)]">Doğru / Yanlış cevabı</h3>

                        <div className="flex flex-wrap gap-3">
                          {[
                            { value: "true", label: "Doğru" },
                            { value: "false", label: "Yanlış" },
                          ].map((item) => (
                            <label
                              key={item.value}
                              className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                form.correct_answer_text === item.value
                                  ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                                  : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-ink)]"
                              }`}
                            >
                              <input
                                checked={form.correct_answer_text === item.value}
                                onChange={() =>
                                  setForm((current) => ({ ...current, correct_answer_text: item.value }))
                                }
                                type="radio"
                              />
                              {item.label}
                            </label>
                          ))}
                        </div>
                      </section>
                    )}

                    <section
                      className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4"
                      ref={explanationSectionRef}
                    >
                      <div className="space-y-4">
                        <div>
                          <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Açıklama / Çözüm</span>
                          <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                            Kullanıcı tarafında ayrı satır/kutu olarak gösterilir. Dayanak, ilgili hüküm ve cevap bağlantısı ayrı saklanır.
                          </p>
                        </div>
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Dayanak</span>
                          <textarea
                            className="admin-input min-h-[72px] resize-y"
                            onChange={(event) =>
                              setForm((current) => ({ ...current, explanation_basis: event.target.value }))
                            }
                            placeholder="Örn. T.C. Anayasası m. 21 - Konut dokunulmazlığı"
                            value={form.explanation_basis}
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">İlgili Hüküm</span>
                          <textarea
                            className="admin-input min-h-[96px] resize-y"
                            onChange={(event) =>
                              setForm((current) => ({ ...current, explanation_relevant_provision: event.target.value }))
                            }
                            placeholder="Soruyu çözdüren kaynak hüküm parçası"
                            value={form.explanation_relevant_provision}
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Cevap Bağlantısı</span>
                          <textarea
                            className="admin-input min-h-[96px] resize-y"
                            onChange={(event) =>
                              setForm((current) => ({ ...current, explanation_answer_link: event.target.value }))
                            }
                            placeholder="Doğru cevabın ilgili hükümle bağlantısı"
                            value={form.explanation_answer_link}
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Düz Açıklama (opsiyonel)</span>
                        <textarea
                          className="admin-input min-h-[120px] resize-y"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, explanation_text: event.target.value }))
                          }
                          placeholder="Doğru cevabın gerekçesi veya açıklaması"
                          value={form.explanation_text}
                        />
                        </label>
                      </div>
                    </section>
                </div>

                <div className="space-y-5">
                    {mode === "edit" && question?.readiness ? (
                      <section className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70">
                        <AdminReadinessPanel
                          actions={[
                            {
                              label: "Şıklara Git",
                              onClick: () => optionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            },
                            {
                              label: "Açıklamaya Git",
                              onClick: () => explanationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            },
                          ]}
                          entityLabel="Soru"
                          readiness={question.readiness}
                        />
                      </section>
                    ) : null}

                    <section className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                      <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                        Önizleme
                      </h3>
                      <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-4">
                        <p className="text-base font-bold leading-8 text-[var(--color-admin-ink)]">
                          {form.question_text || "Soru metni burada önizlenecek."}
                        </p>

                        {form.question_type === "multiple_choice" ? (
                          <div className="mt-5 space-y-3">
                            {form.options.map((option) => (
                              <div
                                key={option.label}
                                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                                  option.is_correct
                                    ? "border-emerald-500 bg-emerald-50/60"
                                    : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]"
                                }`}
                              >
                                <span
                                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-extrabold ${
                                    option.is_correct
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-ink)]"
                                  }`}
                                >
                                  {option.label}
                                </span>
                                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">
                                  {option.option_text || "Seçenek metni"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-5 inline-flex rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
                            {form.correct_answer_text === "true" ? "Doğru" : "Yanlış"}
                          </div>
                        )}
                      </div>
                    </section>
                </div>
              </div>

              <section className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Durum</span>
                    <select
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                      value={form.status}
                    >
                      <option value="active">Aktif</option>
                      <option value="draft">Taslak</option>
                      <option value="passive">Pasif</option>
                    </select>
                  </label>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Yayın Tarihi</span>
                    <input
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, published_at: event.target.value }))}
                      type="date"
                      value={form.published_at}
                    />
                  </label>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Free Preview Sırası</span>
                    <input
                      className="admin-input h-12"
                      inputMode="numeric"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, free_preview_order: event.target.value }))
                      }
                      placeholder="Örn. 1"
                      value={form.free_preview_order}
                    />
                  </label>

                  <div className="grid gap-3">
                    <label className="inline-flex w-full items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-4 text-sm font-semibold text-[var(--color-admin-ink)]">
                      <input
                        checked={form.is_free}
                        onChange={(event) => setForm((current) => ({ ...current, is_free: event.target.checked }))}
                        type="checkbox"
                      />
                      Ücretsiz örnekte görünsün
                    </label>
                    <label className="inline-flex w-full items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-4 text-sm font-semibold text-[var(--color-admin-ink)]">
                      <input
                        checked={form.is_past_exam_question}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, is_past_exam_question: event.target.checked }))
                        }
                        type="checkbox"
                      />
                      Çıkmış soru olarak işaretle
                    </label>
                  </div>
                </div>
              </section>

              {error ? (
                <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                  {error}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </AdminTableCard>
    </div>
  );
}
