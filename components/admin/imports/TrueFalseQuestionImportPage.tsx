"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, FileJson2, ListChecks } from "lucide-react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminFlashcard, AdminPaginationMeta, AdminQuestionImport, AdminSubject, AdminTopic } from "@/lib/types";

type TrueFalseImportQuestion = {
  topic_id?: unknown;
  question_type?: unknown;
  difficulty?: unknown;
  status?: unknown;
  question_text?: unknown;
  correct_answer_text?: unknown;
  explanation_text?: unknown;
  options?: unknown;
};

const trueFalseTemplate = `{
  "questions": [
    {
      "topic_id": 101,
      "question_type": "true_false",
      "difficulty": "medium",
      "status": "active",
      "question_text": "Bilgi kartından üretilen ölçülü doğru/yanlış ifadesi buraya yazılır.",
      "correct_answer_text": "true",
      "explanation_text": "Kısa gerekçe burada yer alır."
    }
  ]
}`;

export function TrueFalseQuestionImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const subjectIdFromQuery = searchParams.get("subjectId");

  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [flashcards, setFlashcards] = useState<AdminFlashcard[]>([]);
  const [imports, setImports] = useState<AdminQuestionImport[]>([]);
  const [importsMeta, setImportsMeta] = useState<AdminPaginationMeta | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjectIdFromQuery ? Number(subjectIdFromQuery) : null,
  );
  const [payload, setPayload] = useState(trueFalseTemplate);
  const [sourceType, setSourceType] = useState<"json_upload" | "json_paste">("json_paste");
  const [loading, setLoading] = useState(true);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);

      try {
        const [subjectsResponse, topicsResponse, importsResponse] = await Promise.all([
          adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
          adminApiRequest<{ imports: AdminQuestionImport[] }>("/admin/question-imports?per_page=6", { token }),
        ]);

        if (cancelled) {
          return;
        }

        setSubjects(subjectsResponse.data.subjects);
        setTopics(topicsResponse.data.topics);
        setImports(importsResponse.data.imports);
        setImportsMeta(parsePagination(importsResponse.meta.pagination));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "D/Y import ekranı yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedSubjectId) {
      setFlashcards([]);

      return;
    }

    let cancelled = false;

    async function loadFlashcards() {
      setFlashcardsLoading(true);

      try {
        const response = await adminApiRequest<{ flashcards: AdminFlashcard[] }>(
          `/admin/flashcards?subject_id=${selectedSubjectId}&status=active`,
          { token },
        );

        if (!cancelled) {
          setFlashcards(response.data.flashcards);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Bilgi kartları alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setFlashcardsLoading(false);
        }
      }
    }

    void loadFlashcards();

    return () => {
      cancelled = true;
    };
  }, [selectedSubjectId, token]);

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: `${subject.topic_count} konu · ${subject.question_count ?? 0} soru`,
      })),
    [subjects],
  );

  const selectedSubjectTopics = useMemo(
    () => topics.filter((topic) => selectedSubjectId === null || topic.subject_id === selectedSubjectId),
    [selectedSubjectId, topics],
  );

  const flashcardContext = useMemo(
    () =>
      JSON.stringify(
        {
          task: "Bu bilgi kartlarından doğru/yanlış soru üret. Bariz cevaplı ve çocukça ifadeler üretme.",
          rules: [
            "Sadece question_type=true_false kullan.",
            "status active olmalı; kalite onayı question statusundan ayrı approval_status alanıyla sonradan yapılır.",
            "correct_answer_text yalnızca true veya false olur.",
            "Madde numarasıyla soru başlatma.",
            "Yanlış ifadede tek kritik unsur değiştir: süre, yetkili makam, kapsam, şart, istisna veya sayı.",
            "Her soru tek hükmü ölçsün; iki ayrı hükmü aynı cümleye sıkıştırma.",
          ],
          topics: selectedSubjectTopics.map((topic) => ({
            topic_id: topic.id,
            topic_name: topic.name,
          })),
          flashcards: flashcards.map((card) => ({
            flashcard_id: card.id,
            topic_id: card.topic_id,
            topic_name: card.topic?.name,
            front_text: card.front_text,
            back_text: card.back_text,
          })),
        },
        null,
        2,
      ),
    [flashcards, selectedSubjectTopics],
  );

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSourceType("json_upload");
    file
      .text()
      .then((text) => setPayload(text))
      .catch(() => {
        setError("JSON dosyası okunamadı.");
      });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (!selectedSubjectId) {
        throw new Error("Önce dersi seçmelisin.");
      }

      const parsed = JSON.parse(payload) as unknown;
      const questions = extractAndValidateQuestions(parsed, selectedSubjectId, topics);

      const response = await adminApiRequest<{ import: AdminQuestionImport }>("/admin/question-imports", {
        token,
        method: "POST",
        body: {
          source_type: sourceType,
          raw_payload: parsed,
          questions,
        },
      });

      showToast({
        tone: "success",
        title: "D/Y import kaydı oluşturuldu",
        description:
          response.data.import.rejected_count > 0
            ? `${response.data.import.pending_count} soru incelemeye hazır, ${response.data.import.rejected_count} duplicate içeri alınmadı.`
            : `${response.data.import.total_count} soru incelemeye hazır.`,
      });

      router.replace(`/sorular/import/${response.data.import.id}/incele`);
    } catch (submitError) {
      const description =
        submitError instanceof Error ? submitError.message : "D/Y import işlemi başarısız oldu.";
      setError(description);
      showToast({
        tone: "error",
        title: "Import tamamlanamadı",
        description,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" id="true-false-import-form" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Ders
              </span>
              <AdminSearchSelect
                emptyText="Ders bulunamadı."
                hideLabel
                label="Ders"
                onChange={setSelectedSubjectId}
                options={subjectOptions}
                placeholder="Ders seç"
                value={selectedSubjectId}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <InfoPill label="Konu" value={selectedSubjectTopics.length} />
              <InfoPill label="Bilgi kartı" value={flashcards.length} loading={flashcardsLoading} />
              <InfoPill label="Son import" value={importsMeta?.total ?? imports.length} />
            </div>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                JSON Dosyası
              </span>
              <input accept=".json,application/json" className="admin-input h-11" onChange={handleFileUpload} type="file" />
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                D/Y JSON İçeriği
              </span>
              <textarea
                className="admin-input min-h-[460px] font-mono text-[13px] leading-6"
                onChange={(event) => {
                  setSourceType("json_paste");
                  setPayload(event.target.value);
                }}
                value={payload}
              />
            </label>

            {error ? (
              <div className="rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                {error}
              </div>
            ) : null}
          </form>
        </AdminTableCard>

        <AdminTableCard>
          <div className="px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                  Son Soru Importları
                </h3>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Oluşan importlar yine soru review ekranında incelenir.
                </p>
              </div>
              <Clock3 size={18} className="text-[var(--color-admin-muted)]" />
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                  Import kayıtları yükleniyor...
                </div>
              ) : imports.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                  Henüz soru import kaydı yok.
                </div>
              ) : (
                imports.map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 transition hover:border-[var(--color-admin-accent)]"
                    href={`/sorular/import/${item.id}/incele`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-admin-ink)]">Import #{item.id}</p>
                      <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                        {item.total_count} soru · {item.pending_count} bekliyor
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[var(--color-admin-muted)]">
                      {item.status === "completed" ? "Tamamlandı" : "İncelemede"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </AdminTableCard>
      </div>

      <div className="space-y-4">
        <AdminFormActionsCard cancelHref="/sorular" formId="true-false-import-form" saving={saving} submitLabel="Review'e Gönder" />

        <AdminTableCard>
          <div className="px-5 py-5">
            <div className="flex items-center gap-2">
              <ListChecks size={17} className="text-[var(--color-admin-accent)]" />
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Bilgi Kartı Kaynağı
              </h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
              D/Y soruları bu kaynaklardan üretilecek. JSON’da sadece `topic_id` kullanılmalı.
            </p>
            <textarea
              className="admin-input mt-4 h-[520px] resize-y font-mono text-xs leading-5"
              readOnly
              value={flashcardContext}
            />
          </div>
        </AdminTableCard>

        <AdminTableCard>
          <div className="px-5 py-5">
            <div className="flex items-center gap-2">
              <FileJson2 size={17} className="text-[var(--color-admin-accent)]" />
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Kalite Notu
              </h3>
            </div>
            <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4 text-sm leading-6 text-[var(--color-admin-muted)]">
              D/Y soruda cevap bariz olmamalı. Yanlış cümlede tek kritik unsur değişsin; doğru cümle de bilgi kartının aynısını kuru kuru tekrar etmesin.
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}

function extractAndValidateQuestions(
  parsed: unknown,
  selectedSubjectId: number,
  topics: AdminTopic[],
) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { questions?: unknown[] }).questions)) {
    throw new Error("JSON kökü `questions` dizisi içeren bir obje olmalı.");
  }

  const questions = (parsed as { questions: TrueFalseImportQuestion[] }).questions;

  questions.forEach((question, index) => {
    const itemNo = index + 1;
    const topicId = typeof question.topic_id === "number" ? question.topic_id : null;

    if (!topicId) {
      throw new Error(`${itemNo}. soruda geçerli topic_id yok.`);
    }

    const topic = topics.find((item) => item.id === topicId);
    if (!topic || topic.subject_id !== selectedSubjectId) {
      throw new Error(`${itemNo}. sorunun topic_id değeri seçilen derse ait değil.`);
    }

    if (question.question_type !== "true_false") {
      throw new Error(`${itemNo}. soru true_false tipinde olmalı.`);
    }

    if (question.correct_answer_text !== "true" && question.correct_answer_text !== "false") {
      throw new Error(`${itemNo}. soruda correct_answer_text true veya false olmalı.`);
    }

    if (Array.isArray(question.options) && question.options.length > 0) {
      throw new Error(`${itemNo}. D/Y sorusunda options gönderilmemeli.`);
    }

    if (!String(question.question_text ?? "").trim()) {
      throw new Error(`${itemNo}. soruda question_text boş olamaz.`);
    }

    if (!String(question.explanation_text ?? "").trim()) {
      throw new Error(`${itemNo}. soruda explanation_text boş olamaz.`);
    }
  });

  return questions.map((question) => ({
    ...question,
    status: "active",
  }));
}

function InfoPill({ label, value, loading = false }: { label: string; value: number; loading?: boolean }) {
  return (
    <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[var(--color-admin-ink)]">{loading ? "..." : value}</p>
    </div>
  );
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
