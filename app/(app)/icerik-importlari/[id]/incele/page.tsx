"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Eye, EyeOff, FileWarning, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminContentImport, AdminContentImportTopic, AdminExam, AdminSubject } from "@/lib/types";

type ImportDetailResponse = {
  import: AdminContentImport;
  subjects: AdminSubject[];
  exams: AdminExam[];
};

export default function ContentImportReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const importId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importItem, setImportItem] = useState<AdminContentImport | null>(null);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [candidateSubjectName, setCandidateSubjectName] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [targetExamId, setTargetExamId] = useState("");
  const [topics, setTopics] = useState<AdminContentImportTopic[]>([]);
  const [topicQuery, setTopicQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<"all" | "accepted" | "excluded">("all");
  const [showSourcePreview, setShowSourcePreview] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!token || !importId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<ImportDetailResponse>(`/admin/content-imports/${importId}`, {
          token,
        });

        if (cancelled) {
          return;
        }

        setImportItem(response.data.import);
        setSubjects(response.data.subjects);
        setExams(response.data.exams);
        setCandidateSubjectName(response.data.import.candidate_subject_name ?? "");
        setSelectedSubjectId(response.data.import.selected_subject?.id ? String(response.data.import.selected_subject.id) : "");
        setTargetExamId(response.data.import.target_exam?.id ? String(response.data.import.target_exam.id) : "");
        setTopics(response.data.import.topics ?? []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Import yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [importId, token]);

  const acceptedCount = useMemo(
    () => topics.filter((topic) => topic.review_status === "accepted").length,
    [topics],
  );
  const filteredTopics = useMemo(() => {
    const normalized = topicQuery.trim().toLocaleLowerCase("tr");

    return topics.filter((topic) => {
      if (topicFilter !== "all" && topic.review_status !== topicFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [
        topic.edited_name ?? topic.proposed_name,
        topic.edited_content_body ?? topic.proposed_content_body,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [topicFilter, topicQuery, topics]);

  function updateTopic(topicId: number, patch: Partial<AdminContentImportTopic>) {
    setTopics((current) =>
      current.map((topic) => (topic.id === topicId ? { ...topic, ...patch } : topic)),
    );
  }

  async function saveDraft(event?: FormEvent, options?: { silent?: boolean }) {
    event?.preventDefault();

    if (!token || !importItem) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await adminApiRequest<{ import: AdminContentImport }>(`/admin/content-imports/${importItem.id}`, {
        token,
        method: "PUT",
        body: {
          candidate_subject_name: candidateSubjectName,
          selected_subject_id: selectedSubjectId ? Number(selectedSubjectId) : null,
          target_exam_id: targetExamId ? Number(targetExamId) : null,
          review_status: "review",
        },
      });

      await Promise.all(
        topics.map((topic) =>
          adminApiRequest(`/admin/content-imports/${importItem.id}/topics/${topic.id}`, {
            token,
            method: "PUT",
            body: {
              edited_name: topic.edited_name ?? null,
              edited_content_body: topic.edited_content_body ?? null,
              edited_sort_order: topic.edited_sort_order ?? null,
              review_status: topic.review_status,
            },
          }),
        ),
      );

      const refreshed = await adminApiRequest<ImportDetailResponse>(`/admin/content-imports/${importItem.id}`, {
        token,
      });

      setImportItem(refreshed.data.import);
      setTopics(refreshed.data.import.topics ?? []);
      setSelectedSubjectId(refreshed.data.import.selected_subject?.id ? String(refreshed.data.import.selected_subject.id) : "");
      setTargetExamId(refreshed.data.import.target_exam?.id ? String(refreshed.data.import.target_exam.id) : "");
      setCandidateSubjectName(refreshed.data.import.candidate_subject_name ?? "");

      if (!options?.silent) {
        showToast({
          tone: "success",
          title: "Review taslağı kaydedildi",
          description: refreshed.data.import.source_title ?? "İçerik importu",
        });
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Review kaydedilemedi.";
      setError(message);
      if (!options?.silent) {
        showToast({
          tone: "error",
          title: "Review kaydedilemedi",
          description: message,
        });
      }
      throw saveError;
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!token || !importItem) {
      return;
    }

    setApproving(true);

    try {
      await saveDraft(undefined, { silent: true });

      const response = await adminApiRequest<{ import: AdminContentImport }>(`/admin/content-imports/${importItem.id}/approve`, {
        token,
        method: "POST",
      });

      setImportItem(response.data.import);
      setTopics(response.data.import.topics ?? []);

      showToast({
        tone: "success",
        title: "Import kataloga yazıldı",
        description: response.data.import.final_subject?.name ?? response.data.import.source_title ?? "İçerik importu",
      });
    } catch (approveError) {
      const message = approveError instanceof Error ? approveError.message : "Import onaylanamadı.";
      setError(message);
      showToast({
        tone: "error",
        title: "Import onaylanamadı",
        description: message,
      });
    } finally {
      setApproving(false);
    }
  }

  async function handleDelete() {
    if (!token || !importItem) {
      return;
    }

    setDeleting(true);

    try {
      await adminApiRequest(`/admin/content-imports/${importItem.id}`, {
        token,
        method: "DELETE",
      });

      showToast({
        tone: "success",
        title: "Import silindi",
        description: importItem.source_title ?? importItem.original_filename ?? "İçerik importu",
      });

      router.push("/icerik-importlari");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Import silinemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: "Import silinemedi",
        description: message,
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminTableCard><div className="admin-skeleton h-40" /></AdminTableCard>
        <AdminTableCard><div className="admin-skeleton h-[520px]" /></AdminTableCard>
      </div>
    );
  }

  if (!importItem) {
    return (
      <AdminTableCard>
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">
          {error ?? "Import kaydı bulunamadı."}
        </div>
      </AdminTableCard>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <AdminTableCard>
            <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                    Belge Özeti
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                    Bu review ekranında ders adı ve konu taslakları ortak katalog için son haline getirilir. Sınav bağlantısı opsiyoneldir.
                  </p>
                </div>
                <button className="admin-button admin-button-secondary" onClick={() => window.location.reload()} type="button">
                  <RefreshCcw size={16} />
                  Sayfayı Yenile
                </button>
              </div>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <label className="block space-y-2.5">
                <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Ders Adı</span>
                <input
                  className="admin-input h-12"
                  onChange={(event) => setCandidateSubjectName(event.target.value)}
                  value={candidateSubjectName}
                />
              </label>

              <label className="block space-y-2.5">
                <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Mevcut Dersle Eşle</span>
                <select
                  className="admin-input h-12"
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  value={selectedSubjectId}
                >
                  <option value="">Yeni ders oluştur</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2.5">
                <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Opsiyonel Sınav Bağlantısı</span>
                <select
                  className="admin-input h-12"
                  onChange={(event) => setTargetExamId(event.target.value)}
                  value={targetExamId}
                >
                  <option value="">Sadece kataloga yaz, sınav kapsamını sonra seçerim</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                <p className="font-semibold text-[var(--color-admin-ink)]">
                  {importItem.source_title ?? importItem.original_filename ?? "Kaynak başlığı yok"}
                </p>
                <p className="mt-2 leading-6">
                  {importItem.source_type === "docx_upload" ? "Kaynak: DOCX yükleme" : "Kaynak: Google Docs linki"}
                </p>
                {importItem.source_reference ? (
                  <Link
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-admin-accent)]"
                    href={importItem.source_reference}
                    target="_blank"
                  >
                    Kaynağı Aç
                    <ExternalLink size={14} />
                  </Link>
                ) : null}
              </div>
            </div>

            {importItem.normalized_text ? (
              <div className="border-t border-[var(--color-admin-line)] px-5 py-5">
                <button
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-admin-accent)]"
                  onClick={() => setShowSourcePreview((current) => !current)}
                  type="button"
                >
                  {showSourcePreview ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showSourcePreview ? "Kaynak önizlemesini gizle" : "Kaynak önizlemesini göster"}
                </button>

                {showSourcePreview ? (
                  <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                    <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-[var(--color-admin-muted)]">
                      {importItem.normalized_text}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </AdminTableCard>

          <AdminTableCard>
            <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <div className="w-full max-w-sm">
                    <input
                      className="admin-input"
                      onChange={(event) => setTopicQuery(event.target.value)}
                      placeholder="Konu ara"
                      value={topicQuery}
                    />
                  </div>

                  <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2.5 text-sm text-[var(--color-admin-muted)]">
                    <select
                      className="bg-transparent text-sm font-medium text-[var(--color-admin-ink)] outline-none"
                      onChange={(event) => setTopicFilter(event.target.value as "all" | "accepted" | "excluded")}
                      value={topicFilter}
                    >
                      <option value="all">Tüm konular</option>
                      <option value="accepted">Kabul edilenler</option>
                      <option value="excluded">Çıkarılanlar</option>
                    </select>
                  </label>
                </div>

                <p className="text-sm font-medium text-[var(--color-admin-muted)]">
                  {filteredTopics.length} satır gösteriliyor
                </p>
              </div>
            </div>
          </AdminTableCard>

          <div className="space-y-4">
            {filteredTopics.map((topic) => (
              <AdminTableCard key={topic.id}>
                <div className="grid gap-4 px-5 py-5">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-admin-line)] pb-4">
                    <div>
                      <p className="text-sm font-bold text-[var(--color-admin-ink)]">
                        {topic.edited_name ?? topic.proposed_name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                        Önerilen sıra: {topic.proposed_sort_order}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                        topic.review_status === "accepted"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {topic.review_status === "accepted" ? "Kabul" : "Çıkarıldı"}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_110px_170px]">
                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Konu Adı</span>
                      <input
                        className="admin-input h-12"
                        onChange={(event) => updateTopic(topic.id, { edited_name: event.target.value })}
                        value={topic.edited_name ?? topic.proposed_name}
                      />
                    </label>

                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Sıra</span>
                      <input
                        className="admin-input h-12"
                        inputMode="numeric"
                        onChange={(event) => updateTopic(topic.id, { edited_sort_order: Number(event.target.value || topic.proposed_sort_order) })}
                        value={topic.edited_sort_order ?? topic.proposed_sort_order}
                      />
                    </label>

                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Durum</span>
                      <select
                        className="admin-input h-12"
                        onChange={(event) => updateTopic(topic.id, { review_status: event.target.value as "accepted" | "excluded" })}
                        value={topic.review_status}
                      >
                        <option value="accepted">Kabul Et</option>
                        <option value="excluded">Çıkar</option>
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">İçerik Taslağı</span>
                    <textarea
                      className="admin-input min-h-[240px]"
                      onChange={(event) => updateTopic(topic.id, { edited_content_body: event.target.value })}
                      value={topic.edited_content_body ?? topic.proposed_content_body ?? ""}
                    />
                  </label>
                </div>
              </AdminTableCard>
            ))}
          </div>

          {error ? (
            <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                İşlemler
              </h3>
              <div className="mt-4 flex gap-2">
                <button
                  className="admin-button admin-button-primary min-w-0 flex-1 justify-center"
                  disabled={saving || approving}
                  onClick={() => void saveDraft()}
                  type="button"
                >
                  <Save size={16} />
                  {saving ? "Kaydediliyor" : "Taslağı Kaydet"}
                </button>
                <Link className="admin-button admin-button-secondary min-w-0 flex-1 justify-center" href="/icerik-importlari">
                  Listeye Dön
                </Link>
              </div>

              <div className="mt-4 border-t border-[var(--color-admin-line)] pt-4">
                <ConfirmDialog
                  busy={approving}
                  confirmLabel="Onayla ve Yaz"
                  description="Kabul edilen konular ortak ders-konu havuzuna yazılacak. Opsiyonel sınav seçiliyse bu konular o sınav kapsamına da eklenecek. Bu işlem sonrası import yeniden onaylanamaz."
                  onConfirm={() => void handleApprove()}
                  title="Import kataloga yazılsın mı?"
                  tone="primary"
                  trigger={
                    <span className="admin-button admin-button-secondary w-full justify-center">
                      <CheckCircle2 size={16} />
                      Onayla ve Kataloga Yaz
                    </span>
                  }
                />
              </div>

              <div className="mt-3">
                <ConfirmDialog
                  busy={deleting}
                  confirmLabel="Sil"
                  description="Bu import kaydı ve staging konuları silinecek. Onaylanmış importlar bu ekrandan silinemez."
                  disabled={importItem.processing_status === "approved"}
                  onConfirm={() => void handleDelete()}
                  title="Import silinsin mi?"
                  trigger={
                    <span className="admin-button admin-button-secondary w-full justify-center text-rose-700">
                      <Trash2 size={16} />
                      Importu Sil
                    </span>
                  }
                />
              </div>
            </div>
          </AdminTableCard>

          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Review Özeti
              </h3>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Toplam</p>
                  <p className="mt-2 text-lg font-extrabold text-[var(--color-admin-ink)]">{topics.length}</p>
                </div>
                <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Kabul</p>
                  <p className="mt-2 text-lg font-extrabold text-[var(--color-admin-ink)]">{acceptedCount}</p>
                </div>
                <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Çıkarılan</p>
                  <p className="mt-2 text-lg font-extrabold text-[var(--color-admin-ink)]">{topics.length - acceptedCount}</p>
                </div>
              </div>
            </div>
          </AdminTableCard>

          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                AI Katmanı
              </h3>
              <p className="mt-4 text-sm leading-6 text-[var(--color-admin-muted)]">
                Bu import hattı artık AI öncelikli çalışır. Kaynak belge Gemini ile konu, özet ve ilk içerik taslağına ayrılır; AI başarısız olursa güvenli fallback extraction devreye girer.
              </p>
            </div>
          </AdminTableCard>

          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                İşlem Logu
              </h3>
              <div className="mt-4 space-y-3">
                {(importItem.processing_log ?? []).length > 0 ? (
                  importItem.processing_log.map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${index}`}
                      className="rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                            entry.level === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : entry.level === "error"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : entry.level === "warning"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {entry.level}
                        </span>
                        <span className="text-xs text-[var(--color-admin-muted)]">
                          {new Date(entry.timestamp).toLocaleString("tr-TR")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                        {entry.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-admin-muted)]">
                    Bu import için henüz işlem logu yok.
                  </p>
                )}
              </div>
            </div>
          </AdminTableCard>

          {importItem.processing_status === "failed" ? (
            <AdminTableCard>
              <div className="px-5 py-5">
                <div className="flex items-start gap-3 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4 text-rose-700">
                  <FileWarning size={18} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">İşleme Hatası</p>
                    <p className="mt-1 text-sm leading-6">
                      {importItem.failure_message ?? "Kaynak işlenemedi."}
                    </p>
                  </div>
                </div>
              </div>
            </AdminTableCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
