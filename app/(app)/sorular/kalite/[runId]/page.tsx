"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, RefreshCcw, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type {
  AdminQuestionQualityCandidate,
  AdminQuestionQualityRunResult,
  AdminQuestionQualityRunItem,
  AdminQuestionRewritePreviewJob,
  AdminQuestionRewritePreviewResult,
  AdminQuestionRewriteRevision,
} from "@/lib/types";

export default function QuestionQualityRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = Number(params.runId);
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [result, setResult] = useState<AdminQuestionQualityRunResult | null>(null);
  const [selectedRewriteIds, setSelectedRewriteIds] = useState<number[]>([]);
  const [rewriteJob, setRewriteJob] = useState<AdminQuestionRewritePreviewJob | null>(null);
  const [rewriteResult, setRewriteResult] = useState<AdminQuestionRewritePreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [applyingRevisionId, setApplyingRevisionId] = useState<number | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rewriteableItems = useMemo(
    () => result?.items.filter((item) => item.quality_status === "failed" || item.quality_status === "borderline") ?? [],
    [result],
  );
  const deleteRecommendedItems = useMemo(
    () => result?.items.filter((item) => item.quality_status === "delete_recommended") ?? [],
    [result],
  );
  const allRewriteableSelected =
    rewriteableItems.length > 0 && rewriteableItems.every((item) => selectedRewriteIds.includes(item.question_id));
  const rewriteJobPending = rewriteJob?.status === "queued" || rewriteJob?.status === "running";

  useEffect(() => {
    if (!token || !runId) {
      return;
    }

    void loadRun();
    // Route param değiştiğinde analiz detayını tekrar alır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, runId]);

  useEffect(() => {
    if (!token || !rewriteJob || !["queued", "running"].includes(rewriteJob.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshRewriteJob(rewriteJob.id);
    }, 3000);

    void refreshRewriteJob(rewriteJob.id);

    return () => window.clearInterval(intervalId);
    // Poll sadece aktif güçlendirme işi için çalışmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewriteJob?.id, rewriteJob?.status, token]);

  async function loadRun() {
    if (!token || !runId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await adminApiRequest<AdminQuestionQualityRunResult>(`/admin/question-quality/analyze/${runId}`, { token });
      setResult(response.data);
      setSelectedRewriteIds([...response.data.bad_question_ids, ...response.data.borderline_question_ids]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Analiz sonucu yüklenemedi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function approveQuestion(questionId: number) {
    if (!token || !result) {
      return;
    }

    setSavingQuestionId(questionId);
    setError(null);

    try {
      const response = await adminApiRequest<AdminQuestionQualityRunResult>(
        `/admin/question-quality/runs/${result.run.id}/questions/${questionId}/approve`,
        {
          method: "POST",
          token,
        },
      );
      setResult(response.data);
      showToast({
        title: "Soru onaylandı",
        description: `#${questionId} artık soru onay havuzunda approved görünecek.`,
        tone: "success",
      });
    } catch (approveError) {
      const message = approveError instanceof Error ? approveError.message : "Soru onaylanamadı.";
      setError(message);
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function deleteQuestion(questionId: number) {
    if (!token || !result) {
      return;
    }

    const confirmed = window.confirm(`#${questionId} numaralı soru kalıcı olarak silinsin mi?`);

    if (!confirmed) {
      return;
    }

    setSavingQuestionId(questionId);
    setError(null);

    try {
      const response = await adminApiRequest<AdminQuestionQualityRunResult>(
        `/admin/question-quality/runs/${result.run.id}/questions/${questionId}`,
        {
          method: "DELETE",
          token,
        },
      );
      setResult(response.data);
      setSelectedRewriteIds((current) => current.filter((id) => id !== questionId));
      showToast({
        title: "Soru silindi",
        description: `#${questionId} analiz sonucundan ve soru havuzundan kaldırıldı.`,
        tone: "success",
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Soru silinemedi.";
      setError(message);
    } finally {
      setSavingQuestionId(null);
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
        description: `${response.data.question_ids.length} soru için AI edit işi başlatıldı.`,
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

  async function applyRevision(questionId: number) {
    if (!token || !rewriteJob) {
      return;
    }

    setApplyingRevisionId(questionId);
    setError(null);

    try {
      await adminApiRequest<{ question: AdminQuestionQualityCandidate }>(
        `/admin/question-quality/rewrite-preview/${rewriteJob.id}/questions/${questionId}/apply`,
        {
          method: "POST",
          token,
        },
      );
      showToast({
        title: "Öneri uygulandı",
        description: `#${questionId} güçlendirildi. İstersen tekrar kalite analizine gönderebilirsin.`,
        tone: "success",
      });
      void loadRun();
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Güçlendirme önerisi uygulanamadı.";
      setError(message);
    } finally {
      setApplyingRevisionId(null);
    }
  }

  function toggleRewriteId(questionId: number) {
    setSelectedRewriteIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  }

  if (loading) {
    return (
      <AdminTableCard>
        <SectionHeader
          icon={<RefreshCcw className="animate-spin" size={18} />}
          title="Analiz sonucu yükleniyor"
          description="Run detayını getiriyorum."
        />
      </AdminTableCard>
    );
  }

  if (!result) {
    return (
      <div className="space-y-4">
        <Link className="admin-button admin-button-secondary inline-flex" href="/sorular/kalite">
          <ArrowLeft size={16} />
          Analizlere Dön
        </Link>
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error ?? "Analiz sonucu bulunamadı."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link className="admin-button admin-button-secondary inline-flex" href="/sorular/kalite">
          <ArrowLeft size={16} />
          Analizlere Dön
        </Link>
        <button className="admin-button admin-button-secondary" onClick={() => void loadRun()} type="button">
          <RefreshCcw size={16} />
          Yenile
        </button>
      </div>

      {error ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <AdminTableCard>
        <SectionHeader
          icon={<ShieldCheck size={18} />}
          title={`Analiz sonucu #${result.run.id}`}
          description={`${result.run.topic?.subject?.name ?? "Ders yok"} · ${result.run.topic?.name ?? "Konu yok"} · ${result.run.model}`}
        />
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
                <p className="text-sm font-black text-red-800">{deleteRecommendedItems.length} soru silme adayı.</p>
                <p className="mt-1 text-sm leading-6 text-red-700">
                  Bunları güçlendirme kuyruğuna almıyorum; tek tek inceleyip silebilir veya yine de manuel düzenleyebilirsin.
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
              Güçlendirilebilir {rewriteableItems.length} sorunun tamamını seç
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
            <QualityRunItemAccordion
              checked={selectedRewriteIds.includes(item.question_id)}
              disabled={savingQuestionId === item.question_id}
              item={item}
              key={item.question_id}
              onApprove={() => void approveQuestion(item.question_id)}
              onDelete={() => void deleteQuestion(item.question_id)}
              onToggle={
                item.quality_status === "failed" || item.quality_status === "borderline"
                  ? () => toggleRewriteId(item.question_id)
                  : undefined
              }
            />
          ))}
        </div>
      </AdminTableCard>

      {rewriteJob && rewriteJobPending ? (
        <AdminTableCard>
          <SectionHeader
            icon={<RefreshCcw className="animate-spin" size={18} />}
            title="Güçlendirme işi kuyrukta"
            description={`Job #${rewriteJob.id} ${rewriteJob.status === "queued" ? "kuyrukta bekliyor" : "çalışıyor"}.`}
          />
          <div className="px-5 py-4 text-sm font-semibold text-[var(--color-admin-muted)]">
            {rewriteJob.question_ids.length} soru arka planda güçlendiriliyor.
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
              <RewriteRevisionAccordion
                applying={applyingRevisionId === revision.id}
                key={revision.id}
                onApply={() => void applyRevision(revision.id)}
                revision={revision}
              />
            ))}
          </div>
        </AdminTableCard>
      ) : null}
    </div>
  );
}

function QualityRunItemAccordion({
  checked,
  disabled,
  item,
  onApprove,
  onDelete,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  item: AdminQuestionQualityRunItem;
  onApprove: () => void;
  onDelete: () => void;
  onToggle?: () => void;
}) {
  const [open, setOpen] = useState(item.quality_status !== "passed");
  const question = item.question;
  const approved = question?.approval_status === "approved";

  return (
    <div className="px-5 py-4">
      <div className="grid gap-3 xl:grid-cols-[32px_88px_150px_minmax(0,1fr)_auto_36px] xl:items-start">
        <div className="pt-1">
          {onToggle ? (
            <input
              checked={checked}
              className="h-4 w-4 accent-[var(--color-admin-accent)]"
              disabled={disabled}
              onChange={onToggle}
              type="checkbox"
            />
          ) : null}
        </div>
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">#{item.question_id}</div>
        <QualityPill status={item.quality_status} score={item.quality_score} />
        <button className="min-w-0 text-left" onClick={() => setOpen((current) => !current)} type="button">
          <p className="text-sm font-bold leading-6 text-[var(--color-admin-ink)]">
            {question?.question_text ?? "Soru silinmiş veya bulunamadı."}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {item.quality_note} · Blind solver: {item.predicted_label ?? "-"} / güven {item.solver_confidence ?? 0}
          </p>
          {item.quality_flags.length > 0 ? <FlagList flags={item.quality_flags} /> : null}
        </button>
        <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
          <button
            className={`admin-button ${approved ? "admin-button-secondary" : "admin-button-primary"} px-3 py-2 text-xs`}
            disabled={disabled || !question || approved}
            onClick={onApprove}
            type="button"
          >
            <CheckCircle2 size={15} />
            {approved ? "Onaylı" : "Onayla"}
          </button>
          <button
            className="admin-button border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            disabled={disabled || !question}
            onClick={onDelete}
            type="button"
          >
            <Trash2 size={15} />
            Sil
          </button>
        </div>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-white text-[var(--color-admin-muted)]"
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
            <span className="font-black text-[var(--color-admin-ink)]">Doğru cevap: </span>
            {question.correct_answer_text}
          </div>
          <div className="mt-3 rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-admin-muted)]">
            <span className="font-black text-[var(--color-admin-ink)]">Açıklama: </span>
            {question.explanation_text}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RewriteRevisionAccordion({
  applying,
  onApply,
  revision,
}: {
  applying: boolean;
  onApply: () => void;
  revision: AdminQuestionRewriteRevision;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="px-5 py-4">
      <div className="flex w-full items-start justify-between gap-4">
        <button className="min-w-0 text-left" onClick={() => setOpen((current) => !current)} type="button">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">#{revision.id}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-[var(--color-admin-ink)]">{revision.question_text}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{revision.revision_note}</p>
          <FlagList flags={revision.quality_flags} />
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button className="admin-button admin-button-primary px-3 py-2 text-xs" disabled={applying} onClick={onApply} type="button">
            {applying ? <RefreshCcw className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
            Öneriyi Uygula
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-white text-[var(--color-admin-muted)]"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            <ChevronDown className={`transition ${open ? "rotate-180" : ""}`} size={18} />
          </button>
        </div>
      </div>

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
