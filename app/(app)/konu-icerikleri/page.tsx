"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminApiRequest } from "@/lib/admin-api";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminList } from "@/hooks/useAdminList";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminFormCard } from "@/components/admin/AdminFormCard";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import type { AdminSubject, AdminTopic } from "@/lib/types";

type TopicContentPayload = {
  topic: {
    id: number;
    name: string;
    subject: {
      id: number;
      name: string;
    } | null;
  };
  content: {
    id: number;
    summary: string | null;
    content_body: string;
    status: string;
    version: number;
    updated_at: string | null;
  } | null;
};

const emptyForm = {
  summary: "",
  content_body: "",
  status: "active",
};

export default function TopicContentsPage() {
  const { token } = useAdminAuth();
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const {
    items: topics,
    setItems: setTopics,
    loading,
    error,
    refresh,
  } = useAdminList<AdminTopic>({
    endpoint: subjectFilter === "all" ? "/admin/topics" : `/admin/topics?subject_id=${subjectFilter}`,
    responseKey: "topics",
  });

  const [selectedTopic, setSelectedTopic] = useState<AdminTopic | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [contentVersion, setContentVersion] = useState<number | null>(null);
  const [contentUpdatedAt, setContentUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !selectedTopic) {
      return;
    }

    let cancelled = false;
    const activeTopic = selectedTopic;

    async function loadContent() {
      setLoadingContent(true);
      setFormError(null);

      try {
        const response = await adminApiRequest<TopicContentPayload>(
          `/admin/topics/${activeTopic.id}/content`,
          { token },
        );

        if (cancelled) {
          return;
        }

        setForm({
          summary: response.data.content?.summary ?? "",
          content_body: response.data.content?.content_body ?? "",
          status: response.data.content?.status ?? "active",
        });
        setContentVersion(response.data.content?.version ?? null);
        setContentUpdatedAt(response.data.content?.updated_at ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setFormError(
            loadError instanceof Error ? loadError.message : "Konu içeriği yüklenemedi.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingContent(false);
        }
      }
    }

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, [selectedTopic, token]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedTopic?.subject_id) ?? null,
    [selectedTopic, subjects],
  );

  function handleSelect(topic: AdminTopic) {
    setSelectedTopic(topic);
    setFormError(null);
    setContentVersion(null);
    setContentUpdatedAt(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTopic) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const response = await adminApiRequest<{ content: { version: number } }>(
        `/admin/topics/${selectedTopic.id}/content`,
        {
          token,
          method: "POST",
          body: {
            summary: form.summary || null,
            content_body: form.content_body,
            status: form.status,
          },
        },
      );

      setContentVersion(response.data.content.version);
      setContentUpdatedAt(new Date().toISOString());
      setTopics((current) =>
        current.map((topic) =>
          topic.id === selectedTopic.id
            ? {
                ...topic,
                content_count: (topic.content_count ?? 0) + (contentVersion ? 0 : 1),
                content_version: response.data.content.version,
              }
            : topic,
        ),
      );
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : "Konu içeriği kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkspace
      title="Konu İçerikleri"
      description="DOCX içeriğinden türeyen ders anlatımları burada versiyonlu olarak kaydedilir. Konu listesi ayrı, içerik editörü ayrı ekrandadır."
      toolbar={
        <div className="flex flex-wrap gap-3">
          <select
            className="admin-input min-w-[220px]"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          >
            <option value="all">Tüm dersler</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <button className="admin-button admin-button-secondary" onClick={refresh} type="button">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Yenile
          </button>
        </div>
      }
      list={
        <AdminDataTable<AdminTopic>
          title="İçerik Yazılacak Konular"
          subtitle="Bir konu seçildiğinde sağ panelde son versiyon yüklenir."
          columns={[
            { key: "name", header: "Konu" },
            {
              key: "subject",
              header: "Ders",
              render: (item) => item.subject?.name ?? "-",
            },
            {
              key: "content_version",
              header: "Versiyon",
              render: (item) => (item.content_version ? `v${item.content_version}` : "Henüz yok"),
            },
            { key: "status", header: "Durum" },
          ]}
          rows={topics}
          loading={loading}
          error={error}
          activeId={selectedTopic?.id ?? null}
          onSelect={handleSelect}
        />
      }
      form={
        <AdminFormCard
          title={selectedTopic ? "İçerik Editörü" : "Konu Seç"}
          description={
            selectedTopic
              ? "Kaydet işlemi yeni bir içerik versiyonu oluşturur."
              : "Önce soldan bir konu seç."
          }
        >
          {selectedTopic ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                <p className="text-sm font-semibold text-[var(--color-admin-ink)]">
                  {selectedTopic.name}
                </p>
                <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                  {selectedSubject?.name ?? "Ders bilgisi yok"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-admin-muted)]">
                  <span>Versiyon: {contentVersion ? `v${contentVersion}` : "Henüz yok"}</span>
                  <span>
                    Son kayıt: {contentUpdatedAt ? new Date(contentUpdatedAt).toLocaleString("tr-TR") : "-"}
                  </span>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Özet</span>
                <textarea
                  className="admin-input min-h-24"
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="Konu özeti"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">İçerik Gövdesi</span>
                <textarea
                  className="admin-input min-h-[420px]"
                  value={form.content_body}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content_body: event.target.value }))
                  }
                  placeholder="DOCX içeriğinden türetilen ders anlatımı"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Durum</span>
                <select
                  className="admin-input"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>

              {loadingContent ? (
                <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                  İçerik yükleniyor...
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                  {formError}
                </div>
              ) : null}

              <button className="admin-button admin-button-primary w-full" disabled={saving} type="submit">
                {saving ? "Kaydediliyor" : "Yeni Versiyonu Kaydet"}
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--color-admin-line)] px-4 py-10 text-sm text-[var(--color-admin-muted)]">
              Soldan bir konu seçildiğinde bu panelde içerik formu açılır.
            </div>
          )}
        </AdminFormCard>
      }
    />
  );
}
