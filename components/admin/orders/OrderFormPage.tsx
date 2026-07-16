"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminOrder } from "@/lib/types";

function toDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

export function OrderFormPage({ id }: { id: number }) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const formId = `order-form-${id}`;

  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [form, setForm] = useState({
    status: "pending",
    payment_method: "",
    invoice_no: "",
    ordered_at: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadOrder() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ order: AdminOrder }>(`/admin/orders/${id}`, { token });
        const item = response.data.order;

        if (cancelled) {
          return;
        }

        setOrder(item);
        setForm({
          status: item.status,
          payment_method: item.payment_method ?? "",
          invoice_no: item.invoice_no ?? "",
          ordered_at: toDateTimeInput(item.ordered_at),
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Sipariş yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrder();

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    setTitle(order?.order_no ?? "Sipariş Düzenle");
    return () => setTitle(null);
  }, [order?.order_no, setTitle]);

  const itemSummary = useMemo(() => {
    if (!Array.isArray(order?.items_snapshot)) {
      return [];
    }

    return order.items_snapshot as Array<Record<string, unknown>>;
  }, [order?.items_snapshot]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ order: AdminOrder }>(`/admin/orders/${id}`, {
        token,
        method: "PUT",
        body: {
          status: form.status,
          payment_method: form.payment_method || null,
          invoice_no: form.invoice_no || null,
          ordered_at: form.ordered_at ? new Date(form.ordered_at).toISOString() : null,
        },
      });

      setOrder(response.data.order);
      showToast({
        tone: "success",
        title: "Sipariş güncellendi",
        description: response.data.order.order_no,
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Sipariş güncellenemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: "Kayıt tamamlanamadı",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminTableCard>
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">Sipariş yükleniyor...</div>
      </AdminTableCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" id={formId} onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Sipariş Durumu
                </span>
                <select
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  value={form.status}
                >
                  <option value="pending">Beklemede</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="failed">Başarısız</option>
                  <option value="cancelled">İptal</option>
                  <option value="refunded">İade</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Sipariş Tarihi
                </span>
                <input
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, ordered_at: event.target.value }))}
                  type="datetime-local"
                  value={form.ordered_at}
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Ödeme Yöntemi
                </span>
                <input
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}
                  placeholder="Kredi Kartı"
                  value={form.payment_method}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Fatura No
                </span>
                <input
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, invoice_no: event.target.value }))}
                  placeholder="INV-2026-001"
                  value={form.invoice_no}
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl border border-[var(--color-admin-danger)]/20 bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                {error}
              </div>
            ) : null}
          </form>
        </AdminTableCard>

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Sipariş İçeriği
            </h3>
            <div className="mt-4 space-y-3">
              {itemSummary.length ? (
                itemSummary.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-[var(--color-admin-ink)]">
                      {String(item.name ?? item.title ?? "Sipariş kalemi")}
                    </p>
                    <p className="mt-1 text-[var(--color-admin-muted)]">
                      {String(item.description ?? item.slug ?? "Ek bilgi bulunmuyor.")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--color-admin-muted)]">Sipariş kalemi bulunamadı.</p>
              )}
            </div>
          </div>
        </AdminTableCard>
      </div>

      <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
        <AdminFormActionsCard cancelHref="/siparisler" formId={formId} saving={saving} />

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Özet
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Sipariş No</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{order?.order_no}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Kullanıcı</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{order?.user?.name ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Tutar</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{order?.total_amount ?? 0} TL</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Sınav / Erişim</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{order?.plan?.name ?? "-"}</span>
              </div>
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
