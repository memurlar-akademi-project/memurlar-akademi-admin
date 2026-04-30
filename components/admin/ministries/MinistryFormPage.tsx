"use client";

import { Building2, ChevronDown, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { adminApiRequest } from "@/lib/admin-api";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import type { AdminMinistry } from "@/lib/types";

const emptyForm = {
  name: "",
  slug: "",
  status: "active",
};

const statusOptions = [
  {
    value: "active",
    label: "Aktif",
    description: "Sınav tanımlarında kullanılabilir durumda kalır.",
    tone: "success",
  },
  {
    value: "draft",
    label: "Taslak",
    description: "Hazırlık aşamasında görünür ama aktif akışa girmez.",
    tone: "warn",
  },
  {
    value: "passive",
    label: "Pasif",
    description: "Kayıt korunur, yeni akışlarda kullanılmaz.",
    tone: "muted",
  },
] as const;

export function MinistryFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `ministry-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !id || !token) {
      return;
    }

    let cancelled = false;

    async function loadMinistry() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ ministry: AdminMinistry }>(`/admin/ministries/${id}`, {
          token,
        });

        if (cancelled) {
          return;
        }

        setForm({
          name: response.data.ministry.name,
          slug: response.data.ministry.slug,
          status: response.data.ministry.status,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Bakanlık bilgisi yüklenemedi.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMinistry();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    setTitle(form.name.trim() || "Bakanlık Düzenle");

    return () => setTitle(null);
  }, [form.name, mode, setTitle]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ ministry: AdminMinistry }>(mode === "edit" ? `/admin/ministries/${id}` : "/admin/ministries", {
        token,
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          name: form.name,
          slug: form.slug || null,
          status: form.status,
        },
      });

      showToast({
        tone: "success",
        title: mode === "edit" ? "Bakanlık güncellendi" : "Bakanlık oluşturuldu",
        description: response.data.ministry.name,
      });

      if (mode === "edit") {
        return;
      }

      router.push("/bakanliklar");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Bakanlık kaydedilemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: mode === "edit" ? "Bakanlık güncellenemedi" : "Bakanlık oluşturulamadı",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <AdminTableCard>
          <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  Bakanlık Kaydı
                </h2>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Bu kayıt sınav ve katalog akışının en üst düğümünü temsil eder.
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-6">
            {loading ? (
              <div className="space-y-4">
                <div className="admin-skeleton h-12" />
                <div className="admin-skeleton h-12" />
                <div className="admin-skeleton h-12" />
              </div>
            ) : (
              <form className="space-y-6" id={formId} onSubmit={handleSubmit}>
                <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                  <div className="pb-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      Temel Bilgiler
                    </h3>
                  </div>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Bakanlık Adı</span>
                    <input
                      className="admin-input h-12"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Örn. Adalet Bakanlığı"
                    />
                  </label>

                  <label className="block space-y-2.5 pt-1">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Slug</span>
                    <input
                      className="admin-input h-12"
                      value={form.slug}
                      onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="Boş bırakılırsa otomatik üretilir"
                    />
                    <p className="text-xs text-[var(--color-admin-muted)]">
                      Teknik URL ve iç arama için kullanılır.
                    </p>
                  </label>
                </section>

                {error ? (
                  <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                    {error}
                  </div>
                ) : null}

              </form>
            )}
          </div>
        </AdminTableCard>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <AdminFormActionsCard
            cancelHref="/bakanliklar"
            formId={formId}
            relatedLinks={
              mode === "edit" && id
                ? [{ href: `/sinavlar?ministryId=${id}`, label: "İlgili Sınavları Gör" }]
                : []
            }
            saving={saving}
          />

          <AdminTableCard>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                    Kullanım Notu
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                    Bakanlık kaydı oluşturulduktan sonra sınav modülünde sınavlar bu bakanlığa
                    bağlanır. Ders ve konu zinciri sınav tarafında devam eder.
                  </p>
                </div>
              </div>
            </div>
          </AdminTableCard>

          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Durum
              </h3>
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <select
                    className="admin-input h-12 appearance-none pr-11"
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                    value={form.status}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-admin-muted)]">
                    <ChevronDown size={16} />
                  </span>
                </div>
                <p className="text-sm leading-6 text-[var(--color-admin-muted)]">
                  {statusOptions.find((option) => option.value === form.status)?.description}
                </p>
              </div>
            </div>
          </AdminTableCard>
        </div>
      </div>
    </div>
  );
}
