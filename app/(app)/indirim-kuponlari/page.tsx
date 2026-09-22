"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, PauseCircle, Plus, RefreshCcw, Save, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import {
  AdminListToolbar,
  AdminListToolbarActions,
  AdminListToolbarField,
  AdminListToolbarFields,
  AdminListToolbarIconButton,
  AdminListToolbarMeta,
  AdminListToolbarMetaPill,
  AdminListToolbarRow,
} from "@/components/admin/crud/AdminListToolbar";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminCouponExamOption, AdminDiscountCoupon } from "@/lib/types";

type CouponForm = {
  exam_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  starts_at: string;
  ends_at: string;
  usage_limit: string;
  per_user_limit: string;
  is_active: boolean;
};

const emptyForm: CouponForm = {
  exam_id: "",
  code: "",
  discount_type: "percentage",
  discount_value: "",
  starts_at: "",
  ends_at: "",
  usage_limit: "",
  per_user_limit: "1",
  is_active: true,
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Sınırsız";
}

export default function DiscountCouponsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminDiscountCoupon>({
    endpoint: "/admin/discount-coupons",
    responseKey: "coupons",
  });
  const [exams, setExams] = useState<AdminCouponExamOption[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "passive">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    void adminApiRequest<{ exams: AdminCouponExamOption[] }>("/admin/discount-coupons/options/exams", { token })
      .then((response) => setExams(response.data.exams))
      .catch((loadError) => showToast({
        tone: "error",
        title: "Sınavlar yüklenemedi",
        description: loadError instanceof Error ? loadError.message : undefined,
      }));
  }, [token, showToast]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    return items.filter((coupon) => {
      if (status === "active" && !coupon.is_active) return false;
      if (status === "passive" && coupon.is_active) return false;
      return !normalized || [coupon.code, coupon.exam?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, status]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(coupon: AdminDiscountCoupon) {
    setEditingId(coupon.id);
    setForm({
      exam_id: String(coupon.exam?.id ?? ""),
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      starts_at: toLocalDateTime(coupon.starts_at),
      ends_at: toLocalDateTime(coupon.ends_at),
      usage_limit: coupon.usage_limit === null ? "" : String(coupon.usage_limit),
      per_user_limit: String(coupon.per_user_limit),
      is_active: coupon.is_active,
    });
    setFormOpen(true);
  }

  async function saveCoupon() {
    if (!token) return;
    if (!form.exam_id || !form.code.trim() || !form.discount_value) {
      showToast({ tone: "error", title: "Zorunlu alanları doldur" });
      return;
    }

    setSaving(true);
    try {
      const response = await adminApiRequest<{ coupon: AdminDiscountCoupon }>(
        editingId ? `/admin/discount-coupons/${editingId}` : "/admin/discount-coupons",
        {
          token,
          method: editingId ? "PUT" : "POST",
          body: {
            exam_id: Number(form.exam_id),
            code: form.code.trim().toUpperCase(),
            discount_type: form.discount_type,
            discount_value: Number(form.discount_value),
            starts_at: form.starts_at || null,
            ends_at: form.ends_at || null,
            usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
            per_user_limit: Number(form.per_user_limit || 1),
            is_active: form.is_active,
          },
        },
      );
      setItems((current) => editingId
        ? current.map((coupon) => coupon.id === editingId ? response.data.coupon : coupon)
        : [response.data.coupon, ...current]);
      setFormOpen(false);
      showToast({ tone: "success", title: editingId ? "Kupon güncellendi" : "Kupon oluşturuldu", description: response.data.coupon.code });
    } catch (saveError) {
      showToast({ tone: "error", title: "Kupon kaydedilemedi", description: saveError instanceof Error ? saveError.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function toggleCoupon(coupon: AdminDiscountCoupon) {
    if (!token) return;
    setTogglingId(coupon.id);
    try {
      const response = await adminApiRequest<{ coupon: AdminDiscountCoupon }>(`/admin/discount-coupons/${coupon.id}`, {
        token,
        method: "PUT",
        body: {
          exam_id: coupon.exam?.id,
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          starts_at: coupon.starts_at,
          ends_at: coupon.ends_at,
          usage_limit: coupon.usage_limit,
          per_user_limit: coupon.per_user_limit,
          is_active: !coupon.is_active,
        },
      });
      setItems((current) => current.map((item) => item.id === coupon.id ? response.data.coupon : item));
      showToast({ tone: "success", title: coupon.is_active ? "Kupon pasife alındı" : "Kupon aktifleştirildi", description: coupon.code });
    } catch (toggleError) {
      showToast({ tone: "error", title: "Kupon durumu değiştirilemedi", description: toggleError instanceof Error ? toggleError.message : undefined });
    } finally {
      setTogglingId(null);
    }
  }

  const columns: ColumnDef<AdminDiscountCoupon>[] = [
    { accessorKey: "code", header: "Kod", cell: ({ row }) => <div><p className="font-black tracking-wide text-[var(--color-admin-ink)]">{row.original.code}</p><p className="mt-1 text-xs text-[var(--color-admin-muted)]">{row.original.exam?.name ?? "Sınav yok"}</p></div> },
    { id: "discount", header: "İndirim", cell: ({ row }) => <span className="font-bold text-[var(--color-admin-ink)]">{row.original.discount_type === "percentage" ? `%${row.original.discount_value}` : `${row.original.discount_value} TL`}</span> },
    { id: "validity", header: "Geçerlilik", cell: ({ row }) => <div className="text-xs text-[var(--color-admin-muted)]"><p>{row.original.starts_at ? formatDate(row.original.starts_at) : "Hemen başlar"}</p><p className="mt-1">{row.original.ends_at ? formatDate(row.original.ends_at) : "Süresiz"}</p></div> },
    { id: "usage", header: "Kullanım", cell: ({ row }) => <div><p className="font-semibold text-[var(--color-admin-ink)]">{row.original.completed_usage_count}{row.original.usage_limit ? ` / ${row.original.usage_limit}` : " / ∞"}</p>{row.original.pending_usage_count > 0 ? <p className="mt-1 text-xs text-amber-700">{row.original.pending_usage_count} ödemede bekliyor</p> : null}</div> },
    { accessorKey: "is_active", header: "Durum", cell: ({ row }) => <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${row.original.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{row.original.is_active ? "Aktif" : "Pasif"}</span> },
    { id: "actions", header: "Aksiyon", cell: ({ row }) => <div className="flex justify-end gap-2"><button aria-label="Kuponu düzenle" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] hover:text-[var(--color-admin-accent)]" onClick={() => openEdit(row.original)} type="button"><SquarePen size={16} /></button><button aria-label={row.original.is_active ? "Pasife al" : "Aktifleştir"} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] hover:text-[var(--color-admin-accent)] disabled:opacity-50" disabled={togglingId === row.original.id} onClick={() => void toggleCoupon(row.original)} type="button">{row.original.is_active ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}</button></div> },
  ];

  return <div className="space-y-4">
    {formOpen ? <section className="admin-card p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-[var(--color-admin-ink)]">{editingId ? "Kuponu düzenle" : "Yeni indirim kuponu"}</h2><p className="mt-1 text-sm text-[var(--color-admin-muted)]">Kod yalnızca seçtiğin sınavın premium ödemesinde geçerli olur.</p></div><button aria-label="Formu kapat" className="admin-button admin-button-secondary" onClick={() => setFormOpen(false)} type="button"><X size={16} /></button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-bold text-[var(--color-admin-ink)] md:col-span-2">Sınav<select className="admin-input mt-2" value={form.exam_id} onChange={(event) => setForm((current) => ({ ...current, exam_id: event.target.value }))}><option value="">Sınav seç</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name} · {exam.price} TL</option>)}</select></label>
        <label className="text-sm font-bold text-[var(--color-admin-ink)]">Kupon kodu<input className="admin-input mt-2 uppercase" maxLength={50} placeholder="ORN. HOSGELDIN20" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label>
        <label className="text-sm font-bold text-[var(--color-admin-ink)]">İndirim türü<select className="admin-input mt-2" value={form.discount_type} onChange={(event) => setForm((current) => ({ ...current, discount_type: event.target.value as CouponForm["discount_type"] }))}><option value="percentage">Yüzde (%)</option><option value="fixed">Sabit tutar (TL)</option></select></label>
        <label className="text-sm font-bold text-[var(--color-admin-ink)]">İndirim değeri<input className="admin-input mt-2" min={1} max={form.discount_type === "percentage" ? 99 : undefined} type="number" value={form.discount_value} onChange={(event) => setForm((current) => ({ ...current, discount_value: event.target.value }))} /></label>
        <label className="text-sm font-bold text-[var(--color-admin-ink)]">Toplam kullanım limiti<input className="admin-input mt-2" min={1} placeholder="Sınırsız" type="number" value={form.usage_limit} onChange={(event) => setForm((current) => ({ ...current, usage_limit: event.target.value }))} /></label>
        <label className="text-sm font-bold text-[var(--color-admin-ink)]">Kullanıcı başı limit<input className="admin-input mt-2" min={1} type="number" value={form.per_user_limit} onChange={(event) => setForm((current) => ({ ...current, per_user_limit: event.target.value }))} /></label>
        <label className="flex items-center gap-3 self-end rounded-2xl border border-[var(--color-admin-line)] px-4 py-3 text-sm font-bold text-[var(--color-admin-ink)]"><input checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" /> Kupon aktif</label>
        <label className="text-sm font-bold text-[var(--color-admin-ink)]">Başlangıç<input className="admin-input mt-2" type="datetime-local" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} /></label>
        <label className="text-sm font-bold text-[var(--color-admin-ink)]">Bitiş<input className="admin-input mt-2" type="datetime-local" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} /></label>
      </div>
      <div className="mt-5 flex justify-end"><button className="admin-button admin-button-primary" disabled={saving} onClick={() => void saveCoupon()} type="button"><Save size={16} /> {saving ? "Kaydediliyor..." : "Kuponu kaydet"}</button></div>
    </section> : null}

    <AdminTableCard><AdminListToolbar><AdminListToolbarRow><AdminListToolbarFields>
      <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[320px]"><input className="admin-input h-10 text-sm" placeholder="Kod veya sınav ara" value={query} onChange={(event) => setQuery(event.target.value)} /></AdminListToolbarField>
      <AdminListToolbarField className="min-w-[170px]"><select className="admin-input h-10" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="passive">Pasif</option></select></AdminListToolbarField>
    </AdminListToolbarFields><AdminListToolbarActions><AdminListToolbarIconButton onClick={() => void refresh()} title="Yenile"><RefreshCcw size={16} /></AdminListToolbarIconButton><button className="admin-button admin-button-primary" onClick={openNew} type="button"><Plus size={16} /> Yeni kupon</button></AdminListToolbarActions></AdminListToolbarRow><AdminListToolbarMeta><AdminListToolbarMetaPill>{filteredRows.length} kupon</AdminListToolbarMetaPill><AdminListToolbarMetaPill>{items.filter((item) => item.is_active).length} aktif</AdminListToolbarMetaPill></AdminListToolbarMeta></AdminListToolbar>
      {error ? <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div> : null}
      {loading ? <div className="p-5"><AdminTableSkeleton rows={6} /></div> : <AdminDataGrid columns={columns} data={filteredRows} emptyState="Henüz indirim kuponu oluşturulmadı." />}
    </AdminTableCard>
  </div>;
}
