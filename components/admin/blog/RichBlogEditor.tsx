"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Quote,
  Redo2,
  Table2,
  Undo2,
  Unlink,
  X,
} from "lucide-react";

export type BlogCtaConfig = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

type RichBlogEditorProps = {
  value: string;
  defaultCta: BlogCtaConfig;
  onChange: (value: string) => void;
};

type CtaModalState = {
  position: number;
  mode: "create" | "edit";
  config: BlogCtaConfig;
};

const emptyCta: BlogCtaConfig = {
  eyebrow: "PAEM İlk Derece Amirlik Eğitim Sınavı",
  title: "Hazırlığını Planlı Bir Programa Dönüştür",
  description: "Konu anlatımları, açıklamalı sorular, denemeler ve AI analiz ile hazırlığını tek platformdan yönet.",
  primaryLabel: "Programı İncele",
  primaryHref: "/sinavlar",
  secondaryLabel: "Hemen Kayıt Ol",
  secondaryHref: "/kayit",
};

function normalizeCta(value: Partial<BlogCtaConfig> | null | undefined): BlogCtaConfig {
  return { ...emptyCta, ...(value ?? {}) };
}

export function encodeCta(value: BlogCtaConfig) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

export function decodeCta(value: string | null): BlogCtaConfig | null {
  if (!value || value === "true") return null;

  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return normalizeCta(JSON.parse(new TextDecoder().decode(bytes)) as Partial<BlogCtaConfig>);
  } catch {
    return null;
  }
}

const BlogCta = Node.create({
  name: "blogCta",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      config: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-blog-cta]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          return { config: decodeCta(element.getAttribute("data-blog-cta")) };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const config = normalizeCta(node.attrs.config as Partial<BlogCtaConfig> | null);
    return [
      "div",
      {
        "data-blog-cta": encodeCta(config),
        class: "blog-cta-node",
      },
      `CTA · ${config.title}`,
    ];
  },
});

export function RichBlogEditor({ value, defaultCta, onChange }: RichBlogEditorProps) {
  const [ctaModal, setCtaModal] = useState<CtaModalState | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),
      TableKit.configure({
        table: { resizable: true },
      }),
      Placeholder.configure({
        placeholder: "Blog içeriğini yazmaya başla…",
      }),
      BlogCta,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "blog-rich-editor__content",
        spellcheck: "true",
      },
      handleClickOn: (_view, position, node) => {
        if (node.type.name !== "blogCta") return false;
        setCtaModal({
          position,
          mode: "edit",
          config: normalizeCta((node.attrs.config as Partial<BlogCtaConfig> | null) ?? defaultCta),
        });
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="h-[680px] animate-pulse rounded-b-2xl bg-[var(--color-admin-panel-soft)]" />;
  }

  function setLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("Bağlantı adresi", previousUrl ?? "https://");

    if (url === null) return;
    if (!url.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function openNewCta() {
    if (!editor) return;

    setCtaModal({
      position: editor.state.selection.from,
      mode: "create",
      config: normalizeCta(defaultCta),
    });
  }

  function saveCta(config: BlogCtaConfig) {
    if (!editor || !ctaModal) return;

    if (ctaModal.mode === "create") {
      editor
        .chain()
        .focus()
        .insertContentAt(ctaModal.position, { type: "blogCta", attrs: { config } })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(ctaModal.position, undefined, { config });
          return true;
        })
        .run();
    }

    setCtaModal(null);
  }

  function deleteCta() {
    if (!editor || !ctaModal || ctaModal.mode !== "edit") return;
    const node = editor.state.doc.nodeAt(ctaModal.position);
    if (!node) return;

    editor
      .chain()
      .focus()
      .deleteRange({ from: ctaModal.position, to: ctaModal.position + node.nodeSize })
      .run();
    setCtaModal(null);
  }

  return (
    <>
      <div className="blog-rich-editor">
        <div className="blog-rich-editor__toolbar" role="toolbar" aria-label="Blog metni biçimlendirme araçları">
          <ToolbarButton active={editor.isActive("heading", { level: 2 })} label="Başlık 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={17} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("heading", { level: 3 })} label="Başlık 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={17} />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("bold")} label="Kalın" onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={17} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} label="İtalik" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={17} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("link")} label="Bağlantı ekle" onClick={setLink}>
            <Link2 size={17} />
          </ToolbarButton>
          <ToolbarButton disabled={!editor.isActive("link")} label="Bağlantıyı kaldır" onClick={() => editor.chain().focus().unsetLink().run()}>
            <Unlink size={17} />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("bulletList")} label="Madde listesi" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={17} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} label="Numaralı liste" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={17} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("blockquote")} label="Alıntı" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote size={17} />
          </ToolbarButton>
          <ToolbarButton label="Tablo ekle" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 size={17} />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton label="CTA yerleştir" onClick={openNewCta} prominent>
            <Megaphone size={17} />
            <span>CTA Ekle</span>
          </ToolbarButton>
          <span className="flex-1" />
          <ToolbarButton disabled={!editor.can().chain().focus().undo().run()} label="Geri al" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 size={17} />
          </ToolbarButton>
          <ToolbarButton disabled={!editor.can().chain().focus().redo().run()} label="İleri al" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 size={17} />
          </ToolbarButton>
        </div>
        <div className="blog-rich-editor__scroller">
          <EditorContent editor={editor} />
        </div>
      </div>

      {ctaModal && typeof document !== "undefined"
        ? createPortal(
            <CtaEditorModal
              state={ctaModal}
              onChange={(config) => setCtaModal((current) => current ? { ...current, config } : current)}
              onClose={() => setCtaModal(null)}
              onDelete={ctaModal.mode === "edit" ? deleteCta : undefined}
              onSave={() => saveCta(ctaModal.config)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function CtaEditorModal({
  state,
  onChange,
  onClose,
  onDelete,
  onSave,
}: {
  state: CtaModalState;
  onChange: (config: BlogCtaConfig) => void;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
}) {
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-3 text-sm text-[var(--color-admin-ink)] outline-none focus:border-[var(--color-admin-warn)]";
  const set = (key: keyof BlogCtaConfig, value: string) => onChange({ ...state.config, [key]: value });
  const safeHref = (value: string) => /^(https?:\/\/|\/|#)/i.test(value);
  const hasSecondaryLabel = Boolean(state.config.secondaryLabel.trim());
  const hasSecondaryHref = Boolean(state.config.secondaryHref.trim());
  const canSave = Boolean(
    state.config.title.trim()
    && state.config.description.trim()
    && state.config.primaryLabel.trim()
    && safeHref(state.config.primaryHref.trim())
    && hasSecondaryLabel === hasSecondaryHref
    && (!hasSecondaryHref || safeHref(state.config.secondaryHref.trim())),
  );

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="cta-modal-title"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] shadow-2xl"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-6 py-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--color-admin-warn)]">Blog CTA</p>
            <h2 id="cta-modal-title" className="mt-1 text-xl font-extrabold text-[var(--color-admin-ink)]">
              {state.mode === "edit" ? "CTA’yı Düzenle" : "Yeni CTA Ekle"}
            </h2>
          </div>
          <button aria-label="Kapat" className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-admin-line)] text-[var(--color-admin-ink)]" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-5 px-6 py-6 md:grid-cols-2">
          <ModalField label="Üst Etiket" className="md:col-span-2">
            <input className={inputClass} value={state.config.eyebrow} onChange={(event) => set("eyebrow", event.target.value)} />
          </ModalField>
          <ModalField label="CTA Başlığı" className="md:col-span-2">
            <input className={inputClass} value={state.config.title} onChange={(event) => set("title", event.target.value)} />
          </ModalField>
          <ModalField label="Açıklama" className="md:col-span-2">
            <textarea className={`${inputClass} h-auto min-h-24 py-3`} value={state.config.description} onChange={(event) => set("description", event.target.value)} />
          </ModalField>
          <ModalField label="Ana Buton Metni">
            <input className={inputClass} value={state.config.primaryLabel} onChange={(event) => set("primaryLabel", event.target.value)} />
          </ModalField>
          <ModalField label="Ana Buton Linki">
            <input className={inputClass} value={state.config.primaryHref} onChange={(event) => set("primaryHref", event.target.value)} />
          </ModalField>
          <ModalField label="İkinci Buton Metni" hint="Boş bırakırsan gösterilmez">
            <input className={inputClass} value={state.config.secondaryLabel} onChange={(event) => set("secondaryLabel", event.target.value)} />
          </ModalField>
          <ModalField label="İkinci Buton Linki" hint="İkinci buton için metin ve link birlikte girilmeli">
            <input className={inputClass} value={state.config.secondaryHref} onChange={(event) => set("secondaryHref", event.target.value)} />
          </ModalField>
        </div>

        <footer className="flex flex-wrap justify-between gap-3 border-t border-[var(--color-admin-line)] px-6 py-5">
          {onDelete ? (
            <button className="admin-button border border-red-200 text-red-600 hover:bg-red-50" type="button" onClick={onDelete}>
              CTA’yı Sil
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button className="admin-button admin-button-secondary" type="button" onClick={onClose}>Vazgeç</button>
            <button className="admin-button admin-button-primary" disabled={!canSave} type="button" onClick={onSave}>
              {state.mode === "edit" ? "Değişiklikleri Kaydet" : "CTA’yı Ekle"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function ModalField({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="flex items-center justify-between gap-3 text-sm font-extrabold text-[var(--color-admin-ink)]">
        {label}
        {hint ? <small className="font-medium text-[var(--color-admin-muted)]">{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  prominent = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  prominent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`blog-rich-editor__tool ${active ? "is-active" : ""} ${prominent ? "is-prominent" : ""}`}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="blog-rich-editor__divider" aria-hidden="true" />;
}
