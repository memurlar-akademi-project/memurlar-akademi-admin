"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Plus, RefreshCcw, Search, SquarePen, Star, Trash2 } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminBlogPost } from "@/lib/types";

const statusLabels: Record<AdminBlogPost["status"], string> = {
  draft: "Taslak",
  published: "Yayında",
  scheduled: "Zamanlandı",
  archived: "Arşiv",
};

function effectiveStatus(post: AdminBlogPost): AdminBlogPost["status"] {
  if (
    post.status === "scheduled"
    && post.published_at
    && new Date(post.published_at).getTime() <= Date.now()
  ) {
    return "published";
  }

  return post.status;
}

export default function BlogPostsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, loading, error, refresh } = useAdminList<AdminBlogPost>({
    endpoint: "/admin/blog-posts",
    responseKey: "posts",
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AdminBlogPost["status"]>("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");

    return items.filter((post) => {
      if (status !== "all" && effectiveStatus(post) !== status) return false;
      if (!normalized) return true;

      return [post.title, post.slug, post.category]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalized);
    });
  }, [items, query, status]);

  async function deletePost(post: AdminBlogPost) {
    if (!token || !window.confirm(`“${post.title}” yazısı kalıcı olarak silinsin mi?`)) return;

    setDeletingId(post.id);
    try {
      await adminApiRequest(`/admin/blog-posts/${post.id}`, {
        token,
        method: "DELETE",
      });
      showToast({
        tone: "success",
        title: "Blog yazısı silindi",
        description: post.title,
      });
      refresh();
    } catch (deleteError) {
      showToast({
        tone: "error",
        title: "Blog yazısı silinemedi",
        description: deleteError instanceof Error ? deleteError.message : "Lütfen tekrar dene.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="admin-card flex flex-wrap items-end justify-between gap-5 px-6 py-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-warn)]">
            Sayfa Yönetimi
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">
            Bloglar
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-admin-muted)]">
            Blog içeriklerini, yayın durumunu, SEO alanlarını ve öne çıkan yazıyı tek yerden yönet.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="admin-button admin-button-secondary" onClick={refresh} type="button">
            <RefreshCcw size={17} />
            Yenile
          </button>
          <Link className="admin-button admin-button-primary" href="/sayfa-yonetimi/bloglar/yeni">
            <Plus size={17} />
            Yeni Blog
          </Link>
        </div>
      </section>

      <section className="admin-card flex flex-wrap gap-4 px-5 py-4">
        <label className="flex min-w-[260px] flex-1 items-center gap-3 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4">
          <Search size={17} className="text-[var(--color-admin-muted)]" />
          <input
            className="h-12 w-full bg-transparent text-sm text-[var(--color-admin-ink)] outline-none"
            placeholder="Başlık, kategori veya slug ara"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          className="h-12 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 text-sm font-bold text-[var(--color-admin-ink)] outline-none"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">Tüm durumlar</option>
          <option value="published">Yayında</option>
          <option value="scheduled">Zamanlandı</option>
          <option value="draft">Taslak</option>
          <option value="archived">Arşiv</option>
        </select>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-5"><AdminTableSkeleton rows={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <FileText size={34} className="text-[var(--color-admin-muted)]" />
            <strong className="mt-4 text-[var(--color-admin-ink)]">Blog yazısı bulunamadı</strong>
            <span className="mt-1 text-sm text-[var(--color-admin-muted)]">Yeni bir yazı ekleyerek başlayabilirsin.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
                  {["Yazı", "Durum", "Yayın Tarihi", "SEO", ""].map((header) => (
                    <th key={header} className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((post) => {
                  const displayStatus = effectiveStatus(post);

                  return (
                    <tr key={post.id} className="border-b border-[var(--color-admin-line)] last:border-0">
                      <td className="min-w-[360px] px-5 py-4">
                      <div className="flex items-start gap-3">
                        {post.is_featured ? <Star size={17} className="mt-1 fill-[var(--color-admin-warn)] text-[var(--color-admin-warn)]" /> : null}
                        <div>
                          <p className="font-extrabold text-[var(--color-admin-ink)]">{post.title}</p>
                          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{post.category} · /blog/{post.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                        displayStatus === "published"
                          ? "bg-emerald-50 text-emerald-700"
                          : displayStatus === "scheduled"
                            ? "bg-sky-50 text-sky-700"
                          : displayStatus === "draft"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {statusLabels[displayStatus]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-[var(--color-admin-muted)]">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
                        : "Planlanmadı"}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span className={post.seo_title && post.seo_description ? "text-emerald-700" : "text-red-600"}>
                        {post.seo_title && post.seo_description ? "Hazır" : "Eksik"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--color-admin-line)] px-3 text-sm font-bold text-[var(--color-admin-ink)] transition hover:bg-[var(--color-admin-panel-soft)]"
                          href={`/sayfa-yonetimi/bloglar/${post.id}/duzenle`}
                        >
                          <SquarePen size={16} />
                          Düzenle
                        </Link>
                        <button
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          disabled={deletingId === post.id}
                          type="button"
                          onClick={() => void deletePost(post)}
                        >
                          <Trash2 size={16} />
                          {deletingId === post.id ? "Siliniyor" : "Sil"}
                        </button>
                      </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
