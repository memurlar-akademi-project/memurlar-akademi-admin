"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Megaphone,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Save,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";

type ModerationStatus = "pending" | "published" | "rejected";
type StatusFilter = ModerationStatus | "all";
type PageTab = "moderation" | "announcements";
type AnnouncementType = "sinav" | "guncelleme" | "canli-ders" | "sistem" | "onemli";

type ModerationPost = {
  id: number;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: string;
  author_name: string;
  author_email: string | null;
  status: ModerationStatus;
  moderation_reason: string | null;
  created_at: string | null;
};

type ModerationComment = {
  id: number;
  post_id: number;
  post_title: string;
  body: string;
  author_name: string;
  author_email: string | null;
  status: ModerationStatus;
  moderation_reason: string | null;
  created_at: string | null;
};

type ModerationPayload = {
  posts: ModerationPost[];
  comments: ModerationComment[];
};

type CommunityAnnouncement = {
  id: number;
  type: AnnouncementType;
  title: string;
  body: string;
  display_date: string | null;
  is_new: boolean;
  sort_order: number;
  published_at: string | null;
  created_at: string | null;
};

type AnnouncementPayload = {
  announcements: CommunityAnnouncement[];
};

type AnnouncementDraft = {
  type: AnnouncementType;
  title: string;
  body: string;
  display_date: string;
  is_new: boolean;
  sort_order: number;
  published_at: string;
};

const statusCopy: Record<ModerationStatus, string> = {
  pending: "Onay Bekliyor",
  published: "Yayında",
  rejected: "Reddedildi",
};

const statusStyles: Record<ModerationStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: ModerationStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[status]}`}>
      {statusCopy[status]}
    </span>
  );
}

type PostDraft = Pick<ModerationPost, "title" | "body" | "moderation_reason">;
type CommentDraft = Pick<ModerationComment, "body" | "moderation_reason">;

const emptyAnnouncementDraft: AnnouncementDraft = {
  type: "onemli",
  title: "",
  body: "",
  display_date: "Bugün",
  is_new: true,
  sort_order: 1,
  published_at: "",
};

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function announcementPayload(draft: AnnouncementDraft) {
  return {
    type: draft.type,
    title: draft.title,
    body: draft.body,
    display_date: draft.display_date || null,
    is_new: draft.is_new,
    sort_order: Number(draft.sort_order) || 1,
    published_at: draft.published_at ? new Date(draft.published_at).toISOString() : null,
  };
}

export default function CommunityModerationPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { setTitle } = useAdminPageMeta();
  const [activeTab, setActiveTab] = useState<PageTab>("moderation");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [posts, setPosts] = useState<ModerationPost[]>([]);
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [announcements, setAnnouncements] = useState<CommunityAnnouncement[]>([]);
  const [postDrafts, setPostDrafts] = useState<Record<number, PostDraft>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, CommentDraft>>({});
  const [announcementDrafts, setAnnouncementDrafts] = useState<Record<number, AnnouncementDraft>>({});
  const [newAnnouncement, setNewAnnouncement] = useState<AnnouncementDraft>(emptyAnnouncementDraft);
  const [loading, setLoading] = useState(true);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setTitle("Topluluk Onayı");

    return () => setTitle(null);
  }, [setTitle]);

  const totalItems = useMemo(() => posts.length + comments.length, [comments.length, posts.length]);

  async function loadModeration(nextStatus = statusFilter) {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await adminApiRequest<ModerationPayload>(
        `/admin/community/moderation?status=${nextStatus}`,
        { token },
      );

      setPosts(response.data.posts);
      setComments(response.data.comments);
      setPostDrafts(
        response.data.posts.reduce<Record<number, PostDraft>>((accumulator, post) => {
          accumulator[post.id] = {
            title: post.title,
            body: post.body ?? "",
            moderation_reason: post.moderation_reason ?? "",
          };

          return accumulator;
        }, {}),
      );
      setCommentDrafts(
        response.data.comments.reduce<Record<number, CommentDraft>>((accumulator, comment) => {
          accumulator[comment.id] = {
            body: comment.body,
            moderation_reason: comment.moderation_reason ?? "",
          };

          return accumulator;
        }, {}),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Topluluk kayıtları alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadModeration(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, token]);

  async function loadAnnouncements() {
    if (!token) {
      return;
    }

    setAnnouncementLoading(true);
    setAnnouncementError(null);

    try {
      const response = await adminApiRequest<AnnouncementPayload>("/admin/community/announcements", { token });
      setAnnouncements(response.data.announcements);
      setAnnouncementDrafts(
        response.data.announcements.reduce<Record<number, AnnouncementDraft>>((accumulator, announcement) => {
          accumulator[announcement.id] = {
            type: announcement.type,
            title: announcement.title,
            body: announcement.body,
            display_date: announcement.display_date ?? "",
            is_new: announcement.is_new,
            sort_order: announcement.sort_order,
            published_at: toDatetimeLocal(announcement.published_at),
          };

          return accumulator;
        }, {}),
      );
    } catch (requestError) {
      setAnnouncementError(requestError instanceof Error ? requestError.message : "Duyurular alınamadı.");
    } finally {
      setAnnouncementLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "announcements") {
      void loadAnnouncements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  async function updatePost(postId: number, body: Partial<PostDraft> & { status?: ModerationStatus }) {
    if (!token) {
      return;
    }

    setBusyKey(`post-${postId}`);

    try {
      await adminApiRequest(`/admin/community/posts/${postId}`, {
        method: "PUT",
        token,
        body,
      });
      showToast({ title: "Konu güncellendi", tone: "success" });
      await loadModeration();
    } catch (requestError) {
      showToast({
        title: "Konu güncellenemedi",
        description: requestError instanceof Error ? requestError.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function deletePost(postId: number) {
    if (!token || !window.confirm("Bu konuyu silmek istediğine emin misin?")) {
      return;
    }

    setBusyKey(`post-${postId}`);

    try {
      await adminApiRequest(`/admin/community/posts/${postId}`, {
        method: "DELETE",
        token,
      });
      showToast({ title: "Konu silindi", tone: "success" });
      await loadModeration();
    } catch (requestError) {
      showToast({
        title: "Konu silinemedi",
        description: requestError instanceof Error ? requestError.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function updateComment(commentId: number, body: Partial<CommentDraft> & { status?: ModerationStatus }) {
    if (!token) {
      return;
    }

    setBusyKey(`comment-${commentId}`);

    try {
      await adminApiRequest(`/admin/community/comments/${commentId}`, {
        method: "PUT",
        token,
        body,
      });
      showToast({ title: "Yorum güncellendi", tone: "success" });
      await loadModeration();
    } catch (requestError) {
      showToast({
        title: "Yorum güncellenemedi",
        description: requestError instanceof Error ? requestError.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteComment(commentId: number) {
    if (!token || !window.confirm("Bu yorumu silmek istediğine emin misin?")) {
      return;
    }

    setBusyKey(`comment-${commentId}`);

    try {
      await adminApiRequest(`/admin/community/comments/${commentId}`, {
        method: "DELETE",
        token,
      });
      showToast({ title: "Yorum silindi", tone: "success" });
      await loadModeration();
    } catch (requestError) {
      showToast({
        title: "Yorum silinemedi",
        description: requestError instanceof Error ? requestError.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function createAnnouncement() {
    if (!token) {
      return;
    }

    setBusyKey("announcement-new");

    try {
      await adminApiRequest("/admin/community/announcements", {
        method: "POST",
        token,
        body: announcementPayload(newAnnouncement),
      });
      showToast({ title: "Duyuru eklendi", tone: "success" });
      setNewAnnouncement({ ...emptyAnnouncementDraft, sort_order: announcements.length + 1 });
      await loadAnnouncements();
    } catch (requestError) {
      showToast({
        title: "Duyuru eklenemedi",
        description: requestError instanceof Error ? requestError.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function updateAnnouncement(announcementId: number, draft: AnnouncementDraft) {
    if (!token) {
      return;
    }

    setBusyKey(`announcement-${announcementId}`);

    try {
      await adminApiRequest(`/admin/community/announcements/${announcementId}`, {
        method: "PUT",
        token,
        body: announcementPayload(draft),
      });
      showToast({ title: "Duyuru güncellendi", tone: "success" });
      await loadAnnouncements();
    } catch (requestError) {
      showToast({
        title: "Duyuru güncellenemedi",
        description: requestError instanceof Error ? requestError.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteAnnouncement(announcementId: number) {
    if (!token || !window.confirm("Bu duyuruyu silmek istediğine emin misin?")) {
      return;
    }

    setBusyKey(`announcement-${announcementId}`);

    try {
      await adminApiRequest(`/admin/community/announcements/${announcementId}`, {
        method: "DELETE",
        token,
      });
      showToast({ title: "Duyuru silindi", tone: "success" });
      await loadAnnouncements();
    } catch (requestError) {
      showToast({
        title: "Duyuru silinemedi",
        description: requestError instanceof Error ? requestError.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="admin-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-lg font-extrabold text-[var(--color-admin-ink)]">Topluluk Moderasyonu</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-admin-muted)]">
                Sakıncalı kelime, spam veya dış iletişim yönlendirmesi içeren konu ve yorumlar onaya düşer.
                Premium olmayan kullanıcılar konu açamaz; yorumlar herkese açıktır.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={`admin-button h-10 ${activeTab === "moderation" ? "admin-button-primary" : "admin-button-secondary"}`}
                  onClick={() => setActiveTab("moderation")}
                  type="button"
                >
                  <ShieldAlert size={16} />
                  Moderasyon
                </button>
                <button
                  className={`admin-button h-10 ${activeTab === "announcements" ? "admin-button-primary" : "admin-button-secondary"}`}
                  onClick={() => setActiveTab("announcements")}
                  type="button"
                >
                  <Megaphone size={16} />
                  Duyurular
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeTab === "moderation" ? (
              <select
                className="admin-input h-10 min-w-[180px] appearance-none pr-9 text-sm leading-none"
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                value={statusFilter}
              >
                <option value="pending">Onay bekleyenler</option>
                <option value="published">Yayındakiler</option>
                <option value="rejected">Reddedilenler</option>
                <option value="all">Tümü</option>
              </select>
            ) : (
              <span className="rounded-full bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-bold text-[var(--color-admin-muted)]">
                {announcements.length} duyuru
              </span>
            )}
            <button
              className="admin-button admin-button-secondary h-10"
              disabled={activeTab === "moderation" ? loading : announcementLoading}
              onClick={() => activeTab === "moderation" ? void loadModeration() : void loadAnnouncements()}
              type="button"
            >
              <RefreshCcw size={16} />
              Yenile
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-[var(--color-admin-danger)]/20 bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-danger)]">
          {error}
        </div>
      ) : null}

      {announcementError ? (
        <div className="rounded-2xl border border-[var(--color-admin-danger)]/20 bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-danger)]">
          {announcementError}
        </div>
      ) : null}

      {activeTab === "moderation" ? loading ? (
        <div className="admin-card flex min-h-[240px] items-center justify-center gap-3 p-8 text-sm font-bold text-[var(--color-admin-muted)]">
          <Loader2 className="animate-spin" size={18} />
          Topluluk kayıtları yükleniyor...
        </div>
      ) : totalItems === 0 ? (
        <div className="admin-card flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
          <MessageSquareText className="text-[var(--color-admin-muted)]" size={28} />
          <p className="mt-3 text-sm font-bold text-[var(--color-admin-ink)]">Bu filtrede kayıt yok.</p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            Yeni konu veya yorum geldiğinde burada görünecek.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Konular</h2>
              <span className="rounded-full bg-[var(--color-admin-bg-raised)] px-3 py-1 text-xs font-bold text-[var(--color-admin-muted)]">
                {posts.length} kayıt
              </span>
            </div>

            {posts.map((post) => {
              const draft = postDrafts[post.id] ?? { title: post.title, body: post.body ?? "", moderation_reason: "" };
              const isBusy = busyKey === `post-${post.id}`;

              return (
                <article key={post.id} className="admin-card space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={post.status} />
                        <span className="rounded-full bg-[var(--color-admin-bg-raised)] px-3 py-1 text-xs font-bold text-[var(--color-admin-muted)]">
                          {post.category}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-[var(--color-admin-muted)]">
                        {post.author_name} {post.author_email ? `· ${post.author_email}` : ""} · {formatDate(post.created_at)}
                      </p>
                    </div>
                  </div>

                  <input
                    className="admin-input h-11 text-sm font-bold"
                    onChange={(event) =>
                      setPostDrafts((current) => ({
                        ...current,
                        [post.id]: { ...draft, title: event.target.value },
                      }))
                    }
                    value={draft.title}
                  />
                  <textarea
                    className="admin-input min-h-[150px] resize-y py-3 text-sm leading-6"
                    onChange={(event) =>
                      setPostDrafts((current) => ({
                        ...current,
                        [post.id]: { ...draft, body: event.target.value },
                      }))
                    }
                    value={draft.body ?? ""}
                  />
                  <input
                    className="admin-input h-10 text-sm"
                    onChange={(event) =>
                      setPostDrafts((current) => ({
                        ...current,
                        [post.id]: { ...draft, moderation_reason: event.target.value },
                      }))
                    }
                    placeholder="Moderasyon notu"
                    value={draft.moderation_reason ?? ""}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="admin-button admin-button-primary h-10"
                      disabled={isBusy}
                      onClick={() => void updatePost(post.id, { status: "published" })}
                      type="button"
                    >
                      <CheckCircle2 size={16} />
                      Onayla
                    </button>
                    <button
                      className="admin-button admin-button-secondary h-10"
                      disabled={isBusy}
                      onClick={() => void updatePost(post.id, draft)}
                      type="button"
                    >
                      <Save size={16} />
                      Kaydet
                    </button>
                    <button
                      className="admin-button admin-button-danger h-10"
                      disabled={isBusy}
                      onClick={() => void updatePost(post.id, { status: "rejected", moderation_reason: draft.moderation_reason })}
                      type="button"
                    >
                      <XCircle size={16} />
                      Reddet
                    </button>
                    <button
                      className="admin-button admin-button-ghost h-10"
                      disabled={isBusy}
                      onClick={() => void deletePost(post.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                      Sil
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Yorumlar</h2>
              <span className="rounded-full bg-[var(--color-admin-bg-raised)] px-3 py-1 text-xs font-bold text-[var(--color-admin-muted)]">
                {comments.length} kayıt
              </span>
            </div>

            {comments.map((comment) => {
              const draft = commentDrafts[comment.id] ?? { body: comment.body, moderation_reason: "" };
              const isBusy = busyKey === `comment-${comment.id}`;

              return (
                <article key={comment.id} className="admin-card space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={comment.status} />
                    <span className="rounded-full bg-[var(--color-admin-bg-raised)] px-3 py-1 text-xs font-bold text-[var(--color-admin-muted)]">
                      #{comment.post_id}
                    </span>
                  </div>
                  <div>
                    <p className="line-clamp-2 text-sm font-extrabold text-[var(--color-admin-ink)]">
                      {comment.post_title}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[var(--color-admin-muted)]">
                      {comment.author_name} {comment.author_email ? `· ${comment.author_email}` : ""} · {formatDate(comment.created_at)}
                    </p>
                  </div>
                  <textarea
                    className="admin-input min-h-[130px] resize-y py-3 text-sm leading-6"
                    onChange={(event) =>
                      setCommentDrafts((current) => ({
                        ...current,
                        [comment.id]: { ...draft, body: event.target.value },
                      }))
                    }
                    value={draft.body}
                  />
                  <input
                    className="admin-input h-10 text-sm"
                    onChange={(event) =>
                      setCommentDrafts((current) => ({
                        ...current,
                        [comment.id]: { ...draft, moderation_reason: event.target.value },
                      }))
                    }
                    placeholder="Moderasyon notu"
                    value={draft.moderation_reason ?? ""}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="admin-button admin-button-primary h-10"
                      disabled={isBusy}
                      onClick={() => void updateComment(comment.id, { status: "published" })}
                      type="button"
                    >
                      <CheckCircle2 size={16} />
                      Onayla
                    </button>
                    <button
                      className="admin-button admin-button-secondary h-10"
                      disabled={isBusy}
                      onClick={() => void updateComment(comment.id, draft)}
                      type="button"
                    >
                      <Save size={16} />
                      Kaydet
                    </button>
                    <button
                      className="admin-button admin-button-danger h-10"
                      disabled={isBusy}
                      onClick={() => void updateComment(comment.id, { status: "rejected", moderation_reason: draft.moderation_reason })}
                      type="button"
                    >
                      <XCircle size={16} />
                      Reddet
                    </button>
                    <button
                      className="admin-button admin-button-ghost h-10"
                      disabled={isBusy}
                      onClick={() => void deleteComment(comment.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                      Sil
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
          <section className="admin-card space-y-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Plus size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Yeni Duyuru</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">
                  Buradan eklenen duyurular kullanıcı panelindeki Topluluk &gt; Duyurular sekmesinde görünür.
                </p>
              </div>
            </div>

            <select
              className="admin-input h-11 appearance-none text-sm"
              onChange={(event) => setNewAnnouncement((current) => ({ ...current, type: event.target.value as AnnouncementType }))}
              value={newAnnouncement.type}
            >
              <option value="onemli">Önemli</option>
              <option value="sinav">Sınav</option>
              <option value="guncelleme">Güncelleme</option>
              <option value="canli-ders">Canlı Ders</option>
              <option value="sistem">Sistem</option>
            </select>
            <input
              className="admin-input h-11 text-sm font-bold"
              onChange={(event) => setNewAnnouncement((current) => ({ ...current, title: event.target.value }))}
              placeholder="Duyuru başlığı"
              value={newAnnouncement.title}
            />
            <textarea
              className="admin-input min-h-[150px] resize-y py-3 text-sm leading-6"
              onChange={(event) => setNewAnnouncement((current) => ({ ...current, body: event.target.value }))}
              placeholder="Duyuru metni"
              value={newAnnouncement.body}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="admin-input h-11 text-sm"
                onChange={(event) => setNewAnnouncement((current) => ({ ...current, display_date: event.target.value }))}
                placeholder="Gösterim tarihi"
                value={newAnnouncement.display_date}
              />
              <input
                className="admin-input h-11 text-sm"
                min={1}
                onChange={(event) => setNewAnnouncement((current) => ({ ...current, sort_order: Number(event.target.value) }))}
                placeholder="Sıra"
                type="number"
                value={newAnnouncement.sort_order}
              />
            </div>
            <input
              className="admin-input h-11 text-sm"
              onChange={(event) => setNewAnnouncement((current) => ({ ...current, published_at: event.target.value }))}
              type="datetime-local"
              value={newAnnouncement.published_at}
            />
            <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-admin-ink)]">
              <input
                checked={newAnnouncement.is_new}
                onChange={(event) => setNewAnnouncement((current) => ({ ...current, is_new: event.target.checked }))}
                type="checkbox"
              />
              Yeni etiketi göster
            </label>
            <button
              className="admin-button admin-button-primary h-11 w-full"
              disabled={busyKey === "announcement-new" || !newAnnouncement.title.trim() || !newAnnouncement.body.trim()}
              onClick={() => void createAnnouncement()}
              type="button"
            >
              <Plus size={16} />
              Duyuru Ekle
            </button>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Duyuru Listesi</h2>
              <span className="rounded-full bg-[var(--color-admin-bg-raised)] px-3 py-1 text-xs font-bold text-[var(--color-admin-muted)]">
                {announcements.length} kayıt
              </span>
            </div>

            {announcementLoading ? (
              <div className="admin-card flex min-h-[220px] items-center justify-center gap-3 p-8 text-sm font-bold text-[var(--color-admin-muted)]">
                <Loader2 className="animate-spin" size={18} />
                Duyurular yükleniyor...
              </div>
            ) : announcements.length === 0 ? (
              <div className="admin-card flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
                <Megaphone className="text-[var(--color-admin-muted)]" size={28} />
                <p className="mt-3 text-sm font-bold text-[var(--color-admin-ink)]">Henüz duyuru yok.</p>
                <p className="mt-1 text-xs text-[var(--color-admin-muted)]">İlk duyuruyu soldaki formdan ekleyebilirsin.</p>
              </div>
            ) : announcements.map((announcement) => {
              const draft = announcementDrafts[announcement.id] ?? {
                type: announcement.type,
                title: announcement.title,
                body: announcement.body,
                display_date: announcement.display_date ?? "",
                is_new: announcement.is_new,
                sort_order: announcement.sort_order,
                published_at: toDatetimeLocal(announcement.published_at),
              };
              const isBusy = busyKey === `announcement-${announcement.id}`;

              return (
                <article key={announcement.id} className="admin-card space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                      {draft.type}
                    </span>
                    {draft.is_new ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        Yeni
                      </span>
                    ) : null}
                    <span className="rounded-full bg-[var(--color-admin-bg-raised)] px-3 py-1 text-xs font-bold text-[var(--color-admin-muted)]">
                      Sıra {draft.sort_order}
                    </span>
                    <span className="ml-auto text-xs font-semibold text-[var(--color-admin-muted)]">
                      {formatDate(announcement.created_at)}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <select
                      className="admin-input h-11 appearance-none text-sm"
                      onChange={(event) =>
                        setAnnouncementDrafts((current) => ({
                          ...current,
                          [announcement.id]: { ...draft, type: event.target.value as AnnouncementType },
                        }))
                      }
                      value={draft.type}
                    >
                      <option value="onemli">Önemli</option>
                      <option value="sinav">Sınav</option>
                      <option value="guncelleme">Güncelleme</option>
                      <option value="canli-ders">Canlı Ders</option>
                      <option value="sistem">Sistem</option>
                    </select>
                    <input
                      className="admin-input h-11 text-sm font-bold"
                      onChange={(event) =>
                        setAnnouncementDrafts((current) => ({
                          ...current,
                          [announcement.id]: { ...draft, title: event.target.value },
                        }))
                      }
                      value={draft.title}
                    />
                  </div>
                  <textarea
                    className="admin-input min-h-[130px] resize-y py-3 text-sm leading-6"
                    onChange={(event) =>
                      setAnnouncementDrafts((current) => ({
                        ...current,
                        [announcement.id]: { ...draft, body: event.target.value },
                      }))
                    }
                    value={draft.body}
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      className="admin-input h-11 text-sm"
                      onChange={(event) =>
                        setAnnouncementDrafts((current) => ({
                          ...current,
                          [announcement.id]: { ...draft, display_date: event.target.value },
                        }))
                      }
                      placeholder="Gösterim tarihi"
                      value={draft.display_date}
                    />
                    <input
                      className="admin-input h-11 text-sm"
                      min={1}
                      onChange={(event) =>
                        setAnnouncementDrafts((current) => ({
                          ...current,
                          [announcement.id]: { ...draft, sort_order: Number(event.target.value) },
                        }))
                      }
                      type="number"
                      value={draft.sort_order}
                    />
                    <input
                      className="admin-input h-11 text-sm"
                      onChange={(event) =>
                        setAnnouncementDrafts((current) => ({
                          ...current,
                          [announcement.id]: { ...draft, published_at: event.target.value },
                        }))
                      }
                      type="datetime-local"
                      value={draft.published_at}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-admin-ink)]">
                    <input
                      checked={draft.is_new}
                      onChange={(event) =>
                        setAnnouncementDrafts((current) => ({
                          ...current,
                          [announcement.id]: { ...draft, is_new: event.target.checked },
                        }))
                      }
                      type="checkbox"
                    />
                    Yeni etiketi göster
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="admin-button admin-button-primary h-10"
                      disabled={isBusy}
                      onClick={() => void updateAnnouncement(announcement.id, draft)}
                      type="button"
                    >
                      <Save size={16} />
                      Kaydet
                    </button>
                    <button
                      className="admin-button admin-button-ghost h-10"
                      disabled={isBusy}
                      onClick={() => void deleteAnnouncement(announcement.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                      Sil
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
