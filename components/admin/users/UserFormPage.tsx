"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminUser } from "@/lib/types";

type ExamOption = {
  id: number;
  name: string;
  ministry_name: string | null;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  status: "active",
  exam_id: null as number | null,
  membership_type: "paid",
  membership_status: "active",
};

export function UserFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { setTitle } = useAdminPageMeta();
  const formId = `user-form-${mode}-${id ?? "new"}`;

  const [form, setForm] = useState(emptyForm);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    const nextTitle = form.name.trim() || "Kullanıcı Düzenle";
    setTitle(nextTitle);

    return () => setTitle(null);
  }, [form.name, mode, setTitle]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadExams() {
      try {
        const response = await adminApiRequest<{ exams: ExamOption[] }>("/admin/users/options/exams", { token });

        if (!cancelled) {
          setExams(response.data.exams);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Sınav seçenekleri yüklenemedi.");
        }
      }
    }

    void loadExams();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (mode !== "edit" || !id || !token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadUser() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ user: AdminUser }>(`/admin/users/${id}`, { token });
        const item = response.data.user;

        if (cancelled) {
          return;
        }

        setUser(item);
        setForm({
          name: item.name,
          email: item.email,
          password: "",
          status: item.status,
          exam_id: item.membership?.exam?.id ?? null,
          membership_type: item.membership?.type ?? "paid",
          membership_status: item.membership?.status ?? item.status,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Kullanıcı yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  const examOptions = useMemo(
    () =>
      exams.map((exam) => ({
        id: exam.id,
        label: exam.name,
        hint: exam.ministry_name ?? undefined,
      })),
    [exams],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!form.exam_id) {
      setError("Bir sınav seçmelisin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ user: AdminUser }>(
        mode === "edit" ? `/admin/users/${id}` : "/admin/users",
        {
          token,
          method: mode === "edit" ? "PUT" : "POST",
          body: {
            name: form.name,
            email: form.email,
            password: form.password || undefined,
            status: form.status,
            exam_id: form.exam_id,
            membership_type: form.membership_type,
            membership_status: form.membership_status,
          },
        },
      );

      setUser(response.data.user);
      setForm((current) => ({
        ...current,
        password: "",
      }));

      showToast({
        tone: "success",
        title: mode === "edit" ? "Kullanıcı güncellendi" : "Kullanıcı oluşturuldu",
        description: response.data.user.email,
      });

      if (mode === "create") {
        router.replace(`/kullanicilar/${response.data.user.id}/duzenle`);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Kullanıcı kaydı başarısız oldu.";
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
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">Kullanıcı yükleniyor...</div>
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
                  Ad Soyad
                </span>
                <input
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Kullanıcı adı"
                  value={form.name}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  E-posta
                </span>
                <input
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="ornek@mail.com"
                  type="email"
                  value={form.email}
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Durum
                </span>
                <select
                  className="admin-input h-11"
                  onChange={(event) => {
                    const nextStatus = event.target.value as "active" | "passive";
                    setForm((current) => ({
                      ...current,
                      status: nextStatus,
                      membership_status: nextStatus,
                    }));
                  }}
                  value={form.status}
                >
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Üyelik Tipi
                </span>
                <select
                  className="admin-input h-11"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, membership_type: event.target.value as "free" | "paid" }))
                  }
                  value={form.membership_type}
                >
                  <option value="free">Free</option>
                  <option value="paid">Ücretli</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Üyelik Durumu
                </span>
                <select
                  className="admin-input h-11"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, membership_status: event.target.value as "active" | "passive" }))
                  }
                  value={form.membership_status}
                >
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Sınav
              </span>
              <AdminSearchSelect
                emptyText="Sınav bulunamadı."
                hideLabel
                label="Sınav"
                onChange={(next) => setForm((current) => ({ ...current, exam_id: next }))}
                options={examOptions}
                placeholder="Sınav seç"
                value={form.exam_id}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                {mode === "edit" ? "Yeni Şifre" : "Şifre"}
              </span>
              <input
                className="admin-input h-11"
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={mode === "edit" ? "Boş bırakırsan değişmez" : "En az 8 karakter"}
                type="password"
                value={form.password}
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-[var(--color-admin-danger)]/20 bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                {error}
              </div>
            ) : null}
          </form>
        </AdminTableCard>
      </div>

      <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
        <AdminFormActionsCard cancelHref="/kullanicilar" formId={formId} saving={saving} />

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Özet
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Bağlı sınav</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">
                  {exams.find((exam) => exam.id === form.exam_id)?.name ?? "Seçilmedi"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Sipariş sayısı</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{user?.order_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-admin-muted)]">Toplam harcama</span>
                <span className="font-semibold text-[var(--color-admin-ink)]">{user?.total_spent ?? 0} TL</span>
              </div>
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
