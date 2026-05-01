"use client";

import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BookOpenText,
  ChevronDown,
  FilePenLine,
  Headphones,
  List,
  ListOrdered,
  ShieldCheck,
  TextQuote,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPodcastEpisode, AdminSubject, AdminTopic } from "@/lib/types";

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
    content_blocks?: Array<Record<string, unknown>> | null;
    status: string;
    version: number;
    updated_at: string | null;
  } | null;
};

type TopicPodcastPayload = {
  topic: {
    id: number;
    name: string;
    subject: {
      id: number;
      name: string;
    } | null;
  };
  podcast: AdminPodcastEpisode | null;
};

const emptyForm = {
  code: "",
  name: "",
  slug: "",
  status: "draft",
};

const emptyTopicEditor = {
  name: "",
  status: "draft",
  content_body: "",
  content_blocks: null as Array<Record<string, unknown>> | null,
};

const emptyPodcastEditor = {
  transcript: "",
  is_active: true,
  audio_file: null as File | null,
  audio_name: "",
  audio_url: "",
  duration_seconds: 0,
};

const statusOptions = [
  {
    value: "active",
    label: "Aktif",
    description: "Sınavlara dahil edilip konu üretiminde kullanılabilir.",
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

export function SubjectFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `subject-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [subject, setSubject] = useState<AdminSubject | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "topics">("general");

  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(mode === "edit");
  const [topicBusyId, setTopicBusyId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [topicEditor, setTopicEditor] = useState(emptyTopicEditor);
  const [topicEditorLoading, setTopicEditorLoading] = useState(false);
  const [topicModalSaving, setTopicModalSaving] = useState(false);
  const [topicDeleteBusy, setTopicDeleteBusy] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [contentVersion, setContentVersion] = useState<number | null>(null);
  const [contentUpdatedAt, setContentUpdatedAt] = useState<string | null>(null);
  const [selectedPodcastTopicId, setSelectedPodcastTopicId] = useState<number | null>(null);
  const [isPodcastModalOpen, setIsPodcastModalOpen] = useState(false);
  const [podcastEditor, setPodcastEditor] = useState(emptyPodcastEditor);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [podcastSaving, setPodcastSaving] = useState(false);
  const [podcastError, setPodcastError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !id || !token) {
      return;
    }

    let cancelled = false;

    async function loadSubject() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ subject: AdminSubject }>(`/admin/subjects/${id}`, { token });

        if (cancelled) {
          return;
        }

        setSubject(response.data.subject);
        setForm({
          code: response.data.subject.code ?? "",
          name: response.data.subject.name,
          slug: response.data.subject.slug,
          status: response.data.subject.status,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Ders bilgisi yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSubject();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit" || !id || !token) {
      return;
    }

    let cancelled = false;

    async function loadTopics() {
      setTopicsLoading(true);

      try {
        const response = await adminApiRequest<{ topics: AdminTopic[] }>(`/admin/topics?subject_id=${id}`, { token });

        if (!cancelled) {
          setTopics(response.data.topics);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Konular yüklenemedi.";
          setError(message);
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
  }, [id, mode, token]);

  const sortedTopics = useMemo(
    () => [...topics].sort((left, right) => left.sort_order - right.sort_order),
    [topics],
  );

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    setTitle(form.name.trim() || "Ders Düzenle");

    return () => {
      setTitle(null);
    };
  }, [form.name, mode, setTitle]);

  const selectedTopic = useMemo(
    () => sortedTopics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedTopicId, sortedTopics],
  );

  const selectedPodcastTopic = useMemo(
    () => sortedTopics.find((topic) => topic.id === selectedPodcastTopicId) ?? null,
    [selectedPodcastTopicId, sortedTopics],
  );

  useEffect(() => {
    if (selectedTopicId && !sortedTopics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(null);
      setIsTopicModalOpen(false);
    }
  }, [selectedTopicId, sortedTopics]);

  useEffect(() => {
    if (selectedPodcastTopicId && !sortedTopics.some((topic) => topic.id === selectedPodcastTopicId)) {
      setSelectedPodcastTopicId(null);
      setIsPodcastModalOpen(false);
    }
  }, [selectedPodcastTopicId, sortedTopics]);

  useEffect(() => {
    if (!selectedTopic || !token) {
      setTopicEditor(emptyTopicEditor);
      setContentVersion(null);
      setContentUpdatedAt(null);
      return;
    }

    let cancelled = false;
    const activeTopic = selectedTopic;

    async function loadTopicEditor() {
      setTopicEditorLoading(true);
      setTopicError(null);
      setTopicEditor((current) => ({
        ...current,
        name: activeTopic.name,
        status: activeTopic.status,
      }));

      try {
        const response = await adminApiRequest<TopicContentPayload>(`/admin/topics/${activeTopic.id}/content`, { token });

        if (cancelled) {
          return;
        }

        setTopicEditor({
          name: activeTopic.name,
          status: activeTopic.status,
          content_body: response.data.content?.content_body ?? "",
          content_blocks: response.data.content?.content_blocks ?? null,
        });
        setContentVersion(response.data.content?.version ?? null);
        setContentUpdatedAt(response.data.content?.updated_at ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setTopicError(loadError instanceof Error ? loadError.message : "Konu içeriği yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setTopicEditorLoading(false);
        }
      }
    }

    void loadTopicEditor();

    return () => {
      cancelled = true;
    };
  }, [selectedTopic, token]);

  useEffect(() => {
    if (!selectedPodcastTopic || !token || !isPodcastModalOpen) {
      setPodcastEditor(emptyPodcastEditor);
      return;
    }

    let cancelled = false;
    const activeTopic = selectedPodcastTopic;

    async function loadPodcast() {
      setPodcastLoading(true);
      setPodcastError(null);

      try {
        const response = await adminApiRequest<TopicPodcastPayload>(`/admin/topics/${activeTopic.id}/podcast`, { token });

        if (cancelled) {
          return;
        }

        const podcast = response.data.podcast;

        setPodcastEditor({
          transcript: (podcast?.transcript ?? []).join("\n"),
          is_active: podcast?.is_active ?? true,
          audio_file: null,
          audio_name: podcast?.audio_original_filename ?? "",
          audio_url: podcast?.audio_url ?? "",
          duration_seconds: podcast?.duration_seconds ?? 0,
        });
      } catch (loadError) {
        if (!cancelled) {
          setPodcastError(loadError instanceof Error ? loadError.message : "Podcast verisi yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setPodcastLoading(false);
        }
      }
    }

    void loadPodcast();

    return () => {
      cancelled = true;
    };
  }, [isPodcastModalOpen, selectedPodcastTopic, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ subject: AdminSubject }>(mode === "edit" ? `/admin/subjects/${id}` : "/admin/subjects", {
        token,
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          code: form.code || null,
          name: form.name,
          slug: form.slug || null,
          status: form.status,
        },
      });

      setSubject(response.data.subject);
      showToast({
        tone: "success",
        title: mode === "edit" ? "Ders güncellendi" : "Ders oluşturuldu",
        description: response.data.subject.name,
      });

      if (mode === "edit") {
        return;
      }

      router.push("/dersler");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Ders kaydedilemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: mode === "edit" ? "Ders güncellenemedi" : "Ders oluşturulamadı",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveTopic(topicId: number, direction: "up" | "down") {
    if (!token) {
      return;
    }

    const currentIndex = sortedTopics.findIndex((topic) => topic.id === topicId);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sortedTopics.length) {
      return;
    }

    const nextTopics = [...sortedTopics];
    const [moved] = nextTopics.splice(currentIndex, 1);
    nextTopics.splice(targetIndex, 0, moved);

    const reordered = nextTopics.map((topic, index) => ({
      ...topic,
      sort_order: index + 1,
    }));

    setTopics(reordered);
    setTopicBusyId(topicId);

    try {
      await Promise.all(
        reordered.map((topic) =>
          adminApiRequest<{ topic: AdminTopic }>(`/admin/topics/${topic.id}`, {
            token,
            method: "PUT",
            body: {
              sort_order: topic.sort_order,
            },
          }),
        ),
      );
    } catch (topicError) {
      const message = topicError instanceof Error ? topicError.message : "Konu sıralaması güncellenemedi.";
      showToast({
        tone: "error",
        title: "Sıralama kaydedilemedi",
        description: message,
      });
    } finally {
      setTopicBusyId(null);
    }
  }

  async function handleSaveTopicEditor() {
    if (!token || !selectedTopic) {
      return;
    }

    if (!topicEditor.name.trim()) {
      showToast({
        tone: "error",
        title: "Konu adı boş olamaz",
        description: "Kaydetmeden önce konu adını doldur.",
      });
      return;
    }

    if (!topicEditor.content_body.trim()) {
      showToast({
        tone: "error",
        title: "İçerik boş olamaz",
        description: "Kaydetmeden önce konu içeriğini doldur.",
      });
      return;
    }

    setTopicModalSaving(true);
    setTopicError(null);

    try {
      const topicResponse = await adminApiRequest<{ topic: AdminTopic }>(`/admin/topics/${selectedTopic.id}`, {
        token,
        method: "PUT",
        body: {
          name: topicEditor.name.trim(),
          status: topicEditor.status,
        },
      });

      const contentResponse = await adminApiRequest<{ content: { version: number } }>(`/admin/topics/${selectedTopic.id}/content`, {
        token,
        method: "POST",
        body: {
          summary: null,
          content_body: topicEditor.content_body,
          content_blocks: topicEditor.content_blocks,
          status: topicEditor.status,
        },
      });

      setTopics((current) =>
        current.map((topic) =>
          topic.id === topicResponse.data.topic.id
            ? {
                ...topic,
                ...topicResponse.data.topic,
                content_version: contentResponse.data.content.version,
                content_count: (topic.content_count ?? 0) + 1,
              }
            : topic,
        ),
      );
      setContentVersion(contentResponse.data.content.version);
      setContentUpdatedAt(new Date().toISOString());
      showToast({
        tone: "success",
        title: "Konu kaydedildi",
        description: `${topicResponse.data.topic.name} için bilgiler ve içerik güncellendi.`,
      });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Konu kaydedilemedi.";
      setTopicError(message);
      showToast({
        tone: "error",
        title: "Kayıt başarısız",
        description: message,
      });
    } finally {
      setTopicModalSaving(false);
    }
  }

  async function handleDeleteTopic(topicOverride?: AdminTopic | null) {
    const topicToDelete = topicOverride ?? selectedTopic;

    if (!token || !topicToDelete) {
      return;
    }

    setTopicDeleteBusy(true);

    try {
      await adminApiRequest(`/admin/topics/${topicToDelete.id}`, {
        token,
        method: "DELETE",
      });

      setTopics((current) => current.filter((topic) => topic.id !== topicToDelete.id));
      setIsTopicModalOpen(false);
      setSelectedTopicId((current) => (current === topicToDelete.id ? null : current));
      setSubject((current) =>
        current
          ? {
              ...current,
              topic_count: Math.max(0, current.topic_count - 1),
            }
          : current,
      );
      showToast({
        tone: "success",
        title: "Konu silindi",
        description: topicToDelete.name,
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Konu silinemedi.";
      setTopicError(message);
      showToast({
        tone: "error",
        title: "Konu silinemedi",
        description: message,
      });
    } finally {
      setTopicDeleteBusy(false);
    }
  }

  function insertIntoEditor(snippet: string) {
    const textarea = textareaRef.current;

    setTopicEditor((current) => {
      if (!textarea) {
        return {
          ...current,
          content_body: `${current.content_body}${current.content_body ? "\n\n" : ""}${snippet}`,
          content_blocks: null,
        };
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = current.content_body;
      const prefix = currentText.slice(0, start);
      const suffix = currentText.slice(end);
      const needsBreakBefore = prefix.length > 0 && !prefix.endsWith("\n");
      const needsBreakAfter = suffix.length > 0 && !suffix.startsWith("\n");
      const insertion = `${needsBreakBefore ? "\n\n" : ""}${snippet}${needsBreakAfter ? "\n\n" : ""}`;

      return {
        ...current,
        content_body: `${prefix}${insertion}${suffix}`,
        content_blocks: null,
      };
    });

    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.focus();
    });
  }

  function openTopicEditor(topicId: number) {
    setSelectedTopicId(topicId);
    setIsTopicModalOpen(true);
  }

  function openPodcastEditor(topicId: number) {
    setSelectedPodcastTopicId(topicId);
    setIsPodcastModalOpen(true);
  }

  async function handlePodcastFileChange(file: File | null) {
    if (!file) {
      setPodcastEditor((current) => ({
        ...current,
        audio_file: null,
        audio_name: "",
        audio_url: "",
        duration_seconds: 0,
      }));
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const audio = document.createElement("audio");
      audio.preload = "metadata";

      const duration = await new Promise<number>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? Math.ceil(audio.duration) : 0);
        audio.onerror = () => reject(new Error("Ses dosyası okunamadı."));
        audio.src = objectUrl;
      });

      URL.revokeObjectURL(objectUrl);

      setPodcastEditor((current) => ({
        ...current,
        audio_file: file,
        audio_name: file.name,
        audio_url: "",
        duration_seconds: duration,
      }));
    } catch (loadError) {
      setPodcastError(loadError instanceof Error ? loadError.message : "Ses dosyası okunamadı.");
    }
  }

  async function handleSaveTopicPodcast() {
    if (!token || !selectedPodcastTopic) {
      return;
    }

    if (!podcastEditor.audio_name && !podcastEditor.audio_url) {
      showToast({
        tone: "error",
        title: "Medya dosyası gerekli",
        description: "Kaydetmeden önce bir ses dosyası yükle.",
      });
      return;
    }

    setPodcastSaving(true);
    setPodcastError(null);

    try {
      const formData = new FormData();
      formData.set("transcript_text", podcastEditor.transcript);
      formData.set("is_active", podcastEditor.is_active ? "1" : "0");
      if (podcastEditor.duration_seconds > 0) {
        formData.set("duration_seconds", String(podcastEditor.duration_seconds));
      }
      if (podcastEditor.audio_file) {
        formData.set("audio_file", podcastEditor.audio_file);
      }

      await adminApiRequest<{ podcast: AdminPodcastEpisode }>(`/admin/topics/${selectedPodcastTopic.id}/podcast`, {
        token,
        method: "POST",
        body: formData,
      });

      showToast({
        tone: "success",
        title: "Podcast kaydedildi",
        description: `${selectedPodcastTopic.name} için podcast bilgisi güncellendi.`,
      });
      setIsPodcastModalOpen(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Podcast kaydedilemedi.";
      setPodcastError(message);
      showToast({
        tone: "error",
        title: "Podcast kaydedilemedi",
        description: message,
      });
    } finally {
      setPodcastSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <AdminTableCard>
          <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                <BookOpenText size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  Ders Kaydı
                </h2>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Ders burada ortak mevzuat/kategori olarak tanımlanır. Konu ve içerik yönetimi artık aynı detay ekranında yapılır.
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
              <div className="space-y-6">
                {mode === "edit" ? (
                  <div className="flex flex-wrap gap-2 border-b border-[var(--color-admin-line)] pb-4">
                    <button
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        activeTab === "general"
                          ? "bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                          : "bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-muted)]"
                      }`}
                      onClick={() => setActiveTab("general")}
                      type="button"
                    >
                      Genel Bilgiler
                    </button>
                    <button
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        activeTab === "topics"
                          ? "bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                          : "bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-muted)]"
                      }`}
                      onClick={() => setActiveTab("topics")}
                      type="button"
                    >
                      Konular ve İçerik
                    </button>
                  </div>
                ) : null}

                {activeTab === "general" || mode === "create" ? (
                  <form className="space-y-6" id={formId} onSubmit={handleSubmit}>
                    <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                      <div className="pb-1">
                        <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                          Temel Bilgiler
                        </h3>
                      </div>

                      <label className="block space-y-2.5">
                        <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Ders Adı</span>
                        <input
                          className="admin-input h-12"
                          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Örn. Devlet Memurları Kanunu"
                          value={form.name}
                        />
                      </label>

                      <label className="block space-y-2.5 pt-1">
                        <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Kanun Numarası / Kod</span>
                        <input
                          className="admin-input h-12"
                          onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                          placeholder="Örn. 657, 2709, 2911"
                          value={form.code}
                        />
                        <span className="block text-xs text-[var(--color-admin-muted)]">
                          Ders adında tekrar yazmak yerine UI rozetlerinde bu alan kullanılır.
                        </span>
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

                    {error ? (
                      <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                        {error}
                      </div>
                    ) : null}
                  </form>
                ) : null}

                {mode === "edit" && activeTab === "topics" ? (
                  <div className="space-y-5">
                    <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                            Konu Importu
                          </h3>
                          <p className="mt-2 text-sm text-[var(--color-admin-muted)]">
                            Konular ve ilk içerik versiyonları bu ders için JSON import ile açılmalı. Elle hızlı konu açma akışını kapattık.
                          </p>
                        </div>
                        <button
                          className="admin-button admin-button-secondary shrink-0"
                          onClick={() => router.push(`/konular/import?subjectId=${id}`)}
                          type="button"
                        >
                          <Upload size={16} />
                          Importa Git
                        </button>
                      </div>
                    </section>

                    <section className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]">
                        <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                                Konu Listesi
                              </h3>
                              <p className="mt-2 text-sm text-[var(--color-admin-muted)]">
                                Konuları burada sıralayıp popup editörle yönetebilirsin.
                              </p>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)]">
                              {sortedTopics.length} konu
                            </div>
                          </div>
                        </div>

                        <div className="max-h-[780px] overflow-y-auto px-4 py-4">
                          {topicsLoading ? (
                            <div className="space-y-3">
                              <div className="admin-skeleton h-16" />
                              <div className="admin-skeleton h-16" />
                              <div className="admin-skeleton h-16" />
                            </div>
                          ) : sortedTopics.length === 0 ? (
                            <div className="rounded-[18px] border border-dashed border-[var(--color-admin-line)] px-4 py-10 text-sm text-[var(--color-admin-muted)]">
                              Bu derse henüz konu eklenmemiş.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {sortedTopics.map((topic, index) => {
                                const isActive = topic.id === selectedTopicId;

                                return (
                                  <div
                                    key={topic.id}
                                    className={`rounded-[18px] border px-4 py-4 transition ${
                                      isActive && isTopicModalOpen
                                        ? "border-[var(--color-admin-accent)]/40 bg-[var(--color-admin-accent-soft)]/60"
                                        : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] hover:border-[var(--color-admin-accent)]/25"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-sm font-extrabold text-[var(--color-admin-ink)]">
                                        {topic.sort_order}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{topic.name}</p>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-admin-muted)]">
                                          <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-2.5 py-1">
                                            {topic.status === "active" ? "Aktif" : topic.status === "draft" ? "Taslak" : "Pasif"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2">
                                        <button
                                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                                          disabled={index === 0 || topicBusyId === topic.id}
                                          onClick={() => {
                                            void handleMoveTopic(topic.id, "up");
                                          }}
                                          type="button"
                                        >
                                          <ArrowUp size={15} />
                                        </button>
                                        <button
                                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                                          disabled={index === sortedTopics.length - 1 || topicBusyId === topic.id}
                                          onClick={() => {
                                            void handleMoveTopic(topic.id, "down");
                                          }}
                                          type="button"
                                        >
                                          <ArrowDown size={15} />
                                        </button>
                                        <button
                                          className="inline-flex h-9 items-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 text-xs font-semibold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35"
                                          onClick={() => openPodcastEditor(topic.id)}
                                          type="button"
                                        >
                                          <Headphones size={14} className="mr-2" />
                                          {topic.has_podcast ? "Podcast Düzenle" : "Podcast Ekle"}
                                        </button>
                                        <button
                                          className="inline-flex h-9 items-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 text-xs font-semibold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35"
                                          onClick={() => openTopicEditor(topic.id)}
                                          type="button"
                                        >
                                          <FilePenLine size={14} className="mr-2" />
                                          {(topic.content_count ?? 0) > 0 ? "İçeriği Düzenle" : "İçerik Ekle"}
                                        </button>
                                        <ConfirmDialog
                                          busy={topicDeleteBusy && selectedTopicId === topic.id}
                                          confirmLabel="Konuyu Sil"
                                          description="Bu konuya bağlı içerik kayıtları da silinir. İşlem geri alınamaz."
                                          onConfirm={() => handleDeleteTopic(topic)}
                                          title="Konuyu silmek istediğine emin misin?"
                                          trigger={
                                            <span className="inline-flex h-9 items-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 text-xs font-semibold text-[var(--color-admin-danger)] transition hover:border-[var(--color-admin-danger)]/35">
                                              <Trash2 size={14} className="mr-2" />
                                              Sil
                                            </span>
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </section>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </AdminTableCard>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          {mode === "create" || activeTab === "general" ? (
            <AdminFormActionsCard cancelHref="/dersler" formId={formId} saving={saving} />
          ) : (
            <AdminTableCard>
              <div className="px-5 py-5">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                  Konu Akışı
                </h3>
                <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm leading-6 text-[var(--color-admin-muted)]">
                  Konuları burada ekleyip sıralayabilir, seçili konunun adını güncelleyebilir ve aynı panelde içerik versiyonunu kaydedebilirsin.
                </div>
              </div>
            </AdminTableCard>
          )}

          {mode === "edit" && subject?.readiness ? (
            <AdminTableCard>
              <AdminReadinessPanel
                actions={[{ label: "Konular Sekmesini Aç", onClick: () => setActiveTab("topics") }]}
                entityLabel="Ders"
                readiness={subject.readiness}
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
                  Ders burada sadece mevzuat/kategori olarak tanımlanır. Hangi sınavda kullanılacağı sınav ekranından seçilir.
                </p>
                {subject ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Konu</p>
                      <p className="mt-2 text-lg font-extrabold text-[var(--color-admin-ink)]">{subject.topic_count}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Sınav</p>
                      <p className="mt-2 text-lg font-extrabold text-[var(--color-admin-ink)]">{subject.exam_count}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </AdminTableCard>
        </div>
      </div>

      {mode === "edit" && selectedTopic && isTopicModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-6 py-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                  Konu Editörü
                </p>
                <h3 className="mt-2 text-lg font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  {selectedTopic.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Konu bilgisi ve içerik versiyonu aynı popup içinde düzenlenir.
                </p>
              </div>
              <button
                className="rounded-xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={() => setIsTopicModalOpen(false)}
                type="button"
              >
                Kapat
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              {topicEditorLoading ? (
                <div className="space-y-3">
                  <div className="admin-skeleton h-12" />
                  <div className="admin-skeleton h-12" />
                  <div className="admin-skeleton h-72" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Konu Adı</span>
                      <input
                        className="admin-input h-12"
                        onChange={(event) =>
                          setTopicEditor((current) => ({ ...current, name: event.target.value }))
                        }
                        value={topicEditor.name}
                      />
                    </label>

                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Konu Durumu</span>
                      <div className="relative">
                        <select
                          className="admin-input h-12 appearance-none pr-11"
                          onChange={(event) =>
                            setTopicEditor((current) => ({ ...current, status: event.target.value }))
                          }
                          value={topicEditor.status}
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
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                      onClick={() => insertIntoEditor("BASLIK:\n")}
                      type="button"
                    >
                      <FilePenLine size={14} className="mr-2 inline" />
                      Başlık
                    </button>
                    <button
                      className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                      onClick={() => insertIntoEditor("Alt Başlık:\n")}
                      type="button"
                    >
                      <AlignLeft size={14} className="mr-2 inline" />
                      Alt Başlık
                    </button>
                    <button
                      className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                      onClick={() => insertIntoEditor("- ")}
                      type="button"
                    >
                      <List size={14} className="mr-2 inline" />
                      Madde
                    </button>
                    <button
                      className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                      onClick={() => insertIntoEditor("1. ")}
                      type="button"
                    >
                      <ListOrdered size={14} className="mr-2 inline" />
                      Numaralı Liste
                    </button>
                    <button
                      className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                      onClick={() => insertIntoEditor("Not:\n")}
                      type="button"
                    >
                      <TextQuote size={14} className="mr-2 inline" />
                      Not Alanı
                    </button>
                  </div>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">İçerik Editörü</span>
                    <textarea
                      ref={textareaRef}
                      className="admin-input min-h-[420px] resize-y leading-7"
                      onChange={(event) =>
                        setTopicEditor((current) => ({
                          ...current,
                          content_body: event.target.value,
                          content_blocks: null,
                        }))
                      }
                      placeholder="Konuya ait ders anlatımını burada düzenle."
                      value={topicEditor.content_body}
                    />
                  </label>

                  <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                    <p className="font-semibold text-[var(--color-admin-ink)]">Versiyon Bilgisi</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <span>Son versiyon: {contentVersion ? `v${contentVersion}` : "Henüz yok"}</span>
                      <span>
                        Son kayıt: {contentUpdatedAt ? new Date(contentUpdatedAt).toLocaleString("tr-TR") : "-"}
                      </span>
                    </div>
                  </div>

                  {topicError ? (
                    <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                      {topicError}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-admin-line)] px-6 py-5">
              <button
                className="admin-button admin-button-secondary"
                onClick={() => setIsTopicModalOpen(false)}
                type="button"
              >
                İptal
              </button>
              <button
                className="admin-button admin-button-primary"
                disabled={topicModalSaving}
                onClick={() => void handleSaveTopicEditor()}
                type="button"
              >
                {topicModalSaving ? "Kaydediliyor" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "edit" && selectedPodcastTopic && isPodcastModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-6 py-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                  Podcast Bilgisi
                </p>
                <h3 className="mt-2 text-lg font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  {selectedPodcastTopic.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Bu konuya bağlı ses dosyası, transcript ve yayın durumu burada yönetilir.
                </p>
              </div>
              <button
                className="rounded-xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={() => setIsPodcastModalOpen(false)}
                type="button"
              >
                Kapat
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              {podcastLoading ? (
                <div className="space-y-3">
                  <div className="admin-skeleton h-12" />
                  <div className="admin-skeleton h-24" />
                  <div className="admin-skeleton h-64" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Medya Dosyası</span>
                      <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                        <input
                          accept="audio/*"
                          className="block w-full text-sm text-[var(--color-admin-ink)] file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--color-admin-accent-soft)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-admin-accent)]"
                          onChange={(event) => void handlePodcastFileChange(event.target.files?.[0] ?? null)}
                          type="file"
                        />
                        <p className="mt-3 text-sm text-[var(--color-admin-muted)]">
                          {podcastEditor.audio_name || "Henüz dosya seçilmedi."}
                        </p>
                        {podcastEditor.audio_url ? (
                          <audio className="mt-4 w-full" controls src={podcastEditor.audio_url} />
                        ) : null}
                      </div>
                    </label>

                    <div className="space-y-4">
                      <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                        <p className="text-[13px] font-semibold text-[var(--color-admin-ink)]">Süre</p>
                        <p className="mt-3 text-2xl font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">
                          {podcastEditor.duration_seconds > 0
                            ? `${Math.floor(podcastEditor.duration_seconds / 60)}:${String(podcastEditor.duration_seconds % 60).padStart(2, "0")}`
                            : "--:--"}
                        </p>
                        <p className="mt-2 text-sm text-[var(--color-admin-muted)]">
                          Süre yüklenen ses dosyasından otomatik hesaplanır.
                        </p>
                      </div>

                      <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
                        <input
                          checked={podcastEditor.is_active}
                          onChange={(event) => setPodcastEditor((current) => ({ ...current, is_active: event.target.checked }))}
                          type="checkbox"
                        />
                        Aktif podcast
                      </label>
                    </div>
                  </div>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Transcript</span>
                    <textarea
                      className="admin-input min-h-[320px] resize-y leading-7"
                      onChange={(event) => setPodcastEditor((current) => ({ ...current, transcript: event.target.value }))}
                      placeholder="Transcript metnini buraya ekle."
                      value={podcastEditor.transcript}
                    />
                  </label>

                  {podcastError ? (
                    <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                      {podcastError}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--color-admin-line)] px-6 py-5">
              <button
                className="admin-button admin-button-secondary"
                onClick={() => setIsPodcastModalOpen(false)}
                type="button"
              >
                İptal
              </button>
              <button
                className="admin-button admin-button-primary"
                disabled={podcastSaving}
                onClick={() => void handleSaveTopicPodcast()}
                type="button"
              >
                {podcastSaving ? "Kaydediliyor" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
