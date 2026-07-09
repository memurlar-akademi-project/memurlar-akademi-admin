"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, PauseCircle, Plus, RefreshCcw, Send, SquarePen, Trash2, Volume2 } from "lucide-react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPodcastEpisode, AdminPodcastLesson, AdminSubject, AdminTopic } from "@/lib/types";

const defaultVoiceId = "fXhoW006nc5Wf8xkGVSy";

export default function PodcastPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminPodcastLesson>({
    endpoint: "/admin/podcast/lessons",
    responseKey: "lessons",
  });
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: topics } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });
  const { items: episodes, refresh: refreshEpisodes } = useAdminList<AdminPodcastEpisode>({
    endpoint: "/admin/podcast/episodes",
    responseKey: "episodes",
  });

  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "passive">("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [episodeBusyId, setEpisodeBusyId] = useState<number | null>(null);
  const [generationSubjectId, setGenerationSubjectId] = useState("");
  const [generationTopicId, setGenerationTopicId] = useState("");
  const [forceAudio, setForceAudio] = useState(false);
  const [queueing, setQueueing] = useState(false);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return items.filter((item) => {
      if (selectedSubjectId !== "all" && item.subject?.id !== Number(selectedSubjectId)) {
        return false;
      }

      if (statusFilter !== "all" && (item.is_active ? "active" : "passive") !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.name, item.code, item.subject?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [items, query, selectedSubjectId, statusFilter]);

  const generationTopics = useMemo(
    () =>
      topics
        .filter((topic) => !generationSubjectId || topic.subject_id === Number(generationSubjectId))
        .sort((left, right) => left.sort_order - right.sort_order),
    [generationSubjectId, topics],
  );

  const reviewEpisodes = useMemo(
    () =>
      episodes
        .filter((episode) => episode.script_status === "sent" || episode.script_status === "generated" || episode.script_status === "failed")
        .sort((left, right) => {
          const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0;
          const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0;

          return rightTime - leftTime;
        })
        .slice(0, 8),
    [episodes],
  );

  async function handleQueueGeneration() {
    if (!token || !generationSubjectId || !generationTopicId) {
      showToast({
        tone: "warning",
        title: "Ders ve konu seç",
        description: "Podcast üretimi için önce ders ve konu seçmelisin.",
      });
      return;
    }

    setQueueing(true);

    try {
      await adminApiRequest<{ podcast: AdminPodcastEpisode }>("/admin/podcast/generate", {
        token,
        method: "POST",
        body: {
          subject_id: Number(generationSubjectId),
          topic_id: Number(generationTopicId),
          voice_id: defaultVoiceId,
          force_audio: forceAudio,
          overwrite_script: true,
        },
      });

      await Promise.all([refresh(), refreshEpisodes()]);
      showToast({
        tone: "success",
        title: "Kuyruğa gönderildi",
        description: "MP3 hazır olduğunda draft olarak bu ekranda görünecek.",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Kuyruğa alınamadı",
        description: submitError instanceof Error ? submitError.message : "Podcast üretimi başlatılamadı.",
      });
    } finally {
      setQueueing(false);
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
          script_text: item.script_text ?? null,
          script_status: item.script_status ?? "generated",
          script_source_hash: item.script_source_hash ?? null,
          script_generation_meta: item.script_generation_meta ?? null,
          script_generated_at: item.script_generated_at ?? null,
          tts_provider: item.tts_provider ?? "elevenlabs",
          tts_voice_id: item.tts_voice_id ?? defaultVoiceId,
          tts_model_id: item.tts_model_id ?? "eleven_multilingual_v2",
          sort_order: item.sort_order,
          is_active: checked,
        },
      });

      await refreshEpisodes();
      showToast({
        tone: "success",
        title: checked ? "Podcast aktif edildi" : "Podcast draft'a alındı",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Podcast durumu değişmedi",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setEpisodeBusyId(null);
    }
  }

  async function handleStatusChange(item: AdminPodcastLesson, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      const response = await adminApiRequest<{ lesson: AdminPodcastLesson }>(`/admin/podcast/lessons/${item.id}`, {
        token,
        method: "PUT",
        body: {
          subject_id: item.subject?.id ?? item.subject_id ?? null,
          code: item.code,
          name: item.name,
          sort_order: item.sort_order ?? 1,
          is_active: checked,
        },
      });

      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? response.data.lesson : entry)),
      );
      showToast({
        tone: "success",
        title: checked ? "Podcast dersi aktife alındı" : "Podcast dersi pasife alındı",
        description: item.name,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: AdminPodcastLesson) {
    if (!token) {
      return;
    }

    setBusyId(item.id);

    try {
      await adminApiRequest(`/admin/podcast/lessons/${item.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Podcast dersi silindi",
        description: item.name,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Podcast dersi silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnDef<AdminPodcastLesson>[] = [
    {
      accessorKey: "name",
      header: "Podcast Dersi",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{row.original.name}</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.subject?.name ?? "Ders bağlantısı yok"} · Kod: {row.original.code}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "episode_count",
      header: "Bölüm",
      cell: ({ row }) => <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.episode_count}</p>,
    },
    {
      accessorKey: "sort_order",
      header: "Sıra",
      cell: ({ row }) => <p className="font-semibold text-[var(--color-admin-ink)]">{row.original.sort_order ?? "-"}</p>,
    },
    {
      accessorKey: "is_active",
      header: "Durum",
      cell: ({ row }) => (
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
          row.original.is_active
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-100 text-slate-600"
        }`}>
          {row.original.is_active ? "Aktif" : "Pasif"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksiyon",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/podcast/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.is_active ? "Pasife Al" : "Aktife Al"}
            description={row.original.is_active ? "Bu podcast dersi öğrenci akışından çıkarılır." : "Bu podcast dersi tekrar aktif hale getirilir."}
            onConfirm={() => handleStatusChange(row.original, !row.original.is_active)}
            title={row.original.is_active ? "Podcast dersi pasife alınsın mı?" : "Podcast dersi aktife alınsın mı?"}
            tone={row.original.is_active ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.is_active ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Podcast Dersini Sil"
            description="Bu kayıt kalıcı olarak silinir."
            onConfirm={() => handleDelete(row.original)}
            title="Podcast dersi silinsin mi?"
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-danger)] hover:text-[var(--color-admin-danger)]">
                <Trash2 size={16} />
              </span>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminTableCard>
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Konu Podcasti Üret</p>
              <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                Dersi ve konuyu seç; sistem konu anlatımını kuyruğa gönderir, MP3 gelince kayıt draft olarak kalır.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Ders
                </span>
                <select
                  className="admin-input h-11"
                  onChange={(event) => {
                    setGenerationSubjectId(event.target.value);
                    setGenerationTopicId("");
                  }}
                  value={generationSubjectId}
                >
                  <option value="">Ders seç</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Konu
                </span>
                <select
                  className="admin-input h-11"
                  disabled={!generationSubjectId}
                  onChange={(event) => setGenerationTopicId(event.target.value)}
                  value={generationTopicId}
                >
                  <option value="">{generationSubjectId ? "Konu seç" : "Önce ders seç"}</option>
                  {generationTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
              <label className="flex items-center gap-3 text-sm font-semibold text-[var(--color-admin-ink)]">
                <input
                  checked={forceAudio}
                  onChange={(event) => setForceAudio(event.target.checked)}
                  type="checkbox"
                />
                Varsa mevcut draft sesi yeniden üret
              </label>
              <button
                className="admin-button admin-button-primary"
                disabled={queueing || !generationSubjectId || !generationTopicId}
                onClick={handleQueueGeneration}
                type="button"
              >
                {queueing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Kuyruğa Gönder
              </button>
            </div>
          </div>

          <div className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Draft Podcastler</p>
                <p className="text-xs leading-5 text-[var(--color-admin-muted)]">
                  MP3 gelince burada dinleyip aktife al.
                </p>
              </div>
              <button className="admin-button admin-button-secondary" onClick={refreshEpisodes} type="button">
                <RefreshCcw size={16} />
                Yenile
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {reviewEpisodes.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[var(--color-admin-line)] px-4 py-5 text-sm text-[var(--color-admin-muted)]">
                  Henüz kuyrukta veya draft podcast yok.
                </div>
              ) : (
                reviewEpisodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{episode.title}</p>
                        <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                          {episode.topic?.subject?.name ?? episode.lesson?.name ?? "Podcast"} · {episode.script_status}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        episode.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : episode.script_status === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}>
                        {episode.is_active ? "Aktif" : episode.script_status === "failed" ? "Hata" : "Draft"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {episode.audio_url ? (
                        <Link
                          className="admin-button admin-button-secondary"
                          href={`/podcast/bolumler/${episode.id}`}
                        >
                          <Volume2 size={16} />
                          Dinle
                        </Link>
                      ) : (
                        <span className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)]">
                          Ses bekleniyor
                        </span>
                      )}
                      <button
                        className="admin-button admin-button-primary"
                        disabled={!episode.audio_url || episodeBusyId === episode.id}
                        onClick={() => handleEpisodeStatusChange(episode, true)}
                        type="button"
                      >
                        {episodeBusyId === episode.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                        Aktife Al
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </AdminTableCard>

      <AdminTableCard>
        <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="block min-w-0 flex-1 space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Arama
                </span>
                <input
                  className="admin-input h-11 max-w-[480px]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Podcast dersi, kod veya bağlı ders ara"
                  value={query}
                />
              </label>
              <div className="flex items-center gap-2">
                <button className="admin-button admin-button-secondary" onClick={refresh} type="button">
                  <RefreshCcw size={16} />
                  Yenile
                </button>
                <Link className="admin-button admin-button-primary" href="/podcast/yeni">
                  <Plus size={16} />
                  Yeni Podcast Dersi
                </Link>
              </div>
            </div>

            <div className="rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]/65 p-3">
              <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr]">
                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Bağlı Ders
                  </span>
                  <select
                    className="admin-input h-11"
                    onChange={(event) => setSelectedSubjectId(event.target.value)}
                    value={selectedSubjectId}
                  >
                    <option value="all">Tüm dersler</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Durum
                  </span>
                  <select
                    className="admin-input h-11"
                    onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                    value={statusFilter}
                  >
                    <option value="all">Tüm durumlar</option>
                    <option value="active">Aktif</option>
                    <option value="passive">Pasif</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <AdminTableSkeleton rows={8} />
        ) : error ? (
          <div className="px-5 py-8 text-sm text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Filtrelere uygun podcast dersi bulunamadı." />
        )}
      </AdminTableCard>
    </div>
  );
}
