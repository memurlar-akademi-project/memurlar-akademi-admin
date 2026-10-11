"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiRequest, AdminApiError } from "@/lib/admin-api";
import {
  emptyPeriod,
  parseLegacyReviewScope,
  parseReviewReceipt,
  reviewDraft,
  reviewSubmission,
} from "@/lib/legacy-web-review";
import type {
  LegacyReviewScope,
  PeriodDraft,
  ReviewDraft,
  ReviewPeriod,
  ReviewReceipt,
} from "@/lib/legacy-web-review";

function PeriodFields({
  value,
  onChange,
  baseline,
  prior = false,
}: {
  value: PeriodDraft;
  onChange: (value: PeriodDraft) => void;
  baseline: ReviewPeriod;
  prior?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {(["starts", "ends"] as const).map((field) => {
        const open = field === "starts" ? "openStart" : "openEnd";
        const canOpen =
          !prior &&
          (field === "starts" ? baseline.starts_at : baseline.ends_at) === null;
        return (
          <div className="min-w-0 space-y-2 text-sm" key={field}>
            <label className="block space-y-2">
              <span className="block font-semibold">
                {field === "starts" ? "Başlangıç" : "Bitiş"} · saat dilimiyle
              </span>
              <input
                className="admin-input w-full min-w-0"
                disabled={value[open]}
                value={value[field]}
                onChange={(event) =>
                  onChange({ ...value, [field]: event.target.value })
                }
                placeholder="YYYY-MM-DDTHH:mm:ssZ"
                autoComplete="off"
              />
            </label>
            {canOpen ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value[open]}
                  onChange={(event) =>
                    onChange({ ...value, [open]: event.target.checked })
                  }
                />
                Bu sınır açık
              </label>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
function Receipt({ receipt }: { receipt: ReviewReceipt }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold">
        İnceleme kaydedildi ·{" "}
        {new Date(receipt.reviewed_at).toLocaleString("tr-TR")}
      </p>
      <p className="break-all text-[var(--color-admin-muted)]">
        Karar: {receipt.public_id}
      </p>
      {receipt.allocations.map((row) => (
        <div
          className="rounded-xl border border-[var(--color-admin-line)] p-3"
          key={row.grant_id}
        >
          <p className="font-semibold">
            {row.kind === "web"
              ? `Sipariş #${row.order_id}`
              : "Ayrı kalan erişim hakkı"}
          </p>
          <p className="mt-1 break-words text-[var(--color-admin-muted)]">
            {row.starts_at ?? "Başlangıç açık"} → {row.ends_at ?? "Bitiş açık"}
          </p>
        </div>
      ))}
      {receipt.excluded_orders.map((row) => (
        <div
          className="rounded-xl border border-[var(--color-admin-line)] p-3"
          key={row.order_id}
        >
          <p className="font-semibold">
            Sipariş #{row.order_id} ·{" "}
            {row.reason === "prior_period"
              ? "Önceki kapanmış dönem"
              : "Bu dönemin kaynağı değil"}
          </p>
          <p className="mt-1 text-[var(--color-admin-muted)]">
            Bu siparişin iadesi mevcut dönemden hak kapatmaz.
          </p>
        </div>
      ))}
      <p className="text-[var(--color-admin-muted)]">
        Siparişin finansal durumunu yukarıdaki formdan ayrıca güncelleyin.
        Kayıtlı inceleme kararı değiştirilemez.
      </p>
    </div>
  );
}
export function LegacyWebReviewCard({ orderId }: { orderId: number }) {
  const { token, session } = useAdminAuth();
  return token && session ? (
    <LegacyWebReviewForm
      key={`${orderId}:${session.user.id}`}
      orderId={orderId}
      token={token}
    />
  ) : null;
}

function LegacyWebReviewForm({
  orderId,
  token,
}: {
  orderId: number;
  token: string;
}) {
  const [scope, setScope] = useState<LegacyReviewScope | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [receipt, setReceipt] = useState<ReviewReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [submittedScope, setSubmittedScope] =
    useState<LegacyReviewScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const attempted = useRef<ReturnType<typeof reviewSubmission> | null>(null);
  const endpoint = `/admin/orders/${orderId}/legacy-reconciliation`;

  const load = useCallback(async () => {
    if (!token || busy.current) return;
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const response = await adminApiRequest<{ reconciliation: unknown }>(
        endpoint,
        { token },
      );
      if (generation.current !== current) return;
      const next = parseLegacyReviewScope(response.data.reconciliation);
      setScope(next);
      setReceipt(next.receipt);
      if (next.receipt) {
        attempted.current = null;
        setPending(false);
        setSubmittedScope(null);
      }
      // An uncertain POST keeps its exact key and body until a receipt or explicit rejection.
      if (!attempted.current) setDraft(reviewDraft(next));
    } catch (failure) {
      if (generation.current === current)
        setError(
          failure instanceof Error ? failure.message : "İnceleme yüklenemedi.",
        );
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [endpoint, token]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidate;
  }, [load, invalidate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !scope || !draft || busy.current) return;
    const current = generation.current;
    try {
      if (!attempted.current) {
        attempted.current = reviewSubmission(scope, draft, crypto.randomUUID());
        setSubmittedScope(scope);
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "İnceleme tamamlanmalı.",
      );
      return;
    }
    busy.current = true;
    setSaving(true);
    setPending(true);
    setError(null);
    try {
      const response = await adminApiRequest<{ reconciliation: unknown }>(
        endpoint,
        { token, method: "POST", body: attempted.current },
      );
      if (generation.current !== current) return;
      const next = parseReviewReceipt(response.data.reconciliation);
      if (next.membership_id !== scope.membership_id)
        throw new Error(
          "Karar bu üyeliğe ait değil; güncel kayıt yeniden yüklenmeli.",
        );
      setReceipt(next);
      attempted.current = null;
      setPending(false);
      setSubmittedScope(null);
    } catch (failure) {
      if (generation.current !== current) return;
      if (
        failure instanceof AdminApiError &&
        [409, 422, 503].includes(failure.status)
      ) {
        attempted.current = null;
        setPending(false);
        setSubmittedScope(null);
      }
      setError(
        failure instanceof Error
          ? failure.message
          : "İnceleme sonucu alınamadı.",
      );
    } finally {
      busy.current = false;
      if (generation.current === current) setSaving(false);
    }
  }

  function updateOrder(
    index: number,
    value: Partial<ReviewDraft["orders"][number]>,
  ) {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            orders: previous.orders.map((row, item) =>
              item === index ? { ...row, ...value } : row,
            ),
          }
        : previous,
    );
  }

  const viewScope = submittedScope ?? scope;

  return (
    <AdminTableCard>
      <div className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
            Eski Premium dönem incelemesi
          </h3>
          <button
            className="text-sm font-semibold underline disabled:opacity-50"
            type="button"
            disabled={loading || saving}
            onClick={() => void load()}
          >
            Güncel kaydı yükle
          </button>
        </div>
        {error ? (
          <p
            role="alert"
            className="break-words rounded-xl bg-[var(--color-admin-danger-soft)] p-3 text-sm text-[var(--color-admin-danger)]"
          >
            {error}
          </p>
        ) : null}
        {loading ? (
          <p role="status" className="text-sm">
            İnceleme bilgisi yükleniyor…
          </p>
        ) : receipt ? (
          <Receipt receipt={receipt} />
        ) : scope?.status === "unavailable" && !pending ? (
          <p className="text-sm text-[var(--color-admin-muted)]">
            Bu sipariş için ayrıştırılabilir eski dönem bulunmuyor. Kaynağı
            doğrulanmış yeni web siparişlerini sipariş formundan iade
            edebilirsiniz.
          </p>
        ) : viewScope && draft ? (
          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm text-[var(--color-admin-muted)]">
              {viewScope.notice}
            </p>
            <div className="rounded-xl bg-[var(--color-admin-panel-soft)] p-3 text-sm">
              <p className="font-semibold">Korunacak eski dönem</p>
              <p className="mt-1 break-words">
                {viewScope.baseline.starts_at ?? "Başlangıç açık"} →{" "}
                {viewScope.baseline.ends_at ?? "Bitiş açık"}
              </p>
            </div>
            <fieldset
              className="min-w-0 space-y-4 disabled:opacity-60"
              disabled={saving || pending}
            >
              {draft.orders.map((row, index) => {
                const order = viewScope.eligible_orders.find(
                  (item) => item.id === row.orderId,
                );
                return (
                  <div
                    className="min-w-0 space-y-3 rounded-xl border border-[var(--color-admin-line)] p-4"
                    key={row.orderId}
                  >
                    <p className="break-words text-sm font-semibold">
                      {order?.order_no} · {order?.total_amount} TL ·{" "}
                      {order?.status === "refunded"
                        ? "İade edilmiş"
                        : "Tamamlanmış"}
                    </p>
                    <label className="block space-y-2 text-sm">
                      <span>Bu ödemenin erişim karşılığı</span>
                      <select
                        className="admin-input w-full"
                        value={row.decision}
                        onChange={(event) =>
                          updateOrder(index, {
                            decision: event.target.value as typeof row.decision,
                          })
                        }
                      >
                        <option value="unreviewed">Karar seçin</option>
                        <option value="period">
                          Bu eski dönemin ödeme kaynağı
                        </option>
                        <option value="prior_period">
                          Önceki kapanmış döneme ait
                        </option>
                        <option value="not_baseline_source">
                          Bu eski dönemin erişim kaynağı değil
                        </option>
                      </select>
                    </label>
                    {row.decision === "period" ||
                    row.decision === "prior_period" ? (
                      <PeriodFields
                        value={row}
                        baseline={viewScope.baseline}
                        prior={row.decision === "prior_period"}
                        onChange={(value) => updateOrder(index, value)}
                      />
                    ) : null}
                    <label className="block space-y-2 text-sm">
                      <span>Kararın kanıtı / kayıt referansı</span>
                      <textarea
                        className="admin-input min-h-20 w-full"
                        maxLength={1000}
                        value={row.note}
                        onChange={(event) =>
                          updateOrder(index, { note: event.target.value })
                        }
                      />
                    </label>
                  </div>
                );
              })}
              {draft.residuals.map((row, index) => (
                <div
                  className="min-w-0 space-y-3 rounded-xl border border-[var(--color-admin-line)] p-4"
                  key={row.key}
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <p className="text-sm font-semibold">
                      Siparişlerden bağımsız kalan hak
                    </p>
                    <button
                      type="button"
                      className="text-sm underline"
                      onClick={() =>
                        setDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                residuals: previous.residuals.filter(
                                  (_, item) => item !== index,
                                ),
                              }
                            : previous,
                        )
                      }
                    >
                      Kaldır
                    </button>
                  </div>
                  <PeriodFields
                    value={row}
                    baseline={viewScope.baseline}
                    onChange={(value) =>
                      setDraft((previous) =>
                        previous
                          ? {
                              ...previous,
                              residuals: previous.residuals.map((item, at) =>
                                at === index ? { ...item, ...value } : item,
                              ),
                            }
                          : previous,
                      )
                    }
                  />
                  <label className="block space-y-2 text-sm">
                    <span>Ayrı kalan hakkın kanıtı</span>
                    <textarea
                      className="admin-input min-h-20 w-full"
                      maxLength={1000}
                      value={row.note}
                      onChange={(event) =>
                        setDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                residuals: previous.residuals.map((item, at) =>
                                  at === index
                                    ? { ...item, note: event.target.value }
                                    : item,
                                ),
                              }
                            : previous,
                        )
                      }
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-semibold underline"
                onClick={() =>
                  setDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          residuals: [
                            ...previous.residuals,
                            { ...emptyPeriod(), key: crypto.randomUUID() },
                          ],
                        }
                      : previous,
                  )
                }
              >
                Bağımsız kalan hak ekle
              </button>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">İncelemenin dayanağı</span>
                <textarea
                  className="admin-input min-h-24 w-full"
                  maxLength={3000}
                  value={draft.evidence}
                  onChange={(event) =>
                    setDraft({ ...draft, evidence: event.target.value })
                  }
                />
              </label>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={draft.confirmed}
                  onChange={(event) =>
                    setDraft({ ...draft, confirmed: event.target.checked })
                  }
                />
                <span>
                  Tüm siparişleri kanıtlarıyla inceledim. Dönem dışı işaretlenen
                  ödemeler bu eski erişimin kaynağı değildir. Diğer hakları
                  korudum; bu karar kalıcı kayda geçsin.
                </span>
              </label>
            </fieldset>
            {pending ? (
              <p role="status" className="text-sm">
                Sonuç kesinleşmedi. Aynı kararı tekrar gönderin veya güncel
                makbuzu yükleyin; kanıt metni korunuyor.
              </p>
            ) : null}
            <button
              className="admin-button admin-button-primary"
              type="submit"
              disabled={saving || loading}
            >
              {saving
                ? "Kaydediliyor…"
                : pending
                  ? "Aynı kararı tekrar gönder"
                  : "İncelemeyi kaydet"}
            </button>
          </form>
        ) : null}
      </div>
    </AdminTableCard>
  );
}
