"use client";

import {
  AudioLines,
  Clock3,
  Loader2,
  MicVocal,
  PauseCircle,
  Plus,
  SquarePen,
  Trash2,
  CheckCircle2,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPodcastEpisode, AdminPodcastLesson, AdminSubject, AdminTopic } from "@/lib/types";

const preferredVoiceId = "fXhoW006nc5Wf8xkGVSy";

const emptyLessonForm = {
  subject_id: null as number | null,
  code: "",
  name: "",
  sort_order: "1",
  is_active: true,
};

const emptyEpisodeEditor = {
  topic_id: null as number | null,
  title: "",
  duration_seconds: "300",
  transcript: "",
  script_text: "",
  script_status: "missing",
  tts_voice_id: preferredVoiceId,
  tts_model_id: "eleven_multilingual_v2",
  sort_order: "1",
  is_active: true,
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function PodcastLessonFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `podcast-lesson-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();

  const [lesson, setLesson] = useState<AdminPodcastLesson | null>(null);
  const [lessonForm, setLessonForm] = useState(emptyLessonForm);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [episodes, setEpisodes] = useState<AdminPodcastEpisode[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "episodes">("general");
  const [episodesLoading, setEpisodesLoading] = useState(mode === "edit");
  const [episodeBusyId, setEpisodeBusyId] = useState<number | null>(null);
  const [episodeSaving, setEpisodeSaving] = useState(false);
  const [scriptBusy, setScriptBusy] = useState<"script" | "audio" | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [episodeEditor, setEpisodeEditor] = useState(emptyEpisodeEditor);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadBaseData() {
      try {
        const [subjectsResponse, topicsResponse] = await Promise.all([
          adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
        ]);

        if (cancelled) {
          return;
        }

        setSubjects(subjectsResponse.data.subjects);
        setTopics(topicsResponse.data.topics);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Podcast verisi yüklenemedi.");
        }
      }
    }

    void loadBaseData();

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

    async function loadLesson() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<{ lesson: AdminPodcastLesson }>(`/admin/podcast/lessons/${id}`, { token });
        const item = response.data.lesson;

        if (cancelled) {
          return;
        }

        setLesson(item);
        setLessonForm({
          subject_id: item.subject?.id ?? item.subject_id ?? null,
          code: item.code,
          name: item.name,
          sort_order: String(item.sort_order ?? 1),
          is_active: Boolean(item.is_active),
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Podcast dersi yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLesson();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit" || !id || !token) {
      setEpisodes([]);
      setEpisodesLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);

      try {
        const response = await adminApiRequest<{ episodes: AdminPodcastEpisode[] }>(`/admin/podcast/episodes?podcast_lesson_id=${id}`, { token });

        if (!cancelled) {
          setEpisodes(response.data.episodes);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Podcast bölümleri yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setEpisodesLoading(false);
        }
      }
    }

    void loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  const sortedEpisodes = useMemo(
    () => [...episodes].sort((left, right) => left.sort_order - right.sort_order),
    [episodes],
  );

  const selectedEpisode = useMemo(
    () => sortedEpisodes.find((episode) => episode.id === selectedEpisodeId) ?? null,
    [selectedEpisodeId, sortedEpisodes],
  );

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    setTitle(lessonForm.name.trim() || "Podcast Dersi Düzenle");

    return () => {
      setTitle(null);
    };
  }, [lessonForm.name, mode, setTitle]);

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [topics],
  );

  useEffect(() => {
    if (!selectedEpisode) {
      setEpisodeEditor(emptyEpisodeEditor);
      return;
    }

    setEpisodeEditor({
      topic_id: selectedEpisode.topic_id ?? null,
      title: selectedEpisode.title,
      duration_seconds: String(selectedEpisode.duration_seconds),
      transcript: (selectedEpisode.transcript ?? []).join("\n"),
      script_text: selectedEpisode.script_text ?? "",
      script_status: selectedEpisode.script_status ?? "missing",
      tts_voice_id: selectedEpisode.tts_voice_id ?? "",
      tts_model_id: selectedEpisode.tts_model_id ?? "eleven_multilingual_v2",
      sort_order: String(selectedEpisode.sort_order),
      is_active: selectedEpisode.is_active,
    });
  }, [selectedEpisode]);

  async function handleLessonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ lesson: AdminPodcastLesson }>(
        mode === "edit" ? `/admin/podcast/lessons/${id}` : "/admin/podcast/lessons",
        {
          token,
          method: mode === "edit" ? "PUT" : "POST",
          body: {
            subject_id: lessonForm.subject_id,
            code: lessonForm.code,
            name: lessonForm.name,
            sort_order: Number(lessonForm.sort_order || 1),
            is_active: lessonForm.is_active,
          },
        },
      );

      setLesson(response.data.lesson);
      showToast({
        tone: "success",
        title: mode === "edit" ? "Podcast dersi güncellendi" : "Podcast dersi oluşturuldu",
        description: lessonForm.name,
      });

      if (mode === "create" && response.data.lesson.id) {
        router.replace(`/podcast/${response.data.lesson.id}/duzenle`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Podcast dersi kaydedilemedi.");
      showToast({
        tone: "error",
        title: "Kayıt tamamlanamadı",
        description: submitError instanceof Error ? submitError.message : "Podcast dersi kaydedilemedi.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function refreshEpisodes() {
    if (!id || !token) {
      return;
    }

    const response = await adminApiRequest<{ episodes: AdminPodcastEpisode[] }>(`/admin/podcast/episodes?podcast_lesson_id=${id}`, { token });
    setEpisodes(response.data.episodes);
  }

  async function handleEpisodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !id) {
      return;
    }

    setEpisodeSaving(true);
    setError(null);

    try {
      await adminApiRequest(
        selectedEpisode ? `/admin/podcast/episodes/${selectedEpisode.id}` : "/admin/podcast/episodes",
        {
          token,
          method: selectedEpisode ? "PUT" : "POST",
          body: {
            podcast_lesson_id: id,
            topic_id: episodeEditor.topic_id,
            title: episodeEditor.title,
            duration_seconds: Number(episodeEditor.duration_seconds || 0),
            transcript: episodeEditor.transcript
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            script_text: episodeEditor.script_text.trim() || null,
            script_status: episodeEditor.script_text.trim() ? episodeEditor.script_status || "ready" : "missing",
            tts_provider: "elevenlabs",
            tts_voice_id: preferredVoiceId,
            tts_model_id: "eleven_multilingual_v2",
            sort_order: Number(episodeEditor.sort_order || 1),
            is_active: episodeEditor.is_active,
          },
        },
      );

      await refreshEpisodes();
      setSelectedEpisodeId(null);
      setIsEpisodeModalOpen(false);
      setEpisodeEditor(emptyEpisodeEditor);
      showToast({
        tone: "success",
        title: selectedEpisode ? "Bölüm güncellendi" : "Bölüm oluşturuldu",
        description: episodeEditor.title || lessonForm.name,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Podcast bölümü kaydedilemedi.");
      showToast({
        tone: "error",
        title: "Bölüm kaydedilemedi",
        description: submitError instanceof Error ? submitError.message : "Podcast bölümü kaydedilemedi.",
      });
    } finally {
      setEpisodeSaving(false);
    }
  }

  async function handleGenerateScript() {
    if (!token || !id || !episodeEditor.topic_id) {
      showToast({
        tone: "warning",
        title: "Önce konu seç",
        description: "Script üretimi konu anlatımı üzerinden yapılır.",
      });
      return;
    }

    setScriptBusy("script");

    try {
      const response = await adminApiRequest<{ podcast: AdminPodcastEpisode }>(
        `/admin/topics/${episodeEditor.topic_id}/podcast/script`,
        {
          token,
          method: "POST",
          body: {
            podcast_lesson_id: id,
            max_characters: 10000,
            overwrite: Boolean(episodeEditor.script_text.trim()),
            tts_provider: "elevenlabs",
            tts_voice_id: preferredVoiceId,
            tts_model_id: "eleven_multilingual_v2",
          },
        },
      );

      const podcast = response.data.podcast;

      setEpisodeEditor((current) => ({
        ...current,
        title: podcast.title || current.title,
        duration_seconds: String(podcast.duration_seconds || current.duration_seconds || 300),
        script_text: podcast.script_text ?? "",
        script_status: podcast.script_status ?? "ready",
        tts_voice_id: podcast.tts_voice_id ?? preferredVoiceId,
        tts_model_id: podcast.tts_model_id ?? "eleven_multilingual_v2",
        sort_order: String(podcast.sort_order || current.sort_order),
        is_active: Boolean(podcast.is_active),
      }));
      setSelectedEpisodeId(podcast.id);
      await refreshEpisodes();
      showToast({
        tone: "success",
        title: "Script hazır",
        description: `${podcast.script_character_count ?? (podcast.script_text ?? "").length} karakterlik seslendirme metni üretildi.`,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Script üretilemedi",
        description: submitError instanceof Error ? submitError.message : "Konu anlatımı script'e çevrilemedi.",
      });
    } finally {
      setScriptBusy(null);
    }
  }

  async function handleSynthesizeAudio() {
    if (!token || !id || !episodeEditor.topic_id) {
      showToast({
        tone: "warning",
        title: "Önce konu seç",
        description: "Ses üretimi için konu bağlantısı gerekli.",
      });
      return;
    }

    setScriptBusy("audio");

    try {
      const response = await adminApiRequest<{ podcast: AdminPodcastEpisode }>(
        `/admin/topics/${episodeEditor.topic_id}/podcast/synthesize`,
        {
          token,
          method: "POST",
          body: {
            podcast_lesson_id: id,
            max_characters: 10000,
            force_audio: Boolean(selectedEpisode?.audio_url),
            script_text: episodeEditor.script_text.trim() || null,
            voice_id: preferredVoiceId,
            model_id: "eleven_multilingual_v2",
          },
        },
      );

      const podcast = response.data.podcast;

      setEpisodeEditor((current) => ({
        ...current,
        title: podcast.title || current.title,
        duration_seconds: String(podcast.duration_seconds || current.duration_seconds || 300),
        script_text: podcast.script_text ?? current.script_text,
        script_status: podcast.script_status ?? "generated",
        tts_voice_id: podcast.tts_voice_id ?? preferredVoiceId,
        tts_model_id: podcast.tts_model_id ?? "eleven_multilingual_v2",
        sort_order: String(podcast.sort_order || current.sort_order),
        is_active: true,
      }));
      setSelectedEpisodeId(podcast.id);
      await refreshEpisodes();
      showToast({
        tone: "success",
        title: "Ses üretildi",
        description: podcast.audio_original_filename ?? "MP3 dosyası podcast bölümüne bağlandı.",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Ses üretilemedi",
        description: submitError instanceof Error ? submitError.message : "Ses üretimi tamamlanamadı.",
      });
    } finally {
      setScriptBusy(null);
    }
  }

  async function handleEpisodeStatusChange(item: AdminPodcastEpisode, checked: boolean) {
    if (!token) {
      return;
    }

    setEpisodeBusyId(item.id);

    try {
      await adminApiRequest(`/admin/podcast/episodes/${item.id}`, {
        token,
        method: "PUT",
        body: {
          podcast_lesson_id: item.podcast_lesson_id,
          topic_id: item.topic_id,
          title: item.title,
          duration_seconds: item.duration_seconds,
          transcript: item.transcript ?? [],
          sort_order: item.sort_order,
          is_active: checked,
        },
      });

      await refreshEpisodes();
      showToast({
        tone: "success",
        title: checked ? "Bölüm aktife alındı" : "Bölüm pasife alındı",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setEpisodeBusyId(null);
    }
  }

  async function handleEpisodeDelete(item: AdminPodcastEpisode) {
    if (!token) {
      return;
    }

    setEpisodeBusyId(item.id);

    try {
      await adminApiRequest(`/admin/podcast/episodes/${item.id}`, {
        token,
        method: "DELETE",
      });

      await refreshEpisodes();
      showToast({
        tone: "success",
        title: "Bölüm silindi",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Bölüm silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setEpisodeBusyId(null);
    }
  }

  if (loading) {
    return (
      <AdminTableCard>
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">Podcast dersi yükleniyor...</div>
      </AdminTableCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <AdminTableCard>
          <div className="border-b border-[var(--color-admin-line)] px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "general", label: "Genel Bilgiler" },
                { key: "episodes", label: "Bölümler", disabled: mode === "create" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-[var(--color-admin-accent)] text-white"
                      : "bg-[var(--color-admin-panel-soft)] text-[var(--color-admin-muted)]"
                  } ${tab.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  disabled={Boolean(tab.disabled)}
                  onClick={() => setActiveTab(tab.key as "general" | "episodes")}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "general" ? (
            <form className="space-y-5 px-5 py-5" id={formId} onSubmit={handleLessonSubmit}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Bağlı Ders
                  </span>
                  <select
                    className="admin-input h-11"
                    onChange={(event) =>
                      setLessonForm((current) => ({
                        ...current,
                        subject_id: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                    value={lessonForm.subject_id ?? ""}
                  >
                    <option value="">Opsiyonel ders seç</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Kod
                  </span>
                  <input
                    className="admin-input h-11"
                    onChange={(event) => setLessonForm((current) => ({ ...current, code: event.target.value }))}
                    value={lessonForm.code}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Sıra
                  </span>
                  <input
                    className="admin-input h-11"
                    onChange={(event) => setLessonForm((current) => ({ ...current, sort_order: event.target.value }))}
                    value={lessonForm.sort_order}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Ad
                </span>
                <input
                  className="admin-input h-11"
                  onChange={(event) => setLessonForm((current) => ({ ...current, name: event.target.value }))}
                  value={lessonForm.name}
                />
              </label>

              <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
                <input
                  checked={lessonForm.is_active}
                  onChange={(event) => setLessonForm((current) => ({ ...current, is_active: event.target.checked }))}
                  type="checkbox"
                />
                Aktif ders
              </label>

              {error ? (
                <div className="rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                  {error}
                </div>
              ) : null}
            </form>
          ) : (
            <div className="space-y-4 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--color-admin-ink)]">Podcast Bölümleri</p>
                  <p className="text-sm text-[var(--color-admin-muted)]">
                    Dersi seçtikten sonra bölümleri burada yönetebilirsin.
                  </p>
                </div>
                <button
                  className="admin-button admin-button-primary"
                  onClick={() => {
                    setSelectedEpisodeId(null);
                    setEpisodeEditor({
                      ...emptyEpisodeEditor,
                      sort_order: String((sortedEpisodes.at(-1)?.sort_order ?? 0) + 1),
                    });
                    setIsEpisodeModalOpen(true);
                  }}
                  type="button"
                >
                  <Plus size={16} />
                  Yeni Bölüm
                </button>
              </div>

              <div className="space-y-2">
                {episodesLoading ? (
                  <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-5 text-sm text-[var(--color-admin-muted)]">
                    Bölümler yükleniyor...
                  </div>
                ) : sortedEpisodes.length === 0 ? (
                  <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-5 text-sm text-[var(--color-admin-muted)]">
                    Henüz bölüm eklenmedi.
                  </div>
                ) : (
                  sortedEpisodes.map((episode) => (
                    <div
                      key={episode.id}
                      className="grid items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3 md:grid-cols-[64px_minmax(0,1fr)_auto]"
                    >
                      <div className="text-sm font-bold text-[var(--color-admin-muted)]">#{episode.sort_order}</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{episode.title}</p>
                        <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                          {episode.topic?.name ?? "Konu yok"} · {formatDuration(episode.duration_seconds)} ·{" "}
                          {episode.script_status === "generated" ? "Ses üretildi" : episode.script_status === "ready" ? "Script hazır" : `${(episode.transcript ?? []).length} satır transkript`}
                          {episode.audio_original_filename ? ` · ${episode.audio_original_filename}` : ""}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                          onClick={() => {
                            setSelectedEpisodeId(episode.id);
                            setIsEpisodeModalOpen(true);
                          }}
                          type="button"
                        >
                          <SquarePen size={16} />
                        </button>
                        <ConfirmDialog
                          busy={episodeBusyId === episode.id}
                          confirmLabel={episode.is_active ? "Pasife Al" : "Aktife Al"}
                          description={episode.is_active ? "Bu bölüm öğrenci akışından çıkarılır." : "Bu bölüm tekrar aktif hale getirilir."}
                          onConfirm={() => handleEpisodeStatusChange(episode, !episode.is_active)}
                          title={episode.is_active ? "Bölüm pasife alınsın mı?" : "Bölüm aktife alınsın mı?"}
                          tone={episode.is_active ? "danger" : "primary"}
                          trigger={
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                              {episode.is_active ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
                            </span>
                          }
                        />
                        <ConfirmDialog
                          busy={episodeBusyId === episode.id}
                          confirmLabel="Bölümü Sil"
                          description="Bu bölüm kalıcı olarak silinir."
                          onConfirm={() => handleEpisodeDelete(episode)}
                          title="Bölüm silinsin mi?"
                          trigger={
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-danger)] hover:text-[var(--color-admin-danger)]">
                              <Trash2 size={16} />
                            </span>
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </AdminTableCard>

        {isEpisodeModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <form className="space-y-5 p-6" onSubmit={handleEpisodeSubmit}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-admin-ink)]">
                      {selectedEpisode ? "Podcast Bölümü Düzenle" : "Yeni Podcast Bölümü"}
                    </h3>
                    <p className="text-sm text-[var(--color-admin-muted)]">
                      Konu anlatımından script oluştur, gerekirse düzenle ve sesi aynı ekranda üret.
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-[var(--color-admin-line)] px-4 py-2 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                    onClick={() => {
                      setIsEpisodeModalOpen(false);
                      setSelectedEpisodeId(null);
                    }}
                    type="button"
                  >
                    Kapat
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                  <label className="block space-y-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                      Konu
                    </span>
                    <AdminSearchSelect
                      emptyText="Kayıt bulunamadı."
                      hideLabel
                      label="Konu"
                      onChange={(next) => setEpisodeEditor((current) => ({ ...current, topic_id: next }))}
                      options={topicOptions}
                      placeholder="Konu ara"
                      value={episodeEditor.topic_id}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                      Süre (sn)
                    </span>
                    <input
                      className="admin-input h-11"
                      onChange={(event) => setEpisodeEditor((current) => ({ ...current, duration_seconds: event.target.value }))}
                      value={episodeEditor.duration_seconds}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                      Sıra
                    </span>
                    <input
                      className="admin-input h-11"
                      onChange={(event) => setEpisodeEditor((current) => ({ ...current, sort_order: event.target.value }))}
                      value={episodeEditor.sort_order}
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Başlık
                  </span>
                  <input
                    className="admin-input h-11"
                    onChange={(event) => setEpisodeEditor((current) => ({ ...current, title: event.target.value }))}
                    value={episodeEditor.title}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Transkript
                  </span>
                  <textarea
                    className="admin-input min-h-72"
                    onChange={(event) => setEpisodeEditor((current) => ({ ...current, transcript: event.target.value }))}
                    placeholder="Her satırı ayrı paragraf gibi girebilirsin."
                    value={episodeEditor.transcript}
                  />
                </label>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="space-y-3 rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Seslendirme Scripti</p>
                        <p className="text-xs leading-5 text-[var(--color-admin-muted)]">
                          Konu anlatımındaki başlık tekrarları temizlenir, madde satırları konuşmaya uygun hale getirilir.
                        </p>
                      </div>
                      <button
                        className="admin-button admin-button-secondary"
                        disabled={scriptBusy !== null}
                        onClick={handleGenerateScript}
                        type="button"
                      >
                        {scriptBusy === "script" ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />}
                        {episodeEditor.script_text.trim() ? "Scripti Yenile" : "Script Oluştur"}
                      </button>
                    </div>

                    <textarea
                      className="admin-input min-h-80"
                      onChange={(event) =>
                        setEpisodeEditor((current) => ({
                          ...current,
                          script_text: event.target.value,
                          script_status: event.target.value.trim() ? "ready" : "missing",
                        }))
                      }
                      placeholder="Konu seçip Script Oluştur butonuna basınca seslendirilecek metin burada oluşur."
                      value={episodeEditor.script_text}
                    />

                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-admin-muted)]">
                      <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-1">
                        Durum: {episodeEditor.script_status || "missing"}
                      </span>
                      <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 py-1">
                        {episodeEditor.script_text.length.toLocaleString("tr-TR")} karakter
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
                    <div>
                      <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Ses Dosyası</p>
                      <p className="text-xs leading-5 text-[var(--color-admin-muted)]">
                        Script hazırsa sesi üretip draft olarak dinleyebilirsin.
                      </p>
                    </div>

                    {selectedEpisode?.audio_url ? (
                      <a
                        className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3 text-sm font-bold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                        href={selectedEpisode.audio_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Volume2 size={16} />
                        Üretilen Sesi Aç
                      </a>
                    ) : null}

                    <button
                      className="admin-button admin-button-primary w-full justify-center"
                      disabled={scriptBusy !== null}
                      onClick={handleSynthesizeAudio}
                      type="button"
                    >
                      {scriptBusy === "audio" ? <Loader2 className="animate-spin" size={16} /> : <Volume2 size={16} />}
                      {selectedEpisode?.audio_url ? "Sesi Yeniden Üret" : "Sesi Üret"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <label className="flex items-center gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)]">
                    <input
                      checked={episodeEditor.is_active}
                      onChange={(event) => setEpisodeEditor((current) => ({ ...current, is_active: event.target.checked }))}
                      type="checkbox"
                    />
                    Aktif bölüm
                  </label>

                  <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm text-[var(--color-admin-muted)]">
                    Otomatik transkript mümkün:
                    sistem tarafında ses dosyası + STT servisi gerekir. Şu an bu alan manuel tutuluyor.
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    className="admin-button admin-button-secondary"
                    onClick={() => {
                      setIsEpisodeModalOpen(false);
                      setSelectedEpisodeId(null);
                    }}
                    type="button"
                  >
                    İptal
                  </button>
                  <button className="admin-button admin-button-primary" disabled={episodeSaving} type="submit">
                    {episodeSaving ? "Kaydediliyor" : "Kaydet"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <AdminFormActionsCard
          cancelHref="/podcast"
          formId={formId}
          saving={saving}
          submitLabel="Kaydet"
        />

        <AdminTableCard>
          <div className="px-5 py-5">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Özet
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                <AudioLines size={18} className="mt-0.5 text-[var(--color-admin-accent)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-admin-ink)]">{lessonForm.name || "Podcast dersi adı"}</p>
                  <p className="text-sm text-[var(--color-admin-muted)]">Kod: {lessonForm.code || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                <MicVocal size={18} className="mt-0.5 text-[var(--color-admin-accent)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-admin-ink)]">{sortedEpisodes.length} bölüm</p>
                  <p className="text-sm text-[var(--color-admin-muted)]">
                    {mode === "edit" ? "Bölümler ders detayında yönetilir." : "Önce dersi kaydedince bölüm ekleyebilirsin."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                <Clock3 size={18} className="mt-0.5 text-[var(--color-admin-accent)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-admin-ink)]">Transkript otomasyonu mümkün</p>
                  <p className="text-sm text-[var(--color-admin-muted)]">
                    Ses dosyası yükleme + speech-to-text servisiyle otomatik transkript üretebiliriz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AdminTableCard>
      </div>
    </div>
  );
}
