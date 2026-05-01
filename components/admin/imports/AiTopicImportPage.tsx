"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Play,
  RefreshCcw,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type {
  AdminDocumentProcessingChunk,
  AdminDocumentProcessingJob,
  AdminDocumentPromptPreview,
  AdminExam,
  AdminSubject,
  AdminTopic,
} from "@/lib/types";

const DEFAULT_MODEL = "minimax/minimax-m2.7";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "Sırada",
    processing: "Chunklanıyor",
    chunked: "Chunk hazır",
    queued_for_generation: "AI kuyruğunda",
    generating: "AI üretiyor",
    generated: "Taslak hazır",
    partially_generated: "Kısmi üretim",
    validation_failed: "Validasyon uyarısı",
    generation_failed: "AI hatası",
    failed: "Hata",
  };

  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (["generated", "chunked"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["queued", "processing", "queued_for_generation", "generating", "partially_generated"].includes(status)) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (["validation_failed", "generation_failed", "failed"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metric(value: number | undefined | null) {
  return typeof value === "number" ? value.toLocaleString("tr-TR") : "-";
}

function draftContentBlockCount(draft?: Record<string, unknown> | null) {
  const topic = draft?.topic;

  if (!topic || typeof topic !== "object") {
    return 0;
  }

  const blocks = (topic as { content_blocks?: unknown }).content_blocks;

  return Array.isArray(blocks) ? blocks.length : 0;
}

function generateButtonLabel(chunk: AdminDocumentProcessingChunk) {
  if (chunk.has_draft_topic && chunk.validation_errors.length) {
    return "AI Düzelt";
  }

  if (chunk.processing_status === "generation_failed") {
    return "Tekrar Üret";
  }

  return "AI Üret";
}

export function AiTopicImportPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { setTitle } = useAdminPageMeta();
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [jobs, setJobs] = useState<AdminDocumentProcessingJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<AdminDocumentProcessingJob | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [targetExamId, setTargetExamId] = useState<number | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewLoadingChunkId, setPreviewLoadingChunkId] = useState<number | null>(null);
  const [draftLoadingChunkId, setDraftLoadingChunkId] = useState<number | null>(null);
  const [promptPreview, setPromptPreview] = useState<AdminDocumentPromptPreview | null>(null);
  const [draftPreviewChunk, setDraftPreviewChunk] = useState<AdminDocumentProcessingChunk | null>(null);
  const [importingChunkId, setImportingChunkId] = useState<number | null>(null);
  const [importStatus, setImportStatus] = useState<"draft" | "active">("draft");
  const [generationArmed, setGenerationArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle("AI Konu Import");

    return () => setTitle(null);
  }, [setTitle]);

  const subjectOptions = useMemo(
    () => subjects.map((subject) => ({ id: subject.id, label: subject.name, hint: `${subject.topic_count} konu` })),
    [subjects],
  );

  const examOptions = useMemo(
    () => exams.map((exam) => ({ id: exam.id, label: exam.name, hint: exam.ministry?.name ?? undefined })),
    [exams],
  );

  const loadInitialData = useCallback(async function loadInitialData() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [subjectsResponse, examsResponse, jobsResponse] = await Promise.all([
        adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
        adminApiRequest<{ exams: AdminExam[] }>("/admin/exams", { token }),
        adminApiRequest<{ jobs: AdminDocumentProcessingJob[] }>("/admin/document-processing-jobs", { token }),
      ]);

      setSubjects(subjectsResponse.data.subjects);
      setExams(examsResponse.data.exams);
      setJobs(jobsResponse.data.jobs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AI konu import ekranı yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  async function loadJob(jobId: number) {
    if (!token) {
      return;
    }

    setDetailLoading(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ job: AdminDocumentProcessingJob }>(
        `/admin/document-processing-jobs/${jobId}`,
        { token },
      );

      setSelectedJob(response.data.job);
      setJobs((current) =>
        current.map((job) => (job.id === response.data.job.id ? { ...job, ...response.data.job } : job)),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Job detayı yüklenemedi.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRefresh() {
    await loadInitialData();

    if (selectedJob?.id) {
      await loadJob(selectedJob.id);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSourceFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !sourceFile) {
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append("source_file", sourceFile);
    formData.append("instruction_version", "topic-analysis-v1");
    formData.append("ai_provider", "openrouter");
    formData.append("ai_model", model.trim() || DEFAULT_MODEL);

    if (subjectId) {
      formData.append("subject_id", String(subjectId));
    }

    if (targetExamId) {
      formData.append("target_exam_id", String(targetExamId));
    }

    try {
      const response = await adminApiRequest<{ job: AdminDocumentProcessingJob }>("/admin/document-processing-jobs", {
        token,
        method: "POST",
        body: formData,
      });

      setJobs((current) => [response.data.job, ...current.filter((job) => job.id !== response.data.job.id)]);
      setSelectedJob(response.data.job);
      setSourceFile(null);
      showToast({
        tone: "success",
        title: "Doküman kuyruğa alındı",
        description: "Bu adım kredi harcamaz. Worker çalışınca chunk listesi oluşur.",
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Doküman kuyruğa alınamadı.");
      showToast({
        tone: "error",
        title: "Job oluşturulamadı",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateJob() {
    if (!token || !selectedJob || !generationArmed) {
      return;
    }

    setGenerating(true);

    try {
      const response = await adminApiRequest<{
        job: AdminDocumentProcessingJob;
        queued_chunk_count: number;
      }>(`/admin/document-processing-jobs/${selectedJob.id}/generate`, {
        token,
        method: "POST",
      });

      setSelectedJob(response.data.job);
      showToast({
        tone: "success",
        title: "AI üretim kuyruğu hazır",
        description: `${response.data.queued_chunk_count} chunk AI üretimine alındı.`,
      });
    } catch (generateError) {
      showToast({
        tone: "error",
        title: "AI kuyruğu başlatılamadı",
        description: generateError instanceof Error ? generateError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setGenerating(false);
      setGenerationArmed(false);
    }
  }

  async function handleGenerateChunk(chunk: AdminDocumentProcessingChunk) {
    if (!token || !selectedJob || !generationArmed) {
      return;
    }

    setGenerating(true);

    try {
      await adminApiRequest(`/admin/document-processing-jobs/${selectedJob.id}/chunks/${chunk.id}/generate`, {
        token,
        method: "POST",
      });

      showToast({
        tone: "success",
        title: chunk.has_draft_topic && chunk.validation_errors.length ? "Chunk AI düzeltmeye alındı" : "Chunk AI kuyruğuna alındı",
        description: chunk.name,
      });
      await loadJob(selectedJob.id);
    } catch (generateError) {
      showToast({
        tone: "error",
        title: "Chunk başlatılamadı",
        description: generateError instanceof Error ? generateError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setGenerating(false);
      setGenerationArmed(false);
    }
  }

  async function handlePromptPreview(chunk: AdminDocumentProcessingChunk) {
    if (!token || !selectedJob) {
      return;
    }

    setPreviewLoadingChunkId(chunk.id);
    setError(null);
    setDraftPreviewChunk(null);

    try {
      const response = await adminApiRequest<{ preview: AdminDocumentPromptPreview }>(
        `/admin/document-processing-jobs/${selectedJob.id}/chunks/${chunk.id}/prompt-preview`,
        { token },
      );

      setPromptPreview(response.data.preview);
      showToast({
        tone: "success",
        title: "Prompt preview hazır",
        description: `${response.data.preview.chunk.name} için AI'a gidecek veri hazırlandı. Kredi harcanmadı.`,
      });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Prompt preview alınamadı.");
      showToast({
        tone: "error",
        title: "Preview alınamadı",
        description: previewError instanceof Error ? previewError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setPreviewLoadingChunkId(null);
    }
  }

  async function handleDraftPreview(chunk: AdminDocumentProcessingChunk) {
    if (!token || !selectedJob) {
      return;
    }

    setDraftLoadingChunkId(chunk.id);
    setError(null);
    setPromptPreview(null);

    try {
      const response = await adminApiRequest<{ chunk: AdminDocumentProcessingChunk }>(
        `/admin/document-processing-jobs/${selectedJob.id}/chunks/${chunk.id}`,
        { token },
      );

      setDraftPreviewChunk(response.data.chunk);
      showToast({
        tone: "success",
        title: "Nihai JSON yüklendi",
        description: response.data.chunk.name,
      });
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Nihai JSON alınamadı.");
      showToast({
        tone: "error",
        title: "JSON alınamadı",
        description: draftError instanceof Error ? draftError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setDraftLoadingChunkId(null);
    }
  }

  async function handleImportChunk(chunk: AdminDocumentProcessingChunk) {
    if (!token || !selectedJob) {
      return;
    }

    setImportingChunkId(chunk.id);
    setError(null);

    try {
      const response = await adminApiRequest<{ chunk: AdminDocumentProcessingChunk; topic: AdminTopic }>(
        `/admin/document-processing-jobs/${selectedJob.id}/chunks/${chunk.id}/import`,
        {
          token,
          method: "POST",
          body: JSON.stringify({ status: importStatus }),
        },
      );

      setDraftPreviewChunk(response.data.chunk);
      showToast({
        tone: "success",
        title: importStatus === "active" ? "Konu aktif kaydedildi" : "Konu draft kaydedildi",
        description: response.data.topic.name,
      });
      await loadJob(selectedJob.id);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Konu kaydedilemedi.");
      showToast({
        tone: "error",
        title: "Konu kaydedilemedi",
        description: importError instanceof Error ? importError.message : "İşlem başarısız oldu.",
      });
      await loadJob(selectedJob.id);
    } finally {
      setImportingChunkId(null);
    }
  }

  const selectedChunks = selectedJob?.chunks ?? [];

  return (
    <div className="space-y-6">
      <section className="admin-card overflow-hidden">
        <div className="relative px-6 py-6">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(14,116,144,0.18),transparent_45%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-800">
                <Sparkles size={14} />
                Kontrollü AI Akışı
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
                AI Konu Import
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-admin-muted)]">
                Dokümanı önce güvenli chunklara böleriz. AI sadece sen onay verince çalışır; üretilen taslaklar human review olmadan konu importuna dönüşmez.
              </p>
            </div>
            <button className="admin-button admin-button-secondary" disabled={loading || detailLoading} onClick={handleRefresh} type="button">
              <RefreshCcw size={16} />
              Yenile
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-6">
          <AdminTableCard>
            <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
              <div>
                <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Yeni Doküman</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--color-admin-muted)]">
                  Bu işlem sadece dosyayı saklar ve chunk job oluşturur. AI çağrısı yapmaz.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  DOCX Dosyası
                </span>
                <input
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="admin-input h-11"
                  onChange={handleFileChange}
                  type="file"
                />
                {sourceFile ? (
                  <span className="flex items-center gap-2 text-xs font-semibold text-cyan-700">
                    <FileText size={14} />
                    {sourceFile.name}
                  </span>
                ) : null}
              </label>

              <AdminSearchSelect
                emptyText="Ders bulunamadı."
                label="Ders"
                onChange={setSubjectId}
                options={subjectOptions}
                placeholder="Ders ara"
                value={subjectId}
              />

              <AdminSearchSelect
                emptyText="Sınav bulunamadı."
                label="Hedef Sınav"
                onChange={setTargetExamId}
                options={examOptions}
                placeholder="Sınav ara"
                value={targetExamId}
              />

              <label className="block space-y-2">
                <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  AI Model
                </span>
                <input
                  className="admin-input h-11 font-mono text-sm"
                  onChange={(event) => setModel(event.target.value)}
                  value={model}
                />
                <span className="text-xs leading-5 text-[var(--color-admin-muted)]">
                  Öneri: {DEFAULT_MODEL}. Kalite/maliyet testlerinde şu an ana adayımız bu.
                </span>
              </label>

              <button className="admin-button admin-button-primary w-full justify-center" disabled={saving || !sourceFile} type="submit">
                <UploadCloud size={17} />
                {saving ? "Kuyruğa alınıyor..." : "Dokümanı Chunkla"}
              </button>
            </form>
          </AdminTableCard>

          <AdminTableCard>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4">
                <AlertTriangle className="mt-0.5 text-amber-700" size={18} />
                <div>
                  <p className="text-sm font-extrabold text-amber-900">Kredi güvenlik kilidi</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    AI üretim butonları bu kutu işaretlenmeden çalışmaz. Şu an ekranı test ederken kredi harcamayız.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-900">
                    <input
                      checked={generationArmed}
                      className="h-4 w-4 accent-amber-700"
                      onChange={(event) => setGenerationArmed(event.target.checked)}
                      type="checkbox"
                    />
                    AI çağrısına izin veriyorum
                  </label>
                  <label className="mt-4 block space-y-2">
                    <span className="block text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-900">
                      Konu kayıt modu
                    </span>
                    <select
                      className="admin-input h-10 bg-white text-sm"
                      onChange={(event) => setImportStatus(event.target.value === "active" ? "active" : "draft")}
                      value={importStatus}
                    >
                      <option value="draft">Draft kaydet</option>
                      <option value="active">Aktif kaydet</option>
                    </select>
                    <span className="block text-xs leading-5 text-amber-800">
                      Kullanıcı arayüzünde görünmesi için aktif gerekir; güvenli inceleme için draft seç.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </AdminTableCard>
        </div>

        <div className="space-y-6">
          <AdminTableCard>
            <div className="border-b border-[var(--color-admin-line)] px-5 py-4">
              <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">AI Import Jobları</h2>
              <p className="mt-1 text-sm text-[var(--color-admin-muted)]">Son 50 doküman işleme kaydı.</p>
            </div>

            <div className="max-h-[390px] overflow-y-auto">
              {loading ? (
                <p className="px-5 py-8 text-sm text-[var(--color-admin-muted)]">Joblar yükleniyor...</p>
              ) : jobs.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[var(--color-admin-muted)]">Henüz AI konu import jobı yok.</p>
              ) : (
                jobs.map((job) => (
                  <button
                    key={job.id}
                    className={`w-full border-b border-[var(--color-admin-line)] px-5 py-4 text-left transition hover:bg-[var(--color-admin-panel-soft)] ${
                      selectedJob?.id === job.id ? "bg-cyan-50/60" : ""
                    }`}
                    onClick={() => loadJob(job.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-[var(--color-admin-ink)]">
                          {job.source_title ?? job.original_filename ?? `Import #${job.id}`}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                          {job.subject?.name ?? "Ders seçilmedi"} · {job.chunk_count ?? 0} chunk · {formatDate(job.updated_at)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(job.processing_status)}`}>
                        {statusLabel(job.processing_status)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </AdminTableCard>

          <AdminTableCard>
            <div className="border-b border-[var(--color-admin-line)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Job Detayı</h2>
                  <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                    Chunkları gör, sonra kontrollü şekilde AI üretimine al.
                  </p>
                </div>
                {selectedJob ? (
                  <button
                    className="admin-button admin-button-primary"
                    disabled={generating || !generationArmed || selectedChunks.length === 0}
                    onClick={handleGenerateJob}
                    type="button"
                  >
                    <Bot size={16} />
                    Tüm Chunkları Üret
                  </button>
                ) : null}
              </div>
            </div>

            {!selectedJob ? (
              <div className="px-5 py-12 text-center">
                <Clock3 className="mx-auto text-[var(--color-admin-muted)]" size={32} />
                <p className="mt-3 text-sm font-semibold text-[var(--color-admin-muted)]">
                  Detay görmek için soldan bir job seç.
                </p>
              </div>
            ) : (
              <div>
                <div className="grid gap-3 border-b border-[var(--color-admin-line)] px-5 py-4 md:grid-cols-4">
                  <div className="rounded-[16px] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Blok</p>
                    <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">{metric(selectedJob.document_stats.block_count)}</p>
                  </div>
                  <div className="rounded-[16px] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Tablo</p>
                    <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">{metric(selectedJob.document_stats.table_count)}</p>
                  </div>
                  <div className="rounded-[16px] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Chunk</p>
                    <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">{metric(selectedJob.chunk_count)}</p>
                  </div>
                  <div className="rounded-[16px] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Model</p>
                    <p className="mt-1 truncate text-sm font-extrabold text-[var(--color-admin-ink)]">{selectedJob.ai_model ?? "-"}</p>
                  </div>
                </div>

                {detailLoading ? (
                  <p className="px-5 py-8 text-sm text-[var(--color-admin-muted)]">Chunklar yükleniyor...</p>
                ) : selectedChunks.length === 0 ? (
                  <div className="px-5 py-8 text-sm leading-6 text-[var(--color-admin-muted)]">
                    Chunklar henüz oluşmadı. Backend queue worker çalışınca bu alan dolacak.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-admin-line)]">
                    {selectedChunks.map((chunk) => (
                      <div key={chunk.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-extrabold text-cyan-800">
                                #{chunk.chunk_no}
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(chunk.processing_status)}`}>
                                {statusLabel(chunk.processing_status)}
                              </span>
                              {chunk.warnings.length ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                  {chunk.warnings.length} uyarı
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 font-extrabold text-[var(--color-admin-ink)]">{chunk.name}</p>
                            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                              {metric(chunk.stats.block_count)} blok · {metric(chunk.stats.table_count)} tablo · {metric(chunk.stats.long_paragraph_count)} uzun paragraf
                            </p>
                            {chunk.validation_errors.length ? (
                              <p className="mt-2 text-xs font-semibold text-rose-700">
                                {chunk.validation_errors[0]}
                              </p>
                            ) : null}
                            {chunk.final_topic ? (
                              <p className="mt-2 text-xs font-bold text-emerald-700">
                                Kaydedildi: {chunk.final_topic.name} ({chunk.final_topic.status})
                              </p>
                            ) : null}
                          </div>
                          <button
                            className="admin-button admin-button-secondary"
                            disabled={previewLoadingChunkId === chunk.id}
                            onClick={() => handlePromptPreview(chunk)}
                            type="button"
                          >
                            <Eye size={16} />
                            {previewLoadingChunkId === chunk.id ? "Hazırlanıyor" : "Prompt Preview"}
                          </button>
                          <button
                            className="admin-button admin-button-secondary"
                            disabled={!chunk.has_draft_topic || draftLoadingChunkId === chunk.id}
                            onClick={() => handleDraftPreview(chunk)}
                            type="button"
                          >
                            <FileText size={16} />
                            {draftLoadingChunkId === chunk.id ? "Yükleniyor" : "JSON Gör"}
                          </button>
                          <button
                            className="admin-button admin-button-primary"
                            disabled={
                              !chunk.has_draft_topic ||
                              chunk.validation_errors.length > 0 ||
                              chunk.processing_status !== "generated" ||
                              importingChunkId === chunk.id
                            }
                            onClick={() => handleImportChunk(chunk)}
                            type="button"
                          >
                            <CheckCircle2 size={16} />
                            {importingChunkId === chunk.id ? "Kaydediliyor" : "Derse Kaydet"}
                          </button>
                          <button
                            className="admin-button admin-button-secondary"
                            disabled={generating || !generationArmed}
                            onClick={() => handleGenerateChunk(chunk)}
                            type="button"
                          >
                            {chunk.has_draft_topic ? <CheckCircle2 size={16} /> : <Play size={16} />}
                            {generateButtonLabel(chunk)}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {promptPreview ? (
                  <div className="border-t border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan-700">
                          Prompt Preview
                        </p>
                        <h3 className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {promptPreview.chunk.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                          Bu çıktı AI&apos;a gönderilecek mesajların birebir önizlemesidir. Kredi harcanmadı.
                        </p>
                      </div>
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-extrabold text-cyan-800">
                        {promptPreview.provider ?? "-"} · {promptPreview.model ?? "-"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Tahmini Token</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {metric(promptPreview.estimates.estimated_input_tokens)}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Prompt Karakter</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {metric(promptPreview.estimates.prompt_char_count)}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Kaynak Blok</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {metric(promptPreview.estimates.source_block_count)}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Kaynak Kelime</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {metric(promptPreview.estimates.source_word_count)}
                        </p>
                      </div>
                    </div>

                    {promptPreview.preflight_warnings.length ? (
                      <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 text-amber-700" size={18} />
                          <div>
                            <p className="text-sm font-extrabold text-amber-900">Göndermeden önce bakılacaklar</p>
                            <div className="mt-2 space-y-2">
                              {promptPreview.preflight_warnings.map((warning) => (
                                <p key={warning.code} className="text-sm font-semibold leading-6 text-amber-800">
                                  {warning.message}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                        Preflight temiz görünüyor. Yine de ilk denemede tek chunk ile ilerlemek en güvenlisi.
                      </div>
                    )}

                    <textarea
                      className="admin-input mt-4 h-[360px] resize-y font-mono text-xs leading-5"
                      readOnly
                      value={JSON.stringify(promptPreview, null, 2)}
                    />
                  </div>
                ) : null}

                {draftPreviewChunk ? (
                  <div className="border-t border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                          Nihai JSON
                        </p>
                        <h3 className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {draftPreviewChunk.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                          Bu panel backend&apos;e kaydedilen normalize edilmiş `draft_topic` çıktısını gösterir.
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${statusClass(draftPreviewChunk.processing_status)}`}>
                        {statusLabel(draftPreviewChunk.processing_status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Blok</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {metric(draftContentBlockCount(draftPreviewChunk.draft_topic))}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Validasyon</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {metric(draftPreviewChunk.validation_errors.length)}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Deneme</p>
                        <p className="mt-1 text-lg font-extrabold text-[var(--color-admin-ink)]">
                          {metric(draftPreviewChunk.attempt_count)}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-white px-4 py-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Üretim</p>
                        <p className="mt-1 text-sm font-extrabold text-[var(--color-admin-ink)]">
                          {formatDate(draftPreviewChunk.generated_at)}
                        </p>
                      </div>
                    </div>

                    {draftPreviewChunk.validation_errors.length ? (
                      <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 text-rose-700" size={18} />
                          <div>
                            <p className="text-sm font-extrabold text-rose-900">Validasyon uyarıları</p>
                            <div className="mt-2 space-y-2">
                              {draftPreviewChunk.validation_errors.map((validationError) => (
                                <p key={validationError} className="text-sm font-semibold leading-6 text-rose-800">
                                  {validationError}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <textarea
                      className="admin-input mt-4 h-[420px] resize-y font-mono text-xs leading-5"
                      readOnly
                      value={draftPreviewChunk.draft_topic ? JSON.stringify(draftPreviewChunk.draft_topic, null, 2) : "Bu chunk için kayıtlı draft_topic yok."}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </AdminTableCard>
        </div>
      </div>
    </div>
  );
}
