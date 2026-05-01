"use client";

import { CalendarDays, GraduationCap, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminOrderedMultiSelect } from "@/components/admin/AdminOrderedMultiSelect";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminExam, AdminMinistry, AdminTopic } from "@/lib/types";

const emptyForm = {
  ministry_id: "",
  name: "",
  slug: "",
  status: "active",
  price: "",
  exam_date: "",
  is_active_for_signup: true,
  topic_ids: [] as number[],
};

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function ExamFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `exam-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [form, setForm] = useState(emptyForm);
  const [exam, setExam] = useState<AdminExam | null>(null);
  const [ministries, setMinistries] = useState<AdminMinistry[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name ?? "Ders bilgisi yok",
      })),
    [topics],
  );

  const selectedMinistry = useMemo(
    () => ministries.find((item) => String(item.id) === form.ministry_id),
    [ministries, form.ministry_id],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(mode === "edit");
      setError(null);

      try {
        const [ministriesResponse, topicsResponse, examResponse] = await Promise.all([
          adminApiRequest<{ ministries: AdminMinistry[] }>("/admin/ministries", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
          mode === "edit" && id
            ? adminApiRequest<{ exam: AdminExam }>(`/admin/exams/${id}`, { token })
            : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setMinistries(ministriesResponse.data.ministries);
        setTopics(topicsResponse.data.topics);

        if (examResponse?.data.exam) {
          const exam = examResponse.data.exam;
          setExam(exam);
          setForm({
            ministry_id: String(exam.ministry?.id ?? ""),
            name: exam.name,
            slug: exam.slug ?? "",
            status: exam.status,
            price: String(exam.price ?? 0),
            exam_date: toDateTimeLocalValue(exam.exam_date),
            is_active_for_signup: exam.is_active_for_signup,
            topic_ids: exam.topic_ids ?? [],
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Sınav bilgisi yüklenemedi.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    setTitle(form.name.trim() || "Sınav Düzenle");

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
      const response = await adminApiRequest<{ exam: AdminExam }>(mode === "edit" ? `/admin/exams/${id}` : "/admin/exams", {
        token,
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          ministry_id: Number(form.ministry_id),
          name: form.name,
          slug: form.slug || null,
          status: form.status,
          price: Number(form.price || 0),
          exam_date: form.exam_date ? new Date(form.exam_date).toISOString() : null,
          is_active_for_signup: form.is_active_for_signup,
          topic_ids: form.topic_ids,
        },
      });

      showToast({
        tone: "success",
        title: mode === "edit" ? "Sınav güncellendi" : "Sınav oluşturuldu",
        description: response.data.exam.name,
      });
      setExam(response.data.exam);

      if (mode === "edit") {
        return;
      }

      router.push("/sinavlar");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Sınav kaydedilemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: mode === "edit" ? "Sınav güncellenemedi" : "Sınav oluşturulamadı",
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
                <GraduationCap size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  Sınav Kaydı
                </h2>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Sınav burada tanımlanır; ortak ders kataloğundaki konular sınav kapsamına bağlanır.
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
                <div className="admin-skeleton h-40" />
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
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Bakanlık</span>
                    <select
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, ministry_id: event.target.value }))}
                      value={form.ministry_id}
                    >
                      <option value="">Bakanlık seç</option>
                      {ministries.map((ministry) => (
                        <option key={ministry.id} value={ministry.id}>
                          {ministry.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2.5 pt-1">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Sınav Adı</span>
                    <input
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Örn. Yazı İşleri Müdürlüğü Görevde Yükselme"
                      value={form.name}
                    />
                  </label>

                  <label className="block space-y-2.5 pt-1">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Slug</span>
                    <input
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="Boş bırakılırsa otomatik üretilir"
                      value={form.slug}
                    />
                  </label>
                </section>

                <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                  <div className="pb-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      Takvim ve Konular
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Yıllık Abonelik Ücreti</span>
                      <input
                        className="admin-input h-12"
                        inputMode="numeric"
                        onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                        placeholder="1490"
                        value={form.price}
                      />
                    </label>

                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Sınav Tarihi</span>
                      <input
                        className="admin-input h-12"
                        onChange={(event) => setForm((current) => ({ ...current, exam_date: event.target.value }))}
                        type="datetime-local"
                        value={form.exam_date}
                      />
                    </label>
                  </div>

                  <AdminOrderedMultiSelect
                    entityLabel="Konu"
                    entityPluralLabel="Konular"
                    helperText="Aynı ders farklı sınavlarda farklı konu kapsamıyla kullanılabilir. Burada sadece bu sınava dahil edilecek konuları seç."
                    label="Sınava Dahil Edilen Konular"
                    onChange={(topic_ids) => setForm((current) => ({ ...current, topic_ids }))}
                    options={topicOptions}
                    value={form.topic_ids}
                  />
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
            cancelHref="/sinavlar"
            formId={formId}
            relatedLinks={
              mode === "edit" && id
                ? [{ href: `/konular?examId=${id}`, label: "Sınav Konularını Gör" }]
                : []
            }
            saving={saving}
          />

          {mode === "edit" && exam?.readiness ? (
            <AdminTableCard>
              <AdminReadinessPanel
                actions={id ? [{ href: `/konular?examId=${id}`, label: "Sınav Konularına Git" }] : []}
                entityLabel="Sınav"
                readiness={exam.readiness}
              />
            </AdminTableCard>
          ) : null}

          <AdminTableCard>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                    Kayıt Durumu
                  </h3>
                  <div className="mt-4 space-y-4">
                    <select
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                      value={form.status}
                    >
                      <option value="active">Aktif</option>
                      <option value="draft">Taslak</option>
                      <option value="passive">Pasif</option>
                    </select>

                    <p className="text-sm leading-6 text-[var(--color-admin-muted)]">
                      {form.status === "active"
                        ? "Aktif sınavlar listeleme ve ilişki kurma akışında kullanılabilir."
                        : form.status === "draft"
                          ? "Taslak sınavlar hazırlık aşamasında tutulur."
                          : "Pasif sınavlar geçmiş kayıt olarak korunur."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AdminTableCard>
          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Takvim Notu
              </h3>
              <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-admin-panel-muted)] text-[var(--color-admin-muted)]">
                  <CalendarDays size={16} />
                </div>
                <div className="space-y-1 text-sm leading-6 text-[var(--color-admin-muted)]">
                  <p>
                    Sınav tarihi zorunlu değil. Netleştiğinde gün, ay, yıl ve saat ile birlikte eklenebilir.
                  </p>
                  {selectedMinistry ? <p>Seçili bakanlık: {selectedMinistry.name}</p> : null}
                </div>
              </div>
            </div>
          </AdminTableCard>
        </div>
      </div>
    </div>
  );
}
