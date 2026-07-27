"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import {
  ArrowLeft,
  Eye,
  FileImage,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  encodeCta,
  RichBlogEditor,
  type BlogCtaConfig,
} from "@/components/admin/blog/RichBlogEditor";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { adminApiBlob, adminApiRequest } from "@/lib/admin-api";
import type { AdminBlogPost } from "@/lib/types";

type BlogPostFormPageProps = {
  mode: "create" | "edit";
  postId?: number;
};

type FormState = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  status: AdminBlogPost["status"];
  isFeatured: boolean;
  readingMinutes: string;
  author: string;
  publishedAt: string;
  coverUrl: string;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  contentMarkdown: string;
  contentHtml: string;
  examCta: AdminBlogPost["exam_cta"];
  faqItems: AdminBlogPost["faq_items"];
};

const emptyForm: FormState = {
  slug: "",
  category: "",
  title: "",
  excerpt: "",
  status: "draft",
  isFeatured: false,
  readingMinutes: "7",
  author: "Memurlar Akademi Ekibi",
  publishedAt: "",
  coverUrl: "",
  coverAlt: "",
  seoTitle: "",
  seoDescription: "",
  intro: "",
  contentMarkdown: "",
  contentHtml: "",
  examCta: {
    eyebrow: "Görevde Yükselme Sınavları",
    title: "Hazırlığını Planlı Bir Programa Dönüştür",
    description: "Konu anlatımları, açıklamalı sorular, denemeler ve AI analiz ile hazırlığını tek platformdan yönet.",
    label: "Sınav Programlarını İncele",
    href: "/sinavlar",
  },
  faqItems: [],
};

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 text-sm text-[var(--color-admin-ink)] outline-none transition focus:border-[var(--color-admin-warn)]";
const textareaClass =
  "mt-2 w-full rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3 text-sm leading-7 text-[var(--color-admin-ink)] outline-none transition focus:border-[var(--color-admin-warn)]";

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function legacyContentToMarkdown(post: AdminBlogPost) {
  const sections = post.sections
    .map((section) => {
      const bullets = section.bullets?.length
        ? `\n\n${section.bullets.map((bullet) => `- ${bullet}`).join("\n")}`
        : "";

      return `## ${section.title}\n\n${section.body.join("\n\n")}${bullets}`;
    })
    .join("\n\n");

  if (!sections) return "";

  const parts = sections.split(/(?=^##\s)/m);
  return parts.length > 1
    ? `${parts[0].trim()}\n\n[[CTA]]\n\n${parts.slice(1).join("").trim()}`
    : `${sections}\n\n[[CTA]]`;
}

function markdownIntro(markdown: string) {
  const block = markdown
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("#") && !item.startsWith("[[CTA]]"));

  return (block ?? "")
    .replace(/^>\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .trim();
}

function markdownToEditorHtml(markdown: string, cta: BlogCtaConfig) {
  const withCtaNodes = markdown.replaceAll(
    "[[CTA]]",
    `<div data-blog-cta="${encodeCta(cta)}"></div>`,
  );

  return marked.parse(withCtaNodes, { async: false }) as string;
}

function htmlIntro(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const paragraph = Array.from(container.querySelectorAll("p"))
    .find((item) => !item.closest("[data-blog-cta]") && item.textContent?.trim());

  return paragraph?.textContent?.trim() ?? "";
}

function marketingPreviewBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_MARKETING_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  if (typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:3027`;
  }

  return "https://memurlarakademi.com";
}

async function blobUrlToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function BlogPostFormPage({ mode, postId }: BlogPostFormPageProps) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [hasUploadedCover, setHasUploadedCover] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !postId || !token) return;
    const authToken = token;
    let cancelled = false;

    async function load() {
      try {
        const response = await adminApiRequest<{ post: AdminBlogPost }>(
          `/admin/blog-posts/${postId}`,
          { token: authToken },
        );
        if (cancelled) return;
        const post = response.data.post;
        const defaultCta: BlogCtaConfig = {
          eyebrow: post.exam_cta.eyebrow,
          title: post.exam_cta.title,
          description: post.exam_cta.description,
          primaryLabel: post.exam_cta.label,
          primaryHref: post.exam_cta.href,
          secondaryLabel: "Hemen Kayıt Ol",
          secondaryHref: "/kayit",
        };
        setForm({
          slug: post.slug,
          category: post.category,
          title: post.title,
          excerpt: post.excerpt,
          status: post.status,
          isFeatured: post.is_featured,
          readingMinutes: String(post.reading_minutes),
          author: post.author,
          publishedAt: toDatetimeLocal(post.published_at),
          coverUrl: post.cover_url ?? "",
          coverAlt: post.cover_alt,
          seoTitle: post.seo_title,
          seoDescription: post.seo_description,
          intro: post.intro,
          contentMarkdown: post.content_markdown?.trim() || legacyContentToMarkdown(post),
          contentHtml: post.content_html?.trim()
            || markdownToEditorHtml(post.content_markdown?.trim() || legacyContentToMarkdown(post), defaultCta),
          examCta: post.exam_cta,
          faqItems: post.faq_items ?? [],
        });
        setHasUploadedCover(post.has_uploaded_cover);
        if (post.has_uploaded_cover) {
          const blob = await adminApiBlob(`/admin/blog-posts/${post.id}/cover`, authToken);
          if (!cancelled) setCoverPreviewUrl(URL.createObjectURL(blob));
        } else if (post.cover_url) {
          setCoverPreviewUrl(`https://memurlarakademi.com${post.cover_url}`);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Blog yazısı yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [mode, postId, token]);

  useEffect(() => {
    if (!coverFile) return;

    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  const canSave = useMemo(() => {
    return Boolean(
      form.title.trim() &&
        form.slug.trim() &&
        form.category.trim() &&
        form.excerpt.trim() &&
        form.contentHtml.trim() &&
        form.coverAlt.trim() &&
        form.seoTitle.trim() &&
        form.seoDescription.trim() &&
        form.faqItems.every((item) => item.question.trim() && item.answer.trim())
    );
  }, [form]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handlePreview() {
    const previewBaseUrl = marketingPreviewBaseUrl();
    const previewOrigin = new URL(previewBaseUrl).origin;
    const previewUrl = `${previewBaseUrl}/blog/onizleme?source=${encodeURIComponent(window.location.origin)}`;
    const previewWindow = window.open(previewUrl, "_blank");

    if (!previewWindow) {
      showToast({
        tone: "error",
        title: "Önizleme açılamadı",
        description: "Tarayıcının açılır pencere iznini kontrol et.",
      });
      return;
    }
    const activePreviewWindow = previewWindow;

    const publishedAt = form.publishedAt ? new Date(form.publishedAt) : new Date();
    const coverPromise = coverPreviewUrl?.startsWith("blob:")
      ? blobUrlToDataUrl(coverPreviewUrl).catch(() => "/seo/og-study-background-v1.jpg")
      : Promise.resolve(coverPreviewUrl || form.coverUrl.trim() || "/seo/og-study-background-v1.jpg");
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", receiveReady);
      showToast({
        tone: "error",
        title: "Önizleme hazırlanamadı",
        description: "Marketing önizleme sayfası zamanında yanıt vermedi.",
      });
    }, 12_000);

    async function receiveReady(event: MessageEvent) {
      if (
        event.origin !== previewOrigin
        || event.source !== activePreviewWindow
        || event.data?.type !== "memurlar-blog-preview-ready"
      ) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", receiveReady);
      const cover = await coverPromise;

      activePreviewWindow.postMessage({
        type: "memurlar-blog-preview",
        payload: {
          slug: form.slug.trim() || "blog-onizleme",
          category: form.category.trim() || "Blog",
          title: form.title.trim() || "Blog Yazısı Başlığı",
          excerpt: form.excerpt.trim() || "Blog yazısının kısa özeti burada görünecek.",
          date: new Intl.DateTimeFormat("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(publishedAt),
          publishedAt: publishedAt.toISOString(),
          read: `${Number(form.readingMinutes) || 7} dk okuma`,
          author: form.author.trim() || "Memurlar Akademi Ekibi",
          cover,
          coverAlt: form.coverAlt.trim() || "Blog kapak görseli",
          seoTitle: form.seoTitle.trim() || form.title.trim(),
          seoDescription: form.seoDescription.trim() || form.excerpt.trim(),
          intro: htmlIntro(form.contentHtml) || form.intro.trim() || form.excerpt.trim(),
          contentHtml: form.contentHtml,
          examCta: {
            eyebrow: form.examCta.eyebrow,
            title: form.examCta.title,
            description: form.examCta.description,
            label: form.examCta.label,
            href: form.examCta.href,
          },
          faqItems: form.faqItems,
          sections: [],
        },
      }, previewOrigin);
    }

    window.addEventListener("message", receiveReady);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canSave) return;
    if (["published", "scheduled"].includes(form.status) && !form.publishedAt) {
      setError("Yayına alınacak yazı için yayın tarihi zorunlu.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const shouldDeferPublishing =
        mode === "create" &&
        form.status === "published" &&
        Boolean(coverFile) &&
        !form.coverUrl.trim();
      const payload = {
        slug: form.slug.trim(),
        category: form.category.trim(),
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        status: shouldDeferPublishing ? "draft" : form.status,
        is_featured: form.isFeatured,
        reading_minutes: Number(form.readingMinutes),
        author: form.author.trim(),
        published_at: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        cover_url: form.coverUrl.trim() || null,
        cover_alt: form.coverAlt.trim(),
        seo_title: form.seoTitle.trim(),
        seo_description: form.seoDescription.trim(),
        intro: htmlIntro(form.contentHtml) || markdownIntro(form.contentMarkdown) || form.intro.trim() || form.excerpt.trim(),
        content_markdown: form.contentMarkdown.trim() || null,
        content_html: form.contentHtml.trim(),
        exam_cta: form.examCta,
        sections: [],
        faq_items: form.faqItems,
      };

      const response = await adminApiRequest<{ post: AdminBlogPost }>(
        mode === "edit" ? `/admin/blog-posts/${postId}` : "/admin/blog-posts",
        {
          token,
          method: mode === "edit" ? "PUT" : "POST",
          body: payload,
        },
      );
      const savedPost = response.data.post;

      if (coverFile) {
        const coverData = new FormData();
        coverData.append("cover", coverFile);
        await adminApiRequest<{ post: AdminBlogPost }>(
          `/admin/blog-posts/${savedPost.id}/cover`,
          { token, method: "POST", body: coverData },
        );
      }

      if (shouldDeferPublishing) {
        await adminApiRequest<{ post: AdminBlogPost }>(
          `/admin/blog-posts/${savedPost.id}`,
          {
            token,
            method: "PUT",
            body: { ...payload, status: "published" },
          },
        );
      }

      showToast({
        tone: "success",
        title: mode === "edit" ? "Blog yazısı güncellendi" : "Blog yazısı oluşturuldu",
        description: form.title,
      });
      router.push("/sayfa-yonetimi/bloglar");
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Blog yazısı kaydedilemedi.";
      setError(message);
      showToast({ tone: "error", title: "Kayıt başarısız", description: message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonBlock className="h-[720px] rounded-[24px]" />;

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="admin-card flex flex-wrap items-end justify-between gap-5 px-6 py-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-warn)]">
            Sayfa Yönetimi · Blog
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">
            {mode === "edit" ? "Blog Yazısını Düzenle" : "Yeni Blog Yazısı"}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-admin-muted)]">
            İçerik, SEO, OG ve yayın bilgileri bu kayıttan otomatik üretilir.
          </p>
        </div>
        <div className="flex gap-3">
          <Link className="admin-button admin-button-secondary" href="/sayfa-yonetimi/bloglar">
            <ArrowLeft size={17} /> Vazgeç
          </Link>
          <button className="admin-button admin-button-secondary" type="button" onClick={handlePreview}>
            <Eye size={17} /> Önizle
          </button>
          <button className="admin-button admin-button-primary" disabled={!canSave || saving} type="submit">
            <Save size={17} /> {saving ? "Kaydediliyor" : "Kaydet"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <FormCard title="Yazı Bilgileri" description="Blog listeleme ve detay sayfasında görünen temel alanlar.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Başlık" className="md:col-span-2">
                <input
                  className={fieldClass}
                  value={form.title}
                  onChange={(event) => setField("title", event.target.value)}
                  onBlur={() => {
                    if (!form.slug) setField("slug", slugify(form.title));
                    if (!form.seoTitle) setField("seoTitle", `${form.title} | Memurlar Akademi`);
                  }}
                />
              </Field>
              <Field label="Slug" hint="Yalnız küçük harf, rakam ve tire">
                <div className="flex gap-2">
                  <input className={fieldClass} value={form.slug} onChange={(event) => setField("slug", slugify(event.target.value))} />
                  <button className="mt-2 rounded-2xl border border-[var(--color-admin-line)] px-3 text-xs font-bold text-[var(--color-admin-ink)]" type="button" onClick={() => setField("slug", slugify(form.title))}>
                    Üret
                  </button>
                </div>
              </Field>
              <Field label="Kategori">
                <input className={fieldClass} value={form.category} onChange={(event) => setField("category", event.target.value)} />
              </Field>
              <Field label="Kısa Özet" hint={`${form.excerpt.length}/700`} className="md:col-span-2">
                <textarea className={textareaClass} rows={3} value={form.excerpt} onChange={(event) => setField("excerpt", event.target.value)} />
              </Field>
            </div>
          </FormCard>

          <FormCard
            title="Blog İçeriği"
            description="Başlık, bağlantı, liste, alıntı, tablo ve CTA bloklarını tek editörden düzenle."
          >
            <RichBlogEditor
              value={form.contentHtml}
              defaultCta={{
                eyebrow: form.examCta.eyebrow,
                title: form.examCta.title,
                description: form.examCta.description,
                primaryLabel: form.examCta.label,
                primaryHref: form.examCta.href,
                secondaryLabel: "Hemen Kayıt Ol",
                secondaryHref: "/kayit",
              }}
              onChange={(contentHtml) => setField("contentHtml", contentHtml)}
            />
            <p className="mt-3 text-xs text-[var(--color-admin-muted)]">
              Araç çubuğundaki CTA butonu, düzenlenebilir CTA bloğunu imlecin bulunduğu yere ekler.
            </p>
          </FormCard>

          <FormCard
            title="Sık Sorulan Sorular"
            description="Sorular blog içeriğinin en altında gösterilir ve FAQ schema verisi otomatik oluşturulur."
          >
            <div className="space-y-4">
              {form.faqItems.map((item, index) => (
                <div
                  className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-5"
                  key={`faq-${index}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-[var(--color-admin-ink)]">
                      Soru {index + 1}
                    </strong>
                    <button
                      aria-label={`Soru ${index + 1} alanını sil`}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50"
                      type="button"
                      onClick={() => setField("faqItems", form.faqItems.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Field label="Soru">
                    <input
                      className={fieldClass}
                      value={item.question}
                      onChange={(event) => {
                        const faqItems = [...form.faqItems];
                        faqItems[index] = { ...item, question: event.target.value };
                        setField("faqItems", faqItems);
                      }}
                    />
                  </Field>
                  <Field label="Cevap">
                    <textarea
                      className={textareaClass}
                      rows={4}
                      value={item.answer}
                      onChange={(event) => {
                        const faqItems = [...form.faqItems];
                        faqItems[index] = { ...item, answer: event.target.value };
                        setField("faqItems", faqItems);
                      }}
                    />
                  </Field>
                </div>
              ))}

              <button
                className="admin-button admin-button-secondary w-full justify-center"
                type="button"
                onClick={() => setField("faqItems", [...form.faqItems, { question: "", answer: "" }])}
              >
                <Plus size={17} />
                Soru Ekle
              </button>
            </div>
          </FormCard>

          <FormCard title="Yan Panel ve Sayfa Altı CTA’sı" description="Editör içindeki CTA’lardan bağımsız olarak blogun yan panelinde ve sayfa sonunda gösterilir.">
            <div className="grid gap-5 md:grid-cols-2">
              {([
                ["eyebrow", "Üst Etiket"],
                ["title", "CTA Başlığı"],
                ["label", "Buton Yazısı"],
                ["href", "Buton Linki"],
              ] as const).map(([key, label]) => (
                <Field label={label} key={key}>
                  <input className={fieldClass} value={form.examCta[key]} onChange={(event) => setField("examCta", { ...form.examCta, [key]: event.target.value })} />
                </Field>
              ))}
              <Field label="CTA Açıklaması" className="md:col-span-2">
                <textarea className={textareaClass} rows={3} value={form.examCta.description} onChange={(event) => setField("examCta", { ...form.examCta, description: event.target.value })} />
              </Field>
            </div>
          </FormCard>
        </div>

        <aside className="space-y-6">
          <FormCard title="Yayın Ayarları">
            <Field label="Durum">
              <select className={fieldClass} value={form.status} onChange={(event) => setField("status", event.target.value as FormState["status"])}>
                <option value="draft">Taslak</option>
                <option value="published">Yayında</option>
                <option value="scheduled">Zamanlandı</option>
                <option value="archived">Arşiv</option>
              </select>
            </Field>
            <Field label="Yayın Tarihi">
              <input className={fieldClass} type="datetime-local" value={form.publishedAt} onChange={(event) => setField("publishedAt", event.target.value)} />
            </Field>
            <Field label="Okuma Süresi (dk)">
              <input className={fieldClass} min={1} max={120} type="number" value={form.readingMinutes} onChange={(event) => setField("readingMinutes", event.target.value)} />
            </Field>
            <Field label="Yazar">
              <input className={fieldClass} value={form.author} onChange={(event) => setField("author", event.target.value)} />
            </Field>
            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--color-admin-line)] p-4">
              <input type="checkbox" checked={form.isFeatured} onChange={(event) => setField("isFeatured", event.target.checked)} />
              <span>
                <strong className="block text-sm text-[var(--color-admin-ink)]">Öne çıkan yazı</strong>
                <small className="text-[var(--color-admin-muted)]">Blog sayfasının üst kartında gösterilir.</small>
              </span>
            </label>
          </FormCard>

          <FormCard title="Kapak Görseli">
            {coverPreviewUrl ? (
              <div className="mb-4 overflow-hidden rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={form.coverAlt || "Blog kapak görseli önizlemesi"}
                  className="aspect-[5/3] w-full object-cover"
                  src={coverPreviewUrl}
                />
              </div>
            ) : null}
            <label className="flex cursor-pointer flex-col items-center rounded-[22px] border border-dashed border-[var(--color-admin-warn)] px-4 py-7 text-center">
              <FileImage size={28} className="text-[var(--color-admin-warn)]" />
              <strong className="mt-3 text-sm text-[var(--color-admin-ink)]">
                {coverFile?.name ?? (hasUploadedCover ? "Yüklü görseli değiştir" : "Görsel yükle")}
              </strong>
              <small className="mt-1 text-[var(--color-admin-muted)]">JPG, PNG veya WebP · en fazla 6 MB</small>
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
            </label>
            <Field label="Görsel Alt Metni">
              <textarea className={textareaClass} rows={3} value={form.coverAlt} onChange={(event) => setField("coverAlt", event.target.value)} />
            </Field>
          </FormCard>

          <FormCard title="SEO ve Paylaşım">
            <Field label="Meta Title" hint={`${form.seoTitle.length} karakter`}>
              <textarea className={textareaClass} rows={3} value={form.seoTitle} onChange={(event) => setField("seoTitle", event.target.value)} />
            </Field>
            <Field label="Meta Description" hint={`${form.seoDescription.length} karakter`}>
              <textarea className={textareaClass} rows={5} value={form.seoDescription} onChange={(event) => setField("seoDescription", event.target.value)} />
            </Field>
            <div className="mt-5 rounded-2xl border border-[var(--color-admin-line)] bg-white p-4">
              <small className="text-emerald-700">memurlarakademi.com › blog › {form.slug || "slug"}</small>
              <strong className="mt-2 block text-[16px] leading-6 text-[#1a0dab]">{form.seoTitle || form.title || "Meta başlığı"}</strong>
              <p className="mt-1 text-xs leading-5 text-slate-600">{form.seoDescription || "Meta açıklaması burada görünecek."}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--color-admin-muted)]">
              Canonical URL, Article schema, breadcrumb schema, OG görseli ve sitemap kaydı yayın durumuna göre otomatik oluşturulur.
            </p>
          </FormCard>
        </aside>
      </div>
    </form>
  );
}

function FormCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="admin-card px-6 py-6">
      <h2 className="text-xl font-extrabold text-[var(--color-admin-ink)]">{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-[var(--color-admin-muted)]">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`mt-5 block first:mt-0 ${className}`}>
      <span className="flex items-center justify-between gap-3 text-sm font-extrabold text-[var(--color-admin-ink)]">
        {label}
        {hint ? <small className="font-medium text-[var(--color-admin-muted)]">{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}
