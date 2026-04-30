"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

type InlineSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
};

type ContentBlock =
  | { type: "heading"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "section_heading"; content: string }
  | { type: "section_title"; content: string }
  | { type: "subheading"; content: string }
  | { type: "list" | "ordered_list" | "alpha_list"; items: string[] }
  | { type: "article_line" | "rich_paragraph"; segments: InlineSegment[] }
  | { type: "table"; headers?: string[]; rows: string[][] }
  | {
      type: string;
      content?: string;
      items?: string[];
      headers?: string[];
      rows?: string[][];
      segments?: InlineSegment[];
    };

type Props = {
  blocks: Array<Record<string, unknown>> | null;
  onChange: (nextBlocks: Array<Record<string, unknown>>) => void;
};

function normalizeBlocks(blocks?: Array<Record<string, unknown>> | null): ContentBlock[] {
  if (!blocks?.length) {
    return [];
  }

  return blocks.filter(
    (block): block is ContentBlock =>
      typeof block === "object" && block !== null && typeof block.type === "string",
  );
}

function hasTextContent(block: ContentBlock): block is Extract<ContentBlock, { content: string }> {
  return "content" in block && typeof block.content === "string";
}

function hasSegments(block: ContentBlock): block is Extract<ContentBlock, { segments: InlineSegment[] }> {
  return "segments" in block && Array.isArray(block.segments);
}

function hasItems(block: ContentBlock): block is Extract<ContentBlock, { items: string[] }> {
  return "items" in block && Array.isArray(block.items);
}

function renderSegments(segments: InlineSegment[]) {
  return segments.map((segment, index) => {
    let className = "";

    if (segment.bold) {
      className += " font-semibold text-slate-900";
    }

    if (segment.italic) {
      className += " italic";
    }

    if (segment.underline) {
      className += " underline";
    }

    const key = `${segment.text}-${index}`;

    if (segment.href) {
      return (
        <a
          className={`text-[var(--color-admin-accent)] underline-offset-2 hover:underline${className}`}
          href={segment.href}
          key={key}
          rel="noreferrer"
          target="_blank"
        >
          {segment.text}
        </a>
      );
    }

    return (
      <span className={className.trim()} key={key}>
        {segment.text}
      </span>
    );
  });
}

function splitAlphaItem(item: string) {
  const match = item.match(/^([a-zçğıöşü]\))\s*(.+)$/iu);
  if (!match) {
    return null;
  }

  const label = match[1];
  const rest = match[2];
  const colonIndex = rest.indexOf(":");

  if (colonIndex === -1) {
    return { label, term: null, description: rest };
  }

  return {
    label,
    term: rest.slice(0, colonIndex).trim(),
    description: rest.slice(colonIndex + 1).trim(),
  };
}

function renderPreviewBlock(block: ContentBlock, index: number) {
  if ((block.type === "article_line" || block.type === "rich_paragraph") && Array.isArray(block.segments)) {
    return (
      <p className="mb-2 text-slate-700 leading-relaxed last:mb-0" key={`${block.type}-${index}`}>
        {renderSegments(block.segments)}
      </p>
    );
  }

  if (block.type === "paragraph" && block.content) {
    return (
      <p className="mb-2 text-slate-700 leading-relaxed last:mb-0" key={`${block.type}-${index}`}>
        {block.content}
      </p>
    );
  }

  if (block.type === "heading" && block.content) {
    return (
      <h4 className="mb-2 text-base font-semibold text-slate-900" key={`${block.type}-${index}`}>
        {block.content}
      </h4>
    );
  }

  if ((block.type === "list" || block.type === "ordered_list") && Array.isArray(block.items)) {
    const ListTag = block.type === "ordered_list" ? "ol" : "ul";
    const className = block.type === "ordered_list" ? "list-decimal space-y-2 pl-5 text-slate-700" : "space-y-2 text-slate-700";

    return (
      <ListTag className={className} key={`${block.type}-${index}`}>
        {block.items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>{item}</li>
        ))}
      </ListTag>
    );
  }

  if (block.type === "alpha_list" && Array.isArray(block.items)) {
    return (
      <dl className="space-y-3 text-sm" key={`${block.type}-${index}`}>
        {block.items.map((item, itemIndex) => {
          const parsed = splitAlphaItem(item);

          if (!parsed) {
            return (
              <div className="text-slate-700" key={`${index}-${itemIndex}`}>
                {item}
              </div>
            );
          }

          return (
            <div className="flex gap-3" key={`${index}-${itemIndex}`}>
              <dt className="w-8 shrink-0 font-semibold text-slate-900">{parsed.label}</dt>
              <dd className="text-slate-700">
                {parsed.term ? <span className="font-semibold text-slate-900">{parsed.term}:</span> : null} {parsed.description}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  if (block.type === "table" && Array.isArray(block.rows)) {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200" key={`${block.type}-${index}`}>
        <table className="min-w-full border-collapse text-sm text-slate-700">
          {Array.isArray(block.headers) && block.headers.length > 0 ? (
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {block.headers.map((header, headerIndex) => (
                  <th className="border-b border-slate-200 p-3 text-left text-xs font-semibold" key={`${index}-header-${headerIndex}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr className={rowIndex % 2 === 1 ? "bg-slate-50" : ""} key={`${index}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td className="border-b border-slate-100 p-3 align-top last:border-b-0" key={`${index}-cell-${rowIndex}-${cellIndex}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (hasTextContent(block)) {
    return (
      <p className="mb-2 text-slate-700 leading-relaxed last:mb-0" key={`${block.type}-${index}`}>
        {block.content}
      </p>
    );
  }

  return null;
}

function updateBlock(
  blocks: ContentBlock[],
  index: number,
  updater: (current: ContentBlock) => ContentBlock,
) {
  return blocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block));
}

function getBlockSurfaceClasses(block: ContentBlock) {
  switch (block.type) {
    case "section_heading":
      return "border-blue-100 bg-blue-50/60";
    case "section_title":
      return "border-slate-200 bg-slate-50/70";
    case "subheading":
      return "border-slate-200 bg-white";
    case "article_line":
      return "border-slate-200 bg-white";
    case "alpha_list":
      return "border-slate-200 bg-slate-50/40";
    case "table":
      return "border-slate-200 bg-slate-50/40";
    default:
      return "border-slate-200 bg-white";
  }
}

function getBlockPlaceholder(block: ContentBlock, index?: number) {
  switch (block.type) {
    case "section_heading":
      return "KISIM - I";
    case "section_title":
      return "Konu başlığı";
    case "subheading":
      return "Alt başlık";
    case "heading":
      return "Ara başlık";
    case "paragraph":
      return "Paragraf metni";
    case "rich_paragraph":
      return "Vurgulu metin";
    case "article_line":
      return index === 0 ? "MADDE 1 – " : "Madde metni";
    default:
      return "İçerik";
  }
}

function defaultBlock(type: "paragraph" | "subheading" | "article_line" | "alpha_list"): ContentBlock {
  if (type === "article_line") {
    return {
      type: "article_line",
      segments: [
        { text: "MADDE X – ", bold: true },
        { text: "Yeni madde metni" },
      ],
    };
  }

  if (type === "alpha_list") {
    return {
      type: "alpha_list",
      items: ["a) Yeni bent"],
    };
  }

  return {
    type,
    content: type === "subheading" ? "Yeni alt başlık" : "Yeni paragraf",
  };
}

export default function StructuredTopicContentEditor({ blocks, onChange }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const normalizedBlocks = normalizeBlocks(blocks);
  const editableBlocks =
    normalizedBlocks.length > 0
      ? normalizedBlocks
      : [
          {
            type: "paragraph",
            content: "",
          } satisfies ContentBlock,
        ];

  function commit(nextBlocks: ContentBlock[]) {
    onChange(nextBlocks as Array<Record<string, unknown>>);
  }

  function updateSegmentText(blockIndex: number, segmentIndex: number, value: string) {
    commit(
      updateBlock(editableBlocks, blockIndex, (current) => ({
        ...current,
        segments: (hasSegments(current) ? current.segments : []).map((item, itemIndex) =>
          itemIndex === segmentIndex ? { ...item, text: value } : item,
        ),
      })),
    );
  }

  function renderInlineEditor(block: ContentBlock, index: number) {
    return (
      <div className="mt-3 rounded-[18px] border border-[var(--color-admin-line)] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        {"content" in block && typeof block.content === "string" ? (
          <textarea
            autoFocus
            className={`admin-input resize-y ${
              block.type === "section_title"
                ? "min-h-[86px] text-2xl font-bold tracking-[-0.04em] text-slate-900"
                : block.type === "section_heading"
                  ? "min-h-[64px] text-sm font-semibold uppercase tracking-[0.18em] text-slate-700"
                  : block.type === "subheading" || block.type === "heading"
                    ? "min-h-[72px] text-lg font-semibold text-slate-900"
                    : "min-h-[92px] text-sm leading-7"
            }`}
            onChange={(event) =>
              commit(
                updateBlock(editableBlocks, index, (current) => ({
                  ...current,
                  content: event.target.value,
                })),
              )
            }
            placeholder={getBlockPlaceholder(block)}
            value={block.content}
          />
        ) : null}

        {hasSegments(block) ? (
          <div className="space-y-3">
            {block.segments.map((segment, segmentIndex) => (
              <textarea
                autoFocus={segmentIndex === 0}
                className={`admin-input min-h-[74px] resize-y ${
                  segment.bold ? "text-base font-semibold text-slate-900" : "text-sm leading-7 text-slate-700"
                }`}
                key={`${index}-segment-${segmentIndex}`}
                onChange={(event) => updateSegmentText(index, segmentIndex, event.target.value)}
                placeholder={getBlockPlaceholder(block, segmentIndex)}
                value={segment.text}
              />
            ))}
          </div>
        ) : null}

        {hasItems(block) ? (
          <div className="space-y-3">
            {block.items.map((item, itemIndex) => (
              <textarea
                autoFocus={itemIndex === 0}
                className="admin-input min-h-[74px] resize-y"
                key={`${index}-item-${itemIndex}`}
                onChange={(event) =>
                  commit(
                    updateBlock(editableBlocks, index, (current) => ({
                      ...current,
                      items: (hasItems(current) ? current.items : []).map((entry, entryIndex) =>
                        entryIndex === itemIndex ? event.target.value : entry,
                      ),
                    })),
                  )
                }
                placeholder={block.type === "alpha_list" ? `Bent ${itemIndex + 1}` : `Satır ${itemIndex + 1}`}
                value={item}
              />
            ))}
          </div>
        ) : null}

        {block.type === "table" && Array.isArray(block.rows) ? (
          <div className="space-y-3">
            {Array.isArray(block.headers) && block.headers.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {block.headers.map((header, headerIndex) => (
                  <input
                    autoFocus={headerIndex === 0}
                    className="admin-input h-11 text-sm font-semibold text-slate-700"
                    key={`${index}-header-${headerIndex}`}
                    onChange={(event) =>
                      commit(
                        updateBlock(editableBlocks, index, (current) => ({
                          ...current,
                          headers:
                            current.type === "table" && Array.isArray(current.headers)
                              ? current.headers.map((item, currentIndex) =>
                                  currentIndex === headerIndex ? event.target.value : item,
                                )
                              : [],
                        })),
                      )
                    }
                    placeholder={`Sütun ${headerIndex + 1}`}
                    value={header}
                  />
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              {block.rows.map((row, rowIndex) => (
                <div className="grid gap-2 md:grid-cols-2" key={`${index}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <textarea
                      className="admin-input min-h-[70px] resize-y text-sm leading-6"
                      key={`${index}-cell-${rowIndex}-${cellIndex}`}
                      onChange={(event) =>
                        commit(
                          updateBlock(editableBlocks, index, (current) => ({
                            ...current,
                            rows:
                              current.type === "table" && Array.isArray(current.rows)
                                ? current.rows.map((currentRow, currentRowIndex) =>
                                    currentRowIndex === rowIndex
                                      ? currentRow.map((currentCell, currentCellIndex) =>
                                          currentCellIndex === cellIndex ? event.target.value : currentCell,
                                        )
                                      : currentRow,
                                  )
                                : [],
                          })),
                        )
                      }
                      placeholder={`Satır ${rowIndex + 1} / Hücre ${cellIndex + 1}`}
                      value={cell}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end">
          <button
            className="admin-button admin-button-secondary"
            onClick={() => setEditingIndex(null)}
            type="button"
          >
            Düzenlemeyi kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-[var(--color-admin-line)] bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">Kullanıcı görünümü</p>
          <p className="mt-1 text-sm text-[var(--color-admin-muted)]">Konu çalışma ekranında görünecek akış. Hata gördüğün yerde direkt düzenle.</p>
        </div>
        <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
          {editableBlocks.length} parça
        </span>
      </div>

      <div className="max-h-[620px] overflow-y-auto rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
        <div className="space-y-6">
          {editableBlocks.map((block, index) => (
            <div className="group relative" key={`${block.type}-${index}`}>
              <div className="absolute right-0 top-0 z-10 flex translate-y-[-10px] items-center gap-2 opacity-0 transition group-hover:opacity-100">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-white text-[var(--color-admin-muted)] shadow-sm transition hover:text-[var(--color-admin-accent)]"
                  onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                  type="button"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-100 bg-white text-[var(--color-admin-danger)] shadow-sm transition hover:bg-red-50"
                  onClick={() => {
                    commit(editableBlocks.filter((_, blockIndex) => blockIndex !== index));
                    setEditingIndex((current) => (current === index ? null : current));
                  }}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {block.type === "section_heading" && hasTextContent(block) ? (
                <div className="inline-block rounded-full bg-[var(--color-admin-accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-admin-accent)]">
                  {block.content}
                </div>
              ) : null}

              {block.type === "section_title" && hasTextContent(block) ? (
                <h2 className="text-2xl font-bold text-slate-900">{block.content}</h2>
              ) : null}

              {block.type === "subheading" && hasTextContent(block) ? (
                <h3 className="text-lg font-semibold text-slate-900">{block.content}</h3>
              ) : null}

              {block.type !== "section_heading" && block.type !== "section_title" && block.type !== "subheading"
                ? renderPreviewBlock(block, index)
                : null}

              {editingIndex === index ? renderInlineEditor(block, index) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["paragraph", "subheading", "article_line", "alpha_list"] as const).map((type) => (
          <button
            className="admin-button admin-button-secondary"
            key={type}
            onClick={() => {
              commit([...editableBlocks, defaultBlock(type)]);
              setEditingIndex(editableBlocks.length);
            }}
            type="button"
          >
            <Plus size={15} />
            {type === "paragraph"
              ? "Paragraf ekle"
              : type === "subheading"
                ? "Alt baslik ekle"
                : type === "article_line"
                  ? "Madde ekle"
                  : "Bent ekle"}
          </button>
        ))}
      </div>
    </div>
  );
}
