"use client";

import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Camera,
  CircleCheck,
  Film,
  ImageIcon,
  Layers3,
  LoaderCircle,
  RefreshCcw,
  Send,
  Share2,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";

type Channel = "facebook" | "instagram";
type ContentType = "text" | "link" | "single" | "carousel" | "video" | "reel" | "story";
type MediaItem = {
  url: string;
  type: "image" | "video";
  mime_type: string | null;
  name: string | null;
};
type SelectedMedia = {
  id: string;
  file: File;
  previewUrl: string;
  type: "image" | "video";
};
type PublicationStatus =
  | "draft"
  | "awaiting_publish_approval"
  | "approved"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

type SocialPublication = {
  id: number;
  channel: Channel;
  content_type: ContentType;
  caption: string;
  media_url: string | null;
  media_items: MediaItem[];
  publish_settings: {
    link_url?: string;
    share_to_feed?: boolean;
    cover_url?: string;
  };
  is_ai_generated: boolean;
  status: PublicationStatus;
  approval_requested_at: string | null;
  approved_at: string | null;
  approval_expires_at: string | null;
  published_at: string | null;
  external_id: string | null;
  last_error: string | null;
  publish_attempts: number;
  created_at: string | null;
  updated_at: string | null;
};

const statusLabels: Record<PublicationStatus, string> = {
  draft: "Taslak",
  awaiting_publish_approval: "Yayın onayı bekliyor",
  approved: "Yayın için onaylandı",
  publishing: "Yayınlanıyor",
  published: "Yayınlandı",
  failed: "Başarısız",
  cancelled: "İptal edildi",
};

const contentTypeLabels: Record<ContentType, string> = {
  text: "Metin",
  link: "Link",
  single: "Tek Görsel",
  carousel: "Carousel",
  video: "Video",
  reel: "Reels",
  story: "Story",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SocialMediaPage() {
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [publications, setPublications] = useState<SocialPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [channel, setChannel] = useState<Channel>("instagram");
  const [contentType, setContentType] = useState<ContentType>("single");
  const [caption, setCaption] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [shareToFeed, setShareToFeed] = useState(true);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const selectedMediaRef = useRef<SelectedMedia[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await adminApiRequest<{ publications: SocialPublication[] }>("/admin/social-publications?per_page=50", { token });
      setPublications(response.data.publications);
    } catch (error) {
      showToast({ title: "Sosyal medya taslakları alınamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    setTitle("Sosyal Medya");
  }, [setTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

  useEffect(() => () => {
    selectedMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  function selectMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const supportedTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];

    if (files.some((file) => !supportedTypes.includes(file.type))) {
      showToast({ title: "JPG, PNG, WebP, MP4 veya MOV dosyası seçmelisin", tone: "error" });
      event.target.value = "";
      return;
    }
    if (files.some((file) => file.size > 1024 * 1024 * 1024)) {
      showToast({ title: "Her dosya en fazla 1 GB olabilir", tone: "error" });
      event.target.value = "";
      return;
    }
    if (selectedMedia.length + files.length > 10) {
      showToast({ title: "Bir gönderiye en fazla 10 medya eklenebilir", tone: "error" });
      event.target.value = "";
      return;
    }

    const additions = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? "video" as const : "image" as const,
    }));
    setSelectedMedia((current) => [...current, ...additions]);
    if (selectedMedia.length + additions.length > 1) setContentType("carousel");
    event.target.value = "";
  }

  function clearMedia() {
    selectedMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setSelectedMedia([]);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  }

  function removeMedia(id: string) {
    setSelectedMedia((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function moveMedia(index: number, direction: -1 | 1) {
    setSelectedMedia((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function uploadSelectedFile(file: File): Promise<MediaItem> {
    if (!token) throw new Error("Yönetici oturumu bulunamadı.");
    const initialized = await adminApiRequest<{ upload_id: string; chunk_size: number; total_chunks: number }>(
      "/admin/social-publications/media/uploads",
      {
        method: "POST",
        token,
        body: { name: file.name, size: file.size, mime_type: file.type },
      },
    );

    const { upload_id: uploadId, chunk_size: chunkSize, total_chunks: totalChunks } = initialized.data;
    for (let index = 0; index < totalChunks; index += 1) {
      setUploadProgress(`${file.name} · ${index + 1}/${totalChunks} parça`);
      const chunkData = new FormData();
      chunkData.append("chunk", file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)), `${index}.part`);
      await adminApiRequest(`/admin/social-publications/media/uploads/${uploadId}/chunks/${index}`, {
        method: "POST",
        token,
        body: chunkData,
      });
    }

    const finalized = await adminApiRequest<{ media_url: string; media_item: MediaItem }>(
      `/admin/social-publications/media/uploads/${uploadId}/finalize`,
      { method: "POST", token },
    );
    return finalized.data.media_item;
  }

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    const mediaTypes = selectedMedia.map((item) => item.type);
    const formatError =
      contentType === "single" && (selectedMedia.length !== 1 || mediaTypes[0] !== "image")
        ? "Tek görsel gönderisi için bir görsel seçmelisin"
        : contentType === "carousel" && (selectedMedia.length < 2 || selectedMedia.length > 10)
          ? "Carousel için 2–10 medya seçmelisin"
          : contentType === "carousel" && channel === "facebook" && mediaTypes.some((type) => type !== "image")
            ? "Facebook carousel yalnızca görsellerden oluşabilir"
            : ["video", "reel"].includes(contentType) && (selectedMedia.length !== 1 || mediaTypes[0] !== "video")
              ? "Video ve Reels için bir video seçmelisin"
              : contentType === "story" && selectedMedia.length !== 1
                ? "Story için bir görsel veya video seçmelisin"
                : null;
    if (formatError) {
      showToast({ title: formatError, tone: "error" });
      return;
    }

    setBusyId("new");
    try {
      const uploadedMedia: MediaItem[] = [];
      for (const selected of selectedMedia) {
        uploadedMedia.push(await uploadSelectedFile(selected.file));
      }

      await adminApiRequest("/admin/social-publications", {
        method: "POST",
        token,
        body: {
          channel,
          content_type: contentType,
          caption,
          media_items: uploadedMedia,
          publish_settings: {
            link_url: contentType === "link" ? linkUrl.trim() : null,
            share_to_feed: contentType === "reel" ? shareToFeed : null,
          },
          is_ai_generated: isAiGenerated,
        },
      });
      setCaption("");
      clearMedia();
      setLinkUrl("");
      setShareToFeed(true);
      setIsAiGenerated(false);
      showToast({ title: "Yayın taslağı oluşturuldu", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Taslak oluşturulamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setUploadProgress(null);
      setBusyId(null);
    }
  }

  async function runAction(publication: SocialPublication, action: "request-approval" | "approve" | "publish" | "cancel") {
    if (!token) return;

    if (action === "approve" && !window.confirm("Ekrandaki son metin ve görseli yayın için onaylıyor musun? Bu onay 30 dakika geçerlidir.")) return;
    if (action === "publish" && !window.confirm(`Bu gönderi şimdi ${publication.channel === "facebook" ? "Facebook" : "Instagram"} hesabında yayınlansın mı?`)) return;
    if (action === "cancel" && !window.confirm("Bu yayın taslağı iptal edilsin mi?")) return;

    setBusyId(publication.id);
    try {
      const response = await adminApiRequest<{ publication: SocialPublication }>(`/admin/social-publications/${publication.id}/${action}`, {
        method: "POST",
        token,
      });
      showToast({
        title: action === "publish" ? "Gönderi yayınlandı" : response.message ?? "İşlem tamamlandı",
        tone: "success",
      });
      await load();
    } catch (error) {
      showToast({ title: "İşlem tamamlanamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        <p className="flex items-center gap-2 font-bold"><ShieldCheck size={18} /> İki ayrı onay korunur</p>
        <p className="mt-1">
          Tasarım üretimine geçmeden önce verilen onay ile buradaki yayın onayı farklıdır. Bu ekranda son metni ve görseli görmeden hiçbir gönderi yayınlanmaz.
        </p>
      </div>

      <AdminTableCard>
        <form className="space-y-5 p-5 sm:p-7" onSubmit={(event) => void createDraft(event)}>
          <div>
            <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">Yeni yayın taslağı</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-admin-muted)]">Onaylanmış caption ve görselin son sürümünü buraya ekle.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-bold text-[var(--color-admin-ink)]">Mecra</span>
              <select
                className="h-11 w-full rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-3 text-sm text-[var(--color-admin-ink)]"
                onChange={(event) => {
                  const nextChannel = event.target.value as Channel;
                  setChannel(nextChannel);
                  if (nextChannel === "instagram" && ["text", "link"].includes(contentType)) setContentType("single");
                }}
                value={channel}
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-bold text-[var(--color-admin-ink)]">Gönderi türü</span>
              <select
                className="h-11 w-full rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-3 text-sm text-[var(--color-admin-ink)]"
                onChange={(event) => setContentType(event.target.value as ContentType)}
                value={contentType}
              >
                {channel === "facebook" ? <option value="text">Metin</option> : null}
                {channel === "facebook" ? <option value="link">Link</option> : null}
                <option value="single">Tek Görsel</option>
                <option value="carousel">Carousel</option>
                <option value="video">Video</option>
                <option value="reel">Reels</option>
                <option value="story">Story</option>
              </select>
            </label>
          </div>

          {contentType === "link" ? (
            <label className="block space-y-2">
              <span className="text-sm font-bold text-[var(--color-admin-ink)]">Paylaşılacak HTTPS bağlantısı</span>
              <input
                className="h-11 w-full rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-3 text-sm text-[var(--color-admin-ink)]"
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://..."
                required
                type="url"
                value={linkUrl}
              />
            </label>
          ) : null}

          {!["text", "link"].includes(contentType) ? (
            <div className="space-y-2">
              <span className="text-sm font-bold text-[var(--color-admin-ink)]">Görsel veya video</span>
              <input
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                className="sr-only"
                multiple={contentType === "carousel"}
                onChange={selectMedia}
                ref={mediaInputRef}
                type="file"
              />
              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-3 text-sm font-bold text-[var(--color-admin-ink)] hover:border-[var(--color-admin-accent)]"
                onClick={() => mediaInputRef.current?.click()}
                type="button"
              >
                {contentType === "carousel" ? <Layers3 size={17} /> : contentType === "video" || contentType === "reel" ? <Film size={17} /> : <ImageIcon size={17} />}
                {selectedMedia.length ? "Medya Ekle" : "Bilgisayardan Medya Seç"}
              </button>
              <p className="text-xs text-[var(--color-admin-muted)]">JPG, PNG, WebP, MP4 veya MOV · dosya başına en fazla 1 GB</p>
            </div>
          ) : null}

          {selectedMedia.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedMedia.map((item, index) => (
                <div className="overflow-hidden rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]" key={item.id}>
                  <div className="relative aspect-square w-full">
                    {item.type === "image" ? (
                      <Image alt={`${index + 1}. medya önizlemesi`} className="object-contain" fill src={item.previewUrl} unoptimized />
                    ) : (
                      <video className="h-full w-full object-contain" controls preload="metadata" src={item.previewUrl} />
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-white">{index + 1}</span>
                  </div>
                  <div className="space-y-3 border-t border-[var(--color-admin-line)] px-4 py-3">
                    <p className="truncate text-sm font-semibold text-[var(--color-admin-ink)]">{item.file.name}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        <button aria-label="Yukarı taşı" className="rounded-lg border p-1.5 disabled:opacity-30" disabled={index === 0} onClick={() => moveMedia(index, -1)} type="button"><ArrowUp size={14} /></button>
                        <button aria-label="Aşağı taşı" className="rounded-lg border p-1.5 disabled:opacity-30" disabled={index === selectedMedia.length - 1} onClick={() => moveMedia(index, 1)} type="button"><ArrowDown size={14} /></button>
                      </div>
                      <button className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:underline" onClick={() => removeMedia(item.id)} type="button">
                        <X size={14} /> Kaldır
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2">
                <button className="text-xs font-bold text-rose-700 hover:underline" onClick={clearMedia} type="button">Tüm medyayı kaldır</button>
              </div>
            </div>
          ) : null}

          {contentType === "reel" && channel === "instagram" ? (
            <label className="flex items-start gap-3 rounded-xl border border-[var(--color-admin-line)] p-4">
              <input checked={shareToFeed} className="mt-1 h-4 w-4" onChange={(event) => setShareToFeed(event.target.checked)} type="checkbox" />
              <span className="text-sm font-bold text-[var(--color-admin-ink)]">Reels gönderisini Instagram akışında da göster</span>
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-bold text-[var(--color-admin-ink)]">Caption</span>
            <textarea
              className="min-h-40 w-full rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-4 py-3 text-sm leading-6 text-[var(--color-admin-ink)]"
              maxLength={2200}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Yayınlanacak son metin..."
              required={contentType !== "story"}
              value={caption}
            />
            <span className="block text-right text-xs text-[var(--color-admin-muted)]">{caption.length}/2200</span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-[var(--color-admin-line)] p-4">
            <input
              checked={isAiGenerated}
              className="mt-1 h-4 w-4"
              onChange={(event) => setIsAiGenerated(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-bold text-[var(--color-admin-ink)]">Görsel yapay zekâ ile üretildi</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--color-admin-muted)]">Meta’ya gerekli içerik işareti gönderilir.</span>
            </span>
          </label>

          <button
            className="admin-button admin-button-primary"
            disabled={
              busyId === "new"
              || (contentType !== "story" && !caption.trim())
              || (!["text", "link"].includes(contentType) && selectedMedia.length === 0)
              || (contentType === "link" && !linkUrl.trim())
            }
            type="submit"
          >
            {busyId === "new" ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
            {uploadProgress ?? "Taslak Oluştur"}
          </button>
        </form>
      </AdminTableCard>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">Yayın akışı</h2>
          <p className="mt-1 text-sm text-[var(--color-admin-muted)]">{publications.length} kayıt gösteriliyor.</p>
        </div>
        <button className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-admin-accent)] hover:underline" onClick={() => void load()} type="button">
          <RefreshCcw size={15} /> Yenile
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-[var(--color-admin-line)] py-16 text-[var(--color-admin-muted)]">
          <LoaderCircle className="mr-2 animate-spin" size={19} /> Kayıtlar yükleniyor...
        </div>
      ) : publications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-admin-line)] px-5 py-14 text-center text-sm text-[var(--color-admin-muted)]">
          Henüz sosyal medya yayın taslağı yok.
        </div>
      ) : (
        <div className="space-y-4">
          {publications.map((publication) => (
            <PublicationCard
              busy={busyId === publication.id}
              key={publication.id}
              onAction={(action) => void runAction(publication, action)}
              publication={publication}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PublicationCard({
  publication,
  busy,
  onAction,
}: {
  publication: SocialPublication;
  busy: boolean;
  onAction: (action: "request-approval" | "approve" | "publish" | "cancel") => void;
}) {
  const isTerminal = publication.status === "published" || publication.status === "cancelled";
  const tone = publication.status === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : publication.status === "failed"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : publication.status === "approved"
        ? "border-blue-200 bg-blue-50 text-blue-900"
        : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <AdminTableCard>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-ink)]">
              {publication.channel === "facebook" ? <Share2 size={19} /> : <Camera size={19} />}
            </div>
            <div>
              <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">
                {publication.channel === "facebook" ? "Facebook" : "Instagram"} · #{publication.id}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-admin-muted)]">
                {contentTypeLabels[publication.content_type] ?? publication.content_type} · Oluşturma: {formatDate(publication.created_at)}
              </p>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${tone}`}>
            {publication.status === "published" ? <CircleCheck size={14} /> : publication.status === "failed" ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />}
            {statusLabels[publication.status]}
          </span>
        </div>

        {publication.media_items?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {publication.media_items.map((item, index) => (
              <a
                className="flex items-center gap-2 rounded-xl border border-[var(--color-admin-line)] px-3 py-2 text-sm font-bold text-[var(--color-admin-accent)] hover:bg-[var(--color-admin-bg-raised)]"
                href={item.url}
                key={`${item.url}-${index}`}
                rel="noreferrer"
                target="_blank"
              >
                {item.type === "video" ? <Film size={16} /> : <ImageIcon size={16} />}
                {index + 1}. {item.type === "video" ? "videoyu" : "görseli"} aç
              </a>
            ))}
          </div>
        ) : null}

        {publication.content_type === "link" && publication.publish_settings.link_url ? (
          <a className="break-all text-sm font-bold text-[var(--color-admin-accent)] hover:underline" href={publication.publish_settings.link_url} rel="noreferrer" target="_blank">
            Paylaşılacak bağlantıyı aç
          </a>
        ) : null}

        <p className="whitespace-pre-wrap rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 py-3 text-sm leading-6 text-[var(--color-admin-ink)]">
          {publication.caption}
        </p>

        {publication.is_ai_generated ? (
          <p className="text-xs font-semibold text-[var(--color-admin-muted)]">Yapay zekâ ile üretilmiş görsel olarak işaretlendi.</p>
        ) : null}

        {publication.approval_expires_at && publication.status === "approved" ? (
          <p className="text-xs font-semibold text-blue-800">Yayın onayı bitişi: {formatDate(publication.approval_expires_at)}</p>
        ) : null}

        {publication.published_at ? (
          <p className="text-xs font-semibold text-emerald-800">Yayın zamanı: {formatDate(publication.published_at)}</p>
        ) : null}

        {publication.last_error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">Son hata: {publication.last_error}</p>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-[var(--color-admin-line)] pt-4">
          {publication.status === "draft" ? (
            <button className="admin-button admin-button-primary" disabled={busy} onClick={() => onAction("request-approval")} type="button">
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Yayın Onayı İste
            </button>
          ) : null}
          {publication.status === "awaiting_publish_approval" ? (
            <button className="admin-button admin-button-primary" disabled={busy} onClick={() => onAction("approve")} type="button">
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} Son İçeriği Onayla
            </button>
          ) : null}
          {publication.status === "approved" ? (
            <button className="admin-button admin-button-primary" disabled={busy} onClick={() => onAction("publish")} type="button">
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />} Şimdi Yayınla
            </button>
          ) : null}
          {!isTerminal && publication.status !== "publishing" ? (
            <button className="admin-button" disabled={busy} onClick={() => onAction("cancel")} type="button">
              <X size={16} /> İptal Et
            </button>
          ) : null}
        </div>
      </div>
    </AdminTableCard>
  );
}
