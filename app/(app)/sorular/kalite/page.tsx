"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Gauge, RefreshCcw, Search, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type {
  AdminQuestionQualityCandidate,
  AdminQuestionQualityRunResult,
  AdminQuestionQualityRunSummary,
  AdminQuestionRewritePreviewJob,
  AdminQuestionRewritePreviewResult,
  AdminQuestionRewriteRevision,
  AdminSubject,
  AdminTopic,
} from "@/lib/types";

const COUNT_OPTIONS = [5, 10, 20, 30, 50];

type CandidatesResponse = {
  candidate_count: number;
  max_limit: number;
  candidates: AdminQuestionQualityCandidate[];
};

type RunsResponse = {
  runs: AdminQuestionQualityRunSummary[];
};

export default function QuestionQualityPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedCount, setSelectedCount] = useState(20);
  const [candidates, setCandidates] = useState<AdminQuestionQualityCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [maxLimit, setMaxLimit] = useState(50);
  const [result, setResult] = useState<AdminQuestionQualityRunResult | null>(null);
  const [selectedRewriteIds, setSelectedRewriteIds] = useState<number[]>([]);
  const [rewriteJob, setRewriteJob] = useState<AdminQuestionRewritePreviewJob | null>(null);
  const [rewriteResult, setRewriteResult] = useState<AdminQuestionRewritePreviewResult | null>(null);
  const [history, setHistory] = useState<AdminQuestionQualityRunSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: topics } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadHistory();
    // Geçmiş liste sayfa açılışında bir kez alınır, yeni analizlerde manuel yenilenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredTopics = useMemo(
    () => (selectedSubjectId ? topics.filter((topic) => topic.subject_id === selectedSubjectId) : topics),
    [selectedSubjectId, topics],
  );

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.code ? `${subject.code} ${subject.name}` : subject.name,
        hint: `${subject.topic_count} konu`,
      })),
    [subjects],
  );

  const topicOptions = useMemo(
    () =>
      filteredTopics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name ?? "Ders yok",
      })),
    [filteredTopics],
  );

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedTopicId, topics],
  );

  useEffect(() => {
    if (!token || !selectedTopicId) {
      return;
    }

    void loadCandidates({ silent: true });
    // Konu değişince adayları otomatik çekiyoruz; adet değişimi sadece listedeki seçimleri değiştirmeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicId, token]);

  useEffect(() => {
    if (!token || !rewriteJob || !["queued", "running"].includes(rewriteJob.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshRewriteJob(rewriteJob.id);
    }, 3000);

    void refreshRewriteJob(rewriteJob.id);

    return () => window.clearInterval(intervalId);
    // Poll sadece aktif rewrite job için çalışmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewriteJob?.id, rewriteJob?.status, token]);

  useEffect(() => {
    if (!token || !result || !["queued", "running"].includes(result.run.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshAnalysisRun(result.run.id);
    }, 3000);

    void refreshAnalysisRun(result.run.id);

    return () => window.clearInterval(intervalId);
    // Poll sadece aktif analiz run için çalışmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.run.id, result?.run.status, token]);

  async function loadCandidates(options: { silent?: boolean } = {}) {
    if (!token || !selectedTopicId) {
      setError("Önce analiz edilecek konuyu seçmelisin.");
      return;
    }

    setLoadingCandidates(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        topic_id: String(selectedTopicId),
        limit: String(Math.max(maxLimit, selectedCount)),
      });
      const response = await adminApiRequest<CandidatesResponse>(`/admin/question-quality/candidates?${params.toString()}`, { token });
      setCandidates(response.data.candidates);
      setMaxLimit(response.data.max_limit);
      setSelectedRewriteIds([]);
      setSelectedCandidateIds(response.data.candidates.slice(0, selectedCount).map((candidate) => candidate.id));
      setRewriteJob(null);
      setRewriteResult(null);

      if (!options.silent) {
        showToast({
          title: "Aday sorular getirildi",
          description: `${response.data.candidate_count} soru kalite analizine hazır.`,
          tone: "success",
        });
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Aday sorular yüklenemedi.";
      setError(message);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function loadHistory() {
    if (!token) {
      return;
    }

    setLoadingHistory(true);

    try {
      const response = await adminApiRequest<RunsResponse>("/admin/question-quality/runs?per_page=20", { token });
      setHistory(response.data.runs);
    } catch (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Analiz geçmişi yüklenemedi.";
      setError(message);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function runAnalysis() {
    if (!token || !selectedTopicId) {
      setError("Önce analiz edilecek konuyu seçmelisin.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await adminApiRequest<AdminQuestionQualityRunResult>("/admin/question-quality/analyze", {
        method: "POST",
        token,
        body: cleanBody({
          topic_id: selectedTopicId,
          limit: Math.max(1, selectedCandidateIds.length || selectedCount),
          question_ids: selectedCandidateIds.length > 0 ? selectedCandidateIds : undefined,
        }),
      });
      setResult(response.data);
      setCandidates([]);
      setRewriteJob(null);
      setRewriteResult(null);
      setSelectedRewriteIds([]);

      showToast({
        title: "Kalite analizi kuyruğa alındı",
        description: `${response.data.run.requested_count} soru arka planda analiz edilecek.`,
        tone: "success",
      });
      void loadHistory();
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : "Kalite analizi çalıştırılamadı.";
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function refreshAnalysisRun(runId: number) {
    if (!token) {
      return;
    }

    try {
      const response = await adminApiRequest<AdminQuestionQualityRunResult>(`/admin/question-quality/analyze/${runId}`, { token });
      setResult(response.data);

      if (response.data.run.status === "completed") {
        setSelectedRewriteIds([...response.data.bad_question_ids, ...response.data.borderline_question_ids]);
        void loadHistory();
      }

      if (response.data.run.status === "failed") {
        setError(response.data.run.failure_message ?? "Soru kalite analizi başarısız oldu.");
      }
    } catch (pollError) {
      const message = pollError instanceof Error ? pollError.message : "Kalite analizi takip edilemedi.";
      setError(message);
    }
  }

  async function runRewritePreview() {
    if (!token || selectedRewriteIds.length === 0) {
      setError("Güçlendirme için en az bir zayıf veya sınırda soru seçmelisin.");
      return;
    }

    setRewriting(true);
    setError(null);
    setRewriteResult(null);

    try {
      const response = await adminApiRequest<AdminQuestionRewritePreviewJob>("/admin/question-quality/rewrite-preview", {
        method: "POST",
        token,
        body: {
          question_ids: selectedRewriteIds,
        },
      });
      setRewriteJob(response.data);
      setRewriteResult(response.data.result ?? null);

      showToast({
        title: "Güçlendirme kuyruğa alındı",
        description: `${response.data.question_ids.length} soru için AI edit işi arka planda çalışacak.`,
        tone: "success",
      });
    } catch (rewriteError) {
      const message = rewriteError instanceof Error ? rewriteError.message : "Güçlendirme önerisi oluşturulamadı.";
      setError(message);
    } finally {
      setRewriting(false);
    }
  }

  async function refreshRewriteJob(jobId: number) {
    if (!token) {
      return;
    }

    try {
      const response = await adminApiRequest<AdminQuestionRewritePreviewJob>(`/admin/question-quality/rewrite-preview/${jobId}`, { token });
      setRewriteJob(response.data);

      if (response.data.status === "completed" && response.data.result) {
        setRewriteResult(response.data.result);
      }

      if (response.data.status === "failed") {
        setError(response.data.failure_message ?? "Soru güçlendirme işi başarısız oldu.");
      }
    } catch (pollError) {
      const message = pollError instanceof Error ? pollError.message : "Güçlendirme işi takip edilemedi.";
      setError(message);
    }
  }

  function toggleRewriteId(questionId: number) {
    setSelectedRewriteIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  }

  const availableCountOptions = COUNT_OPTIONS.filter((count) => count <= maxLimit);
  const allCandidatesSelected = candidates.length > 0 && candidates.every((candidate) => selectedCandidateIds.includes(candidate.id));
  const rewriteableItems = result?.items.filter((item) => item.quality_status === "failed" || item.quality_status === "borderline") ?? [];
  const deleteRecommendedItems = result?.items.filter((item) => item.quality_status === "delete_recommended") ?? [];
  const allRewriteableSelected = rewriteableItems.length > 0 && rewriteableItems.every((item) => selectedRewriteIds.includes(item.question_id));
  const analysisPending = result?.run.status === "queued" || result?.run.status === "running";
  const rewriteJobPending = rewriteJob?.status === "queued" || rewriteJob?.status === "running";

  function selectFirstCandidates(count: number) {
    setSelectedCount(count);
    setSelectedCandidateIds(candidates.slice(0, count).map((candidate) => candidate.id));
  }

  function toggleCandidateId(questionId: number) {
    setSelectedCandidateIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  }

  return (
    <div className="space-y-5">
      <AdminTableCard>
        <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                <Gauge size={14} />
                AI kalite kapısı
              </div>
              <h1 className="mt-3 text-2xl font-black text-[var(--color-admin-ink)]">Soru Kalite Analizi</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-admin-muted)]">
                Konu bazlı çoktan seçmeli soruları seçilen adet kadar gönderir. `passed` kalite alanına geçen sorular tekrar aday listesine alınmaz; zayıf ve sınırdaki sorular burada kalır.
              </p>
            </div>
            <div className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-muted)]">
              Token sadece <span className="text-[var(--color-admin-ink)]">Kalite Analizi Çalıştır</span> butonunda harcanır.
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-end">
          <AdminSearchSelect
            label="Ders"
            options={subjectOptions}
            value={selectedSubjectId}
            onChange={(value) => {
              setSelectedSubjectId(value);
              setSelectedTopicId(null);
              setCandidates([]);
              setSelectedCandidateIds([]);
              setResult(null);
            }}
            placeholder="Ders veya kanun numarası ara"
            buttonPlaceholder="Ders seç"
          />

          <AdminSearchSelect
            label="Konu"
            options={topicOptions}
            value={selectedTopicId}
            onChange={(value) => {
              setSelectedTopicId(value);
              setCandidates([]);
              setSelectedCandidateIds([]);
              setResult(null);
            }}
            placeholder="Konu ara"
            buttonPlaceholder="Konu seç"
          />

          <div className="space-y-2">
            <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
              Gönderilecek Adet
            </span>
            <div className="flex flex-wrap gap-2">
              {availableCountOptions.map((count) => (
                <button
                  className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                    selectedCandidateIds.length === count
                      ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]"
                      : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-ink)] hover:border-[var(--color-admin-accent)]"
                  }`}
                  key={count}
                  onClick={() => selectFirstCandidates(count)}
                  type="button"
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-admin-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--color-admin-muted)]">
            {selectedTopic ? (
              <>
                Seçili konu: <span className="font-bold text-[var(--color-admin-ink)]">{selectedTopic.name}</span>
              </>
            ) : (
              "Kalite analizi için önce konu seç."
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="admin-button admin-button-secondary"
              disabled={loadingCandidates || analyzing || analysisPending || !selectedTopicId}
              onClick={() => void loadCandidates()}
              type="button"
            >
              {loadingCandidates ? <RefreshCcw className="animate-spin" size={16} /> : <Search size={16} />}
              Adayları Göster
            </button>
            <button
              className="admin-button admin-button-primary"
              disabled={analyzing || analysisPending || loadingCandidates || !selectedTopicId || (candidates.length > 0 && selectedCandidateIds.length === 0)}
              onClick={() => void runAnalysis()}
              type="button"
            >
              {analyzing || analysisPending ? <RefreshCcw className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {analysisPending ? "Analiz Kuyrukta" : selectedCandidateIds.length > 0 ? `${selectedCandidateIds.length} Soruyu Analiz Et` : "Kalite Analizi Çalıştır"}
            </button>
          </div>
        </div>
      </AdminTableCard>

      {error ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <AdminTableCard>
        <SectionHeader
          icon={loadingHistory ? <RefreshCcw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
          title="Yapılan analizler"
          description="Her kalite analizi burada kalır; detayından zayıf soruları güçlendirebilir, silinecekleri silebilir veya geçenleri onaylayabilirsin."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-admin-line)] text-sm">
            <thead className="bg-[var(--color-admin-panel-soft)] text-left text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
              <tr>
                <th className="px-5 py-3">Run</th>
                <th className="px-5 py-3">Ders / Konu</th>
                <th className="px-5 py-3">Durum</th>
                <th className="px-5 py-3">Sonuç</th>
                <th className="px-5 py-3">Tarih</th>
                <th className="px-5 py-3 text-right">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-admin-line)] bg-white">
              {history.map((run) => (
                <tr key={run.id}>
                  <td className="px-5 py-4 font-black text-[var(--color-admin-ink)]">#{run.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-[var(--color-admin-ink)]">
                      {run.topic?.subject?.code ? `${run.topic.subject.code} ` : ""}
                      {run.topic?.subject?.name ?? "Ders yok"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">{run.topic?.name ?? "Konu yok"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <RunStatusPill status={run.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{run.passed_count} geçti</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{run.borderline_count} sınır</span>
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{run.failed_count} zayıf</span>
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{run.delete_recommended_count} sil</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{run.analyzed_count}/{run.requested_count} soru</p>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-[var(--color-admin-muted)]">{formatDate(run.created_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <Link className="admin-button admin-button-secondary inline-flex" href={`/sorular/kalite/${run.id}`}>
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
              {loadingHistory && history.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm font-semibold text-[var(--color-admin-muted)]" colSpan={6}>
                    Analiz geçmişi yükleniyor.
                  </td>
                </tr>
              ) : null}
              {!loadingHistory && history.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm font-semibold text-[var(--color-admin-muted)]" colSpan={6}>
                    Henüz kalite analizi yapılmamış.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminTableCard>

      {candidates.length > 0 ? (
        <AdminTableCard>
          <SectionHeader
            icon={<AlertTriangle size={18} />}
            title={`${candidates.length} aday soru`}
            description="Checkbox ile istediğin soruları seçebilirsin; sayı butonları listedeki ilk N soruyu otomatik seçer."
          />
          <div className="flex flex-col gap-3 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-3 text-sm font-bold text-[var(--color-admin-ink)]">
              <input
                checked={allCandidatesSelected}
                className="h-4 w-4 accent-[var(--color-admin-accent)]"
                onChange={() => setSelectedCandidateIds(allCandidatesSelected ? [] : candidates.map((candidate) => candidate.id))}
                type="checkbox"
              />
              Görünen {candidates.length} adayın tamamını seç
            </label>
            <p className="text-sm font-semibold text-[var(--color-admin-muted)]">
              {selectedCandidateIds.length} soru seçili
            </p>
          </div>
          <div className="divide-y divide-[var(--color-admin-line)]">
            {candidates.map((candidate) => (
              <CandidateAccordion
                candidate={candidate}
                checked={selectedCandidateIds.includes(candidate.id)}
                key={candidate.id}
                onToggle={() => toggleCandidateId(candidate.id)}
              />
            ))}
          </div>
        </AdminTableCard>
      ) : null}

      {analysisPending && result ? (
        <AdminTableCard>
          <SectionHeader
            icon={<RefreshCcw className="animate-spin" size={18} />}
            title="Kalite analizi kuyrukta"
            description={`Run #${result.run.id} ${result.run.status === "queued" ? "kuyrukta bekliyor" : "çalışıyor"}. Localde sonuç gelmiyorsa php artisan queue:work çalışmalı.`}
          />
          <div className="px-5 py-4 text-sm font-semibold text-[var(--color-admin-muted)]">
            {result.run.requested_count} soru arka planda analiz ediliyor. Bu ekran açık kaldığı sürece sonucu otomatik takip edeceğim.
            <Link className="ml-3 font-black text-[var(--color-admin-accent)]" href={`/sorular/kalite/${result.run.id}`}>
              Detay sayfasına git
            </Link>
          </div>
        </AdminTableCard>
      ) : null}

      {result && result.run.status === "completed" ? (
        <AdminTableCard>
          <SectionHeader
            icon={<ShieldCheck size={18} />}
            title="Son analiz sonucu"
            description={`${result.run.model} ile ${result.run.analyzed_count} soru analiz edildi.`}
          />
          <div className="flex justify-end border-b border-[var(--color-admin-line)] px-5 py-3">
            <Link className="admin-button admin-button-secondary inline-flex" href={`/sorular/kalite/${result.run.id}`}>
              Analiz Detayına Git
            </Link>
          </div>
          <div className="grid gap-3 border-b border-[var(--color-admin-line)] px-5 py-4 md:grid-cols-4">
            <ResultStat label="Geçti" value={result.run.passed_count} tone="success" />
            <ResultStat label="Sınırda" value={result.run.borderline_count} tone="warning" />
            <ResultStat label="Zayıf" value={result.run.failed_count} tone="danger" />
            <ResultStat label="Silinmeli" value={deleteRecommendedItems.length} tone="delete" />
          </div>
          {deleteRecommendedItems.length > 0 ? (
            <div className="border-b border-red-200 bg-red-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-red-700" size={18} />
                <div>
                  <p className="text-sm font-black text-red-800">
                    {deleteRecommendedItems.length} soru için silme önerisi var
                  </p>
                  <p className="mt-1 text-sm leading-6 text-red-700">
                    Bu sorular güçlendirme kuyruğuna alınmaz. Çok aşırı basit, anlamsız, kaynak dışı veya kurtarılamayacak kadar zayıf görünüyor.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {rewriteableItems.length > 0 ? (
            <div className="flex flex-col gap-3 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="inline-flex items-center gap-3 text-sm font-bold text-[var(--color-admin-ink)]">
                <input
                  checked={allRewriteableSelected}
                  className="h-4 w-4 accent-[var(--color-admin-accent)]"
                  onChange={() => {
                    setSelectedRewriteIds(allRewriteableSelected ? [] : rewriteableItems.map((item) => item.question_id));
                  }}
                  type="checkbox"
                />
                Editlenebilir zayıf/sınırdaki {rewriteableItems.length} soruyu seç
              </label>
              <button
                className="admin-button admin-button-primary"
                disabled={rewriting || rewriteJobPending || selectedRewriteIds.length === 0}
                onClick={() => void runRewritePreview()}
                type="button"
              >
                {rewriting || rewriteJobPending ? <RefreshCcw className="animate-spin" size={16} /> : <Wand2 size={16} />}
                {rewriteJobPending ? "Güçlendirme Hazırlanıyor" : `Seçili ${selectedRewriteIds.length} Soruyu Güçlendir`}
              </button>
            </div>
          ) : null}
          <div className="divide-y divide-[var(--color-admin-line)]">
            {result.items.map((item) => (
              <QualityResultAccordion
                checked={selectedRewriteIds.includes(item.question_id)}
                item={item}
                key={item.question_id}
                onToggle={item.quality_status === "failed" || item.quality_status === "borderline" ? () => toggleRewriteId(item.question_id) : undefined}
              />
            ))}
          </div>
        </AdminTableCard>
      ) : null}

      {rewriteJob && rewriteJobPending ? (
        <AdminTableCard>
          <SectionHeader
            icon={<RefreshCcw className="animate-spin" size={18} />}
            title="Güçlendirme işi kuyrukta"
            description={`Job #${rewriteJob.id} ${rewriteJob.status === "queued" ? "kuyrukta bekliyor" : "çalışıyor"}. Localde sonuç gelmiyorsa php artisan queue:work çalışmalı.`}
          />
          <div className="px-5 py-4 text-sm font-semibold text-[var(--color-admin-muted)]">
            {rewriteJob.question_ids.length} soru arka planda güçlendiriliyor. Bu ekran açık kaldığı sürece sonucu otomatik takip edeceğim.
          </div>
        </AdminTableCard>
      ) : null}

      {rewriteResult ? (
        <AdminTableCard>
          <SectionHeader
            icon={<Wand2 size={18} />}
            title="Güçlendirme önerileri"
            description={`${rewriteResult.model} ile ${rewriteResult.revision_count} revizyon önerisi üretildi. Bu öneriler otomatik kaydedilmez.`}
          />
          <div className="divide-y divide-[var(--color-admin-line)]">
            {rewriteResult.revisions.map((revision) => (
              <RewriteRevisionAccordion key={revision.id} revision={revision} />
            ))}
          </div>
        </AdminTableCard>
      ) : null}
    </div>
  );
}

function CandidateAccordion({
  candidate,
  checked,
  onToggle,
}: {
  candidate: AdminQuestionQualityCandidate;
  checked: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`px-5 py-4 transition ${checked ? "bg-blue-50/40" : ""}`}>
      <div className="grid gap-3 lg:grid-cols-[32px_96px_minmax(0,1fr)_180px_36px] lg:items-start">
        <div className="pt-1">
          <input
            checked={checked}
            className="h-4 w-4 accent-[var(--color-admin-accent)]"
            onChange={onToggle}
            type="checkbox"
          />
        </div>
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">#{candidate.id}</div>
        <button className="min-w-0 text-left" onClick={() => setOpen((current) => !current)} type="button">
          <p className="text-sm font-bold leading-6 text-[var(--color-admin-ink)]">{candidate.question_text}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {candidate.topic?.subject?.name ?? "Ders yok"} · {candidate.topic?.name ?? "Konu yok"}
          </p>
          {candidate.quality_flags && candidate.quality_flags.length > 0 ? <FlagList flags={candidate.quality_flags} /> : null}
        </button>
        <QualityPill status={candidate.quality_status ?? null} score={candidate.quality_score ?? null} />
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-white text-[var(--color-admin-muted)]"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <ChevronDown className={`transition ${open ? "rotate-180" : ""}`} size={16} />
        </button>
      </div>

      {open ? (
        <div className="mt-4 rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
          <QuestionOptions options={candidate.options} />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-admin-muted)]">
              <span className="font-black text-[var(--color-admin-ink)]">Doğru cevap: </span>
              {candidate.correct_answer_text}
            </div>
            <div className="rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-admin-muted)]">
              <span className="font-black text-[var(--color-admin-ink)]">Açıklama: </span>
              {candidate.explanation_text}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QualityResultAccordion({
  checked,
  item,
  onToggle,
}: {
  checked: boolean;
  item: AdminQuestionQualityRunResult["items"][number];
  onToggle?: () => void;
}) {
  const [open, setOpen] = useState(item.quality_status !== "passed");
  const question = item.question;

  return (
    <div className="px-5 py-4">
      <div className="grid gap-3 lg:grid-cols-[32px_96px_160px_minmax(0,1fr)_36px] lg:items-start">
        <div className="pt-1">
          {onToggle ? (
            <input
              checked={checked}
              className="h-4 w-4 accent-[var(--color-admin-accent)]"
              onChange={onToggle}
              type="checkbox"
            />
          ) : null}
        </div>
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">#{item.question_id}</div>
        <QualityPill status={item.quality_status} score={item.quality_score} />
        <button className="min-w-0 text-left" onClick={() => setOpen((current) => !current)} type="button">
          <p className="text-sm font-bold leading-6 text-[var(--color-admin-ink)]">
            {question?.question_text ?? item.quality_note}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {item.quality_note} · Blind solver: {item.predicted_label ?? "-"} / güven {item.solver_confidence ?? 0}
          </p>
          {item.quality_flags.length > 0 ? <FlagList flags={item.quality_flags} /> : null}
        </button>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] text-[var(--color-admin-muted)]"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <ChevronDown className={`transition ${open ? "rotate-180" : ""}`} size={16} />
        </button>
      </div>

      {open && question ? (
        <div className="mt-4 rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
          <QuestionOptions options={question.options} />
          <div className="mt-4 rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-admin-muted)]">
            <span className="font-black text-[var(--color-admin-ink)]">Açıklama: </span>
            {question.explanation_text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RewriteRevisionAccordion({ revision }: { revision: AdminQuestionRewriteRevision }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="px-5 py-4">
      <button className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setOpen((current) => !current)} type="button">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">#{revision.id}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-[var(--color-admin-ink)]">{revision.question_text}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{revision.revision_note}</p>
          <FlagList flags={revision.quality_flags} />
        </div>
        <ChevronDown className={`mt-1 shrink-0 text-[var(--color-admin-muted)] transition ${open ? "rotate-180" : ""}`} size={18} />
      </button>

      {open ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[20px] border border-red-100 bg-red-50/50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Eski</p>
            <p className="mt-3 text-sm font-bold leading-6 text-[var(--color-admin-ink)]">{revision.original.question_text}</p>
            <QuestionOptions options={revision.original.options} />
          </div>
          <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Öneri</p>
            <p className="mt-3 text-sm font-bold leading-6 text-[var(--color-admin-ink)]">{revision.question_text}</p>
            <QuestionOptions options={revision.options} />
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm leading-6 text-[var(--color-admin-muted)]">
              <span className="font-black text-[var(--color-admin-ink)]">Açıklama: </span>
              {revision.explanation_text}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuestionOptions({
  options,
}: {
  options: Array<{ label: string; option_text: string; is_correct: boolean }>;
}) {
  return (
    <div className="mt-3 grid gap-2">
      {options.map((option) => (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            option.is_correct
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-[var(--color-admin-line)] bg-white text-[var(--color-admin-ink)]"
          }`}
          key={option.label}
        >
          <span className="mr-2 font-black">{option.label})</span>
          {option.option_text}
        </div>
      ))}
    </div>
  );
}

function FlagList({ flags }: { flags: string[] }) {
  if (flags.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {flags.map((flag) => (
        <span className="rounded-full bg-[var(--color-admin-panel-soft)] px-2 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]" key={flag}>
          {flag}
        </span>
      ))}
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
        {icon}
      </span>
      <div>
        <h2 className="text-base font-black text-[var(--color-admin-ink)]">{title}</h2>
        <p className="text-sm text-[var(--color-admin-muted)]">{description}</p>
      </div>
    </div>
  );
}

function QualityPill({ status, score }: { status: string | null; score: number | null }) {
  const config =
    status === "passed"
      ? { label: "Kaliteli", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : status === "delete_recommended"
        ? { label: "Silinmeli", className: "border-red-300 bg-red-100 text-red-800" }
      : status === "failed"
        ? { label: "Zayıf", className: "border-red-200 bg-red-50 text-red-700" }
        : status === "borderline"
          ? { label: "Sınırda", className: "border-amber-200 bg-amber-50 text-amber-700" }
          : { label: "Analiz yok", className: "border-slate-200 bg-slate-100 text-slate-600" };

  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${config.className}`}>
      {status === "passed" ? <CheckCircle2 size={14} /> : null}
      {config.label}
      {score !== null ? <span>· {score}</span> : null}
    </span>
  );
}

function RunStatusPill({ status }: { status: AdminQuestionQualityRunSummary["status"] }) {
  const config =
    status === "completed"
      ? { label: "Tamamlandı", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : status === "failed"
        ? { label: "Hatalı", className: "border-red-200 bg-red-50 text-red-700" }
        : status === "running"
          ? { label: "Çalışıyor", className: "border-blue-200 bg-blue-50 text-blue-700" }
          : { label: "Kuyrukta", className: "border-slate-200 bg-slate-100 text-slate-600" };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${config.className}`}>
      {config.label}
    </span>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" | "delete" }) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "delete"
          ? "border-red-300 bg-red-100 text-red-800"
          : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-[20px] border px-4 py-4 ${className}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function cleanBody<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
