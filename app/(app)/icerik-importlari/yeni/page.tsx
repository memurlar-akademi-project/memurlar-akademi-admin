"use client";

import { FormEvent, useMemo, useState } from "react";
import { FileUp, Link2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminContentImport, AdminExam } from "@/lib/types";

export default function NewContentImportPage() {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items: exams } = useAdminList<AdminExam>({
    endpoint: "/admin/exams",
    responseKey: "exams",
  });

  const [sourceType, setSourceType] = useState<"docx_upload" | "google_doc_link">("docx_upload");
  const [sourceLink, setSourceLink] = useState("");
  const [targetExamId, setTargetExamId] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formId = "content-import-create-form";

  const selectedExamName = useMemo(
    () => exams.find((exam) => String(exam.id) === targetExamId)?.name ?? null,
    [exams, targetExamId],
  );

  function handleSourceTypeChange(nextType: "docx_upload" | "google_doc_link") {
    setSourceType(nextType);
    setError(null);

    if (nextType === "docx_upload") {
      setSourceLink("");
      return;
    }

    setSourceFile(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("source_type", sourceType);

      if (sourceType === "docx_upload") {
        if (!sourceFile) {
          throw new Error("DOC veya DOCX dosyası seçmelisin.");
        }

        body.append("source_file", sourceFile);
      } else {
        body.append("source_link", sourceLink);
      }

      if (targetExamId) {
        body.append("target_exam_id", targetExamId);
      }

      const response = await adminApiRequest<{ import: AdminContentImport }>("/admin/content-imports", {
        token,
        method: "POST",
        body,
      });

      showToast({
        tone: response.data.import.processing_status === "failed" ? "error" : "success",
        title:
          response.data.import.processing_status === "failed"
            ? "Import oluşturuldu ama işlenemedi"
            : "Import oluşturuldu",
        description: response.data.import.source_title ?? response.data.import.original_filename ?? "Yeni import",
      });

      router.push(`/icerik-importlari/${response.data.import.id}/incele`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Import oluşturulamadı.";
      setError(message);
      showToast({
        tone: "error",
        title: "Import oluşturulamadı",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AdminTableCard>
          <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                <Upload size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  Kaynak Seçimi
                </h2>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Mevzuat veya ders dokümanını ortak ders-konu havuzuna hazırlamak için yükle. Sınav kapsamı daha sonra bu havuzdaki konulardan seçilecek.
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-6">
            <form className="space-y-6" id={formId} onSubmit={handleSubmit}>
              <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                <div className="pb-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                    Kaynak Türü
                  </h3>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    className={`rounded-[18px] border px-4 py-4 text-left transition ${
                      sourceType === "docx_upload"
                        ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)]"
                        : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]"
                    }`}
                    onClick={() => handleSourceTypeChange("docx_upload")}
                    type="button"
                  >
                    <p className="text-sm font-bold text-[var(--color-admin-ink)]">DOC / DOCX Yükleme</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                      Yerel dosyadan Word dokümanı yükle.
                    </p>
                  </button>

                  <button
                    className={`rounded-[18px] border px-4 py-4 text-left transition ${
                      sourceType === "google_doc_link"
                        ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)]"
                        : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]"
                    }`}
                    onClick={() => handleSourceTypeChange("google_doc_link")}
                    type="button"
                  >
                    <p className="text-sm font-bold text-[var(--color-admin-ink)]">Google Docs Linki</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                      Paylaşılan Google Docs dokümanından import başlat.
                    </p>
                  </button>
                </div>

                {sourceType === "docx_upload" ? (
                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">DOC / DOCX Dosyası</span>
                    <input
                      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="admin-input h-12 px-3 py-2"
                      key="docx-file-input"
                      onChange={(event) => setSourceFile(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                  </label>
                ) : (
                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Google Docs Linki</span>
                    <input
                      className="admin-input h-12"
                      key="google-doc-input"
                      onChange={(event) => setSourceLink(event.target.value)}
                      placeholder="https://docs.google.com/document/d/..."
                      value={sourceLink ?? ""}
                    />
                  </label>
                )}
              </section>

              <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                <div className="pb-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                    Opsiyonel Sınav Bağlantısı
                  </h3>
                </div>

                <label className="block space-y-2.5">
                  <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Hedef Sınav</span>
                  <select
                    className="admin-input h-12"
                    onChange={(event) => setTargetExamId(event.target.value)}
                    value={targetExamId}
                  >
                  <option value="">Kataloga yaz, sınav kapsamını sonra seçerim</option>
                    {exams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              {error ? (
                <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                  {error}
                </div>
              ) : null}
            </form>
          </div>
        </AdminTableCard>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <AdminFormActionsCard
            cancelHref="/icerik-importlari"
            formId={formId}
            saving={saving}
            submitLabel="AI Analizini Çalıştır"
            savingLabel="Analiz Çalışıyor"
          />

          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Import Notu
              </h3>
              <div className="mt-4 space-y-4 text-sm text-[var(--color-admin-muted)]">
                <div className="flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                  <FileUp size={18} className="mt-0.5 text-[var(--color-admin-accent)]" />
                  <p>İlk fazda ders, konu ve konu anlatımı ortak havuza yazılır. Aynı konu daha sonra birden fazla sınavda kullanılabilir.</p>
                </div>
                <div className="flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                  <Link2 size={18} className="mt-0.5 text-[var(--color-admin-accent)]" />
                  <p>{selectedExamName ? `Bu import onaylanırsa kabul edilen konular ${selectedExamName} sınav kapsamına da eklenir.` : "Sınav seçmezsen konular sadece ortak katalogda oluşur; sınavı oluştururken bu konuları kapsam olarak seçebilirsin."}</p>
                </div>
              </div>
            </div>
          </AdminTableCard>
        </div>
      </div>
    </div>
  );
}
