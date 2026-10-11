"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { adminApiRequest, AdminApiError } from "@/lib/admin-api";
import { FinancialRetentionFields } from "./FinancialRetentionFields";
import {
  readCompletionPreview,
  readCompletionReceipt,
  type CompletionPreview,
} from "@/lib/account-deletion-cleanup";

export function DeletionCleanupDetails({
  token,
  requestId,
  userId,
  revision,
  onCompleted,
}: {
  token: string;
  requestId: string;
  userId: number;
  revision: number;
  onCompleted: () => void;
}) {
  const [preview, setPreview] = useState<CompletionPreview | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [financialReviewed, setFinancialReviewed] = useState(false);
  const [retentionBasis, setRetentionBasis] = useState("");
  const [retentionUntil, setRetentionUntil] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const live = useRef(false);
  const lock = useRef(false);
  const submission = useRef<{
    request_key: string;
    expected_revision: number;
    preparation_id: string;
    verification_digest: string;
    background_jobs_reviewed: true;
    financial_retention_reviewed: boolean;
    retention_basis: string | null;
    retention_until: string | null;
  } | null>(null);
  const endpoint = `/admin/account-deletion-requests/${requestId}/completion`;
  const data = preview?.verification;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
  const decisionReady = !preview?.requires_financial_review ||
    (financialReviewed && retentionBasis.trim().length > 0 && retentionUntil >= today);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  async function inspect() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setPreview(null);
    setReviewed(false);
    setFinancialReviewed(false);
    setRetentionBasis("");
    setRetentionUntil("");
    setError("");
    try {
      const response = await adminApiRequest<unknown>(endpoint, { token });
      const next = readCompletionPreview(
        response.data,
        requestId,
        userId,
        revision,
      );
      if (live.current) setPreview(next);
    } catch (failure) {
      if (live.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Silme sonrası kontrol yapılamadı.",
        );
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function complete() {
    if (
      lock.current ||
      (!submission.current &&
        (!preview?.can_complete ||
          !data?.preparation_id ||
          !preview.verification_digest ||
          !reviewed || !decisionReady))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    submission.current ??= {
      request_key: crypto.randomUUID(),
      expected_revision: revision,
      preparation_id: data!.preparation_id!,
      verification_digest: preview!.verification_digest!,
      background_jobs_reviewed: true,
      financial_retention_reviewed: preview!.requires_financial_review && financialReviewed,
      retention_basis: preview!.requires_financial_review ? retentionBasis.trim() : null,
      retention_until: preview!.requires_financial_review ? retentionUntil : null,
    };
    setPending(true);
    try {
      const response = await adminApiRequest<unknown>(endpoint, {
        token,
        method: "POST",
        body: submission.current,
      });
      const receipt = readCompletionReceipt(
        response.data,
        requestId,
        userId,
        revision + 1,
      );
      if (receipt.preparation_id !== submission.current.preparation_id)
        throw new Error("Tamamlanma hazırlığı eşleşmiyor.");
      if (live.current) onCompleted();
    } catch (failure) {
      if (live.current) {
        if (
          failure instanceof AdminApiError &&
          [403, 404, 409, 422, 503].includes(failure.status)
        ) {
          submission.current = null;
          setPending(false);
          setPreview(null);
          setReviewed(false);
          setFinancialReviewed(false);
          setRetentionBasis("");
          setRetentionUntil("");
        }
        setError(
          failure instanceof Error
            ? failure.message
            : "Tamamlanma kaydedilemedi.",
        );
      }
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  const remaining =
    data?.rows.filter(
      (row) => row.owner_linked !== 0 || row.sealed_records_remaining !== 0,
    ) ?? [];
  return (
    <section
      className="space-y-3 border-t border-slate-100 pt-4"
      aria-busy={busy}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => void inspect()}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="animate-spin" size={16} aria-hidden />
        ) : (
          <ScanSearch size={16} aria-hidden />
        )}
        {busy ? "Kontrol ediliyor…" : "Silme sonrası verileri kontrol et"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {preview?.latest ? (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-4 text-sm text-green-800"
        >
          Tamamlandı:{" "}
          {new Date(preview.latest.completed_at).toLocaleString("tr-TR")}.
          Bildirim:{" "}
          {preview.latest.confirmation_status === null
            ? "Henüz hazırlanmadı"
            : {
                queued: "Kuyrukta",
                sending: "Gönderiliyor",
                accepted: "E-posta sağlayıcısı kabul etti",
                failed: "Gönderim başarısız",
              }[preview.latest.confirmation_status]}
          .
        </p>
      ) : null}
      {data ? (
        <div
          className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm"
          role="status"
        >
          <p className="font-semibold">
            {data.mapped_personal_records_clear
              ? "Kontrol edilen kişisel kayıtlar kaldırılmış."
              : "Silme işlemi henüz doğrulanamadı."}
          </p>
          <p className="text-xs text-slate-500">
            Kontrol: {new Date(data.inspected_at).toLocaleString("tr-TR")}
          </p>
          <p className="leading-6 text-slate-600">{data.notice}</p>
          {data.issues.length > 0 ? (
            <ul className="list-disc space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 pl-8 text-amber-900">
              {data.issues.map((issue, index) => (
                <li key={`${issue.code}:${issue.key ?? index}`}>
                  {issue.label}
                </li>
              ))}
            </ul>
          ) : null}
          {remaining.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="pb-2 text-left font-semibold">
                  Kalan veya ayrıca incelenecek kayıtlar
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-2">
                      Veri
                    </th>
                    <th scope="col" className="p-2">
                      Hesaba bağlı
                    </th>
                    <th scope="col" className="p-2">
                      Önceki kayıtlardan kalan
                    </th>
                    <th scope="col" className="p-2">İçeriği korunmuş</th>
                  </tr>
                </thead>
                <tbody>
                  {remaining.map((row) => (
                    <tr key={row.key} className="border-t border-slate-200">
                      <th scope="row" className="p-2 font-normal">
                        {row.label}
                      </th>
                      <td className="p-2">
                        {row.owner_linked ?? "Doğrulanamadı"}
                      </td>
                      <td className="p-2">{row.sealed_records_remaining}</td>
                      <td className="p-2">{row.group === "financial_review" ? (row.sealed_records_preserved ?? "Doğrulanamadı") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-slate-600">
            Bu kontrol talebi tamamlandı durumuna geçirmez.
          </p>
          <p className="text-slate-600">
            Saklanan kayıtlar hakkında kullanıcıya verilen açıklama:{" "}
            {preview?.retention_disclosure}
          </p>
          {!preview?.issuance_enabled ? (
            <p className="text-amber-800">
              Manuel silme operasyonunun son kabulü bekleniyor; tamamlanma kaydı
              henüz açılamaz.
            </p>
          ) : null}
          {preview?.can_complete ? (
            <>
            {preview.requires_financial_review ? (
              <FinancialRetentionFields disabled={busy || pending} reviewed={financialReviewed} basis={retentionBasis} until={retentionUntil} today={today} onReviewed={setFinancialReviewed} onBasis={setRetentionBasis} onUntil={setRetentionUntil} />
            ) : null}
            <label className="flex items-start gap-2 leading-6">
              <input
                type="checkbox"
                checked={reviewed}
                disabled={busy || pending}
                onChange={(event) => setReviewed(event.target.checked)}
                className="mt-1"
              />
              Bu hesaba ait kuyruk ve arka plan işlerinin durdurulduğunu ayrıca
              kontrol ettim.
            </label>
            </>
          ) : null}
          {preview?.can_complete || pending ? (
            <button
              type="button"
              disabled={busy || (!pending && (!reviewed || !decisionReady))}
              onClick={() => void complete()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
            >
              {busy
                ? "Kaydediliyor…"
                : pending
                  ? "Aynı işlemi yeniden dene"
                  : "Manuel silmeyi tamamlandı olarak kaydet"}
            </button>
          ) : null}
        </div>
      ) : null}
      {pending && !data ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void complete()}
          className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
        >
          Aynı işlemi yeniden dene
        </button>
      ) : null}
    </section>
  );
}
