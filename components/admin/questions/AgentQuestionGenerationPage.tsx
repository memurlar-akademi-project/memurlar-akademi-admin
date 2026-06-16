"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminSubject, AdminTopic } from "@/lib/types";
import type {
  AgentGenerationStartResponse,
  AgentJobListResponse,
  AgentJobStatus,
} from "@/components/admin/questions/AgentQuestionGenerationTypes";
import {
  formatDateTime,
  formatMoney,
  runningStatuses,
  statusLabel,
  statusTone,
} from "@/components/admin/questions/AgentQuestionGenerationTypes";

const COUNT_OPTIONS = [3, 5, 10, 20];
const MODEL_GEMINI_25_FLASH = "google/gemini-2.5-flash";
const MODEL_GEMINI_25_FLASH_LITE = "google/gemini-2.5-flash-lite";
const MODEL_GEMINI_35_FLASH = "google/gemini-3.5-flash";
const MODEL_GEMINI_31_FLASH_LITE = "google/gemini-3.1-flash-lite";
const MODEL_V32 = "deepseek/deepseek-v3.2";
const MODEL_V4_PRO = "deepseek/deepseek-v4-pro";
const MODEL_GEMMA_4_26B = "google/gemma-4-26b-a4b-it";
const MODEL_CLAUDE_HAIKU_45 = "anthropic/claude-haiku-4.5";
const DEFAULT_MODEL = MODEL_V4_PRO;

const MODEL_OPTIONS: Array<{
  value: string;
  label: string;
  hint: string;
  inputPrice: number;
  outputPrice: number;
  context: string;
}> = [
  {
    value: MODEL_GEMINI_25_FLASH,
    label: "Gemini 2.5 Flash",
    hint: "Hız/kalite dengesi; geniş context ile genel smoke test için iyi.",
    inputPrice: 0.3,
    outputPrice: 2.5,
    context: "1M",
  },
  {
    value: MODEL_GEMINI_25_FLASH_LITE,
    label: "Gemini 2.5 Flash Lite",
    hint: "Ucuz ve hızlı deneme; kalite eşiği düşük işlerde mantıklı.",
    inputPrice: 0.1,
    outputPrice: 0.4,
    context: "1M",
  },
  {
    value: MODEL_GEMINI_35_FLASH,
    label: "Gemini 3.5 Flash",
    hint: "Yeni Flash hattı; daha pahalı ama güçlü muhakeme/dil kalitesi beklenir.",
    inputPrice: 1.5,
    outputPrice: 9,
    context: "1M",
  },
  {
    value: MODEL_GEMINI_31_FLASH_LITE,
    label: "Gemini 3.1 Flash Lite",
    hint: "3.1 Lite hattı; ucuz, geniş context, hızlı soru denemesi için uygun.",
    inputPrice: 0.25,
    outputPrice: 1.5,
    context: "1M",
  },
  {
    value: MODEL_V4_PRO,
    label: "DeepSeek V4 Pro",
    hint: "Mevzuat sorusu üretimi için ana güçlü model.",
    inputPrice: 0.435,
    outputPrice: 0.87,
    context: "1M",
  },
  {
    value: MODEL_V32,
    label: "DeepSeek V3.2",
    hint: "Hızlı/ucuz deneme; final üretimde tek başına zayıf kalabilir.",
    inputPrice: 0.2288,
    outputPrice: 0.3432,
    context: "131K",
  },
  {
    value: MODEL_GEMMA_4_26B,
    label: "Gemma 4 26B A4B",
    hint: "Çok ucuz açık model alternatifi; kaliteyi küçük batch ile ölçmek iyi olur.",
    inputPrice: 0.06,
    outputPrice: 0.33,
    context: "262K",
  },
  {
    value: MODEL_CLAUDE_HAIKU_45,
    label: "Claude Haiku 4.5",
    hint: "Dili güçlü ve dengeli; maliyet Gemini/DeepSeek hızlı modellere göre yüksek.",
    inputPrice: 1,
    outputPrice: 5,
    context: "200K",
  },
];

function topicIsUsable(topic: AdminTopic) {
  return topic.status === "active" && (topic.content_count ?? 0) > 0;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("tr");
}

export function AgentQuestionGenerationPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { setTitle } = useAdminPageMeta();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [topicQuery, setTopicQuery] = useState("");
  const [requestedCount, setRequestedCount] = useState(5);
  const [qVersion, setQVersion] = useState("5");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [currentJob, setCurrentJob] = useState<AgentJobStatus | null>(null);
  const [jobs, setJobs] = useState<AgentJobListResponse["jobs"]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items: subjects, loading: subjectsLoading } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: topics, loading: topicsLoading } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });

  useEffect(() => {
    setTitle("Agent Soru Üret");

    return () => setTitle(null);
  }, [setTitle]);

  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.code ? `${subject.code} ${subject.name}` : subject.name,
        hint: `${subject.topic_count} konu · ${subject.pending_approval_question_count ?? 0} bekleyen`,
      })),
    [subjects],
  );

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects],
  );

  const subjectTopics = useMemo(
    () =>
      topics
        .filter((topic) => topic.subject_id === selectedSubjectId)
        .sort((first, second) => first.sort_order - second.sort_order || first.id - second.id),
    [selectedSubjectId, topics],
  );

  const filteredTopics = useMemo(() => {
    const query = normalizeSearch(topicQuery);

    if (!query) {
      return subjectTopics;
    }

    return subjectTopics.filter((topic) => topic.name.toLocaleLowerCase("tr").includes(query));
  }, [subjectTopics, topicQuery]);

  const selectedTopics = useMemo(
    () => subjectTopics.filter((topic) => selectedTopicIds.includes(topic.id)),
    [selectedTopicIds, subjectTopics],
  );
  const selectedModelOption = useMemo(
    () => MODEL_OPTIONS.find((option) => option.value === selectedModel) ?? MODEL_OPTIONS[0],
    [selectedModel],
  );

  const visibleSelectableTopicIds = useMemo(
    () => filteredTopics.filter(topicIsUsable).map((topic) => topic.id),
    [filteredTopics],
  );

  const totalRequested = selectedTopicIds.length * requestedCount;
  const parsedQVersion = qVersion.trim() ? Number(qVersion) : null;
  const qVersionIsValid =
    parsedQVersion === null || (Number.isInteger(parsedQVersion) && parsedQVersion >= 1 && parsedQVersion <= 65535);
  const canSubmit = Boolean(
    token &&
      selectedSubjectId &&
      selectedTopicIds.length > 0 &&
      requestedCount >= 1 &&
      requestedCount <= 100 &&
      qVersionIsValid &&
      !submitting,
  );

  const anyRunningJob = useMemo(
    () => jobs.some((job) => runningStatuses.has(job.status)) || Boolean(currentJob && runningStatuses.has(currentJob.status)),
    [currentJob, jobs],
  );

  useEffect(() => {
    setSelectedTopicIds([]);
    setTopicQuery("");
  }, [selectedSubjectId]);

  const loadJobStatus = useCallback(
    async (jobId: string, options: { silent?: boolean } = {}) => {
      if (!token) {
        return;
      }

      if (!options.silent) {
        setLoadingStatus(true);
      }

      try {
        const response = await adminApiRequest<AgentJobStatus>(`/admin/agent/question-generation/${jobId}`, { token });
        setCurrentJob(response.data);
      } catch (loadError) {
        showToast({
          title: "Job durumu alınamadı",
          description: loadError instanceof Error ? loadError.message : "Agent durum bilgisi okunamadı.",
          tone: "error",
        });
      } finally {
        if (!options.silent) {
          setLoadingStatus(false);
        }
      }
    },
    [showToast, token],
  );

  const loadJobs = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!token) {
        return;
      }

      if (!options.silent) {
        setJobsLoading(true);
      }

      try {
        const response = await adminApiRequest<AgentJobListResponse>("/admin/agent/question-generation-jobs?per_page=20", {
          token,
        });
        setJobs(response.data.jobs);
      } catch (loadError) {
        if (!options.silent) {
          showToast({
            title: "Üretim geçmişi alınamadı",
            description: loadError instanceof Error ? loadError.message : "Agent job listesi okunamadı.",
            tone: "error",
          });
        }
      } finally {
        if (!options.silent) {
          setJobsLoading(false);
        }
      }
    },
    [showToast, token],
  );

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!currentJob?.job_id || !runningStatuses.has(currentJob.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadJobStatus(currentJob.job_id, { silent: true });
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, [currentJob?.job_id, currentJob?.status, loadJobStatus]);

  useEffect(() => {
    if (!anyRunningJob) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadJobs({ silent: true });
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [anyRunningJob, loadJobs]);

  function toggleTopic(topicId: number) {
    setSelectedTopicIds((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId],
    );
  }

  function selectVisibleTopics() {
    setSelectedTopicIds((current) => Array.from(new Set([...current, ...visibleSelectableTopicIds])));
  }

  function clearVisibleTopics() {
    setSelectedTopicIds((current) => current.filter((id) => !visibleSelectableTopicIds.includes(id)));
  }

  async function handleSubmit() {
    if (!token || !selectedSubjectId || !canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await adminApiRequest<AgentGenerationStartResponse>("/admin/agent/question-generation", {
        token,
        method: "POST",
        body: {
          subject_id: selectedSubjectId,
          topic_ids: selectedTopicIds,
          requested_count: requestedCount,
          q_version: parsedQVersion,
          model_profile: {
            model: selectedModel.trim() || null,
          },
        },
      });

      setCurrentJob({
        job_id: response.data.job_id,
        status: response.data.status,
      });
      void loadJobs({ silent: true });
      showToast({
        title: "Soru üretimi kuyruğa alındı",
        description: `${selectedTopicIds.length} konu için toplam hedef ${totalRequested} soru. Detay kartı üretim geçmişine eklenecek.`,
        tone: "success",
      });
      void loadJobStatus(response.data.job_id, { silent: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Agent işi başlatılamadı.";
      setError(message);
      showToast({
        title: "Agent işi başlatılamadı",
        description: message,
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="admin-card overflow-hidden">
        <div className="border-b border-[var(--color-admin-line)] bg-[linear-gradient(135deg,rgba(37,99,235,0.10),rgba(15,159,110,0.07))] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700">
                <Sparkles size={14} />
                Tek Agent
              </div>
              <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
                Soru üretim işini kuyruğa al
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-admin-muted)]">
                Konuları seç, küçük bir hedef adet ver, tek modelle agent job başlat. Çıktılar doğrudan
                <span className="font-bold text-[var(--color-admin-ink)]"> Soru Onayla </span>
                kuyruğuna düşer; üretim geçmişinden ayrıca detayına girip inceleyebilirsin.
              </p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm shadow-sm">
              <p className="font-extrabold text-[var(--color-admin-ink)]">{selectedTopicIds.length} konu seçili</p>
              <p className="mt-1 text-xs text-[var(--color-admin-muted)]">Hedef: {totalRequested} aday soru</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_150px]">
              <AdminSearchSelect
                label="Ders"
                options={subjectOptions}
                value={selectedSubjectId}
                onChange={setSelectedSubjectId}
                placeholder="Ders ara"
                emptyText="Ders bulunamadı."
              />

              <label className="space-y-2">
                <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Topic başı adet
                </span>
                <input
                  className="admin-input h-11"
                  min={1}
                  max={100}
                  onChange={(event) => setRequestedCount(Number(event.target.value))}
                  type="number"
                  value={requestedCount}
                />
              </label>

              <label className="space-y-2">
                <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  q_version
                </span>
                <input
                  className={`admin-input h-11 ${qVersionIsValid ? "" : "border-rose-300"}`}
                  onChange={(event) => setQVersion(event.target.value)}
                  placeholder="5"
                  value={qVersion}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {COUNT_OPTIONS.map((count) => (
                <button
                  className={`rounded-full border px-4 py-2 text-sm font-extrabold transition ${
                    requestedCount === count
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-[var(--color-admin-line)] bg-white text-[var(--color-admin-muted)] hover:border-blue-300 hover:text-blue-700"
                  }`}
                  key={count}
                  onClick={() => setRequestedCount(count)}
                  type="button"
                >
                  {count} soru
                </button>
              ))}
            </div>

            <section className="rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-admin-line)] px-4 py-4">
                <div>
                  <h2 className="text-sm font-extrabold text-[var(--color-admin-ink)]">
                    {selectedSubject ? selectedSubject.name : "Konu seçimi"}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                    İçeriği olan aktif konular seçilebilir. Büyük koşmayalım diye önce 1-2 konuyla denemek daha güvenli.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="admin-button admin-button-secondary py-2 text-xs" onClick={selectVisibleTopics} type="button">
                    Görünenleri seç
                  </button>
                  <button className="admin-button admin-button-ghost py-2 text-xs" onClick={clearVisibleTopics} type="button">
                    Görünenleri temizle
                  </button>
                </div>
              </div>

              <div className="border-b border-[var(--color-admin-line)] p-4">
                <label className="admin-input-shell block">
                  <Search className="admin-input-icon" size={16} />
                  <input
                    className="admin-input admin-input-with-icon h-11"
                    onChange={(event) => setTopicQuery(event.target.value)}
                    placeholder="Konu ara"
                    value={topicQuery}
                  />
                </label>
              </div>

              <div className="max-h-[480px] overflow-y-auto p-3">
                {subjectsLoading || topicsLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-5 text-sm font-bold text-[var(--color-admin-muted)]">
                    <Loader2 className="animate-spin" size={16} />
                    Ders ve konular yükleniyor...
                  </div>
                ) : filteredTopics.length === 0 ? (
                  <div className="rounded-2xl bg-white px-4 py-5 text-sm font-bold text-[var(--color-admin-muted)]">
                    Bu derste arama kriterine uyan konu yok.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTopics.map((topic) => {
                      const checked = selectedTopicIds.includes(topic.id);
                      const usable = topicIsUsable(topic);

                      return (
                        <button
                          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                            checked
                              ? "border-blue-300 bg-blue-50"
                              : "border-[var(--color-admin-line)] bg-white hover:border-blue-200"
                          } ${usable ? "" : "opacity-55"}`}
                          disabled={!usable}
                          key={topic.id}
                          onClick={() => toggleTopic(topic.id)}
                          type="button"
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                              checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                            }`}
                          >
                            {checked ? <CheckCircle2 size={15} /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-extrabold text-[var(--color-admin-ink)]">
                              {topic.sort_order}. {topic.name}
                            </span>
                            <span className="mt-1 block text-xs text-[var(--color-admin-muted)]">
                              {topic.status} · {topic.content_count ?? 0} içerik · v{topic.content_version ?? "-"}
                            </span>
                          </span>
                          {!usable ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                              içerik yok
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[20px] border border-[var(--color-admin-line)] bg-white p-4">
              <div className="flex items-center gap-2">
                <Wand2 size={17} className="text-blue-600" />
                <h2 className="text-sm font-extrabold text-[var(--color-admin-ink)]">Tek agent modeli</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-admin-muted)]">
                Bu işte tek üretici agent çalışır. Çıktı daha sonra yalnız schema guard ile süzülür.
              </p>
              <label className="mt-4 block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                  Model
                </span>
                <select
                  className="admin-input h-11 text-sm"
                  onChange={(event) => setSelectedModel(event.target.value)}
                  value={selectedModel}
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · ${option.inputPrice}/$${option.outputPrice} / 1M
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 rounded-2xl bg-[var(--color-admin-panel-soft)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--color-admin-muted)]">
                <p className="font-bold text-[var(--color-admin-ink)]">{selectedModelOption.value}</p>
                <p className="mt-1">{selectedModelOption.hint}</p>
                <p className="mt-2">
                  Input ${selectedModelOption.inputPrice}/1M · Output ${selectedModelOption.outputPrice}/1M · Context {selectedModelOption.context}
                </p>
              </div>
            </section>

            <section className="rounded-[20px] border border-[var(--color-admin-line)] bg-white p-4">
              <h2 className="text-sm font-extrabold text-[var(--color-admin-ink)]">Seçim özeti</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <SummaryBox label="Konu" value={selectedTopicIds.length} />
                <SummaryBox label="Adet" value={requestedCount} />
                <SummaryBox label="Hedef" value={totalRequested} />
              </div>

              {selectedTopics.length > 0 ? (
                <div className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-2">
                  {selectedTopics.map((topic) => (
                    <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--color-admin-ink)]" key={topic.id}>
                      {topic.sort_order}. {topic.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-admin-line)] px-4 py-5 text-center text-sm font-bold text-[var(--color-admin-muted)]">
                  Henüz konu seçilmedi.
                </div>
              )}

              {error ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  <AlertTriangle size={17} />
                  <span>{error}</span>
                </div>
              ) : null}

              {!qVersionIsValid ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                  q_version 1 ile 65535 arasında tam sayı olmalı.
                </div>
              ) : null}

              <button
                className="admin-button admin-button-primary mt-4 h-12 w-full"
                disabled={!canSubmit}
                onClick={handleSubmit}
                type="button"
              >
                {submitting ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
                Job başlat
              </button>
            </section>

            {currentJob ? (
              <section className="rounded-[20px] border border-[var(--color-admin-line)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-[var(--color-admin-ink)]">Son job</h2>
                    <p className="mt-1 break-all text-xs font-semibold text-[var(--color-admin-muted)]">{currentJob.job_id}</p>
                  </div>
                  <button
                    className="admin-button admin-button-secondary h-10 px-3 py-2"
                    disabled={loadingStatus}
                    onClick={() => void loadJobStatus(currentJob.job_id)}
                    type="button"
                  >
                    {loadingStatus ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${statusTone(currentJob.status)}`}>
                    {statusLabel(currentJob.status)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                    {currentJob.question_count ?? 0} soru
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                    {formatMoney(currentJob.ai_stats?.estimated_cost_usd)}
                  </span>
                </div>

                {currentJob.error_message ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {currentJob.error_message}
                  </div>
                ) : null}

                {currentJob.question_runs && currentJob.question_runs.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {currentJob.question_runs.map((run) => (
                      <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-3" key={run.run_id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-[var(--color-admin-ink)]">
                              {run.topic_name ?? `Topic #${run.topic_id}`}
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                              Üretilen {run.generated} · Geçen {run.selected} · Elenen {run.rejected}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${statusTone(run.status)}`}>
                            {statusLabel(run.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-[var(--color-admin-panel-soft)] px-4 py-3 text-xs font-bold text-[var(--color-admin-muted)]">
                    Worker çalışmadıysa job burada kuyrukta kalır. Worker açılınca run detayları görünür.
                  </p>
                )}

                {currentJob.ai_logs && currentJob.ai_logs.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-[var(--color-admin-line)] bg-white p-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      AI log
                    </h3>
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                      {currentJob.ai_logs.map((logItem) => (
                        <div
                          className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs"
                          key={logItem.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-extrabold text-[var(--color-admin-ink)]">
                              {logItem.step ?? "ai_call"}
                            </span>
                            <span className={logItem.success ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>
                              {logItem.success ? "ok" : "hata"}
                            </span>
                          </div>
                          <p className="mt-1 break-all font-semibold text-[var(--color-admin-muted)]">{logItem.model}</p>
                          <p className="mt-1 font-semibold text-[var(--color-admin-muted)]">
                            In {logItem.input_tokens} · Out {logItem.output_tokens} · {logItem.latency_ms} ms · {formatMoney(logItem.estimated_cost_usd)}
                          </p>
                          {logItem.error ? <p className="mt-1 font-bold text-rose-700">{logItem.error}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-admin-line)] px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Üretim geçmişi</h2>
            <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
              Gönderdiğin agent işleri burada kalır. Detay için ayrı sayfaya girersin.
            </p>
          </div>
          <button className="admin-button admin-button-secondary h-10 px-3 py-2" disabled={jobsLoading} onClick={() => void loadJobs()} type="button">
            {jobsLoading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
          </button>
        </div>

        <div className="p-4">
          {jobsLoading && jobs.length === 0 ? (
            <div className="rounded-2xl bg-[var(--color-admin-panel-soft)] px-4 py-5 text-sm font-bold text-[var(--color-admin-muted)]">
              Üretim geçmişi yükleniyor...
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-2xl bg-[var(--color-admin-panel-soft)] px-4 py-5 text-sm font-bold text-[var(--color-admin-muted)]">
              Henüz agent soru üretim işi yok.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <Link
                  className="group rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  href={`/sorular/agent-uret/${job.job_id}`}
                  key={job.job_id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {job.subject_code ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
                            {job.subject_code}
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${statusTone(job.status)}`}>
                          {statusLabel(job.status)}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-extrabold text-[var(--color-admin-ink)]">
                        {job.subject_name ?? job.source_law_name ?? "Agent üretimi"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                        {job.requested_topic_count} konu · {job.requested_question_count} istendi · {job.generated_question_count} üretildi
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
                        {formatDateTime(job.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="mt-8 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" size={18} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[var(--color-admin-panel-soft)] px-3 py-3 text-center">
      <p className="text-lg font-extrabold text-[var(--color-admin-ink)]">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">{label}</p>
    </div>
  );
}
