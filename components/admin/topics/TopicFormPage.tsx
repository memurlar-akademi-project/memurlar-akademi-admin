"use client";

import { ChevronDown, FileText, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminSubject, AdminTopic } from "@/lib/types";

type TopicContentPayload = {
  content: {
    id: number;
    summary: string | null;
    content_body: string;
    content_blocks?: Array<Record<string, unknown>> | null;
    status: string;
    version: number;
    updated_at: string | null;
  } | null;
};

const emptyForm = {
  subject_id: "",
  name: "",
  slug: "",
  sort_order: "1",
  status: "active",
  content_body: "",
  content_blocks: null as Array<Record<string, unknown>> | null,
};

const statusOptions = [
  {
    value: "active",
    label: "Aktif",
    description: "İçerik, soru ve çalışma akışında kullanılabilir.",
  },
  {
    value: "draft",
    label: "Taslak",
    description: "Hazırlık aşamasında tutulur, aktif akışlarda görünmez.",
  },
  {
    value: "passive",
    label: "Pasif",
    description: "Kayıt korunur, yeni akışlarda kullanılmaz.",
  },
] as const;

export function TopicFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `topic-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const contentSectionRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [topic, setTopic] = useState<AdminTopic | null>(null);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentVersion, setContentVersion] = useState<number | null>(null);
  const [contentUpdatedAt, setContentUpdatedAt] = useState<string | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => String(subject.id) === form.subject_id) ?? null,
    [form.subject_id, subjects],
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
        const [subjectsResponse, topicResponse] = await Promise.all([
          adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
          mode === "edit" && id
            ? adminApiRequest<{ topic: AdminTopic }>(`/admin/topics/${id}`, { token })
            : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setSubjects(subjectsResponse.data.subjects);

        if (topicResponse?.data.topic) {
          setTopic(topicResponse.data.topic);
          setForm({
            subject_id: String(topicResponse.data.topic.subject_id),
            name: topicResponse.data.topic.name,
            slug: topicResponse.data.topic.slug,
            sort_order: String(topicResponse.data.topic.sort_order),
            status: topicResponse.data.topic.status,
            content_body: "",
            content_blocks: null,
          });

          try {
            const contentResponse = await adminApiRequest<TopicContentPayload>(`/admin/topics/${topicResponse.data.topic.id}/content`, { token });

            if (!cancelled) {
              setForm((current) => ({
                ...current,
                content_body: contentResponse.data.content?.content_body ?? "",
                content_blocks: contentResponse.data.content?.content_blocks ?? null,
              }));
              setContentVersion(contentResponse.data.content?.version ?? null);
              setContentUpdatedAt(contentResponse.data.content?.updated_at ?? null);
            }
          } catch (contentLoadError) {
            if (!cancelled) {
              setError(contentLoadError instanceof Error ? contentLoadError.message : "Konu içeriği yüklenemedi.");
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Konu bilgisi yüklenemedi.");
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

    setTitle(form.name.trim() || "Konu Düzenle");

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
      const response = await adminApiRequest<{ topic: AdminTopic }>(mode === "edit" ? `/admin/topics/${id}` : "/admin/topics", {
        token,
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          subject_id: Number(form.subject_id),
          name: form.name,
          slug: form.slug || null,
          sort_order: Number(form.sort_order),
          status: form.status,
        },
      });

      const activeTopicId = response.data.topic.id;

      if (mode === "edit" || form.content_body.trim()) {
        const contentResponse = await adminApiRequest<{ content: { version: number; updated_at?: string | null } }>(`/admin/topics/${activeTopicId}/content`, {
          token,
          method: "POST",
          body: {
            summary: null,
            content_body: form.content_body,
            content_blocks: form.content_blocks,
            status: form.status,
          },
        });

        setContentVersion(contentResponse.data.content.version);
        setContentUpdatedAt(contentResponse.data.content.updated_at ?? new Date().toISOString());
      }

      setTopic(response.data.topic);
      showToast({
        tone: "success",
        title: mode === "edit" ? "Konu güncellendi" : "Konu oluşturuldu",
        description: response.data.topic.name,
      });

      if (mode === "edit") {
        return;
      }

      router.push("/konular");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Konu kaydedilemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: mode === "edit" ? "Konu güncellenemedi" : "Konu oluşturulamadı",
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
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  Konu Kaydı
                </h2>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  DOCX içindeki ana başlıkların sistem karşılığı burada açılır. Her konu bir derse bağlıdır.
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
                <div className="admin-skeleton h-12" />
              </div>
            ) : (
              <form className="space-y-6" id={formId} onSubmit={handleSubmit}>
                <section
                  className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4"
                  ref={contentSectionRef}
                >
                  <div className="pb-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      Temel Bilgiler
                    </h3>
                  </div>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Ders</span>
                    <select
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, subject_id: event.target.value }))}
                      value={form.subject_id}
                    >
                      <option value="">Ders seç</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2.5 pt-1">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Konu Adı</span>
                    <input
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Örn. Aday memurluk hükümleri"
                      value={form.name}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Slug</span>
                      <input
                        className="admin-input h-12"
                        onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                        placeholder="Boş bırakılırsa otomatik üretilir"
                        value={form.slug}
                      />
                    </label>

                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Sıra</span>
                      <input
                        className="admin-input h-12"
                        inputMode="numeric"
                        onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
                        value={form.sort_order}
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                  <div className="flex items-center justify-between gap-3 pb-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      İçerik
                    </h3>
                    {mode === "edit" ? (
                      <div className="text-xs text-[var(--color-admin-muted)]">
                        {contentVersion ? `v${contentVersion}` : "Henüz versiyon yok"}
                      </div>
                    ) : null}
                  </div>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Konu İçeriği</span>
                    <textarea
                      className="admin-input min-h-[320px] resize-y leading-7"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          content_body: event.target.value,
                          content_blocks: null,
                        }))
                      }
                      placeholder="Konu anlatımını burada düzenle."
                      value={form.content_body}
                    />
                  </label>

                  {mode === "edit" && contentUpdatedAt ? (
                    <p className="text-sm text-[var(--color-admin-muted)]">
                      Son kayıt: {new Date(contentUpdatedAt).toLocaleString("tr-TR")}
                    </p>
                  ) : null}
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
            cancelHref="/konular"
            formId={formId}
            saving={saving}
          />

          {mode === "edit" && topic?.readiness ? (
            <AdminTableCard>
              <AdminReadinessPanel
                actions={[
                  {
                    label: "İçerik Alanına Git",
                    onClick: () => contentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  },
                ]}
                entityLabel="Konu"
                readiness={topic.readiness}
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
              </div>
            </div>
          </AdminTableCard>
          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Kullanım Notu
              </h3>
              <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                <p className="text-sm leading-6 text-[var(--color-admin-muted)]">
                  Konu, ders altındaki bir ana başlıktır. İçerik, soru, hap bilgi ve podcast akışları sonrasında bu konuya bağlanır.
                </p>
                {topic ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Sıra</p>
                      <p className="mt-2 text-lg font-extrabold text-[var(--color-admin-ink)]">{topic.sort_order}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">İçerik</p>
                      <p className="mt-2 text-lg font-extrabold text-[var(--color-admin-ink)]">
                        {topic.content_version ? `v${topic.content_version}` : "-"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </AdminTableCard>
        </div>
      </div>
    </div>
  );
}
