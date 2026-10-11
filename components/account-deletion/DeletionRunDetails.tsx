"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, RefreshCcw } from "lucide-react";
import { adminApiRequest, AdminApiError } from "@/lib/admin-api";
import { readPreparationPreview, type PreparationPreview } from "@/lib/account-deletion-preparation";
import { readDeletionScope, type DeletionScope } from "@/lib/account-deletion-scope";
import {
  cleanupPhases, cleanupRequirements, cleanupStartInput, cleanupResumeInput, readCleanupRun, readCleanupRunPreview,
  type CleanupReview, type CleanupRunPreview, type CleanupStartInput,
} from "@/lib/account-deletion-run";
import { FinancialRetentionFields } from "./FinancialRetentionFields";

const emptyReview: CleanupReview = {
  backgroundReviewed: false, communityReviewed: false, financialReviewed: false, retentionBasis: "", retentionUntil: "",
};
type Inspection = { preview: CleanupRunPreview; preparation: PreparationPreview | null; scope: DeletionScope | null };

export function DeletionRunDetails({ token, requestId, userId, revision, onStarted, onLocked }: {
  token: string; requestId: string; userId: number; revision: number;
  onStarted: () => void; onLocked: (locked: boolean) => void;
}) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [review, setReview] = useState(emptyReview);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [queued, setQueued] = useState(false);
  const live = useRef(false), lock = useRef(false);
  const submission = useRef<CleanupStartInput | null>(null);
  const endpoint = `/admin/account-deletion-requests/${requestId}`;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
  const needs = inspection?.scope ? cleanupRequirements(inspection.scope) : null;
  const run = inspection?.preview.run;
  const ready = inspection?.preview.startup_enabled && !run && inspection.preparation?.can_prepare &&
    inspection.preparation.latest?.current && inspection.scope?.account_exists && needs?.blockers.length === 0;
  const reviewReady = review.backgroundReviewed && (!needs?.community || review.communityReviewed) &&
    (!needs?.financial || (review.financialReviewed && !!review.retentionBasis.trim() && review.retentionUntil >= today));
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  async function inspect() {
    if (lock.current || submission.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setQueued(false);
    setInspection(null);
    setReview(emptyReview);
    try {
      const result = await adminApiRequest<unknown>(`${endpoint}/cleanup-run`, { token });
      const preview = readCleanupRunPreview(result.data, requestId, userId, revision);
      let preparation: PreparationPreview | null = null, scope: DeletionScope | null = null;
      if (preview.startup_enabled && !preview.run) {
        const [prepared, scoped] = await Promise.all([
          adminApiRequest<unknown>(`${endpoint}/preparation`, { token }),
          adminApiRequest<unknown>(`${endpoint}/scope`, { token }),
        ]);
        preparation = readPreparationPreview(prepared.data, requestId, userId, revision);
        scope = readDeletionScope(scoped.data, requestId, userId, revision);
        // Preparation includes primary-key metadata; its schema digest is not the scope digest.
        // The POST checks a fresh complete capture against the immutable preparation.
      }
      if (!live.current) return;
      setInspection({ preview, preparation, scope });
      onLocked(preview.run !== null);
    } catch (failure) {
      if (live.current) setError(failure instanceof Error ? failure.message : "İşlem durumu kontrol edilemedi.");
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }

  async function start() {
    if (lock.current) return;
    if (!submission.current) {
      if (!inspection?.preparation || !inspection.scope) return;
      try {
        submission.current = cleanupStartInput(inspection.preview, inspection.preparation, inspection.scope, review, crypto.randomUUID(), today);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "İncelemeyi tamamla.");
        return;
      }
    }
    const input = submission.current;
    lock.current = true;
    setBusy(true);
    setPending(true);
    setError("");
    onLocked(true);
    try {
      const response = await adminApiRequest<unknown>(`${endpoint}/cleanup-run`, { token, method: "POST", body: input });
      readCleanupRun(response.data, requestId, userId, input.expected_revision + 1);
      if (!live.current) return;
      submission.current = null;
      setPending(false);
      onStarted();
    } catch (failure) {
      if (!live.current) return;
      if (failure instanceof AdminApiError && [403, 404, 409, 422, 503].includes(failure.status)) {
        submission.current = null;
        setPending(false);
        setInspection(null);
        setReview(emptyReview);
        // A conflict may be an already-started operation from another operator.
        if (failure.status !== 409) onLocked(false);
      }
      setError(failure instanceof Error ? failure.message : "İşlem başlangıcı doğrulanamadı.");
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }

  async function resume() {
    if (lock.current || !inspection) return;
    const input = cleanupResumeInput(inspection.preview);
    const current = inspection.preview.run!;
    lock.current = true;
    setBusy(true);
    setError("");
    setQueued(false);
    try {
      const response = await adminApiRequest<unknown>(`${endpoint}/cleanup-run/resume`, { token, method: "POST", body: input });
      const receipt = readCleanupRun(response.data, requestId, userId, current.request_revision);
      if (receipt.id !== current.id) throw new Error("Devam kaydı mevcut işlemle eşleşmiyor.");
      if (!live.current) return;
      setInspection((old) => old ? { ...old, preview: { ...old.preview, run: receipt } } : null);
      setQueued(true);
    } catch (failure) {
      if (live.current) setError(failure instanceof Error ? failure.message : "İşlem kuyruğa alınamadı. Durumu kontrol et.");
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }

  return (
    <section aria-busy={busy} className="space-y-3 border-t border-slate-100 pt-4">
      <button type="button" disabled={busy || pending} onClick={() => void inspect()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40">
        {busy ? <Loader2 size={16} aria-hidden className="animate-spin" /> : <RefreshCcw size={16} aria-hidden />}
        {busy ? "Kontrol ediliyor…" : "Temizleme işlemini kontrol et"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {inspection ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          {run ? (
            <div role="status" className="space-y-2">
              <p className="font-semibold">{cleanupPhases[run.phase]}</p>
              <p>Başlangıç: {new Date(run.started_at).toLocaleString("tr-TR")}</p>
              <p className="break-all text-xs text-slate-500">İşlem: {run.id}</p>
              {run.last_attempt_at ? <p>Son deneme: {new Date(run.last_attempt_at).toLocaleString("tr-TR")} · {run.attempts} deneme</p> : null}
              {run.failure_code ? <p role="alert" className="text-amber-800">İşlem bu aşamada durdu. Önceki aşamalar korunuyor. Hata kodu: {run.failure_code}</p> : null}
              {run.phase !== "completed" ? <p>Hesap kullanıma kapatıldı. Silme tamamlandı bildirimi henüz oluşturulmadı.</p> : <p>Tamamlanma ve bildirim durumunu aşağıdaki silme sonrası kontrolden görebilirsin.</p>}
              {run.phase !== "completed" && !inspection.preview.execution_enabled ? <p className="text-amber-800">Temizleme çalıştırması kapalı. İşlem bu aşamada korunuyor.</p> : null}
              {run.phase !== "completed" && inspection.preview.execution_enabled ? <button type="button" disabled={busy} onClick={() => void resume()} className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40">{busy ? "Kuyruğa alınıyor…" : "İşlemi kaldığı yerden sürdür"}</button> : null}
              {queued ? <p role="status">İşlem kuyruğa alındı. Güncel aşamayı kontrol düğmesinden yenileyebilirsin.</p> : null}
            </div>
          ) : !inspection.preview.startup_enabled ? (
            <p role="status" className="text-amber-800">Temizleme işleminin son kabulü bekleniyor; işlem başlatma henüz açık değil. Hesap dondurulmadı.</p>
          ) : !ready ? (
            <>
              <p>Talebi işleme al, işlem öncesi kapsamı kontrol et ve güncel kapsam kanıtını kaydet. Ardından buradan yeniden kontrol et.</p>
              {needs?.blockers.length ? <ul className="list-disc space-y-1 pl-5 text-amber-800">{needs.blockers.map((label, index) => <li key={`${index}:${label}`}>{label}</li>)}</ul> : null}
            </>
          ) : (
            <>
              <p>İşlem başladığında kullanıcı bu hesaba giriş yapamaz ve talebi geri çekemez. Bu adım hesabı dondurur; silmenin tamamlandığı anlamına gelmez.</p>
              {needs?.financial ? <FinancialRetentionFields disabled={busy || pending} reviewed={review.financialReviewed} basis={review.retentionBasis} until={review.retentionUntil} today={today} onReviewed={(value) => setReview((old) => ({ ...old, financialReviewed: value }))} onBasis={(value) => setReview((old) => ({ ...old, retentionBasis: value }))} onUntil={(value) => setReview((old) => ({ ...old, retentionUntil: value }))} /> : null}
              {needs?.community ? <label className="flex items-start gap-2 leading-6"><input type="checkbox" checked={review.communityReviewed} disabled={busy || pending} onChange={(event) => setReview((old) => ({ ...old, communityReviewed: event.target.checked }))} className="mt-1" />Kullanıcının paylaşımlarındaki yorumları ve ilişkili içerik bildirimlerini inceledim; hesap temizliğine dahil edilmelerini onaylıyorum.</label> : null}
              <label className="flex items-start gap-2 leading-6"><input type="checkbox" checked={review.backgroundReviewed} disabled={busy || pending} onChange={(event) => setReview((old) => ({ ...old, backgroundReviewed: event.target.checked }))} className="mt-1" />Bu hesaba ait kuyruk ve arka plan işlerinin durdurulduğunu kontrol ettim.</label>
            </>
          )}
        </div>
      ) : null}
      {pending ? <p role="status" className="text-sm text-slate-600">Sonuç kesinleşmedi. Aynı işlemi yeniden dene; ikinci bir temizleme işlemi oluşturulmaz. Sayfayı yeniden açarsan mevcut işlem durumunu kontrol et.</p> : null}
      {ready || pending ? (
        <button type="button" disabled={busy || (!pending && !reviewReady)} onClick={() => void start()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? <Loader2 size={16} aria-hidden className="animate-spin" /> : <Play size={16} aria-hidden />}
          {busy ? "Başlatma doğrulanıyor…" : pending ? "Aynı işlemi yeniden dene" : "Hesabı dondur ve temizlemeyi başlat"}
        </button>
      ) : null}
    </section>
  );
}
