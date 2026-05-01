"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, GripVertical, Save, Trash2, X } from "lucide-react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import StructuredTopicContentEditor from "@/components/admin/imports/StructuredTopicContentEditor";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminSubject, AdminTopic } from "@/lib/types";

function createTopicTemplate(subjectId: number | null) {
  return `{
  "subject_id": ${subjectId ?? 5},
  "topics": [
    {
      "name": "Amaç, Kapsam, Dayanak, Tanımlar ve İlkeler",
      "status": "draft",
      "content_schema_version": 2,
      "content_blocks": [
        {
          "type": "section_heading",
          "content": "BİRİNCİ BÖLÜM"
        },
        {
          "type": "section_title",
          "content": "Amaç, Kapsam, Dayanak, Tanımlar ve İlkeler"
        },
        {
          "type": "subheading",
          "content": "Amaç ve kapsam"
        },
        {
          "type": "article_line",
          "segments": [
            {
              "text": "MADDE 1 – ",
              "bold": true
            },
            {
              "text": "Bu Yönetmeliğin amacı..."
            }
          ]
        }
      ]
    }
  ]
}`;
}

const topicImportNotes = ["Dersi seç.", "JSON dosyasını yükle veya içeriği yapıştır.", "Import et."];

type ImportedTopicTemplate = {
  name: string;
  slug?: string | null;
  status?: "active" | "passive" | "draft";
  sort_order?: number;
  content_body?: string;
  content_blocks?: Array<Record<string, unknown>> | null;
};

type TopicContentPayload = {
  content: {
    id: number;
    summary: string | null;
    content_body: string;
    content_blocks?: Array<Record<string, unknown>> | null;
    status: string;
    version: number;
    updated_at: string | null;
  } | null;
};

type ReviewTopicItem = {
  id: number;
  subject_id: number;
  subject_name: string | null;
  name: string;
  slug: string;
  status: "active" | "passive" | "draft";
  sort_order: number;
  content_body: string;
  content_blocks: Array<Record<string, unknown>> | null;
  content_ready: boolean;
  dirty: boolean;
  saving: boolean;
  review_state: "new" | "saved" | "approved";
  origin: "existing" | "imported";
};

type SortableTopicListItemProps = {
  item: ReviewTopicItem;
  index: number;
  active: boolean;
  onSelect: (id: number) => void;
  badge: (item: ReviewTopicItem) => React.ReactNode;
};

function segmentsToText(segments: unknown): string {
  if (!Array.isArray(segments)) {
    return "";
  }

  return segments
    .map((segment) =>
      typeof segment === "object" &&
      segment !== null &&
      "text" in segment &&
      typeof segment.text === "string"
        ? segment.text
        : "",
    )
    .join("")
    .trim();
}

function tableCellToText(cell: unknown): string {
  if (typeof cell === "string") {
    return cell;
  }

  if (typeof cell === "object" && cell !== null && "blocks" in cell && Array.isArray(cell.blocks)) {
    return blocksToPlainText(cell.blocks as Array<Record<string, unknown>>).replace(/\s*\n+\s*/g, " ");
  }

  return "";
}

function structuredListItemToText(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }

  if (typeof item !== "object" || item === null) {
    return "";
  }

  const marker = "marker" in item && typeof item.marker === "string" ? item.marker : "";
  const blocks = "blocks" in item && Array.isArray(item.blocks) ? blocksToPlainText(item.blocks as Array<Record<string, unknown>>) : "";
  const content = "content" in item && typeof item.content === "string" ? item.content : "";
  const segments = "segments" in item ? segmentsToText(item.segments) : "";

  return [marker, blocks || content || segments].filter(Boolean).join(" ").trim();
}

function blocksToPlainText(blocks: Array<Record<string, unknown>> | null | undefined): string {
  if (!blocks?.length) {
    return "";
  }

  return blocks
    .map((block) => {
      const content = typeof block.content === "string" ? block.content : "";
      const segments = Array.isArray(block.segments) ? segmentsToText(block.segments) : "";
      const items = Array.isArray(block.items)
        ? block.items.map((item) => structuredListItemToText(item)).filter(Boolean).join("\n")
        : "";
      const table =
        block.type === "table" && Array.isArray(block.rows)
          ? block.rows
              .map((row) => (Array.isArray(row) ? row.map((cell) => tableCellToText(cell)).join("\t") : ""))
              .filter(Boolean)
              .join("\n")
          : "";

      return [content, segments, items, table].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function contentBodyToBlocks(contentBody: string): Array<Record<string, unknown>> {
  const paragraphs = contentBody
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [
      {
        type: "paragraph",
        content: "",
      },
    ];
  }

  return paragraphs.map((paragraph) => ({
    type: "paragraph",
    content: paragraph,
  }));
}

function toWorkspaceTopic(
  topic: AdminTopic,
  subjectName: string | null,
  importedSource?: ImportedTopicTemplate,
): ReviewTopicItem {
  const importedText =
    importedSource?.content_body?.trim() || blocksToPlainText(importedSource?.content_blocks ?? null);

  return {
    id: topic.id,
    subject_id: topic.subject_id,
    subject_name: topic.subject?.name ?? subjectName,
    name: topic.name,
    slug: topic.slug,
    status: (topic.status as ReviewTopicItem["status"]) ?? "draft",
    sort_order: topic.sort_order,
    content_body: importedText,
    content_blocks: importedSource?.content_blocks ?? contentBodyToBlocks(importedText),
    content_ready: importedText !== "",
    dirty: false,
    saving: false,
    review_state: importedSource ? "new" : "saved",
    origin: importedSource ? "imported" : "existing",
  };
}

function SortableTopicListItem({ item, index, active, onSelect, badge }: SortableTopicListItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-[20px] border transition ${
        active
          ? "border-[var(--color-admin-accent)] bg-white text-[var(--color-admin-ink)]"
          : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[var(--color-admin-ink)] hover:border-[var(--color-admin-accent)]/35"
      } ${isDragging ? "opacity-80 shadow-[0_18px_40px_rgba(15,23,42,0.18)]" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          className="mt-0.5 flex shrink-0 cursor-grab items-center gap-2 rounded-xl p-1 text-[var(--color-admin-muted)] active:cursor-grabbing"
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>

        <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(item.id)} type="button">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-admin-line)] text-[11px] font-bold text-[var(--color-admin-muted)]">
              {index + 1}
            </span>

            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold">{item.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-admin-muted)]">
                <span>Sıra {item.sort_order}</span>
                <span>•</span>
                <span>{item.origin === "imported" ? "Yeni" : "Mevcut"}</span>
                <span>•</span>
                <span>{item.status === "active" ? "Aktif" : item.status === "draft" ? "Taslak" : "Pasif"}</span>
                {badge(item)}
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export function TopicImportPage() {
  const searchParams = useSearchParams();
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const subjectIdFromQuery = searchParams.get("subjectId");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(subjectIdFromQuery ? Number(subjectIdFromQuery) : null);
  const [payload, setPayload] = useState(createTopicTemplate(subjectIdFromQuery ? Number(subjectIdFromQuery) : null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceTopics, setWorkspaceTopics] = useState<ReviewTopicItem[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSaveMessage, setBulkSaveMessage] = useState<string | null>(null);

  const orderedWorkspaceTopics = useMemo(() => {
    const pending = workspaceTopics.filter((item) => item.review_state !== "approved");
    const approved = workspaceTopics.filter((item) => item.review_state === "approved");
    return [...pending, ...approved];
  }, [workspaceTopics]);

  const selectedReviewTopic = useMemo(
    () => orderedWorkspaceTopics.find((item) => item.id === selectedTopicId) ?? null,
    [orderedWorkspaceTopics, selectedTopicId],
  );
  const selectedIndex = useMemo(
    () => orderedWorkspaceTopics.findIndex((item) => item.id === selectedTopicId),
    [orderedWorkspaceTopics, selectedTopicId],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadSubjects() {
      setLoading(true);

      try {
        const response = await adminApiRequest<{ subjects: AdminSubject[] }>("/admin/subjects", { token });

        if (!cancelled) {
          setSubjects(response.data.subjects);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Dersler yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSubjects();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: `${subject.topic_count} konu`,
      })),
    [subjects],
  );

  useEffect(() => {
    setPayload(createTopicTemplate(subjectId));
  }, [subjectId]);

  async function fetchSubjectTopics(nextSubjectId: number) {
    if (!token) {
      return [];
    }

    const response = await adminApiRequest<{ topics: AdminTopic[] }>(`/admin/topics?subject_id=${nextSubjectId}`, { token });
    return response.data.topics;
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    file.text().then((text) => setPayload(text)).catch(() => {
      setError("JSON dosyası okunamadı.");
    });
  }

  function updateWorkspaceTopic(id: number, patch: Partial<ReviewTopicItem>) {
    setBulkSaveMessage(null);
    setWorkspaceTopics((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch, dirty: patch.dirty ?? true } : item)),
    );
  }

  async function loadTopicContent(topicId: number) {
    if (!token) {
      return;
    }

    setReviewLoading(true);

    try {
      const response = await adminApiRequest<TopicContentPayload>(`/admin/topics/${topicId}/content`, { token });
      setWorkspaceTopics((current) =>
        current.map((item) =>
          item.id === topicId
            ? {
                ...item,
                content_body: response.data.content?.content_body ?? item.content_body,
                content_blocks:
                  response.data.content?.content_blocks ??
                  item.content_blocks ??
                  contentBodyToBlocks(response.data.content?.content_body ?? item.content_body),
                content_ready: true,
                dirty: false,
              }
            : item,
        ),
      );
    } finally {
      setReviewLoading(false);
    }
  }

  async function persistTopic(item: ReviewTopicItem) {
    if (!token) {
      return item;
    }

    const topicResponse = await adminApiRequest<{ topic: AdminTopic }>(`/admin/topics/${item.id}`, {
      token,
      method: "PUT",
      body: {
        subject_id: item.subject_id,
        name: item.name,
        slug: item.slug || null,
        sort_order: item.sort_order,
        status: item.status,
      },
    });

    if (item.content_ready && (item.content_body.trim() || item.content_blocks)) {
      await adminApiRequest(`/admin/topics/${item.id}/content`, {
        token,
        method: "POST",
        body: {
          summary: null,
          content_body: item.content_body,
          content_blocks: item.content_blocks,
          status: item.status,
        },
      });
    }

    return topicResponse.data.topic;
  }

  async function handleSaveSelected() {
    if (!selectedReviewTopic) {
      return;
    }

    updateWorkspaceTopic(selectedReviewTopic.id, { saving: true, dirty: selectedReviewTopic.dirty });

    try {
      const savedTopic = await persistTopic(selectedReviewTopic);

      setWorkspaceTopics((current) =>
        current.map((item) =>
          item.id === selectedReviewTopic.id
            ? {
                ...item,
                name: savedTopic.name,
                slug: savedTopic.slug,
                status: savedTopic.status as ReviewTopicItem["status"],
                sort_order: savedTopic.sort_order,
                saving: false,
                dirty: false,
                review_state: item.review_state === "approved" ? "approved" : "saved",
              }
            : item,
        ),
      );

      showToast({
        tone: "success",
        title: "Konu kaydedildi",
        description: savedTopic.name,
      });
    } catch (submitError) {
      updateWorkspaceTopic(selectedReviewTopic.id, { saving: false, dirty: selectedReviewTopic.dirty });
      showToast({
        tone: "error",
        title: "Kaydetme başarısız",
        description: submitError instanceof Error ? submitError.message : "Konu güncellenemedi.",
      });
    }
  }

  async function handleSaveAll() {
    if (!token || workspaceTopics.length === 0) {
      return;
    }

    setBulkSaving(true);

    try {
      const nextTopics = [...workspaceTopics];

      for (let index = 0; index < nextTopics.length; index += 1) {
        const item = nextTopics[index];

        if (!item.dirty) {
          continue;
        }

        const savedTopic = await persistTopic(item);
        nextTopics[index] = {
          ...item,
          name: savedTopic.name,
          slug: savedTopic.slug,
          status: savedTopic.status as ReviewTopicItem["status"],
          sort_order: savedTopic.sort_order,
          dirty: false,
          saving: false,
          review_state: item.review_state === "approved" ? "approved" : "saved",
        };
      }

      setWorkspaceTopics(nextTopics);
      setBulkSaveMessage("Tüm değişiklikler kaydedildi. İstersen review’e devam edebilir veya modalı kapatabilirsin.");

      showToast({
        tone: "success",
        title: "Tüm değişiklikler kaydedildi",
        description: `${nextTopics.length} konu güncellendi.`,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Toplu kayıt başarısız",
        description: submitError instanceof Error ? submitError.message : "Kayıt tamamlanamadı.",
      });
    } finally {
      setBulkSaving(false);
    }
  }

  function handleApproveSelected() {
    if (!selectedReviewTopic) {
      return;
    }

    setBulkSaveMessage(null);
    updateWorkspaceTopic(selectedReviewTopic.id, {
      status: "active",
      review_state: "approved",
    });

    const next = orderedWorkspaceTopics[selectedIndex + 1];
    if (next) {
      setSelectedTopicId(next.id);
    }
  }

  async function handleDeleteSelected() {
    if (!token || !selectedReviewTopic) {
      return;
    }

    try {
      await adminApiRequest(`/admin/topics/${selectedReviewTopic.id}`, {
        token,
        method: "DELETE",
      });

      const nextTopics = workspaceTopics.filter((item) => item.id !== selectedReviewTopic.id);
      setWorkspaceTopics(nextTopics);
      setSelectedTopicId(nextTopics[0]?.id ?? null);

      if (nextTopics.length === 0) {
        setReviewOpen(false);
      }

      showToast({
        tone: "success",
        title: "Konu silindi",
        description: selectedReviewTopic.name,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Konu silinemedi",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setBulkSaveMessage(null);
    setWorkspaceTopics((current) => {
      const pending = current.filter((item) => item.review_state !== "approved");
      const approved = current.filter((item) => item.review_state === "approved");
      const oldIndex = pending.findIndex((item) => item.id === active.id);
      const newIndex = pending.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return current;
      }

      const reorderedPending = arrayMove(pending, oldIndex, newIndex);
      return [...reorderedPending, ...approved].map((item, index) => ({
        ...item,
        sort_order: index + 1,
        dirty: true,
      }));
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !subjectId) {
      setError("Bir ders seçmelisin.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const parsed = JSON.parse(payload) as unknown;

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { topics?: unknown[] }).topics) ||
        typeof (parsed as { subject_id?: unknown }).subject_id !== "number"
      ) {
        throw new Error("JSON kökü `subject_id` ve `topics` alanlarını içeren bir obje olmalı.");
      }

      const normalizedPayload = parsed as { subject_id: number; topics: ImportedTopicTemplate[] };
      const invalidTopicIndex = normalizedPayload.topics.findIndex(
        (topic) => !Array.isArray(topic.content_blocks) || topic.content_blocks.length === 0,
      );

      if (invalidTopicIndex !== -1) {
        throw new Error(
          `${invalidTopicIndex + 1}. konu için dolu content_blocks zorunlu. Düz content_body ile konu import edilemez.`,
        );
      }

      const importResponse = await adminApiRequest<{
        topics: Array<Pick<AdminTopic, "id" | "name" | "slug" | "status" | "sort_order" | "subject">>;
      }>("/admin/topics/import", {
        token,
        method: "POST",
        body: {
          subject_id: normalizedPayload.subject_id,
          topics: normalizedPayload.topics,
        },
      });

      const subjectName = subjects.find((subject) => subject.id === normalizedPayload.subject_id)?.name ?? null;
      const importedTopicMap = new Map(
        importResponse.data.topics.map((topic, index) => [topic.id, normalizedPayload.topics[index]]),
      );
      const allTopics = await fetchSubjectTopics(normalizedPayload.subject_id);

      const nextWorkspaceTopics = allTopics
        .map((topic) => toWorkspaceTopic(topic, subjectName, importedTopicMap.get(topic.id)))
        .sort((left, right) => left.sort_order - right.sort_order);

      setWorkspaceTopics(nextWorkspaceTopics);
      setBulkSaveMessage(null);
      setSelectedTopicId(importResponse.data.topics[0]?.id ?? nextWorkspaceTopics[0]?.id ?? null);
      setReviewOpen(true);

      showToast({
        tone: "success",
        title: "Konular içe aktarıldı",
        description: subjectName ?? "Ders havuzu",
      });
    } catch (submitError) {
      const description =
        submitError instanceof Error ? submitError.message : "Konu import işlemi başarısız oldu.";
      setError(description);
      showToast({
        tone: "error",
        title: "Import tamamlanamadı",
        description,
      });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!reviewOpen || !selectedReviewTopic || !token || selectedReviewTopic.content_ready) {
      return;
    }

    void loadTopicContent(selectedReviewTopic.id);
  }, [reviewOpen, selectedReviewTopic, token]);

  function renderReviewStateBadge(item: ReviewTopicItem) {
    if (item.dirty) {
      return (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          Düzenlendi
        </span>
      );
    }

    if (item.review_state === "approved") {
      return (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          Onaylandı
        </span>
      );
    }

    if (item.review_state === "saved") {
      return (
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
          Kaydedildi
        </span>
      );
    }

    return (
      <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-admin-muted)]">
        Yeni
      </span>
    );
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <AdminTableCard>
            <form className="space-y-5 px-5 py-5" id="topic-import-form" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <h3 className="text-base font-bold tracking-[-0.03em] text-[var(--color-admin-ink)]">Konu JSON Import</h3>
                <p className="text-sm text-[var(--color-admin-muted)]">Dersi seç, JSON&apos;u yükle veya yapıştır, import et.</p>
              </div>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  Ders
                </span>
                <AdminSearchSelect
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={setSubjectId}
                  options={subjectOptions}
                  placeholder="Ders seç"
                  value={subjectId}
                />
              </label>

              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <label className="block space-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    JSON Dosyası
                  </span>
                  <input accept=".json,application/json" className="admin-input h-11" onChange={handleFileUpload} type="file" />
                </label>

                <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Akış</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--color-admin-ink)]">
                    {topicImportNotes.map((item, index) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] text-[11px] font-bold text-[var(--color-admin-muted)]">
                          {index + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  JSON İçeriği
                </span>
                <textarea
                  className="admin-input min-h-[460px] font-mono text-[13px] leading-6"
                  onChange={(event) => setPayload(event.target.value)}
                  value={payload}
                />
              </label>

              {error ? (
                <div className="rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                  {error}
                </div>
              ) : null}
            </form>
          </AdminTableCard>
        </div>

        <div className="space-y-4">
          <AdminFormActionsCard cancelHref="/konular" formId="topic-import-form" saving={saving} submitLabel="Import Et" />

          <AdminTableCard>
            <div className="px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                  Beklenen JSON
                </h3>
                <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                  {loading ? "..." : `${subjects.length} ders`}
                </span>
              </div>

              <pre className="mt-4 overflow-x-auto rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-4 text-[12px] leading-6 text-[var(--color-admin-ink)]">
{createTopicTemplate(subjectId)}
              </pre>

              <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm text-[var(--color-admin-muted)]">
                `subject_id` ve `topics` kökü zorunlu. Her konu için dolu `content_blocks` gönderilmelidir; yalnız `content_body` ile import kabul edilmez.
              </div>
            </div>
          </AdminTableCard>
        </div>
      </div>

      {reviewOpen && selectedReviewTopic ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="flex h-[min(92vh,980px)] w-[min(1240px,100%)] flex-col overflow-hidden rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-admin-line)] px-6 py-5">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                  İçerik Kontrol
                </p>
                <h3 className="mt-1 truncate text-xl font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
                  {selectedReviewTopic.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[var(--color-admin-muted)]">
                    {selectedIndex + 1} / {orderedWorkspaceTopics.length} konu
                  </p>
                  {renderReviewStateBadge(selectedReviewTopic)}
                  <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-admin-muted)]">
                    {selectedReviewTopic.subject_name ?? "Ders bilgisi yok"}
                  </span>
                </div>
              </div>

              <button
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={() => setReviewOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-r border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Konular
                  </p>
                  <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-admin-muted)]">
                    {orderedWorkspaceTopics.length}
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
                    <SortableContext
                      items={orderedWorkspaceTopics.filter((item) => item.review_state !== "approved").map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {orderedWorkspaceTopics.map((item, index) => (
                          <SortableTopicListItem
                            key={item.id}
                            active={item.id === selectedTopicId}
                            badge={renderReviewStateBadge}
                            index={index}
                            item={item}
                            onSelect={setSelectedTopicId}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </aside>

              <div className="min-h-0 overflow-y-auto px-6 py-5">
                {bulkSaveMessage ? (
                  <div className="mb-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {bulkSaveMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="block space-y-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                      Konu Adı
                    </span>
                    <input
                      className="admin-input h-11"
                      onChange={(event) => updateWorkspaceTopic(selectedReviewTopic.id, { name: event.target.value })}
                      value={selectedReviewTopic.name}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                      Durum
                    </span>
                    <select
                      className="admin-input h-11"
                      onChange={(event) =>
                        updateWorkspaceTopic(selectedReviewTopic.id, {
                          status: event.target.value as ReviewTopicItem["status"],
                        })
                      }
                      value={selectedReviewTopic.status}
                    >
                      <option value="draft">Taslak</option>
                      <option value="active">Aktif</option>
                      <option value="passive">Pasif</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm text-[var(--color-admin-muted)]">
                  Bu konu <span className="font-semibold text-[var(--color-admin-ink)]">{selectedReviewTopic.subject_name ?? "seçili ders"}</span> dersi içinde{" "}
                  <span className="font-semibold text-[var(--color-admin-ink)]">{selectedReviewTopic.sort_order}. sırada</span>.
                  Soldaki listeyi sürükleyerek sıralayıp içerikleri burada düzenleyebilirsin.
                </div>

                <div className="mt-5">
                  <StructuredTopicContentEditor
                    blocks={selectedReviewTopic.content_blocks}
                    onChange={(nextBlocks) =>
                      updateWorkspaceTopic(selectedReviewTopic.id, {
                        content_blocks: nextBlocks,
                        content_body: blocksToPlainText(nextBlocks),
                        content_ready: true,
                      })
                    }
                  />
                </div>

                {reviewLoading ? (
                  <div className="mt-4 text-sm text-[var(--color-admin-muted)]">İçerik yükleniyor...</div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-admin-line)] px-6 py-4">
              <div className="flex items-center gap-2">
                <button
                  className="admin-button admin-button-secondary"
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedTopicId(orderedWorkspaceTopics[selectedIndex - 1]?.id ?? null)}
                  type="button"
                >
                  <ArrowLeft size={16} />
                  Önceki
                </button>
                <button
                  className="admin-button admin-button-secondary"
                  disabled={selectedIndex === -1 || selectedIndex >= orderedWorkspaceTopics.length - 1}
                  onClick={() => setSelectedTopicId(orderedWorkspaceTopics[selectedIndex + 1]?.id ?? null)}
                  type="button"
                >
                  Sonraki
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className="admin-button admin-button-secondary" onClick={() => setReviewOpen(false)} type="button">
                  Kapat
                </button>
                <button
                  className="admin-button admin-button-secondary text-[var(--color-admin-danger)]"
                  disabled={selectedReviewTopic.saving || bulkSaving}
                  onClick={() => void handleDeleteSelected()}
                  type="button"
                >
                  <Trash2 size={16} />
                  Sil
                </button>
                <button
                  className="admin-button admin-button-secondary"
                  disabled={selectedReviewTopic.saving || bulkSaving}
                  onClick={() => void handleSaveSelected()}
                  type="button"
                >
                  <Save size={16} />
                  Kaydet
                </button>
                <button
                  className="admin-button admin-button-secondary"
                  disabled={selectedReviewTopic.saving || bulkSaving}
                  onClick={handleApproveSelected}
                  type="button"
                >
                  <Check size={16} />
                  Onayla
                </button>
                <button className="admin-button" disabled={bulkSaving} onClick={() => void handleSaveAll()} type="button">
                  <Save size={16} />
                  Tümünü Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
