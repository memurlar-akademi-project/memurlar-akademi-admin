"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { adminApiRequest, AdminApiError } from "@/lib/admin-api";
import {
  readPreparationPreview,
  readPreparationReceipt,
  type PreparationPreview,
  type PreparationReceipt,
} from "@/lib/account-deletion-preparation";

type Submission = {
  request_key: string;
  expected_revision: number;
  scope_hash: string;
};
export function DeletionPreparationDetails({
  token,
  requestId,
  userId,
  revision,
}: {
  token: string;
  requestId: string;
  userId: number;
  revision: number;
}) {
  const [preview, setPreview] = useState<PreparationPreview | null>(null);
  const [receipt, setReceipt] = useState<PreparationReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const live = useRef(false),
    lock = useRef(false);
  const submission = useRef<Submission | null>(null);
  const endpoint = `/admin/account-deletion-requests/${requestId}/preparation`;
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
    setError("");
    try {
      const result = await adminApiRequest<unknown>(endpoint, { token });
      const next = readPreparationPreview(
        result.data,
        requestId,
        userId,
        revision,
      );
      if (!live.current) return;
      setPreview(next);
      setReceipt(next.latest);
      // A different operator's seal does not resolve this client's uncertain POST.
      if (
        submission.current &&
        next.latest?.scope_hash === submission.current.scope_hash &&
        next.latest.current
      ) {
        // Keep the exact request key until its own POST returns a receipt.
        setPending(true);
      }
    } catch (failure) {
      if (live.current) {
        setPreview(null);
        setError(
          failure instanceof Error
            ? failure.message
            : "Hazırlık kontrol edilemedi.",
        );
      }
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function save() {
    if (
      lock.current ||
      (!submission.current && (!preview?.can_prepare || !preview.scope_hash))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    submission.current ??= {
      request_key: crypto.randomUUID(),
      expected_revision: revision,
      scope_hash: preview!.scope_hash!,
    };
    setPending(true);
    try {
      const result = await adminApiRequest<unknown>(endpoint, {
        token,
        method: "POST",
        body: submission.current,
      });
      const saved = readPreparationReceipt(
        result.data,
        requestId,
        userId,
        revision,
      );
      if (
        saved.scope_hash !== submission.current.scope_hash ||
        saved.request_revision !== submission.current.expected_revision
      )
        throw new Error(
          "Kaydedilen hazırlık doğrulanamadı. Aynı işlemi tekrar gönder.",
        );
      if (!live.current) return;
      setReceipt(saved);
      submission.current = null;
      setPending(false);
    } catch (failure) {
      if (!live.current) return;
      setError(
        failure instanceof Error ? failure.message : "Hazırlık kaydedilemedi.",
      );
      if (
        failure instanceof AdminApiError &&
        [403, 404, 409, 422, 503].includes(failure.status)
      ) {
        submission.current = null;
        setPending(false);
        setPreview(null);
      }
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void inspect()}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <ShieldCheck size={16} />
        )}
        İşlem öncesi kapsamı kontrol et
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {preview && (
        <p className="text-sm leading-6 text-slate-600">{preview.notice}</p>
      )}
      {preview && !preview.can_prepare && !pending && (
        <p className="text-sm text-slate-600">
          {preview.scope_available
            ? "Hesap veya talep yeni hazırlığa uygun değil. Güncel talep ve temizleme durumunu kontrol et."
            : "Mevcut kapsam doğrulanamadı; önceki hazırlık kaydı korunuyor."}
        </p>
      )}
      {receipt && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <p className="font-semibold">
            Hazırlık kaydı:{" "}
            {new Date(receipt.prepared_at).toLocaleString("tr-TR")}
          </p>
          <p className="break-all text-xs text-slate-500">{receipt.id}</p>
          <p className={receipt.current ? "text-slate-600" : "text-amber-800"}>
            {receipt.current
              ? "Kontrol edilen kapsam kaydedildi."
              : "Kapsam değişmiş veya doğrulanamıyor; bu hazırlıkla işleme devam etme."}
          </p>
          <p className="text-slate-600">
            Hesap silinmedi. Hazırlık kaydı tamamlanma belgesi değildir.
          </p>
        </div>
      )}
      {pending && (
        <p role="status" className="text-sm text-slate-600">
          Sonuç kesinleşmedi. Aynı işlemi tekrar göndererek kayıt durumunu
          doğrula.
        </p>
      )}
      {(pending || (preview?.can_prepare && !receipt?.current)) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Aynı hazırlığı tekrar gönder" : "Kapsam kanıtını kaydet"}
        </button>
      )}
    </section>
  );
}
