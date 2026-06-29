"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  Layers3,
  Pencil,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminListToolbarIconButton } from "@/components/admin/crud/AdminListToolbar";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminLawDurationCategory, AdminLawDurationItem, AdminSubject, AdminTopic } from "@/lib/types";

type CategoryForm = {
  subject_id: number | null;
  title: string;
  description: string;
  status: "active" | "draft" | "passive";
  sort_order: number;
};

type ItemForm = {
  category_id: number | null;
  topic_id: number | null;
  item_type: "duration" | "rule";
  title: string;
  value: string;
  description: string;
  article_reference: string;
  source_excerpt: string;
  status: "active" | "draft" | "passive";
  sort_order: number;
};

const emptyCategoryForm: CategoryForm = {
  subject_id: null,
  title: "",
  description: "",
  status: "active",
  sort_order: 1,
};

const emptyItemForm: ItemForm = {
  category_id: null,
  topic_id: null,
  item_type: "duration",
  title: "",
  value: "",
  description: "",
  article_reference: "",
  source_excerpt: "",
  status: "active",
  sort_order: 1,
};

function statusLabel(status: string) {
  if (status === "active") {
    return "Aktif";
  }

  if (status === "draft") {
    return "Taslak";
  }

  return "Pasif";
}

function itemTypeLabel(type: "duration" | "rule") {
  return type === "duration" ? "Süre" : "Kural";
}

function normalizeNullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function LawDurationsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: topics } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });
  const {
    items: categories,
    setItems: setCategories,
    loading: categoriesLoading,
    error: categoriesError,
    refresh: refreshCategories,
  } = useAdminList<AdminLawDurationCategory>({
    endpoint: "/admin/law-duration-categories",
    responseKey: "categories",
    params: { subject_id: selectedSubjectId },
  });
  const {
    items,
    setItems,
    loading: itemsLoading,
    error: itemsError,
    refresh: refreshItems,
  } = useAdminList<AdminLawDurationItem>({
    endpoint: "/admin/law-duration-items",
    responseKey: "items",
    params: { category_id: selectedCategoryId },
  });
  const {
    items: subjectItems,
    refresh: refreshSubjectItems,
  } = useAdminList<AdminLawDurationItem>({
    endpoint: "/admin/law-duration-items",
    responseKey: "items",
    params: { subject_id: selectedSubjectId },
  });

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? selectedCategory?.subject ?? null,
    [selectedCategory?.subject, selectedSubjectId, subjects],
  );
  const selectedSubjectForTopics = selectedCategory?.subject_id ?? selectedSubjectId;
  const activeCategoryCount = useMemo(
    () => categories.filter((category) => category.status === "active").length,
    [categories],
  );
  const subjectRuleCount = useMemo(
    () => subjectItems.filter((item) => item.item_type === "rule").length,
    [subjectItems],
  );
  const subjectActiveItemCount = useMemo(
    () => subjectItems.filter((item) => item.status === "active").length,
    [subjectItems],
  );
  const subjectDurationCount = Math.max(subjectItems.length - subjectRuleCount, 0);

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: subject.code ? `${subject.code} · ${subject.topic_count} konu` : `${subject.topic_count} konu`,
      })),
    [subjects],
  );

  const topicOptions = useMemo(
    () =>
      topics
        .filter((topic) => !selectedSubjectForTopics || topic.subject_id === selectedSubjectForTopics)
        .map((topic) => ({
          id: topic.id,
          label: topic.name,
          hint: topic.subject?.name,
        })),
    [selectedSubjectForTopics, topics],
  );

  const activePreviewItems = useMemo(
    () =>
      items
        .filter((item) => item.status === "active")
        .sort((first, second) => first.sort_order - second.sort_order || first.id - second.id),
    [items],
  );

  useEffect(() => {
    if (selectedSubjectId || subjects.length === 0) {
      return;
    }

    const cmkSubject = subjects.find(
      (subject) =>
        subject.code === "5271" ||
        subject.name.toLocaleLowerCase("tr-TR").includes("ceza muhakemesi"),
    );

    if (cmkSubject) {
      setSelectedSubjectId(cmkSubject.id);
      setCategoryForm((current) => ({ ...current, subject_id: cmkSubject.id }));
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    if (selectedCategoryId && categories.some((category) => category.id === selectedCategoryId)) {
      return;
    }

    setSelectedCategoryId(categories[0]?.id ?? null);
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    setCategoryForm((current) => ({
      ...current,
      subject_id: current.subject_id ?? selectedSubjectId,
    }));
  }, [selectedSubjectId]);

  useEffect(() => {
    setItemForm((current) => ({
      ...current,
      category_id: selectedCategoryId,
      topic_id: selectedSubjectForTopics && current.topic_id
        ? topics.some((topic) => topic.id === current.topic_id && topic.subject_id === selectedSubjectForTopics)
          ? current.topic_id
          : null
        : current.topic_id,
    }));
  }, [selectedCategoryId, selectedSubjectForTopics, topics]);

  function resetCategoryForm(subjectId = selectedSubjectId) {
    setEditingCategoryId(null);
    setCategoryForm({
      ...emptyCategoryForm,
      subject_id: subjectId,
      sort_order: categories.length + 1,
    });
  }

  function editCategory(category: AdminLawDurationCategory) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      subject_id: category.subject_id,
      title: category.title,
      description: category.description ?? "",
      status: category.status as CategoryForm["status"],
      sort_order: category.sort_order,
    });
  }

  function resetItemForm(categoryId = selectedCategoryId) {
    setEditingItemId(null);
    setItemForm({
      ...emptyItemForm,
      category_id: categoryId,
      sort_order: items.length + 1,
    });
  }

  function editItem(item: AdminLawDurationItem) {
    setEditingItemId(item.id);
    setItemForm({
      category_id: item.category_id,
      topic_id: item.topic_id,
      item_type: item.item_type,
      title: item.title,
      value: item.value,
      description: item.description ?? "",
      article_reference: item.article_reference ?? "",
      source_excerpt: item.source_excerpt ?? "",
      status: item.status as ItemForm["status"],
      sort_order: item.sort_order,
    });
  }

  async function refreshAll() {
    await Promise.all([refreshCategories(), refreshItems(), refreshSubjectItems()]);
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !categoryForm.subject_id) {
      showToast({
        tone: "warning",
        title: "Ders seçmelisin",
        description: "Kategori hangi kanuna/derse bağlı olacaksa onu seç.",
      });
      return;
    }

    setSavingCategory(true);

    try {
      const response = await adminApiRequest<{ category: AdminLawDurationCategory }>(
        editingCategoryId ? `/admin/law-duration-categories/${editingCategoryId}` : "/admin/law-duration-categories",
        {
          token,
          method: editingCategoryId ? "PUT" : "POST",
          body: {
            subject_id: categoryForm.subject_id,
            title: categoryForm.title,
            description: normalizeNullable(categoryForm.description),
            status: categoryForm.status,
            sort_order: categoryForm.sort_order,
          },
        },
      );

      setCategories((current) => {
        const exists = current.some((category) => category.id === response.data.category.id);
        return exists
          ? current.map((category) => (category.id === response.data.category.id ? response.data.category : category))
          : [...current, response.data.category].sort((first, second) => first.sort_order - second.sort_order);
      });
      setSelectedCategoryId(response.data.category.id);
      setSelectedSubjectId(response.data.category.subject_id);
      resetCategoryForm(response.data.category.subject_id);
      showToast({
        tone: "success",
        title: editingCategoryId ? "Kategori güncellendi" : "Kategori eklendi",
        description: response.data.category.title,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Kategori kaydedilemedi",
        description: error instanceof Error ? error.message : "İşlem başarısız oldu.",
      });
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !itemForm.category_id) {
      showToast({
        tone: "warning",
        title: "Kategori seçmelisin",
        description: "Satır eklemek için önce bir kategori seç.",
      });
      return;
    }

    setSavingItem(true);

    try {
      const response = await adminApiRequest<{ item: AdminLawDurationItem }>(
        editingItemId ? `/admin/law-duration-items/${editingItemId}` : "/admin/law-duration-items",
        {
          token,
          method: editingItemId ? "PUT" : "POST",
          body: {
            category_id: itemForm.category_id,
            topic_id: itemForm.topic_id,
            item_type: itemForm.item_type,
            title: itemForm.title,
            value: itemForm.value,
            description: normalizeNullable(itemForm.description),
            article_reference: normalizeNullable(itemForm.article_reference),
            source_excerpt: normalizeNullable(itemForm.source_excerpt),
            status: itemForm.status,
            sort_order: itemForm.sort_order,
          },
        },
      );

      setItems((current) => {
        const exists = current.some((item) => item.id === response.data.item.id);
        return exists
          ? current.map((item) => (item.id === response.data.item.id ? response.data.item : item))
          : [...current, response.data.item].sort((first, second) => first.sort_order - second.sort_order);
      });
      resetItemForm(response.data.item.category_id);
      showToast({
        tone: "success",
        title: editingItemId ? "Satır güncellendi" : "Satır eklendi",
        description: response.data.item.title,
      });
      void refreshCategories();
      void refreshSubjectItems();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Satır kaydedilemedi",
        description: error instanceof Error ? error.message : "İşlem başarısız oldu.",
      });
    } finally {
      setSavingItem(false);
    }
  }

  async function handleDeleteCategory(category: AdminLawDurationCategory) {
    if (!token) {
      return;
    }

    setBusyId(`category-${category.id}`);

    try {
      await adminApiRequest(`/admin/law-duration-categories/${category.id}`, {
        token,
        method: "DELETE",
      });

      setCategories((current) => current.filter((entry) => entry.id !== category.id));
      if (selectedCategoryId === category.id) {
        setSelectedCategoryId(null);
        resetItemForm(null);
      }
      showToast({
        tone: "success",
        title: "Kategori silindi",
        description: category.title,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Kategori silinemedi",
        description: error instanceof Error ? error.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteItem(item: AdminLawDurationItem) {
    if (!token) {
      return;
    }

    setBusyId(`item-${item.id}`);

    try {
      await adminApiRequest(`/admin/law-duration-items/${item.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast({
        tone: "success",
        title: "Satır silindi",
        description: item.title,
      });
      void refreshCategories();
      void refreshSubjectItems();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Satır silinemedi",
        description: error instanceof Error ? error.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]">
        <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                  <BookOpen size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Süre / Kural Dokümanı
                  </p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-normal text-[var(--color-admin-ink)]">
                    {selectedSubject?.name ?? "Ders seç"}
                  </h1>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-admin-muted)]">
                Konu anlatımlarından çıkarılan kısa süre ve kural satırlarını tek ekranda yönet.
              </p>
            </div>

            <div className="flex min-w-[260px] flex-1 flex-wrap items-end justify-end gap-2 sm:max-w-[560px]">
              <div className="min-w-[240px] flex-1">
                <AdminSearchSelect
                  buttonPlaceholder="Ders seç"
                  compact
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={(value) => {
                    setSelectedSubjectId(value);
                    setSelectedCategoryId(null);
                    resetCategoryForm(value);
                    resetItemForm(null);
                  }}
                  options={subjectOptions}
                  placeholder="CMK, DMK, TCK ara"
                  value={selectedSubjectId}
                />
              </div>
              <AdminListToolbarIconButton onClick={() => void refreshAll()} title="Yenile">
                <RefreshCcw size={15} />
              </AdminListToolbarIconButton>
              <button className="admin-button admin-button-primary h-10 px-3 py-2 text-sm" onClick={() => resetCategoryForm()} type="button">
                <Plus size={16} />
                Kategori
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-[var(--color-admin-line)] md:grid-cols-4">
          <div className="bg-[var(--color-admin-panel)] px-5 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Kategori</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-admin-ink)]">{categories.length}</p>
            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{activeCategoryCount} aktif blok</p>
          </div>
          <div className="bg-[var(--color-admin-panel)] px-5 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Satır</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-admin-ink)]">{subjectItems.length}</p>
            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{subjectActiveItemCount} aktif görünür</p>
          </div>
          <div className="bg-[var(--color-admin-panel)] px-5 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Süre</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-admin-ink)]">{subjectDurationCount}</p>
            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">ezberlik süre satırı</p>
          </div>
          <div className="bg-[var(--color-admin-panel)] px-5 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Kural</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-admin-ink)]">{subjectRuleCount}</p>
            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">kısa sınav kuralı</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_380px] 2xl:grid-cols-[300px_minmax(0,1fr)_420px]">
        <section className="admin-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-admin-line)] px-5 py-4">
            <div>
              <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">Kategoriler</h2>
              <p className="mt-1 text-xs text-[var(--color-admin-muted)]">Seç, sırala, düzenle.</p>
            </div>
            <Layers3 size={18} className="text-[var(--color-admin-muted)]" />
          </div>

          {categoriesLoading ? (
            <div className="p-5">
              <AdminTableSkeleton rows={6} />
            </div>
          ) : categoriesError ? (
            <div className="px-5 py-8 text-sm text-[var(--color-admin-danger)]">{categoriesError}</div>
          ) : categories.length === 0 ? (
            <div className="px-5 py-10 text-sm leading-6 text-[var(--color-admin-muted)]">
              Bu ders için kategori yok. Sağdaki panelden ilk kategoriyi ekleyebilirsin.
            </div>
          ) : (
            <div className="max-h-[760px] overflow-y-auto p-2">
              {categories.map((category) => {
                const active = category.id === selectedCategoryId;

                return (
                  <button
                    className={`mb-2 w-full rounded-[14px] border px-4 py-3 text-left transition ${
                      active
                        ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                        : "border-transparent text-[var(--color-admin-muted)] hover:border-[var(--color-admin-line)] hover:bg-[var(--color-admin-panel-soft)]"
                    }`}
                    key={category.id}
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      resetItemForm(category.id);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[var(--color-admin-ink)]">{category.title}</p>
                        <p className="mt-1 text-xs">{statusLabel(category.status)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--color-admin-bg-raised)] px-2.5 py-1 text-xs font-extrabold text-[var(--color-admin-muted)]">
                        {category.active_items_count}/{category.items_count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="admin-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-admin-line)] px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[var(--color-admin-accent)]" />
                <h2 className="text-lg font-extrabold text-[var(--color-admin-ink)]">
                  {selectedCategory?.title ?? "Süre dokümanı"}
                </h2>
              </div>
              <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                {selectedSubject?.name ?? "Ders"} için kullanıcıya gösterilecek sade doküman görünümü.
              </p>
            </div>
            <button
              className="admin-button admin-button-soft h-10 px-3 py-2 text-sm"
              disabled={!selectedCategoryId}
              onClick={() => resetItemForm(selectedCategoryId)}
              type="button"
            >
              <Plus size={16} />
              Satır Ekle
            </button>
          </div>

          {itemsLoading ? (
            <div className="p-5">
              <AdminTableSkeleton rows={8} />
            </div>
          ) : itemsError ? (
            <div className="px-5 py-8 text-sm text-[var(--color-admin-danger)]">{itemsError}</div>
          ) : !selectedCategoryId ? (
            <div className="px-5 py-14 text-sm text-[var(--color-admin-muted)]">Önce kategori seç.</div>
          ) : activePreviewItems.length === 0 ? (
            <div className="px-5 py-14 text-sm text-[var(--color-admin-muted)]">Bu kategoride aktif satır yok.</div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="overflow-hidden rounded-[12px] border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)]">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#13254a] px-4 py-4 text-white">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/65">
                      {selectedSubject?.code ?? "Kanun"}
                    </p>
                    <h3 className="mt-1 text-xl font-extrabold tracking-normal">
                      {selectedCategory?.title ?? "Süre dokümanı"}
                    </h3>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold">
                    {activePreviewItems.length} kısa bilgi
                  </div>
                </div>

                <div className="hidden grid-cols-[minmax(130px,0.95fr)_112px_minmax(160px,1.15fr)] bg-[#f97316] text-[11px] font-extrabold uppercase tracking-[0.1em] text-white md:grid">
                  <div className="px-4 py-3">İşlem</div>
                  <div className="border-l border-white/25 px-4 py-3">Süre / Kural</div>
                  <div className="border-l border-white/25 px-4 py-3">Açıklama</div>
                </div>

                <div className="divide-y divide-[var(--color-admin-line)]">
                  {activePreviewItems.map((item) => (
                    <div
                      className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[minmax(130px,0.95fr)_112px_minmax(160px,1.15fr)] md:items-start md:gap-0 md:px-0 md:py-0"
                      key={item.id}
                    >
                      <div className="md:px-4 md:py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${item.item_type === "duration" ? "bg-[#f97316]" : "bg-[var(--color-admin-accent)]"}`} />
                            <p className="font-extrabold leading-5 text-[var(--color-admin-ink)]">{item.title}</p>
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                            {item.article_reference ?? item.topic?.name ?? itemTypeLabel(item.item_type)}
                          </p>
                          <div className="mt-2 flex gap-1">
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
                              onClick={() => editItem(item)}
                              title="Satırı düzenle"
                              type="button"
                            >
                              <Pencil size={14} />
                            </button>
                            <ConfirmDialog
                              busy={busyId === `item-${item.id}`}
                              confirmLabel="Satırı Sil"
                              description="Bu kısa bilgi kalıcı olarak silinir."
                              onConfirm={() => handleDeleteItem(item)}
                              title="Satır silinsin mi?"
                              trigger={
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-admin-line)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-danger)] hover:text-[var(--color-admin-danger)]">
                                  <Trash2 size={14} />
                                </span>
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <div className="md:border-l md:border-[var(--color-admin-line)] md:px-4 md:py-4">
                        <span className="inline-flex max-w-full rounded-[8px] bg-[#f97316] px-3 py-1.5 text-xs font-extrabold uppercase leading-tight text-white">
                          {item.value}
                        </span>
                      </div>
                      <div className="text-xs leading-5 text-[var(--color-admin-muted)] md:border-l md:border-[var(--color-admin-line)] md:px-4 md:py-4">
                        {item.description || item.article_reference || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="admin-card overflow-hidden">
            <div className="border-b border-[var(--color-admin-line)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-[var(--color-admin-accent)]" />
                <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">
                  {editingCategoryId ? "Kategori Düzenle" : "Kategori Ekle"}
                </h2>
              </div>
            </div>
            <form className="space-y-4 p-5" onSubmit={handleCategorySubmit}>
              <AdminSearchSelect
                emptyText="Ders bulunamadı."
                label="Ders / Kanun"
                onChange={(value) => setCategoryForm((current) => ({ ...current, subject_id: value }))}
                options={subjectOptions}
                placeholder="Ders ara"
                value={categoryForm.subject_id}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Kategori Başlığı</span>
                <input
                  className="admin-input"
                  onChange={(event) => setCategoryForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Yakalama ve Gözaltı"
                  required
                  value={categoryForm.title}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Durum</span>
                  <select
                    className="admin-input"
                    onChange={(event) => setCategoryForm((current) => ({ ...current, status: event.target.value as CategoryForm["status"] }))}
                    value={categoryForm.status}
                  >
                    <option value="active">Aktif</option>
                    <option value="draft">Taslak</option>
                    <option value="passive">Pasif</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Sıra</span>
                  <input
                    className="admin-input"
                    min={1}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: Number(event.target.value) || 1 }))}
                    type="number"
                    value={categoryForm.sort_order}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Açıklama</span>
                <textarea
                  className="admin-input min-h-20"
                  onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Opsiyonel iç not"
                  value={categoryForm.description}
                />
              </label>

              <div className="flex justify-between gap-3">
                <button className="admin-button admin-button-secondary" onClick={() => resetCategoryForm()} type="button">
                  Temizle
                </button>
                {editingCategoryId ? (
                  <ConfirmDialog
                    busy={busyId === `category-${editingCategoryId}`}
                    confirmLabel="Kategoriyi Sil"
                    description="Kategori silinirse altındaki süre/kural satırları da silinir."
                    onConfirm={() => {
                      const category = categories.find((entry) => entry.id === editingCategoryId);
                      return category ? handleDeleteCategory(category) : undefined;
                    }}
                    title="Kategori silinsin mi?"
                    trigger={
                      <span className="admin-button admin-button-danger">
                        <Trash2 size={16} />
                      </span>
                    }
                  />
                ) : null}
                <button className="admin-button admin-button-primary ml-auto" disabled={savingCategory} type="submit">
                  <CheckCircle2 size={16} />
                  {savingCategory ? "Kaydediliyor" : "Kaydet"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-card overflow-hidden">
            <div className="border-b border-[var(--color-admin-line)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock3 size={17} className="text-[#f97316]" />
                <h2 className="text-base font-extrabold text-[var(--color-admin-ink)]">
                  {editingItemId ? "Satır Düzenle" : "Satır Ekle"}
                </h2>
              </div>
            </div>
            <form className="space-y-4 p-5" onSubmit={handleItemSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                    itemForm.item_type === "duration"
                      ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                      : "border-[var(--color-admin-line)] text-[var(--color-admin-muted)]"
                  }`}
                  onClick={() => setItemForm((current) => ({ ...current, item_type: "duration" }))}
                  type="button"
                >
                  <Clock3 className="mb-2" size={18} />
                  Süre
                </button>
                <button
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                    itemForm.item_type === "rule"
                      ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                      : "border-[var(--color-admin-line)] text-[var(--color-admin-muted)]"
                  }`}
                  onClick={() => setItemForm((current) => ({ ...current, item_type: "rule" }))}
                  type="button"
                >
                  <Gavel className="mb-2" size={18} />
                  Kural
                </button>
              </div>

              <AdminSearchSelect
                emptyText="Kaynak konu bulunamadı."
                label="Kaynak Konu"
                onChange={(value) => setItemForm((current) => ({ ...current, topic_id: value }))}
                options={topicOptions}
                placeholder="Konu ara"
                value={itemForm.topic_id}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Konu / İşlem</span>
                <input
                  className="admin-input"
                  onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Gözaltı"
                  required
                  value={itemForm.title}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Süre / Kural</span>
                <input
                  className="admin-input"
                  onChange={(event) => setItemForm((current) => ({ ...current, value: event.target.value }))}
                  placeholder="24 saat"
                  required
                  value={itemForm.value}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Kısa Açıklama</span>
                <textarea
                  className="admin-input min-h-20"
                  onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Yakalama anından itibaren, zorunlu yol süresi hariç."
                  value={itemForm.description}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Madde</span>
                  <input
                    className="admin-input"
                    onChange={(event) => setItemForm((current) => ({ ...current, article_reference: event.target.value }))}
                    placeholder="CMK m.91"
                    value={itemForm.article_reference}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Sıra</span>
                  <input
                    className="admin-input"
                    min={1}
                    onChange={(event) => setItemForm((current) => ({ ...current, sort_order: Number(event.target.value) || 1 }))}
                    type="number"
                    value={itemForm.sort_order}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-admin-ink)]">Durum</span>
                <select
                  className="admin-input"
                  onChange={(event) => setItemForm((current) => ({ ...current, status: event.target.value as ItemForm["status"] }))}
                  value={itemForm.status}
                >
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>

              <details className="rounded-2xl border border-[var(--color-admin-line)] px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold text-[var(--color-admin-ink)]">Kaynak alıntı</summary>
                <textarea
                  className="admin-input mt-3 min-h-24"
                  onChange={(event) => setItemForm((current) => ({ ...current, source_excerpt: event.target.value }))}
                  placeholder="Konu anlatımından kontrol için kısa kaynak parça"
                  value={itemForm.source_excerpt}
                />
              </details>

              <div className="flex justify-between gap-3">
                <button className="admin-button admin-button-secondary" onClick={() => resetItemForm(selectedCategoryId)} type="button">
                  Temizle
                </button>
                <button className="admin-button admin-button-primary ml-auto" disabled={savingItem || !selectedCategoryId} type="submit">
                  <CheckCircle2 size={16} />
                  {savingItem ? "Kaydediliyor" : "Kaydet"}
                </button>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
