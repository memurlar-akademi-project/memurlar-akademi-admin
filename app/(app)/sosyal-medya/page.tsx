"use client";

import Image from "next/image";
import {
  Check,
  Camera,
  CircleCheck,
  ImageIcon,
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
  caption: string;
  media_url: string | null;
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
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

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
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  function selectMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast({ title: "JPG, PNG veya WebP görsel seçmelisin", tone: "error" });
      event.target.value = "";
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      showToast({ title: "Görsel en fazla 10 MB olabilir", tone: "error" });
      event.target.value = "";
      return;
    }

    setMediaFile(file);
    setMediaPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function clearMedia() {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  }

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (channel === "instagram" && !mediaFile) {
      showToast({ title: "Instagram gönderisi için görsel seçmelisin", tone: "error" });
      return;
    }

    setBusyId("new");
    try {
      let uploadedMediaUrl: string | null = null;

      if (mediaFile) {
        const mediaData = new FormData();
        mediaData.append("media", mediaFile);
        const uploadResponse = await adminApiRequest<{ media_url: string }>("/admin/social-publications/media", {
          method: "POST",
          token,
          body: mediaData,
        });
        uploadedMediaUrl = uploadResponse.data.media_url;
      }

      await adminApiRequest("/admin/social-publications", {
        method: "POST",
        token,
        body: {
          channel,
          caption,
          media_url: uploadedMediaUrl,
          is_ai_generated: isAiGenerated,
        },
      });
      setCaption("");
      clearMedia();
      setIsAiGenerated(false);
      showToast({ title: "Yayın taslağı oluşturuldu", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Taslak oluşturulamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
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
                onChange={(event) => setChannel(event.target.value as Channel)}
                value={channel}
              >
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </label>

            <div className="space-y-2">
              <span className="text-sm font-bold text-[var(--color-admin-ink)]">
                Görsel {channel === "instagram" ? "(zorunlu)" : "(isteğe bağlı)"}
              </span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={selectMedia}
                ref={mediaInputRef}
                type="file"
              />
              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-3 text-sm font-bold text-[var(--color-admin-ink)] hover:border-[var(--color-admin-accent)]"
                onClick={() => mediaInputRef.current?.click()}
                type="button"
              >
                <ImageIcon size={17} />
                {mediaFile ? "Başka Görsel Seç" : "Bilgisayardan Görsel Seç"}
              </button>
              <p className="text-xs text-[var(--color-admin-muted)]">JPG, PNG veya WebP · en fazla 10 MB</p>
            </div>
          </div>

          {mediaFile && mediaPreviewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]">
              <div className="relative aspect-square max-h-[28rem] w-full">
                <Image
                  alt="Yüklenecek sosyal medya görseli önizlemesi"
                  className="object-contain"
                  fill
                  src={mediaPreviewUrl}
                  unoptimized
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--color-admin-line)] px-4 py-3">
                <p className="min-w-0 truncate text-sm font-semibold text-[var(--color-admin-ink)]">{mediaFile.name}</p>
                <button className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-rose-700 hover:underline" onClick={clearMedia} type="button">
                  <X size={14} /> Kaldır
                </button>
              </div>
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-bold text-[var(--color-admin-ink)]">Caption</span>
            <textarea
              className="min-h-40 w-full rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-4 py-3 text-sm leading-6 text-[var(--color-admin-ink)]"
              maxLength={2200}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Yayınlanacak son metin..."
              required
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
            disabled={busyId === "new" || !caption.trim() || (channel === "instagram" && !mediaFile)}
            type="submit"
          >
            {busyId === "new" ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
            Taslak Oluştur
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
              <p className="mt-0.5 text-xs text-[var(--color-admin-muted)]">Oluşturma: {formatDate(publication.created_at)}</p>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${tone}`}>
            {publication.status === "published" ? <CircleCheck size={14} /> : publication.status === "failed" ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />}
            {statusLabels[publication.status]}
          </span>
        </div>

        {publication.media_url ? (
          <a className="flex items-center gap-2 break-all text-sm font-bold text-[var(--color-admin-accent)] hover:underline" href={publication.media_url} rel="noreferrer" target="_blank">
            <ImageIcon size={16} /> Onaylanacak görseli aç
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
