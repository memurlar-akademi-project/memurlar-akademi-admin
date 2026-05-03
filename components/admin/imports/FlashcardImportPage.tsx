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
import type { AdminFlashcardImport, AdminPaginationMeta, AdminSubject, AdminTopic } from "@/lib/types";

const flashcardTemplate = `{
  "flashcards": [
    {
      "topic_id": 101,
      "front_text": "Cevap süresi kaç gündür?",
      "back_text": "En geç 30 gün.",
      "status": "draft",
      "sort_order": 1,
      "is_free": false
    }
  ]
}`;

export function FlashcardImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();

  const subjectIdFromQuery = searchParams.get("subjectId");
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [imports, setImports] = useState<AdminFlashcardImport[]>([]);
  const [importsMeta, setImportsMeta] = useState<AdminPaginationMeta | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjectIdFromQuery ? Number(subjectIdFromQuery) : null,
  );
  const [payload, setPayload] = useState(flashcardTemplate);
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
          adminApiRequest<{ imports: AdminFlashcardImport[] }>("/admin/flashcard-imports?per_page=6", { token }),
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
          setError(loadError instanceof Error ? loadError.message : "Hap bilgi import ekranı yüklenemedi.");
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
      .slice(0, 80);
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

      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { flashcards?: unknown[] }).flashcards)) {
        throw new Error("JSON kökü `flashcards` dizisi içeren bir obje olmalı.");
      }

      const invalidTopic = (parsed as { flashcards: Array<{ topic_id?: unknown }> }).flashcards.find((flashcard) => {
        const topicId = typeof flashcard?.topic_id === "number" ? flashcard.topic_id : null;
        if (!topicId) {
          return true;
        }

        const topic = topics.find((item) => item.id === topicId);

        return !topic || topic.subject_id !== selectedSubjectId;
      });

      if (invalidTopic) {
        throw new Error("JSON içindeki tüm `topic_id` değerleri seçtiğin derse ait olmalı.");
      }

      const response = await adminApiRequest<{ import: AdminFlashcardImport }>("/admin/flashcard-imports", {
        token,
        method: "POST",
        body: {
          source_type: sourceType,
          raw_payload: parsed,
          flashcards: (parsed as { flashcards: unknown[] }).flashcards,
        },
      });

      showToast({
        tone: "success",
        title: "Hap bilgi import kaydı oluşturuldu",
        description:
          response.data.import.rejected_count > 0
            ? `${response.data.import.pending_count} kart incelemeye hazır, ${response.data.import.rejected_count} duplicate içeri alınmadı.`
            : `${response.data.import.total_count} kart incelemeye hazır.`,
      });

      router.replace(`/flashcardlar/import/${response.data.import.id}/incele`);
    } catch (submitError) {
      const description =
        submitError instanceof Error ? submitError.message : "Hap bilgi import işlemi başarısız oldu.";
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
          <form className="space-y-5 px-5 py-5" id="flashcard-import-form" onSubmit={handleSubmit}>
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
                  Onay bekleyen hap bilgi importlarını buradan tekrar açabilirsin.
                </p>
              </div>
              <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                {importsMeta?.total ?? imports.length} kayıt
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                  Import kayıtları yükleniyor...
                </div>
              ) : imports.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                  Henüz hap bilgi import kaydı yok.
                </div>
              ) : (
                imports.map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 transition hover:border-[var(--color-admin-accent)]"
                    href={`/flashcardlar/import/${item.id}/incele`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-admin-ink)]">
                        Import #{item.id}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                        {item.total_count} kart, {item.topic_count} konu, {item.pending_count} bekliyor
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
        <AdminFormActionsCard cancelHref="/flashcardlar" formId="flashcard-import-form" saving={saving} submitLabel="Önizlemeye Geç" />

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              AI Şablonu
            </h3>
            <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4 text-sm leading-6 text-[var(--color-admin-muted)]">
              Hap bilgi JSON'u `topic_id` bazlı gelir. Konu adı JSON'a yazılmaz; konu ve ders bilgisi backend tarafından `topic_id` üzerinden bağlanır.
            </div>

            <pre className="mt-4 overflow-x-auto rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-4 text-[12px] leading-6 text-[var(--color-admin-ink)]">
{flashcardTemplate}
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
                Bu listeyi AI’a verip hap bilgi JSON’unu `topic_id` bazlı ürettirebilirsin. Import sonrası her kart review ekranında konu bilgisiyle görünür.
              </p>
            </div>
          </div>
        </AdminTableCard>
      </div>
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
