"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileDown, Loader2, Pencil, RefreshCcw, Save, Trash2, X } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminQuestion } from "@/lib/types";
import type { AgentJobDetailResponse, AgentJobStatus } from "@/components/admin/questions/AgentQuestionGenerationTypes";
import {
  cancelableStatuses,
  formatDateTime,
  formatMoney,
  formatTokenCount,
  modelNameFromProfile,
  runningStatuses,
  statusLabel,
  statusTone,
} from "@/components/admin/questions/AgentQuestionGenerationTypes";

type EditableQuestionDraft = {
  question_text: string;
  options: Array<{
    label: string;
    option_text: string;
    is_correct: boolean;
  }>;
  explanation_text: string;
  explanation_basis: string;
  explanation_relevant_provision: string;
  explanation_answer_link: string;
};

export function AgentQuestionGenerationDetailPage({ jobId }: { jobId: string }) {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { setTitle } = useAdminPageMeta();
  const [detail, setDetail] = useState<AgentJobDetailResponse | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentJobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditableQuestionDraft | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<number | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle("Agent Üretim Detayı");

    return () => setTitle(null);
  }, [setTitle]);

  const loadAgentStatus = useCallback(
    async () => {
      if (!token || !jobId) {
        return;
      }

      try {
        const response = await adminApiRequest<AgentJobStatus>(`/admin/agent/question-generation/${jobId}`, { token });
        setAgentStatus(response.data);
      } catch {
        // Detay local kayıtla kullanılabilsin; agent status geçici okunamazsa maliyet boş kalır.
      }
    },
    [jobId, token],
  );

  const loadDetail = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!token || !jobId) {
        return;
      }

      if (!options.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await adminApiRequest<AgentJobDetailResponse>(
          `/admin/agent/question-generation-jobs/${jobId}`,
          { token },
        );
        setDetail(response.data);
        void loadAgentStatus();
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Agent job detayı okunamadı.";
        setError(message);
        showToast({
          title: "Job detayı alınamadı",
          description: message,
          tone: "error",
        });
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [jobId, loadAgentStatus, showToast, token],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail?.job.status || !runningStatuses.has(detail.job.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadDetail({ silent: true });
      void loadAgentStatus();
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [detail?.job.status, loadAgentStatus, loadDetail]);

  function startEditing(question: AdminQuestion) {
    if (question.approval_status) {
      return;
    }

    setEditingQuestionId(question.id);
    setDraft(createQuestionDraft(question));
  }

  function stopEditing() {
    setEditingQuestionId(null);
    setDraft(null);
  }

  function setCorrectOption(label: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            options: current.options.map((option) => ({
              ...option,
              is_correct: option.label === label,
            })),
          }
        : current,
    );
  }

  async function saveQuestion(question: AdminQuestion) {
    if (!token || !draft) {
      return;
    }

    const validationMessage = validateDraft(draft);
    if (validationMessage) {
      showToast({ title: "Soru kaydedilemedi", description: validationMessage, tone: "error" });
      return;
    }

    setSavingQuestionId(question.id);
    try {
      const response = await adminApiRequest<{ question: AdminQuestion }>(`/admin/questions/${question.id}`, {
        token,
        method: "PUT",
        body: buildQuestionUpdatePayload(question, draft),
      });
      patchQuestion(response.data.question);
      stopEditing();
      showToast({ title: "Soru güncellendi", description: `#${question.id} düzenlendi.`, tone: "success" });
    } catch (saveError) {
      showToast({
        title: "Soru güncellenemedi",
        description: saveError instanceof Error ? saveError.message : "Soru kaydedilemedi.",
        tone: "error",
      });
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function approveQuestion(question: AdminQuestion) {
    if (!token || question.approval_status) {
      return;
    }

    setSavingQuestionId(question.id);
    try {
      const response = await adminApiRequest<{ question: AdminQuestion }>(`/admin/questions/${question.id}/approval`, {
        token,
        method: "POST",
        body: {
          approval_status: "approved",
          review_flags: [],
          review_note: null,
        },
      });
      patchQuestion(response.data.question);
      showToast({ title: "Soru onaylandı", description: `#${question.id} onaylandı.`, tone: "success" });
    } catch (approveError) {
      showToast({
        title: "Soru onaylanamadı",
        description: approveError instanceof Error ? approveError.message : "Soru onaylanamadı.",
        tone: "error",
      });
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function deleteQuestion(question: AdminQuestion) {
    if (!token || question.approval_status) {
      return;
    }

    const confirmed = window.confirm(`#${question.id} sorusu silinsin mi?`);
    if (!confirmed) {
      return;
    }

    setSavingQuestionId(question.id);
    try {
      await adminApiRequest(`/admin/questions/${question.id}`, { token, method: "DELETE" });
      setDetail((current) =>
        current
          ? {
              ...current,
              questions: current.questions.filter((item) => item.id !== question.id),
              job: {
                ...current.job,
                generated_question_count: Math.max((current.job.generated_question_count ?? 0) - 1, 0),
                question_ids: (current.job.question_ids ?? []).filter((id) => id !== question.id),
              },
            }
          : current,
      );
      stopEditing();
      showToast({ title: "Soru silindi", description: `#${question.id} kaldırıldı.`, tone: "warning" });
    } catch (deleteError) {
      showToast({
        title: "Soru silinemedi",
        description: deleteError instanceof Error ? deleteError.message : "Soru silinemedi.",
        tone: "error",
      });
    } finally {
      setSavingQuestionId(null);
    }
  }

  function patchQuestion(question: AdminQuestion) {
    setDetail((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((item) => (item.id === question.id ? question : item)),
          }
        : current,
    );
  }

  function exportQuestions() {
    if (!job || questions.length === 0) {
      showToast({
        title: "Export alınamadı",
        description: "Bu üretim işinde export edilecek soru yok.",
        tone: "error",
      });
      return;
    }

    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";

    const cleanup = () => {
      window.setTimeout(() => {
        printFrame.remove();
      }, 1000);
    };

    document.body.appendChild(printFrame);
    const frameDocument = printFrame.contentDocument;
    const frameWindow = printFrame.contentWindow;
    if (!frameDocument || !frameWindow) {
      cleanup();
      showToast({
        title: "Export başlatılamadı",
        description: "Tarayıcı export içeriğini hazırlayamadı.",
        tone: "error",
      });
      return;
    }

    frameDocument.open();
    frameDocument.write(buildExportHtml(job, questions));
    frameDocument.close();

    frameWindow.onafterprint = cleanup;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        frameWindow.focus();
        frameWindow.print();
        cleanup();
      });
    });
  }

  async function cancelJob() {
    if (!token || !job) {
      return;
    }

    const confirmed = window.confirm("Bu agent üretim işi iptal edilsin mi?");
    if (!confirmed) {
      return;
    }

    setCanceling(true);
    try {
      const response = await adminApiRequest<Pick<AgentJobDetailResponse, "job">>(
        `/admin/agent/question-generation/${job.job_id}/cancel`,
        {
          token,
          method: "POST",
        },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              job: response.data.job,
            }
          : current,
      );
      showToast({
        title: "Job iptal edildi",
        description: "Kuyrukta bekliyorsa başlamayacak; çalışıyorsa sıradaki kontrol noktasında duracak.",
        tone: "warning",
      });
    } catch (cancelError) {
      showToast({
        title: "Job iptal edilemedi",
        description: cancelError instanceof Error ? cancelError.message : "İptal isteği gönderilemedi.",
        tone: "error",
      });
    } finally {
      setCanceling(false);
    }
  }

  const job = detail?.job ?? null;
  const questions = detail?.questions ?? [];
  const aiStats = agentStatus?.ai_stats ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="admin-button admin-button-secondary" href="/sorular/agent-uret">
          <ArrowLeft size={16} />
          Üretim ekranına dön
        </Link>
        <button className="admin-button admin-button-secondary" disabled={loading} onClick={() => void loadDetail()} type="button">
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
          Yenile
        </button>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {loading && !detail ? (
        <div className="admin-card px-6 py-10 text-sm font-bold text-[var(--color-admin-muted)]">
          Job detayı yükleniyor...
        </div>
      ) : job ? (
        <>
          <section className="admin-card overflow-hidden">
            <div className="border-b border-[var(--color-admin-line)] bg-[linear-gradient(135deg,rgba(37,99,235,0.10),rgba(15,159,110,0.07))] px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {job.subject_code ? (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-700">
                        {job.subject_code}
                      </span>
                    ) : null}
                    <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${statusTone(job.status)}`}>
                      {statusLabel(job.status)}
                    </span>
                  </div>
                  <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
                    {job.subject_name ?? job.source_law_name ?? "Agent üretim detayı"}
                  </h1>
                  <p className="mt-2 break-all text-xs font-semibold text-[var(--color-admin-muted)]">
                    {job.job_id}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/75 px-4 py-3 text-right shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">Oluşturma</p>
                  <p className="mt-1 text-sm font-extrabold text-[var(--color-admin-ink)]">{formatDateTime(job.created_at)}</p>
                  {cancelableStatuses.has(job.status) ? (
                    <button
                      className="admin-button admin-button-danger mt-3 h-9 px-3 py-2 text-xs"
                      disabled={canceling}
                      onClick={() => void cancelJob()}
                      type="button"
                    >
                      {canceling ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
                      İptal et
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-4 xl:grid-cols-8">
              <JobMetric label="Konu" value={job.requested_topic_count} />
              <JobMetric label="İstenen" value={job.requested_question_count} />
              <JobMetric label="Üretilen" value={job.generated_question_count} />
              <JobMetric label="Duplicate" value={job.duplicate_question_count} />
              <JobInfoMetric className="md:col-span-2" label="Model" value={modelNameFromProfile(job.model_profile)} />
              <JobInfoMetric label="Maliyet" value={typeof aiStats?.estimated_cost_usd === "number" ? formatMoney(aiStats.estimated_cost_usd) : "hesaplanıyor"} />
              <JobInfoMetric label="Token" value={`${formatTokenCount(aiStats?.total_input_tokens)} / ${formatTokenCount(aiStats?.total_output_tokens)}`} />
            </div>

            {job.error_message ? (
              <div className="mx-5 mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {job.error_message}
              </div>
            ) : null}
          </section>

          <section className="admin-card overflow-hidden">
            <div className="border-b border-[var(--color-admin-line)] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Üretilen sorular</h2>
                  <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                    Onay verilmemiş soruları burada düzenleyebilir, onaylayabilir veya silebilirsin. Onaylandıktan sonra bu detay ekranında kilitlenir.
                  </p>
                </div>
                <button
                  className="admin-button admin-button-secondary"
                  disabled={questions.length === 0}
                  onClick={exportQuestions}
                  type="button"
                >
                  <FileDown size={16} />
                  PDF / Yazdır
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {loading ? (
                <div className="rounded-2xl bg-[var(--color-admin-panel-soft)] px-4 py-5 text-sm font-bold text-[var(--color-admin-muted)]">
                  Detay yenileniyor...
                </div>
              ) : null}

              {questions.length === 0 ? (
                <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-6 text-sm font-bold text-amber-800">
                  Bu job henüz soru döndürmedi. Job tamamlandıysa kalite kapıları tüm adayları elemiş olabilir.
                </div>
              ) : (
                questions.map((question, index) => {
                  const locked = Boolean(question.approval_status);
                  const editing = editingQuestionId === question.id && draft;
                  const busy = savingQuestionId === question.id;

                  return (
                    <article className="rounded-[24px] border border-[var(--color-admin-line)] bg-white p-4 shadow-sm" key={question.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-700">
                              #{question.id}
                            </span>
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-extrabold text-blue-700">
                              {index + 1}. soru
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                              locked ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {approvalLabel(question)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-[var(--color-admin-muted)]">
                            {question.topic?.name ?? "Konu yok"} · {question.difficulty}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editing ? (
                            <>
                              <button
                                className="admin-button admin-button-secondary px-3 py-2 text-xs"
                                disabled={busy}
                                onClick={stopEditing}
                                type="button"
                              >
                                <X size={14} />
                                Vazgeç
                              </button>
                              <button
                                className="admin-button admin-button-primary px-3 py-2 text-xs"
                                disabled={busy}
                                onClick={() => void saveQuestion(question)}
                                type="button"
                              >
                                {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                Kaydet
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="admin-button admin-button-secondary px-3 py-2 text-xs"
                                disabled={locked || busy}
                                onClick={() => startEditing(question)}
                                type="button"
                              >
                                <Pencil size={14} />
                                Düzenle
                              </button>
                              <button
                                className="admin-button admin-button-primary px-3 py-2 text-xs"
                                disabled={locked || busy}
                                onClick={() => void approveQuestion(question)}
                                type="button"
                              >
                                {busy ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                Onayla
                              </button>
                              <button
                                className="admin-button admin-button-danger px-3 py-2 text-xs"
                                disabled={locked || busy}
                                onClick={() => void deleteQuestion(question)}
                                type="button"
                              >
                                <Trash2 size={14} />
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {editing && draft ? (
                        <EditableQuestionCard
                          draft={draft}
                          disabled={busy}
                          onChange={setDraft}
                          onCorrectChange={setCorrectOption}
                        />
                      ) : (
                        <ReadonlyQuestionCard question={question} />
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function JobMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[var(--color-admin-panel-soft)] px-4 py-4">
      <p className="text-xl font-extrabold text-[var(--color-admin-ink)]">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">{label}</p>
    </div>
  );
}

function JobInfoMetric({ className = "", label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`min-w-0 rounded-2xl bg-[var(--color-admin-panel-soft)] px-4 py-4 ${className}`}>
      <p className="truncate text-sm font-extrabold text-[var(--color-admin-ink)]" title={value}>{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">{label}</p>
    </div>
  );
}

function approvalLabel(question: AdminQuestion) {
  if (question.approval_status === "approved") {
    return "Onaylandı";
  }

  if (question.approval_status === "rejected") {
    return "Geri gönderildi";
  }

  return "Onay bekliyor";
}

function ReadonlyQuestionCard({ question }: { question: AdminQuestion }) {
  const options = sortedOptions(question);

  return (
    <div className="mt-5 space-y-4">
      <QuestionText text={question.question_text ?? ""} />

      <div className="grid gap-2">
        {options.map((option) => (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              option.is_correct
                ? "border-emerald-200 bg-emerald-50"
                : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]"
            }`}
            key={option.label}
          >
            <span
              className={`flex h-8 min-w-8 items-center justify-center rounded-full text-xs font-black ${
                option.is_correct ? "bg-emerald-600 text-white" : "bg-white text-[var(--color-admin-muted)]"
              }`}
            >
              {option.label}
            </span>
            <p className="text-sm font-bold leading-7 text-[var(--color-admin-ink)]">{option.option_text}</p>
          </div>
        ))}
      </div>

      <ExplanationPanel question={question} />
    </div>
  );
}

function QuestionText({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-admin-line)] bg-white px-4 py-4">
      <p className="whitespace-pre-line text-lg font-extrabold leading-8 tracking-[-0.03em] text-[var(--color-admin-ink)]">
        {text}
      </p>
    </div>
  );
}

function ExplanationPanel({ question }: { question: AdminQuestion }) {
  const rows = [
    ["Dayanak", question.explanation_basis ?? question.explanation?.basis ?? null],
    ["İlgili Hüküm", question.explanation_relevant_provision ?? question.explanation?.relevant_provision ?? null],
    ["Cevap Bağlantısı", question.explanation_answer_link ?? question.explanation?.answer_link ?? null],
  ].filter(([, value]) => typeof value === "string" && value.trim().length > 0);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Açıklama</p>
      {rows.length > 0 ? (
        <div className="mt-3 space-y-2">
          {rows.map(([label, value]) => (
            <div className="text-sm leading-6 text-emerald-950" key={label}>
              <span className="font-black text-emerald-800">{label}: </span>
              <span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-emerald-950">
          {question.explanation_text || "Açıklama girilmemiş."}
        </p>
      )}
    </div>
  );
}

function EditableQuestionCard({
  disabled,
  draft,
  onChange,
  onCorrectChange,
}: {
  disabled: boolean;
  draft: EditableQuestionDraft;
  onChange: (draft: EditableQuestionDraft) => void;
  onCorrectChange: (label: string) => void;
}) {
  return (
    <div className="mt-5 space-y-4 rounded-[22px] border border-blue-200 bg-blue-50/45 p-4">
      <label className="block">
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">Soru kökü</span>
        <textarea
          className="admin-input mt-1 min-h-32 resize-y bg-white text-sm font-semibold leading-6"
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, question_text: event.target.value })}
          value={draft.question_text}
        />
      </label>

      <div className="grid gap-2">
        {draft.options.map((option, index) => (
          <div className="grid gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-white p-3 md:grid-cols-[80px_minmax(0,1fr)]" key={option.label}>
            <button
              className={`rounded-xl px-3 py-2 text-xs font-black ${
                option.is_correct
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-[var(--color-admin-muted)] hover:bg-emerald-50 hover:text-emerald-700"
              }`}
              disabled={disabled}
              onClick={() => onCorrectChange(option.label)}
              type="button"
            >
              {option.label} {option.is_correct ? "Doğru" : ""}
            </button>
            <input
              className="admin-input h-10 bg-white text-sm"
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...draft,
                  options: draft.options.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, option_text: event.target.value } : item,
                  ),
                })
              }
              value={option.option_text}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <EditableExplanationField
          disabled={disabled}
          label="Dayanak"
          onChange={(value) => onChange({ ...draft, explanation_basis: value })}
          value={draft.explanation_basis}
        />
        <EditableExplanationField
          disabled={disabled}
          label="İlgili Hüküm"
          onChange={(value) => onChange({ ...draft, explanation_relevant_provision: value })}
          value={draft.explanation_relevant_provision}
        />
        <EditableExplanationField
          disabled={disabled}
          label="Cevap Bağlantısı"
          onChange={(value) => onChange({ ...draft, explanation_answer_link: value })}
          value={draft.explanation_answer_link}
        />
      </div>

      <label className="block">
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
          Düz açıklama fallback
        </span>
        <textarea
          className="admin-input mt-1 min-h-20 resize-y bg-white text-sm font-semibold leading-6"
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, explanation_text: event.target.value })}
          value={draft.explanation_text}
        />
      </label>
    </div>
  );
}

function EditableExplanationField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">{label}</span>
      <textarea
        className="admin-input mt-1 min-h-24 resize-y bg-white text-sm font-semibold leading-6"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function createQuestionDraft(question: AdminQuestion): EditableQuestionDraft {
  return {
    question_text: question.question_text ?? "",
    options: normalizeDraftOptions(question),
    explanation_text: question.explanation_text ?? "",
    explanation_basis: question.explanation_basis ?? question.explanation?.basis ?? "",
    explanation_relevant_provision:
      question.explanation_relevant_provision ?? question.explanation?.relevant_provision ?? "",
    explanation_answer_link: question.explanation_answer_link ?? question.explanation?.answer_link ?? "",
  };
}

function normalizeDraftOptions(question: AdminQuestion): EditableQuestionDraft["options"] {
  const sourceOptions = question.options?.length
    ? sortedOptions(question)
    : ["A", "B", "C", "D", "E"].map((label) => ({
        label,
        option_text: "",
        is_correct: question.correct_answer_text === label,
      }));

  return sourceOptions.map((option) => ({
    label: option.label,
    option_text: option.option_text,
    is_correct: option.is_correct,
  }));
}

function sortedOptions(question: AdminQuestion) {
  return [...(question.options ?? [])].sort(
    (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.label.localeCompare(right.label, "tr"),
  );
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
    is_free: question.is_free ?? false,
    free_preview_order: question.free_preview_order ?? null,
    is_past_exam_question: question.is_past_exam_question ?? false,
    question_text: draft.question_text.trim(),
    correct_answer_text: correctOption?.option_text.trim() || question.correct_answer_text || "",
    explanation_text: explanationText,
    explanation_basis: draft.explanation_basis.trim() || null,
    explanation_relevant_provision: draft.explanation_relevant_provision.trim() || null,
    explanation_answer_link: draft.explanation_answer_link.trim() || null,
    review_flags: sanitizeReviewFlags(question.review_flags),
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

function sanitizeReviewFlags(flags: AdminQuestion["review_flags"]) {
  const allowedFlags = new Set(["obvious_answer", "bad_question_form", "low_quality", "needs_rewrite", "wrong_answer"]);

  return (Array.isArray(flags) ? flags : []).filter((flag) => typeof flag === "string" && allowedFlags.has(flag));
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

function validateDraft(draft: EditableQuestionDraft) {
  if (!draft.question_text.trim()) {
    return "Soru kökü boş olamaz.";
  }

  if (draft.options.length !== 5) {
    return "Çoktan seçmeli soruda 5 şık olmalı.";
  }

  if (draft.options.some((option) => !option.option_text.trim())) {
    return "Şık metinleri boş olamaz.";
  }

  if (draft.options.filter((option) => option.is_correct).length !== 1) {
    return "Tek bir doğru cevap seçmelisin.";
  }

  if (!buildExplanationText(draft)) {
    return "Açıklama için en az bir alan doldurulmalı.";
  }

  return null;
}

function buildExportHtml(job: AgentJobDetailResponse["job"], questions: AdminQuestion[]) {
  const title = `${job.subject_name ?? job.source_law_name ?? "Agent Soru Üretimi"} - ${job.job_id}`;
  const questionItems = questions
    .map((question, index) => {
      const options = sortedOptions(question)
        .map(
          (option) => `
            <li class="${option.is_correct ? "correct" : ""}">
              <span class="label">${escapeHtml(option.label)}</span>
              <span>${escapeHtml(option.option_text)}</span>
            </li>
          `,
        )
        .join("");
      const explanation = exportExplanation(question);

      return `
        <article class="question">
          <div class="meta">
            <span>${index + 1}. Soru</span>
            <span>#${question.id}</span>
            <span>${escapeHtml(question.topic?.name ?? "Konu yok")}</span>
            <span>${escapeHtml(question.difficulty ?? "-")}</span>
          </div>
          <h2>${escapeHtml(question.question_text ?? "")}</h2>
          <ol class="options">${options}</ol>
          <section class="explanation">
            <strong>Açıklama</strong>
            ${explanation}
          </section>
        </article>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f7fb;
      color: #172033;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 24px;
      border-bottom: 1px solid #dbe3ef;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(8px);
    }
    .toolbar button {
      border: 0;
      border-radius: 8px;
      background: #2563eb;
      color: #fff;
      cursor: pointer;
      font-weight: 800;
      padding: 10px 14px;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 28px 24px 48px;
    }
    header {
      margin-bottom: 18px;
      padding: 22px;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: #fff;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: 0;
    }
    .job-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      color: #526071;
      font-size: 12px;
      font-weight: 700;
    }
    .question {
      break-inside: avoid;
      margin-top: 16px;
      padding: 22px;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: #fff;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: #526071;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    h2 {
      margin: 14px 0 16px;
      font-size: 18px;
      letter-spacing: 0;
      line-height: 1.5;
    }
    .options {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .options li {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 10px;
      align-items: start;
      padding: 10px 12px;
      border: 1px solid #e3e8f0;
      border-radius: 8px;
      background: #f8fafc;
      font-size: 14px;
      font-weight: 650;
    }
    .options li.correct {
      border-color: #86efac;
      background: #ecfdf3;
    }
    .label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: #fff;
      color: #526071;
      font-weight: 900;
    }
    .correct .label {
      background: #059669;
      color: #fff;
    }
    .explanation {
      margin-top: 14px;
      padding: 12px;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      background: #f0fdf4;
      color: #064e3b;
      font-size: 13px;
    }
    .explanation p {
      margin: 6px 0 0;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      main { max-width: none; padding: 0; }
      header, .question { border-color: #cbd5e1; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>${escapeHtml(title)}</strong>
    <button onclick="window.print()">PDF / Yazdır</button>
  </div>
  <main>
    <header>
      <h1>${escapeHtml(job.subject_name ?? job.source_law_name ?? "Agent Soru Üretimi")}</h1>
      <div class="job-meta">
        <span>Job: ${escapeHtml(job.job_id)}</span>
        <span>Durum: ${escapeHtml(statusLabel(job.status))}</span>
        <span>Soru: ${questions.length}</span>
        <span>Oluşturma: ${escapeHtml(formatDateTime(job.created_at))}</span>
      </div>
    </header>
    ${questionItems}
  </main>
</body>
</html>`;
}

function exportExplanation(question: AdminQuestion) {
  const rows = [
    ["Dayanak", question.explanation_basis ?? question.explanation?.basis ?? null],
    ["İlgili Hüküm", question.explanation_relevant_provision ?? question.explanation?.relevant_provision ?? null],
    ["Cevap Bağlantısı", question.explanation_answer_link ?? question.explanation?.answer_link ?? null],
  ].filter(([, value]) => typeof value === "string" && value.trim().length > 0);

  if (rows.length > 0) {
    return rows
      .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value ?? "")}</p>`)
      .join("");
  }

  return `<p>${escapeHtml(question.explanation_text || "Açıklama girilmemiş.")}</p>`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
