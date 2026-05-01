"use client";

import { CalendarDays, Check, GraduationCap, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminFormActionsCard } from "@/components/admin/crud/AdminFormActionsCard";
import { AdminReadinessPanel } from "@/components/admin/crud/AdminReadinessPanel";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminExam, AdminMinistry, AdminTopic } from "@/lib/types";

const emptyForm = {
  ministry_id: "",
  name: "",
  slug: "",
  status: "active",
  price: "",
  exam_date: "",
  is_active_for_signup: true,
  topic_ids: [] as number[],
};

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

type TopicGroup = {
  subjectId: number;
  subjectName: string;
  subjectCode: string | null;
  topics: AdminTopic[];
  selectedCount: number;
  totalCount: number;
};

export function ExamFormPage({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const formId = `exam-form-${mode}${id ? `-${id}` : ""}`;
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [form, setForm] = useState(emptyForm);
  const [exam, setExam] = useState<AdminExam | null>(null);
  const [ministries, setMinistries] = useState<AdminMinistry[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [topicDraftIds, setTopicDraftIds] = useState<Set<number>>(new Set());
  const [subjectPoolQuery, setSubjectPoolQuery] = useState("");
  const [topicModalQuery, setTopicModalQuery] = useState("");
  const [showOnlySelectedTopics, setShowOnlySelectedTopics] = useState(false);

  const selectedTopicIdSet = useMemo(() => new Set(form.topic_ids), [form.topic_ids]);

  const orderedTopicIds = useMemo(() => {
    return [...topics]
      .sort((left, right) =>
        left.subject_id - right.subject_id ||
        left.sort_order - right.sort_order ||
        left.id - right.id,
      )
      .map((topic) => topic.id);
  }, [topics]);

  const topicOrderMap = useMemo(
    () => new Map(orderedTopicIds.map((topicId, index) => [topicId, index])),
    [orderedTopicIds],
  );

  const topicGroups = useMemo<TopicGroup[]>(() => {
    const groups = new Map<number, Omit<TopicGroup, "selectedCount" | "totalCount">>();

    [...topics]
      .sort((left, right) =>
        left.subject_id - right.subject_id ||
        left.sort_order - right.sort_order ||
        left.id - right.id,
      )
      .forEach((topic) => {
        const subjectId = topic.subject?.id ?? topic.subject_id;
        const existing = groups.get(subjectId);

        if (existing) {
          existing.topics.push(topic);
          return;
        }

        groups.set(subjectId, {
          subjectId,
          subjectName: topic.subject?.name ?? "Ders bilgisi yok",
          subjectCode: topic.subject?.code?.trim() || null,
          topics: [topic],
        });
      });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      selectedCount: group.topics.filter((topic) => selectedTopicIdSet.has(topic.id)).length,
      totalCount: group.topics.length,
    }));
  }, [selectedTopicIdSet, topics]);

  const activeTopicGroup = useMemo(
    () => topicGroups.find((group) => group.subjectId === activeSubjectId) ?? null,
    [activeSubjectId, topicGroups],
  );

  const filteredTopicGroups = useMemo(() => {
    const normalized = subjectPoolQuery.trim().toLocaleLowerCase("tr");

    if (!normalized) {
      return topicGroups;
    }

    return topicGroups.filter((group) =>
      [group.subjectCode, group.subjectName]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized),
    );
  }, [subjectPoolQuery, topicGroups]);

  const modalTopics = useMemo(() => {
    const normalized = topicModalQuery.trim().toLocaleLowerCase("tr");

    return (activeTopicGroup?.topics ?? []).filter((topic) => {
      if (showOnlySelectedTopics && !topicDraftIds.has(topic.id)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [topic.name, topic.slug]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [activeTopicGroup, showOnlySelectedTopics, topicDraftIds, topicModalQuery]);

  const selectedTopicGroups = useMemo(
    () =>
      topicGroups
        .map((group) => ({
          ...group,
          topics: group.topics.filter((topic) => selectedTopicIdSet.has(topic.id)),
        }))
        .filter((group) => group.topics.length > 0),
    [selectedTopicIdSet, topicGroups],
  );

  const selectedMinistry = useMemo(
    () => ministries.find((item) => String(item.id) === form.ministry_id),
    [ministries, form.ministry_id],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(mode === "edit");
      setError(null);

      try {
        const [ministriesResponse, topicsResponse, examResponse] = await Promise.all([
          adminApiRequest<{ ministries: AdminMinistry[] }>("/admin/ministries", { token }),
          adminApiRequest<{ topics: AdminTopic[] }>("/admin/topics", { token }),
          mode === "edit" && id
            ? adminApiRequest<{ exam: AdminExam }>(`/admin/exams/${id}`, { token })
            : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setMinistries(ministriesResponse.data.ministries);
        setTopics(topicsResponse.data.topics);

        if (examResponse?.data.exam) {
          const exam = examResponse.data.exam;
          setExam(exam);
          setForm({
            ministry_id: String(exam.ministry?.id ?? ""),
            name: exam.name,
            slug: exam.slug ?? "",
            status: exam.status,
            price: String(exam.price ?? 0),
            exam_date: toDateTimeLocalValue(exam.exam_date),
            is_active_for_signup: exam.is_active_for_signup,
            topic_ids: exam.topic_ids ?? [],
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Sınav bilgisi yüklenemedi.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [id, mode, token]);

  useEffect(() => {
    if (mode !== "edit") {
      setTitle(null);
      return;
    }

    setTitle(form.name.trim() || "Sınav Düzenle");

    return () => setTitle(null);
  }, [form.name, mode, setTitle]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await adminApiRequest<{ exam: AdminExam }>(mode === "edit" ? `/admin/exams/${id}` : "/admin/exams", {
        token,
        method: mode === "edit" ? "PUT" : "POST",
        body: {
          ministry_id: Number(form.ministry_id),
          name: form.name,
          slug: form.slug || null,
          status: form.status,
          price: Number(form.price || 0),
          exam_date: form.exam_date ? new Date(form.exam_date).toISOString() : null,
          is_active_for_signup: form.is_active_for_signup,
          topic_ids: form.topic_ids,
        },
      });

      showToast({
        tone: "success",
        title: mode === "edit" ? "Sınav güncellendi" : "Sınav oluşturuldu",
        description: response.data.exam.name,
      });
      setExam(response.data.exam);

      if (mode === "edit") {
        return;
      }

      router.push("/sinavlar");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Sınav kaydedilemedi.";
      setError(message);
      showToast({
        tone: "error",
        title: mode === "edit" ? "Sınav güncellenemedi" : "Sınav oluşturulamadı",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  }

  function normalizeTopicIds(nextTopicIds: number[]) {
    return Array.from(new Set(nextTopicIds)).sort((left, right) => {
      const leftOrder = topicOrderMap.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = topicOrderMap.get(right) ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder || left - right;
    });
  }

  function openTopicModal(group: TopicGroup) {
    setActiveSubjectId(group.subjectId);
    setTopicDraftIds(new Set(group.topics.filter((topic) => selectedTopicIdSet.has(topic.id)).map((topic) => topic.id)));
    setTopicModalQuery("");
    setShowOnlySelectedTopics(false);
  }

  function closeTopicModal() {
    setActiveSubjectId(null);
    setTopicDraftIds(new Set());
    setTopicModalQuery("");
    setShowOnlySelectedTopics(false);
  }

  function toggleDraftTopic(topicId: number) {
    setTopicDraftIds((current) => {
      const next = new Set(current);
      next.has(topicId) ? next.delete(topicId) : next.add(topicId);
      return next;
    });
  }

  function saveTopicModal() {
    if (!activeTopicGroup) {
      return;
    }

    const activeTopicIds = new Set(activeTopicGroup.topics.map((topic) => topic.id));

    setForm((current) => {
      const otherTopicIds = current.topic_ids.filter((topicId) => !activeTopicIds.has(topicId));

      return {
        ...current,
        topic_ids: normalizeTopicIds([...otherTopicIds, ...Array.from(topicDraftIds)]),
      };
    });
    closeTopicModal();
  }

  return (
    <>
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AdminTableCard>
          <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                <GraduationCap size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                  Sınav Kaydı
                </h2>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Sınav burada tanımlanır; ortak ders kataloğundaki konular sınav kapsamına bağlanır.
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-6">
            {loading ? (
              <div className="space-y-4">
                <div className="admin-skeleton h-12" />
                <div className="admin-skeleton h-12" />
                <div className="admin-skeleton h-12" />
                <div className="admin-skeleton h-40" />
              </div>
            ) : (
              <form className="space-y-6" id={formId} onSubmit={handleSubmit}>
                <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                  <div className="pb-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      Temel Bilgiler
                    </h3>
                  </div>

                  <label className="block space-y-2.5">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Bakanlık</span>
                    <select
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, ministry_id: event.target.value }))}
                      value={form.ministry_id}
                    >
                      <option value="">Bakanlık seç</option>
                      {ministries.map((ministry) => (
                        <option key={ministry.id} value={ministry.id}>
                          {ministry.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2.5 pt-1">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Sınav Adı</span>
                    <input
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Örn. Yazı İşleri Müdürlüğü Görevde Yükselme"
                      value={form.name}
                    />
                  </label>

                  <label className="block space-y-2.5 pt-1">
                    <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Slug</span>
                    <input
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="Boş bırakılırsa otomatik üretilir"
                      value={form.slug}
                    />
                  </label>
                </section>

                <section className="space-y-4 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]/70 p-4">
                  <div className="pb-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                      Takvim ve Konular
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Yıllık Abonelik Ücreti</span>
                      <input
                        className="admin-input h-12"
                        inputMode="numeric"
                        onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                        placeholder="1490"
                        value={form.price}
                      />
                    </label>

                    <label className="block space-y-2.5">
                      <span className="block text-[13px] font-semibold text-[var(--color-admin-ink)]">Sınav Tarihi</span>
                      <input
                        className="admin-input h-12"
                        onChange={(event) => setForm((current) => ({ ...current, exam_date: event.target.value }))}
                        type="datetime-local"
                        value={form.exam_date}
                      />
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-[var(--color-admin-ink)]">
                        Sınava Dahil Edilen Konular
                      </label>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">
                        Konular ders bazında seçilir. Sıralama elle yapılmaz; her dersin kendi konu sırası otomatik korunur.
                      </p>
                    </div>

                    <div className="space-y-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                          Ders Havuzu
                        </p>
                        <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
                          {filteredTopicGroups.length}/{topicGroups.length} ders
                        </span>
                      </div>

                      <label className="admin-input-shell block">
                        <Search className="admin-input-icon" size={15} />
                        <input
                          className="admin-input admin-input-with-icon h-10 text-sm"
                          onChange={(event) => setSubjectPoolQuery(event.target.value)}
                          placeholder="Ders veya kanun numarası ara"
                          value={subjectPoolQuery}
                        />
                      </label>

                      <div className="max-h-80 overflow-y-auto rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]">
                      {topicGroups.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-[var(--color-admin-muted)]">
                          Henüz konu havuzu bulunamadı.
                        </div>
                      ) : filteredTopicGroups.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-[var(--color-admin-muted)]">
                          Aramaya uygun ders bulunamadı.
                        </div>
                      ) : (
                        filteredTopicGroups.map((group, index) => {
                          const hasSelection = group.selectedCount > 0;

                          return (
                            <button
                              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-[var(--color-admin-bg-raised)] ${
                                hasSelection
                                  ? "bg-[var(--color-admin-accent-soft)]/45"
                                  : "bg-[var(--color-admin-panel)]"
                              } ${index !== filteredTopicGroups.length - 1 ? "border-b border-[var(--color-admin-line)]" : ""}`}
                              key={group.subjectId}
                              onClick={() => openTopicModal(group)}
                              type="button"
                            >
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                                  hasSelection
                                    ? "bg-[var(--color-admin-accent)] text-white"
                                    : "bg-[var(--color-admin-panel-muted)] text-[var(--color-admin-muted)]"
                                }`}
                              >
                                {hasSelection ? <Check size={13} /> : <Plus size={13} />}
                              </div>

                              {group.subjectCode ? (
                                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-[var(--color-admin-accent)]">
                                  {group.subjectCode}
                                </span>
                              ) : null}

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-bold text-[var(--color-admin-ink)]">
                                  {group.subjectName}
                                </p>
                                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--color-admin-panel-muted)]">
                                  <div
                                    className="h-full rounded-full bg-[var(--color-admin-accent)]"
                                    style={{ width: `${group.totalCount > 0 ? (group.selectedCount / group.totalCount) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>

                              <span className="shrink-0 rounded-full border border-[var(--color-admin-line)] px-2 py-1 text-[11px] font-bold text-[var(--color-admin-muted)]">
                                {group.selectedCount}/{group.totalCount}
                              </span>
                            </button>
                          );
                        })
                      )}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                          Seçili Konular
                        </p>
                        <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
                          {form.topic_ids.length} konu seçildi
                        </span>
                      </div>

                      {selectedTopicGroups.length === 0 ? (
                        <p className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-4 text-sm text-[var(--color-admin-muted)]">
                          Henüz konu seçilmedi. Yukarıdaki ders kartlarından konu ekleyebilirsin.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedTopicGroups.map((group) => (
                            <button
                              className="w-full rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-4 text-left transition hover:border-[var(--color-admin-accent)]"
                              key={group.subjectId}
                              onClick={() => openTopicModal(group)}
                              type="button"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {group.subjectCode ? (
                                      <span className="rounded-full bg-[var(--color-admin-accent-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--color-admin-accent)]">
                                        {group.subjectCode}
                                      </span>
                                    ) : null}
                                    <p className="font-bold text-[var(--color-admin-ink)]">{group.subjectName}</p>
                                  </div>
                                  <p className="mt-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                                    {group.topics.length} konu
                                  </p>
                                </div>
                                <span className="rounded-full border border-[var(--color-admin-line)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
                                  Düzenle
                                </span>
                              </div>

                              <ol className="mt-3 space-y-1.5">
                                {group.topics.map((topic) => (
                                  <li className="flex items-center gap-2 text-sm text-[var(--color-admin-muted)]" key={topic.id}>
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-admin-panel-muted)] text-[10px] font-extrabold">
                                      {topic.sort_order}
                                    </span>
                                    <span className="truncate">{topic.name}</span>
                                  </li>
                                ))}
                              </ol>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {error ? (
                  <div className="rounded-2xl border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3 text-sm text-[var(--color-admin-danger)]">
                    {error}
                  </div>
                ) : null}

              </form>
            )}
          </div>
        </AdminTableCard>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <AdminFormActionsCard
            cancelHref="/sinavlar"
            formId={formId}
            relatedLinks={
              mode === "edit" && id
                ? [{ href: `/konular?examId=${id}`, label: "Sınav Konularını Gör" }]
                : []
            }
            saving={saving}
          />

          {mode === "edit" && exam?.readiness ? (
            <AdminTableCard>
              <AdminReadinessPanel
                actions={id ? [{ href: `/konular?examId=${id}`, label: "Sınav Konularına Git" }] : []}
                entityLabel="Sınav"
                readiness={exam.readiness}
              />
            </AdminTableCard>
          ) : null}

          <AdminTableCard>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                    Kayıt Durumu
                  </h3>
                  <div className="mt-4 space-y-4">
                    <select
                      className="admin-input h-12"
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                      value={form.status}
                    >
                      <option value="active">Aktif</option>
                      <option value="draft">Taslak</option>
                      <option value="passive">Pasif</option>
                    </select>

                    <p className="text-sm leading-6 text-[var(--color-admin-muted)]">
                      {form.status === "active"
                        ? "Aktif sınavlar listeleme ve ilişki kurma akışında kullanılabilir."
                        : form.status === "draft"
                          ? "Taslak sınavlar hazırlık aşamasında tutulur."
                          : "Pasif sınavlar geçmiş kayıt olarak korunur."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AdminTableCard>
          <AdminTableCard>
            <div className="px-5 py-5">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
                Takvim Notu
              </h3>
              <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-admin-panel-muted)] text-[var(--color-admin-muted)]">
                  <CalendarDays size={16} />
                </div>
                <div className="space-y-1 text-sm leading-6 text-[var(--color-admin-muted)]">
                  <p>
                    Sınav tarihi zorunlu değil. Netleştiğinde gün, ay, yıl ve saat ile birlikte eklenebilir.
                  </p>
                  {selectedMinistry ? <p>Seçili bakanlık: {selectedMinistry.name}</p> : null}
                </div>
              </div>
            </div>
          </AdminTableCard>
        </div>
      </div>
    </div>

    {activeTopicGroup ? (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
        <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] shadow-2xl">
          <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {activeTopicGroup.subjectCode ? (
                    <span className="rounded-full bg-[var(--color-admin-accent-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--color-admin-accent)]">
                      {activeTopicGroup.subjectCode}
                    </span>
                  ) : null}
                  <h3 className="text-lg font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
                    {activeTopicGroup.subjectName}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                  Bu dersten sınava dahil edilecek konuları seç. Konu sırası ders içindeki mevcut sıraya göre korunur.
                </p>
              </div>
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={closeTopicModal}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="admin-input-shell block">
                <Search className="admin-input-icon" size={16} />
                <input
                  className="admin-input admin-input-with-icon h-11"
                  onChange={(event) => setTopicModalQuery(event.target.value)}
                  placeholder="Konu ara"
                  value={topicModalQuery}
                />
              </label>
              <button
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  showOnlySelectedTopics
                    ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]"
                    : "border-[var(--color-admin-line)] text-[var(--color-admin-muted)]"
                }`}
                onClick={() => setShowOnlySelectedTopics((current) => !current)}
                type="button"
              >
                Sadece seçilenler
              </button>
              <span className="inline-flex items-center rounded-xl bg-[var(--color-admin-panel-soft)] px-4 py-2.5 text-sm font-bold text-[var(--color-admin-muted)]">
                {topicDraftIds.size} seçili
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-[var(--color-admin-line)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={() => setTopicDraftIds(new Set(activeTopicGroup.topics.map((topic) => topic.id)))}
                type="button"
              >
                Tümünü seç
              </button>
              <button
                className="rounded-xl border border-[var(--color-admin-line)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-danger)]"
                onClick={() => setTopicDraftIds(new Set())}
                type="button"
              >
                Seçimi temizle
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--color-admin-line)]">
              {modalTopics.length === 0 ? (
                <p className="px-4 py-5 text-sm text-[var(--color-admin-muted)]">Bu filtrede konu bulunamadı.</p>
              ) : (
                modalTopics.map((topic, index) => {
                  const checked = topicDraftIds.has(topic.id);

                  return (
                    <button
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--color-admin-bg-raised)] ${
                        checked ? "bg-[var(--color-admin-accent-soft)]/45" : "bg-[var(--color-admin-panel)]"
                      } ${index !== modalTopics.length - 1 ? "border-b border-[var(--color-admin-line)]" : ""}`}
                      key={topic.id}
                      onClick={() => toggleDraftTopic(topic.id)}
                      type="button"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          checked
                            ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent)] text-white"
                            : "border-[var(--color-admin-line)]"
                        }`}
                      >
                        {checked ? <Check size={13} /> : null}
                      </span>
                      <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-admin-panel-muted)] text-[11px] font-extrabold text-[var(--color-admin-muted)]">
                        {topic.sort_order}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[var(--color-admin-ink)]">{topic.name}</span>
                        <span className="mt-0.5 block text-xs text-[var(--color-admin-muted)]">{topic.slug}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--color-admin-line)] px-5 py-4">
            <button
              className="rounded-xl border border-[var(--color-admin-line)] px-4 py-2.5 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
              onClick={closeTopicModal}
              type="button"
            >
              Vazgeç
            </button>
            <button
              className="rounded-xl bg-[var(--color-admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              onClick={saveTopicModal}
              type="button"
            >
              Seçimi Kaydet
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
