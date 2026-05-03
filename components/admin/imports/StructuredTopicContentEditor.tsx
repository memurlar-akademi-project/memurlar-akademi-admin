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

type ListStyle = "alpha" | "ordered" | "unordered" | "roman" | "dash" | "custom";

type StructuredListItem = {
  marker?: string;
  content?: string;
  segments?: InlineSegment[];
  blocks?: ContentBlock[];
  children?: StructuredListItem[];
};

type TableCell = string | {
  content?: string;
  segments?: InlineSegment[];
  blocks?: ContentBlock[];
};

type ContentBlock =
  | { type: "heading"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "section_heading"; content: string }
  | { type: "section_title"; content: string }
  | { type: "subheading"; content: string }
  | { type: "list"; style?: ListStyle; items: StructuredListItem[] }
  | { type: "ordered_list" | "alpha_list"; items: Array<string | StructuredListItem> }
  | { type: "article_line" | "rich_paragraph"; content?: string; segments?: InlineSegment[] }
  | { type: "quote"; content: string }
  | { type: "divider" }
  | { type: "table"; caption?: string; headers?: string[]; rows: TableCell[][] }
  | {
      type: string;
      content?: string;
      items?: Array<string | StructuredListItem>;
      style?: ListStyle;
      caption?: string;
      headers?: string[];
      rows?: TableCell[][];
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

function hasSegments(block: ContentBlock): block is ContentBlock & { segments: InlineSegment[] } {
  return "segments" in block && Array.isArray(block.segments);
}

function stripProcessNotes(value: string) {
  return value
    .replace(
      /\s*\((?:(?:Değişik|Degişik|Değisik|Mülga|Mulga|İptal|Iptal|Aynen kabul|Değiştirilerek kabul|Degistirilerek kabul|Yeniden düzenleme|Yeniden duzenleme)\s*[:\-]|Ek(?:\s+(?:paragraf|fıkra|fikra|cümle|cumle|bent|ibare|madde|iki cümle|iki cumle|üç cümle|uc cumle))?\s*[:\-])[^)]*\)/gi,
      "",
    )
    .replace(/[^\S\r\n]{2,}/g, " ")
    .replace(/[^\S\r\n]+\n/g, "\n")
    .replace(/\n[^\S\r\n]+/g, "\n")
    .trim();
}

function isOnlyProcessNote(value: string) {
  return /^\s*\((?:(?:Değişik|Degişik|Değisik|Mülga|Mulga|İptal|Iptal|Aynen kabul|Değiştirilerek kabul|Degistirilerek kabul|Yeniden düzenleme|Yeniden duzenleme)\s*[:\-]|Ek(?:\s+(?:paragraf|fıkra|fikra|cümle|cumle|bent|ibare|madde|iki cümle|iki cumle|üç cümle|uc cumle))?\s*[:\-])/i.test(value);
}

function blockToSegments(block: ContentBlock, options?: { articleLine?: boolean }): InlineSegment[] {
  const rawSegments = "segments" in block && Array.isArray(block.segments) ? block.segments : [];

  if (rawSegments.length > 0) {
    return rawSegments
      .map((segment) => {
        const text = options?.articleLine ? stripProcessNotes(segment.text) : segment.text;
        return { ...segment, text };
      })
      .filter((segment) => segment.text.trim() && (!options?.articleLine || !isOnlyProcessNote(segment.text)));
  }

  if (!hasTextContent(block)) {
    return [];
  }

  const text = options?.articleLine ? stripProcessNotes(block.content) : block.content.trim();

  if (!text) {
    return [];
  }

  return [
    {
      text,
      bold: Boolean(options?.articleLine),
    },
  ];
}

function hasItems(block: ContentBlock): block is Extract<ContentBlock, { items: Array<string | StructuredListItem> }> {
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

function splitTextParts(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isStructuredListItem(item: string | StructuredListItem): item is StructuredListItem {
  return typeof item === "object" && item !== null;
}

function getListItemBlocks(item: StructuredListItem): ContentBlock[] {
  if (Array.isArray(item.blocks) && item.blocks.length > 0) {
    return item.blocks;
  }

  if (Array.isArray(item.children) && item.children.length > 0) {
    return [
      {
        type: "list",
        style: "alpha",
        items: item.children,
      },
    ];
  }

  if (Array.isArray(item.segments) && item.segments.length > 0) {
    return [
      {
        type: "rich_paragraph",
        segments: item.segments,
      },
    ];
  }

  if (typeof item.content === "string" && item.content.trim()) {
    return splitTextParts(item.content).map((part) => ({
      type: "paragraph",
      content: part,
    }));
  }

  return [];
}

function listItemToEditableText(item: string | StructuredListItem) {
  if (!isStructuredListItem(item)) {
    return item;
  }

  const blocks = getListItemBlocks(item);

  return blocks
    .map((block) => {
      if ("content" in block && typeof block.content === "string") {
        return block.content;
      }

      if ("segments" in block && Array.isArray(block.segments)) {
        return block.segments.map((segment) => segment.text).join("");
      }

      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function updateListItemText(item: string | StructuredListItem, value: string): string | StructuredListItem {
  if (!isStructuredListItem(item)) {
    return value;
  }

  return {
    ...item,
    blocks: splitTextParts(value).map((part) => ({
      type: "paragraph",
      content: part,
    })),
  };
}

function updateListItemMarker(item: string | StructuredListItem, marker: string): StructuredListItem {
  return {
    ...(isStructuredListItem(item) ? item : { blocks: [{ type: "paragraph", content: item }] }),
    marker,
  };
}

function resolveListStyle(block: ContentBlock): ListStyle {
  if (block.type === "alpha_list") {
    return "alpha";
  }

  if (block.type === "ordered_list") {
    return "ordered";
  }

  if (block.type === "list" && block.style) {
    return block.style;
  }

  return "unordered";
}

function renderPreviewListItem(item: string | StructuredListItem, itemIndex: number, style: ListStyle) {
  if (!isStructuredListItem(item)) {
    return (
      <div className="text-slate-700" key={`legacy-${itemIndex}`}>
        {item}
      </div>
    );
  }

  const blocks = getListItemBlocks(item);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-3" key={`${item.marker ?? "item"}-${itemIndex}`}>
      {item.marker ? (
        <dt className="w-9 shrink-0 font-semibold text-slate-900">{item.marker}</dt>
      ) : style === "unordered" ? (
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
      ) : null}
      <dd className="min-w-0 flex-1 space-y-2 text-slate-700">
        {blocks.map((nestedBlock, nestedIndex) => renderPreviewBlock(nestedBlock, nestedIndex))}
      </dd>
    </div>
  );
}

function renderPreviewTableCell(cell: TableCell, index: string) {
  if (typeof cell === "string") {
    return stripProcessNotes(cell);
  }

  const blocks = Array.isArray(cell.blocks)
    ? cell.blocks
    : getListItemBlocks({
        content: cell.content,
        segments: cell.segments,
      });

  return blocks.length > 0 ? (
    <div className="space-y-2" key={index}>
      {blocks.map((block, blockIndex) => renderPreviewBlock(block, blockIndex))}
    </div>
  ) : null;
}

function getTableCellText(cell: TableCell) {
  if (typeof cell === "string") {
    return cell;
  }

  if (typeof cell.content === "string") {
    return cell.content;
  }

  if (Array.isArray(cell.segments)) {
    return cell.segments.map((segment) => segment.text).join("");
  }

  return "";
}

function getTableColumnCount(block: Extract<ContentBlock, { type: "table" }>) {
  const headerCount = Array.isArray(block.headers) ? block.headers.length : 0;
  const rowColumnCount = block.rows.reduce((max, row) => (Array.isArray(row) ? Math.max(max, row.length) : max), 0);

  return Math.max(headerCount, rowColumnCount, 1);
}

function getNormalizedHeaders(block: Extract<ContentBlock, { type: "table" }>, columnCount: number) {
  const headers = Array.isArray(block.headers) ? block.headers : [];

  if (headers.length === 0) {
    return [];
  }

  if (headers.length === columnCount) {
    return headers;
  }

  const hasLeadingLabelColumn = block.rows.some((row) => {
    if (!Array.isArray(row) || row.length !== columnCount) {
      return false;
    }

    const firstCell = getTableCellText(row[0]).trim();
    return firstCell.length > 12 && !/^\d+\.?$/.test(firstCell);
  });

  const missingCount = columnCount - headers.length;
  const blanks = Array.from({ length: Math.max(missingCount, 0) }, () => "");

  return hasLeadingLabelColumn ? [...blanks, ...headers] : [...headers, ...blanks];
}

function getNormalizedRow(row: TableCell[], columnCount: number): Array<{ cell: TableCell; colSpan: number; emphasis?: boolean }> {
  if (row.length === columnCount) {
    return row.map((cell) => ({ cell, colSpan: 1 }));
  }

  if (row.length === 1 && columnCount > 1) {
    return [{ cell: row[0], colSpan: columnCount, emphasis: true }];
  }

  const firstCellText = getTableCellText(row[0]).trim();
  const isTotalRow = /^TOPLAM$/i.test(firstCellText);

  if (isTotalRow && row.length === 2 && columnCount > 2) {
    return [
      { cell: row[0], colSpan: columnCount - 1, emphasis: true },
      { cell: row[1], colSpan: 1, emphasis: true },
    ];
  }

  const shouldPrependBlank = row.length === columnCount - 1 && /^\d+\.?$/.test(firstCellText);
  const blankCell: TableCell = "";
  const normalized = shouldPrependBlank ? [blankCell, ...row] : [...row, ...Array.from({ length: columnCount - row.length }, () => blankCell)];

  return normalized.map((cell) => ({ cell, colSpan: 1 }));
}

function tableCellToEditableText(cell: TableCell) {
  if (typeof cell === "string") {
    return cell;
  }

  const blocks = Array.isArray(cell.blocks)
    ? cell.blocks
    : getListItemBlocks({
        content: cell.content,
        segments: cell.segments,
      });

  return blocks
    .map((block) => {
      if ("content" in block && typeof block.content === "string") {
        return block.content;
      }

      if ("segments" in block && Array.isArray(block.segments)) {
        return block.segments.map((segment) => segment.text).join("");
      }

      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function renderPreviewBlock(block: ContentBlock, index: number) {
  if (block.type === "article_line" || block.type === "rich_paragraph") {
    const segments = blockToSegments(block, { articleLine: block.type === "article_line" });

    if (segments.length === 0) {
      return null;
    }

    return (
      <p className="mb-2 text-slate-700 leading-relaxed last:mb-0" key={`${block.type}-${index}`}>
        {renderSegments(segments)}
      </p>
    );
  }

  if (block.type === "paragraph" && block.content) {
    const content = stripProcessNotes(block.content);

    if (!content) {
      return null;
    }

    return (
      <p className="mb-2 text-slate-700 leading-relaxed last:mb-0" key={`${block.type}-${index}`}>
        {content}
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

  if ((block.type === "list" || block.type === "ordered_list" || block.type === "alpha_list") && Array.isArray(block.items)) {
    const style = resolveListStyle(block);

    return (
      <dl className="space-y-3 text-sm" key={`${block.type}-${index}`}>
        {block.items.map((item, itemIndex) => renderPreviewListItem(item, itemIndex, style))}
      </dl>
    );
  }

  if (block.type === "table" && Array.isArray(block.rows)) {
    const tableBlock = block as Extract<ContentBlock, { type: "table" }>;
    const columnCount = getTableColumnCount(tableBlock);
    const headers = getNormalizedHeaders(tableBlock, columnCount);

    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200" key={`${block.type}-${index}`}>
        {block.caption ? (
          <div className="border-b border-slate-200 bg-slate-50 p-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {block.caption}
          </div>
        ) : null}
        <table className="min-w-full border-collapse text-sm text-slate-700">
          {headers.length > 0 ? (
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {headers.map((header, headerIndex) => (
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
                {getNormalizedRow(row, columnCount).map(({ cell, colSpan, emphasis }, cellIndex) => (
                  <td
                    className={`border-b border-slate-100 p-3 align-top last:border-b-0 ${emphasis ? "bg-slate-100 font-semibold text-slate-800" : ""}`}
                    colSpan={colSpan}
                    key={`${index}-cell-${rowIndex}-${cellIndex}`}
                  >
                    {renderPreviewTableCell(cell, `${index}-cell-content-${rowIndex}-${cellIndex}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "divider") {
    return <hr className="border-slate-200" key={`${block.type}-${index}`} />;
  }

  if (block.type === "quote" && block.content) {
    const content = stripProcessNotes(block.content);

    if (!content) {
      return null;
    }

    return (
      <blockquote className="border-l-4 border-slate-300 bg-white py-2 pl-4 text-sm leading-7 text-slate-700" key={`${block.type}-${index}`}>
        {content}
      </blockquote>
    );
  }

  if (hasTextContent(block)) {
    const content = stripProcessNotes(block.content);

    if (!content) {
      return null;
    }

    return (
      <p className="mb-2 text-slate-700 leading-relaxed last:mb-0" key={`${block.type}-${index}`}>
        {content}
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
      type: "list",
      style: "alpha",
      items: [
        {
          marker: "a)",
          blocks: [
            {
              type: "paragraph",
              content: "Yeni bent",
            },
          ],
        },
      ],
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
              <div className="grid gap-2 md:grid-cols-[92px_1fr]" key={`${index}-item-${itemIndex}`}>
                <input
                  autoFocus={itemIndex === 0}
                  className="admin-input h-11 text-sm font-semibold text-slate-700"
                  onChange={(event) =>
                    commit(
                      updateBlock(editableBlocks, index, (current) => ({
                        ...current,
                        items: (hasItems(current) ? current.items : []).map((entry, entryIndex) =>
                          entryIndex === itemIndex ? updateListItemMarker(entry, event.target.value) : entry,
                        ),
                      })),
                    )
                  }
                  placeholder="a)"
                  value={isStructuredListItem(item) ? item.marker ?? "" : ""}
                />
                <textarea
                  className="admin-input min-h-[74px] resize-y"
                  onChange={(event) =>
                    commit(
                      updateBlock(editableBlocks, index, (current) => ({
                        ...current,
                        items: (hasItems(current) ? current.items : []).map((entry, entryIndex) =>
                          entryIndex === itemIndex ? updateListItemText(entry, event.target.value) : entry,
                        ),
                      })),
                    )
                  }
                  placeholder={block.type === "alpha_list" || block.type === "list" ? `Bent ${itemIndex + 1}` : `Satır ${itemIndex + 1}`}
                  value={listItemToEditableText(item)}
                />
              </div>
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
                      value={tableCellToEditableText(cell)}
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
