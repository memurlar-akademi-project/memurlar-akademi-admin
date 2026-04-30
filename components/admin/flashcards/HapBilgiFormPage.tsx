"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminFlashcard, AdminTopic } from "@/lib/types";

const emptyForm = {
  topic_id: null as number | null,
  front_text: "",
  back_text: "",
  status: "active",
  is_free: false,
};

export function HapBilgiFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `hap-bilgi-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();

  const [form, setForm] = useState(emptyForm);
  const [flashcard, setFlashcard] = useState<AdminFlashcard | null>(null);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadTopics() {
      setTopicsLoading(true);

      try {
        const response = await adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token });

        if (!cancelled) {
          setTopics(response.data.topics);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Konular yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setTopicsLoading(false);
        }
      }
    }

    void loadTopics();

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

    async function loadCard() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ flashcard: AdminFlashcard }>(`/admin/flashcards/${id}`, { token });
        const item = response.data.flashcard;

        if (cancelled) {
          return;
        }

        setFlashcard(item);
        setForm({
          topic_id: item.topic?.id ?? item.topic_id ?? null,
          front_text: item.front_text,
          back_text: item.back_text,
          status: item.status,
          is_free: Boolean(item.is_free),
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Hap bilgi yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCard();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    const preview = form.front_text.trim();
    setTitle(preview ? preview.slice(0, 72) : "Hap Bilgi Düzenle");

    return () => setTitle(null);
  }, [form.front_text, mode, setTitle]);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === form.topic_id) ?? null,
    [form.topic_id, topics],
  );

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [topics],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!form.topic_id) {
      setError("Bir konu seçmelisin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ flashcard: AdminFlashcard }>(mode === "edit" ? `/admin/flashcards/${id}` : "/admin/flashcards", {
        token,
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          topic_id: form.topic_id,
          front_text: form.front_text,
          back_text: form.back_text,
          status: form.status,
          is_free: form.is_free,
        },
      });

      setFlashcard(response.data.flashcard);

      showToast({
        tone: "success",
        title: mode === "edit" ? "Hap bilgi güncellendi" : "Hap bilgi oluşturuldu",
        description: selectedTopic?.name ?? "Konu havuzu",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Kayıt tamamlanamadı",
        description: submitError instanceof Error ? submitError.message : "Hap bilgi kaydı başarısız oldu.",
      });
      setError(submitError instanceof Error ? submitError.message : "Hap bilgi kaydı başarısız oldu.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminTableCard>
          <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">Hap bilgi yükleniyor...</div>
        </AdminTableCard>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <AdminTableCard>
          <form className="space-y-5 px-5 py-5" id={formId} onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Konu
                </span>
                <AdminSearchSelect
                  emptyText="Kayıt bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={(next) => setForm((current) => ({ ...current, topic_id: next }))}
                  options={topicOptions}
                  placeholder="Konu ara"
                  value={form.topic_id}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Durum
                </span>
                <select
                  className="admin-input h-11"
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  value={form.status}
                >
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Ön Yüz
              </span>
              <textarea
                className="admin-input min-h-32"
                onChange={(event) => setForm((current) => ({ ...current, front_text: event.target.value }))}
                placeholder="Kısa ve çarpıcı bilgi başlığını yaz"
                value={form.front_text}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                Arka Yüz
              </span>
              <textarea
                className="admin-input min-h-44"
                onChange={(event) => setForm((current) => ({ ...current, back_text: event.target.value }))}
                placeholder="Kullanıcının göreceği açıklamayı yaz"
                value={form.back_text}
              />
            </label>

            <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
              <input
                checked={form.is_free}
                onChange={(event) => setForm((current) => ({ ...current, is_free: event.target.checked }))}
                type="checkbox"
              />
              Free akışta da göster
            </label>

            {error ? (
              <div className="rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                {error}
              </div>
            ) : null}
          </form>
        </AdminTableCard>
      </div>

      <div className="space-y-4">
        <AdminFormActionsCard
          cancelHref="/flashcardlar"
          formId={formId}
          saving={saving}
          submitLabel="Kaydet"
        />

        {mode === "edit" && flashcard?.readiness ? (
          <AdminTableCard>
            <AdminReadinessPanel entityLabel="Hap bilgi" readiness={flashcard.readiness} />
          </AdminTableCard>
        ) : null}

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Önizleme
            </h3>
            <div className="mt-4 rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                {selectedTopic?.subject?.name ?? "Ders"} · {selectedTopic?.name ?? "Konu"}
              </p>
              <p className="mt-3 text-base font-bold leading-7 text-[var(--color-admin-ink)]">
                {form.front_text || "Ön yüz metni burada görünecek."}
              </p>
              <div className="mt-4 rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3 text-sm leading-6 text-[var(--color-admin-ink)]">
                {form.back_text || "Arka yüz açıklaması burada görünecek."}
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm text-[var(--color-admin-muted)]">
              {topicsLoading
                ? "Konular yükleniyor..."
                : "Hap bilgi kartları konu bazlı çalışır. Ön yüz kısa, arka yüz ise açıklayıcı olmalıdır."}
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
