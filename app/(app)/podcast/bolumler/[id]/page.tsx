"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Music2, RefreshCcw, Volume2 } from "lucide-react";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminPodcastEpisode } from "@/lib/types";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
const apiOrigin = (() => {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "";
  }
})();

function normalizeAudioUrl(url?: string | null, path?: string | null) {
  if (!url && path) {
    return `${apiOrigin}/storage/${path.replace(/^\/+/, "")}`;
  }

  if (!url) {
    return null;
  }

  if (url.startsWith("/storage/")) {
    return `${apiOrigin}${url}`;
  }

  try {
    const parsed = new URL(url);

    if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && !parsed.port && apiOrigin) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return url;
  }

  return url;
}

function formatDuration(seconds?: number | null) {
  if (!seconds) {
    return "-";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function PodcastEpisodeDetailPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [episode, setEpisode] = useState<AdminPodcastEpisode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const episodeId = Number(params.id);
  const audioUrl = useMemo(() => normalizeAudioUrl(episode?.audio_url, episode?.audio_path), [episode?.audio_path, episode?.audio_url]);

  const loadEpisode = useCallback(async () => {
    if (!token || !episodeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ episode: AdminPodcastEpisode }>(`/admin/podcast/episodes/${episodeId}`, { token });
      setEpisode(response.data.episode);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Podcast bölümü yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [episodeId, token]);

  useEffect(() => {
    void loadEpisode();
  }, [loadEpisode]);

  useEffect(() => {
    if (!token || !episodeId || !episode?.audio_path) {
      setAudioObjectUrl(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;

    async function loadAudio() {
      setAudioLoading(true);
      setAudioError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/admin/podcast/episodes/${episodeId}/audio`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Ses dosyası yüklenemedi.");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setAudioObjectUrl(objectUrl);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setAudioError(loadError instanceof Error ? loadError.message : "Ses dosyası yüklenemedi.");
          setAudioObjectUrl(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAudioLoading(false);
        }
      }
    }

    void loadAudio();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [episode?.audio_path, episodeId, token]);

  async function handleActivate() {
    if (!token || !episode) {
      return;
    }

    setSaving(true);

    try {
      const response = await adminApiRequest<{ episode: AdminPodcastEpisode }>(`/admin/podcast/episodes/${episode.id}`, {
        token,
        method: "PUT",
        body: {
          podcast_lesson_id: episode.podcast_lesson_id,
          topic_id: episode.topic_id,
          title: episode.title,
          duration_seconds: episode.duration_seconds,
          transcript: episode.transcript ?? [],
          script_text: episode.script_text ?? null,
          script_status: episode.script_status ?? "generated",
          script_source_hash: episode.script_source_hash ?? null,
          script_generation_meta: episode.script_generation_meta ?? null,
          script_generated_at: episode.script_generated_at ?? null,
          tts_provider: episode.tts_provider ?? "elevenlabs",
          tts_voice_id: episode.tts_voice_id ?? null,
          tts_model_id: episode.tts_model_id ?? null,
          sort_order: episode.sort_order,
          is_active: true,
        },
      });

      setEpisode(response.data.episode);
      showToast({
        tone: "success",
        title: "Podcast aktif edildi",
        description: episode.title,
      });
    } catch (saveError) {
      showToast({
        tone: "error",
        title: "Podcast aktif edilemedi",
        description: saveError instanceof Error ? saveError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminTableCard>
        <div className="flex min-h-[360px] items-center justify-center gap-3 text-sm font-semibold text-[var(--color-admin-muted)]">
          <Loader2 className="animate-spin" size={18} />
          Podcast bölümü yükleniyor...
        </div>
      </AdminTableCard>
    );
  }

  if (error || !episode) {
    return (
      <AdminTableCard>
        <div className="space-y-4 p-6">
          <p className="text-sm font-semibold text-[var(--color-admin-danger)]">{error ?? "Podcast bölümü bulunamadı."}</p>
          <Link className="admin-button admin-button-secondary w-fit" href="/podcast">
            <ArrowLeft size={16} />
            Podcast&apos;e Dön
          </Link>
        </div>
      </AdminTableCard>
    );
  }

  return (
    <div className="space-y-4">
      <AdminTableCard>
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Link className="admin-button admin-button-secondary w-fit" href="/podcast">
              <ArrowLeft size={16} />
              Podcast&apos;e Dön
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-1 text-xs font-bold text-[var(--color-admin-muted)]">
                  {episode.topic?.subject?.name ?? episode.lesson?.name ?? "Podcast"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  episode.is_active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : episode.script_status === "failed"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  {episode.is_active ? "Aktif" : episode.script_status === "failed" ? "Hata" : "Draft"}
                </span>
              </div>
              <h1 className="mt-4 text-2xl font-extrabold leading-tight text-[var(--color-admin-ink)]">
                {episode.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                {episode.topic?.name ?? "Konu bağlantısı yok"} için üretilen ses kaydı.
              </p>
            </div>

            <div className="rounded-[24px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-admin-accent)] text-white">
                  <Volume2 size={22} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Ses Önizleme</p>
                  <p className="text-xs font-semibold text-[var(--color-admin-muted)]">
                    Süre: {formatDuration(episode.duration_seconds)}
                  </p>
                </div>
              </div>

              {audioLoading ? (
                <div className="mt-5 flex items-center gap-2 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-6 text-sm font-semibold text-[var(--color-admin-muted)]">
                  <Loader2 className="animate-spin" size={16} />
                  Ses dosyası hazırlanıyor...
                </div>
              ) : audioObjectUrl ? (
                <audio className="mt-5 w-full" controls preload="metadata" src={audioObjectUrl} />
              ) : audioError ? (
                <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-6 text-sm font-semibold text-rose-700">
                  {audioError}
                </div>
              ) : audioUrl ? (
                <audio className="mt-5 w-full" controls preload="metadata" src={audioUrl} />
              ) : (
                <div className="mt-5 rounded-[18px] border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-6 text-sm font-semibold text-[var(--color-admin-muted)]">
                  Ses dosyası henüz hazır değil.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-5">
              <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Bölüm Bilgisi</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Ders</dt>
                  <dd className="mt-1 font-bold text-[var(--color-admin-ink)]">{episode.topic?.subject?.name ?? episode.lesson?.name ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Konu</dt>
                  <dd className="mt-1 font-bold text-[var(--color-admin-ink)]">{episode.topic?.name ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Üretim Durumu</dt>
                  <dd className="mt-1 font-bold text-[var(--color-admin-ink)]">{episode.script_status ?? "-"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[24px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-5">
              <button
                className="admin-button admin-button-primary w-full justify-center"
                disabled={!audioUrl || saving || episode.is_active}
                onClick={handleActivate}
                type="button"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {episode.is_active ? "Podcast Aktif" : "Aktife Al"}
              </button>
              <button className="admin-button admin-button-secondary mt-3 w-full justify-center" onClick={() => void loadEpisode()} type="button">
                <RefreshCcw size={16} />
                Yenile
              </button>
            </div>
          </aside>
        </div>
      </AdminTableCard>

      {episode.script_text ? (
        <AdminTableCard>
          <div className="p-5">
            <div className="flex items-center gap-3">
              <Music2 size={18} className="text-[var(--color-admin-accent)]" />
              <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">Seslendirilen Metin</p>
            </div>
            <div className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4 text-sm leading-7 text-[var(--color-admin-ink)]">
              {episode.script_text}
            </div>
          </div>
        </AdminTableCard>
      ) : null}
    </div>
  );
}
