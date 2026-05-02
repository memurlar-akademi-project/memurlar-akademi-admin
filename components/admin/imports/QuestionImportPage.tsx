"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Clock3, FileJson2 } from "lucide-react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminQuestionImport, AdminSubject, AdminTopic } from "@/lib/types";

const questionTemplate = `{
  "questions": [
    {
      "topic_id": 101,
      "question_type": "multiple_choice",
      "difficulty": "medium",
      "status": "draft",
      "question_text": "Disiplin cezası verilmeden önce savunma için en az kaç gün süre verilir?",
      "correct_answer_text": "B",
      "explanation_text": "657 sayılı Kanun'a göre en az 7 gün süre tanınır.",
      "options": [
        { "label": "A", "option_text": "3 gün", "is_correct": false },
        { "label": "B", "option_text": "7 gün", "is_correct": true },
        { "label": "C", "option_text": "10 gün", "is_correct": false },
        { "label": "D", "option_text": "15 gün", "is_correct": false },
        { "label": "E", "option_text": "30 gün", "is_correct": false }
      ]
    }
  ]
}`;

export function QuestionImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();

  const subjectIdFromQuery = searchParams.get("subjectId");
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [imports, setImports] = useState<AdminQuestionImport[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjectIdFromQuery ? Number(subjectIdFromQuery) : null,
  );
  const [payload, setPayload] = useState(questionTemplate);
  const [sourceType, setSourceType] = useState<"json_upload" | "json_paste">("json_paste");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicSearch, setTopicSearch] = useState("");

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
          adminApiRequest<{ imports: AdminQuestionImport[] }>("/admin/question-imports", { token }),
        ]);

        if (cancelled) {
          return;
        }

        setSubjects(subjectsResponse.data.subjects);
        setTopics(topicsResponse.data.topics);
        setImports(importsResponse.data.imports);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Import ekranı yüklenemedi.");
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

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: `${subject.topic_count} konu`,
      })),
    [subjects],
  );

  const helperTopics = useMemo(() => {
    const normalizedQuery = topicSearch.trim().toLocaleLowerCase("tr");

    return topics
      .filter((topic) => selectedSubjectId === null || topic.subject_id === selectedSubjectId)
      .filter((topic) => {
        if (!normalizedQuery) {
          return true;
        }

        return [topic.name, topic.subject?.name]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr")
          .includes(normalizedQuery);
      })
      .slice(0, 60);
  }, [selectedSubjectId, topicSearch, topics]);

  const helperJson = useMemo(
    () =>
      JSON.stringify(
        helperTopics.map((topic) => ({
          topic_id: topic.id,
          topic_name: topic.name,
        })),
        null,
        2,
      ),
    [helperTopics],
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

      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { questions?: unknown[] }).questions)) {
        throw new Error("JSON kökü `questions` dizisi içeren bir obje olmalı.");
      }

      const invalidTopic = (parsed as { questions: Array<{ topic_id?: unknown }> }).questions.find((question) => {
        const topicId = typeof question?.topic_id === "number" ? question.topic_id : null;
        if (!topicId) {
          return true;
        }

        const topic = topics.find((item) => item.id === topicId);

        return !topic || topic.subject_id !== selectedSubjectId;
      });

      if (invalidTopic) {
        throw new Error("JSON içindeki tüm `topic_id` değerleri seçtiğin derse ait olmalı.");
      }

      const response = await adminApiRequest<{ import: AdminQuestionImport }>("/admin/question-imports", {
        token,
        method: "POST",
        body: {
          source_type: sourceType,
          raw_payload: parsed,
          questions: (parsed as { questions: unknown[] }).questions,
        },
      });

      showToast({
        tone: "success",
        title: "Soru import kaydı oluşturuldu",
        description: `${response.data.import.total_count} soru incelemeye hazır.`,
      });

      router.replace(`/sorular/import/${response.data.import.id}/incele`);
    } catch (submitError) {
      const description =
        submitError instanceof Error ? submitError.message : "Soru import işlemi başarısız oldu.";
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" id="question-import-form" onSubmit={handleSubmit}>
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

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                JSON Dosyası
              </span>
              <input accept=".json,application/json" className="admin-input h-11" onChange={handleFileUpload} type="file" />
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                JSON İçeriği
              </span>
              <textarea
                className="admin-input min-h-[420px] font-mono text-[13px] leading-6"
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
                  Son Importlar
                </h3>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Onay bekleyen importları buradan tekrar açabilirsin.
                </p>
              </div>
              <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                {imports.length} kayıt
              </span>
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
                imports.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 transition hover:border-[var(--color-admin-accent)]"
                    href={`/sorular/import/${item.id}/incele`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-admin-ink)]">
                        Import #{item.id}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                        {item.total_count} soru, {item.topic_count} konu, {item.pending_count} bekliyor
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-admin-muted)]">
                      <Clock3 size={14} />
                      <span>{item.status === "completed" ? "Tamamlandı" : "İncelemede"}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </AdminTableCard>
      </div>

      <div className="space-y-4">
        <AdminFormActionsCard cancelHref="/sorular" formId="question-import-form" saving={saving} submitLabel="Önizlemeye Geç" />

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              AI Şablonu
            </h3>
            <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4 text-sm leading-6 text-[var(--color-admin-muted)]">
              Önce konu import et. Sonra AI’a `topic_id + topic_name` listesini bağlam olarak ver. JSON çıktısında sadece `topic_id` kullanılmalı; konu adı DB’den alınır.
            </div>

            <pre className="mt-4 overflow-x-auto rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-4 text-[12px] leading-6 text-[var(--color-admin-ink)]">
{questionTemplate}
            </pre>
          </div>
        </AdminTableCard>

        <AdminTableCard>
          <div className="px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Topic ID Rehberi
              </h3>
              <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                {helperTopics.length} kayıt
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <AdminSearchSelect
                compact
                emptyText="Ders bulunamadı."
                hideLabel
                label="Ders"
                onChange={setSelectedSubjectId}
                options={subjectOptions}
                placeholder="Ders seç"
                value={selectedSubjectId}
              />

              <input
                className="admin-input h-10 text-sm"
                onChange={(event) => setTopicSearch(event.target.value)}
                placeholder="Topic ara"
                value={topicSearch}
              />
            </div>

            <pre className="mt-4 max-h-[280px] overflow-auto rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-4 text-[12px] leading-6 text-[var(--color-admin-ink)]">
{helperJson}
            </pre>

            <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm text-[var(--color-admin-muted)]">
              <FileJson2 className="mt-0.5 shrink-0" size={16} />
              <p>
                Bu listeyi dış AI’a verip soru JSON’unu `topic_id` bazlı ürettirebilirsin. Import sonrası sorular review ekranında tek tek incelenir.
              </p>
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
