"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, PauseCircle, Plus, RefreshCcw, Sparkles, SquarePen, Trash2, X } from "lucide-react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import {
  AdminListToolbar,
  AdminListToolbarActions,
  AdminListToolbarField,
  AdminListToolbarFields,
  AdminListToolbarIconButton,
  AdminListToolbarMeta,
  AdminListToolbarMetaPill,
  AdminListToolbarRow,
} from "@/components/admin/crud/AdminListToolbar";
import { AdminReadinessHint } from "@/components/admin/crud/AdminReadinessHint";
import { AdminSearchSelect } from "@/components/admin/crud/AdminSearchSelect";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { useAdminList } from "@/hooks/useAdminList";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminExam, AdminSubject, AdminTest, AdminTestGenerationResult, AdminTopic } from "@/lib/types";

export default function TestsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const {
    items: tests,
    setItems: setTests,
    loading: testsLoading,
    error: testsError,
    refresh: refreshTests,
  } = useAdminList<AdminTest>({
    endpoint: "/admin/tests",
    responseKey: "tests",
  });
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: exams } = useAdminList<AdminExam>({
    endpoint: "/admin/exams",
    responseKey: "exams",
  });
  const { items: topics } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });

  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | "subject" | "topic">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [generationOpen, setGenerationOpen] = useState(false);
  const [generationExamId, setGenerationExamId] = useState<number | null>(null);
  const [generationSubjectId, setGenerationSubjectId] = useState<number | null>(null);
  const [generationResult, setGenerationResult] = useState<AdminTestGenerationResult | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationApplying, setGenerationApplying] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const rows = useMemo(
    () => [...tests].sort((first, second) => (second.updated_at ?? "").localeCompare(first.updated_at ?? "")),
    [tests],
  );

  const subjectOptions = useMemo(
    () => subjects.map((subject) => ({ id: subject.id, label: subject.name, hint: `${subject.topic_count} konu` })),
    [subjects],
  );

  const examOptions = useMemo(
    () => exams.map((exam) => ({ id: exam.id, label: exam.name, hint: exam.ministry?.name })),
    [exams],
  );

  const generationSubjectOptions = useMemo(() => {
    if (generationExamId === null) {
      return subjectOptions;
    }

    return subjects
      .filter((subject) =>
        topics.some((topic) => topic.subject_id === subject.id && (topic.exam_ids ?? []).includes(generationExamId)),
      )
      .map((subject) => ({ id: subject.id, label: subject.name, hint: `${subject.topic_count} konu` }));
  }, [generationExamId, subjectOptions, subjects, topics]);

  const topicOptions = useMemo(
    () =>
      topics
        .filter((topic) => selectedSubjectId === null || topic.subject_id === selectedSubjectId)
        .map((topic) => ({ id: topic.id, label: topic.name, hint: topic.subject?.name })),
    [selectedSubjectId, topics],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return rows.filter((item) => {
      if (scopeFilter !== "all" && item.scope !== scopeFilter) {
        return false;
      }

      if (selectedSubjectId !== null && item.subject_id !== selectedSubjectId) {
        return false;
      }

      if (selectedTopicId !== null && item.topic_id !== selectedTopicId) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [item.title, item.subject?.name, item.topic?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [query, rows, scopeFilter, selectedSubjectId, selectedTopicId, statusFilter]);

  async function handleStatusChange(item: AdminTest, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyKey(`${item.scope}-${item.id}`);

    try {
      const response = await adminApiRequest<{ test: AdminTest }>(`/admin/tests/${item.id}`, {
        token,
        method: "PUT",
        body: {
          subject_id: item.subject_id,
          exam_id: item.topic_id ? null : item.exam_id,
          topic_id: item.topic_id,
          title: item.title,
          slug: item.slug ?? null,
          status: checked ? "active" : "passive",
          duration_min: item.duration_min,
          instructions: item.instructions ?? null,
          question_ids: item.question_ids ?? [],
        },
      });

      setTests((current) => current.map((entry) => (entry.id === item.id ? response.data.test : entry)));

      showToast({
        tone: "success",
        title: checked ? "Test aktife alındı" : "Test pasife alındı",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: submitError instanceof Error ? submitError.message : "İşlem başarısız oldu.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(item: AdminTest) {
    if (!token) {
      return;
    }

    setBusyKey(`${item.scope}-${item.id}`);

    try {
      await adminApiRequest(`/admin/tests/${item.id}`, {
        token,
        method: "DELETE",
      });

      setTests((current) => current.filter((entry) => entry.id !== item.id));

      showToast({
        tone: "success",
        title: "Test silindi",
        description: item.title,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Test silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  function generationPath(examId: number | null, subjectId: number | null) {
    const params = new URLSearchParams();

    if (examId !== null) {
      params.set("exam_id", String(examId));
    }

    if (subjectId !== null) {
      params.set("subject_id", String(subjectId));
    }

    return `/admin/tests/auto-generate/preview${params.toString() ? `?${params.toString()}` : ""}`;
  }

  async function loadGenerationPreview(examId: number | null, subjectId: number | null) {
    if (!token) {
      return;
    }

    if (examId === null) {
      setGenerationResult(null);
      setGenerationError("Otomatik genel test üretimi için önce sınav seçmelisin.");
      return;
    }

    setGenerationLoading(true);
    setGenerationError(null);

    try {
      const response = await adminApiRequest<AdminTestGenerationResult>(generationPath(examId, subjectId), { token });
      setGenerationResult(response.data);
    } catch (previewError) {
      setGenerationError(previewError instanceof Error ? previewError.message : "Önizleme alınamadı.");
      setGenerationResult(null);
    } finally {
      setGenerationLoading(false);
    }
  }

  function handleOpenGenerator() {
    const initialSubjectId = selectedSubjectId;
    const initialExamId = topics.find((topic) => initialSubjectId === null || topic.subject_id === initialSubjectId)?.exam_ids?.[0] ?? exams[0]?.id ?? null;

    setGenerationExamId(initialExamId);
    setGenerationSubjectId(initialSubjectId);
    setGenerationOpen(true);
    void loadGenerationPreview(initialExamId, initialSubjectId);
  }

  async function handleApplyGeneration() {
    if (!token) {
      return;
    }

    if (generationExamId === null) {
      setGenerationError("Otomatik genel test üretimi için önce sınav seçmelisin.");
      return;
    }

    setGenerationApplying(true);
    setGenerationError(null);

    try {
      const response = await adminApiRequest<AdminTestGenerationResult>("/admin/tests/auto-generate", {
        token,
        method: "POST",
        body: {
          exam_id: generationExamId,
          subject_id: generationSubjectId,
        },
      });

      setGenerationResult(response.data);
      await refreshTests();
      showToast({
        tone: "success",
        title: "Otomatik testler hazır",
        description: `${response.data.summary.planned_create_count} yeni, ${response.data.summary.planned_update_count} güncel test.`,
      });
    } catch (generateError) {
      setGenerationError(generateError instanceof Error ? generateError.message : "Otomatik üretim tamamlanamadı.");
    } finally {
      setGenerationApplying(false);
    }
  }

  const columns: ColumnDef<AdminTest>[] = [
    {
      accessorKey: "title",
      header: "Test",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[520px]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="overflow-hidden text-sm font-bold leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {row.original.title}
            </p>
            {row.original.is_auto_generated ? (
              <span className="rounded-full bg-[var(--color-admin-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-admin-accent)]">
                Otomatik
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.subject?.name ?? "Ders yok"}
            {row.original.topic ? ` · ${row.original.topic.name}` : ""}
            {!row.original.topic && row.original.exam ? ` · ${row.original.exam.name}` : ""}
          </p>
          <AdminReadinessHint readiness={row.original.readiness} />
        </div>
      ),
    },
    {
      accessorKey: "scope",
      header: "Kapsam",
      cell: ({ row }) => (
        <span className="inline-flex rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-admin-muted)]">
          {row.original.scope === "topic" ? "Konu Testi" : "Ders Geneli"}
        </span>
      ),
    },
    {
      accessorKey: "question_count",
      header: "Soru",
      cell: ({ row }) => <span className="font-semibold text-[var(--color-admin-ink)]">{row.original.question_count}</span>,
    },
    {
      accessorKey: "duration_min",
      header: "Süre",
      cell: ({ row }) => <span className="text-sm font-semibold text-[var(--color-admin-ink)]">{row.original.duration_min} dk</span>,
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            row.original.status === "active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : row.original.status === "draft"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {row.original.status === "active" ? "Aktif" : row.original.status === "draft" ? "Taslak" : "Pasif"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksiyon",
      cell: ({ row }) => {
        const busy = busyKey === `${row.original.scope}-${row.original.id}`;

        return (
          <div className="flex justify-end gap-2">
            <Link
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
              href={`/testler/${row.original.id}/duzenle`}
            >
              <SquarePen size={16} />
            </Link>
            <ConfirmDialog
              busy={busy}
              confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
              description={row.original.status === "active" ? "Bu test öğrenci tarafında listelenmez." : "Bu test tekrar aktif hale getirilir."}
              onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
              title={row.original.status === "active" ? "Test pasife alınsın mı?" : "Test aktife alınsın mı?"}
              tone={row.original.status === "active" ? "danger" : "primary"}
              trigger={
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                  {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
                </span>
              }
            />
            <ConfirmDialog
              busy={busy}
              confirmLabel="Testi Sil"
              description="Kayıt kalıcı olarak silinir."
              onConfirm={() => handleDelete(row.original)}
              title="Test silinsin mi?"
              trigger={
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-danger)] hover:text-[var(--color-admin-danger)]">
                  <Trash2 size={16} />
                </span>
              }
            />
          </div>
        );
      },
    },
  ];

  const loading = testsLoading;
  const error = testsError;

  return (
    <div className="space-y-4">
      <AdminTableCard>
        <AdminListToolbar>
          <AdminListToolbarRow>
            <AdminListToolbarFields>
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[320px]">
                <input
                  className="admin-input h-10 text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Test başlığı, ders veya konu ara"
                  value={query}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Ders seç"
                  compact
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={(next) => {
                    setSelectedSubjectId(next);
                    setSelectedTopicId(null);
                  }}
                  options={subjectOptions}
                  placeholder="Ders seç"
                  value={selectedSubjectId}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Konu seç"
                  compact
                  emptyText="Konu bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={setSelectedTopicId}
                  options={topicOptions}
                  placeholder="Konu seç"
                  value={selectedTopicId}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[170px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}
                  value={scopeFilter}
                >
                  <option value="all">Tüm kapsamlar</option>
                  <option value="subject">Ders geneli</option>
                  <option value="topic">Konu testi</option>
                </select>
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[170px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  value={statusFilter}
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="active">Aktif</option>
                  <option value="draft">Taslak</option>
                  <option value="passive">Pasif</option>
                </select>
              </AdminListToolbarField>
            </AdminListToolbarFields>

            <AdminListToolbarActions>
              <AdminListToolbarIconButton onClick={handleOpenGenerator} title="Otomatik Test Oluştur">
                <Sparkles size={15} />
              </AdminListToolbarIconButton>
              <AdminListToolbarIconButton onClick={() => void refreshTests()} title="Yenile">
                <RefreshCcw size={15} />
              </AdminListToolbarIconButton>
              <Link
                aria-label="Yeni Test"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35 hover:text-[var(--color-admin-accent)]"
                href="/testler/yeni"
                title="Yeni Test"
              >
                <Plus size={16} />
              </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{filteredRows.length} test</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>{rows.filter((item) => item.status === "active").length} aktif</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>{rows.filter((item) => item.scope === "subject").length} ders geneli</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>{rows.filter((item) => item.scope === "topic").length} konu testi</AdminListToolbarMetaPill>
          </AdminListToolbarMeta>
        </AdminListToolbar>

        {loading ? (
          <AdminTableSkeleton />
        ) : error ? (
          <div className="px-5 py-10 text-sm text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Henüz test kaydı yok." />
        )}
      </AdminTableCard>

      {generationOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-admin-line)] px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-[var(--color-admin-accent)]">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">
                      Otomatik Test Oluştur
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                      Her ders için 1 genel test, yeterli sorusu olan her konu için konu testi üretir.
                    </p>
                  </div>
                </div>
              </div>
              <button
                className="rounded-2xl border border-[var(--color-admin-line)] p-2 text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={() => setGenerationOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
                  <AdminSearchSelect
                    emptyText="Sınav bulunamadı."
                    label="Sınav"
                    onChange={(next) => {
                      setGenerationExamId(next);
                      setGenerationSubjectId(null);
                      void loadGenerationPreview(next, null);
                    }}
                    options={examOptions}
                    placeholder="Sınav ara"
                    value={generationExamId}
                  />
                  <p className="mt-3 text-xs leading-5 text-[var(--color-admin-muted)]">
                    Genel testler sınava özel üretilir; aynı ders farklı sınavlarda ayrı Genel Test alır.
                  </p>
                </div>

                <div className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
                  <AdminSearchSelect
                    emptyText="Ders bulunamadı."
                    label="Ders filtresi"
                    onChange={(next) => {
                      setGenerationSubjectId(next);
                      void loadGenerationPreview(generationExamId, next);
                    }}
                    options={generationSubjectOptions}
                    placeholder="Ders ara"
                    value={generationSubjectId}
                  />
                  <p className="mt-3 text-xs leading-5 text-[var(--color-admin-muted)]">
                    Ders seçmezsen tüm aktif dersler için önizleme ve üretim yapılır.
                  </p>
                </div>

                <div className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                    Kural
                  </p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-admin-muted)]">
                    <p>10 sorudan az havuzda test açılmaz.</p>
                    <p>Konu testleri 10-20 soru arası sınırlandırılır.</p>
                    <p>Genel testler en fazla 20 soru olur ve konulara dengeli dağılır.</p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                {generationError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {generationError}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    ["Sınav", generationResult?.summary.exams_seen ?? 0],
                    ["Ders", generationResult?.summary.subjects_seen ?? 0],
                    ["Konu", generationResult?.summary.topics_seen ?? 0],
                    ["Oluştur", generationResult?.summary.planned_create_count ?? 0],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3"
                      key={label}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-[var(--color-admin-ink)]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-[22px] border border-[var(--color-admin-line)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
                    <p className="text-sm font-bold text-[var(--color-admin-ink)]">Üretim planı</p>
                    {generationLoading ? (
                      <span className="text-xs font-semibold text-[var(--color-admin-muted)]">Önizleme alınıyor...</span>
                    ) : (
                      <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
                        {generationResult?.plans.length ?? 0} satır
                      </span>
                    )}
                  </div>

                  <div className="max-h-[380px] overflow-y-auto bg-[var(--color-admin-panel)]">
                    {generationLoading ? (
                      <div className="p-5 text-sm text-[var(--color-admin-muted)]">Plan hazırlanıyor...</div>
                    ) : !generationResult || generationResult.plans.length === 0 ? (
                      <div className="p-5 text-sm text-[var(--color-admin-muted)]">Henüz önizleme yok.</div>
                    ) : (
                      generationResult.plans.map((plan) => (
                        <div
                          className="grid gap-3 border-b border-[var(--color-admin-line)] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_90px_90px_110px]"
                          key={plan.auto_generated_key}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-admin-muted)]">
                                {plan.type === "topic" ? "Konu" : "Genel"}
                              </span>
                              <p className="truncate text-sm font-bold text-[var(--color-admin-ink)]">{plan.title}</p>
                            </div>
                              <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">
                                {plan.type === "subject" && plan.exam_name ? `${plan.exam_name} · ${plan.subject_name} · ` : ""}
                                {plan.reason}
                              </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Uygun</p>
                            <p className="text-sm font-bold text-[var(--color-admin-ink)]">{plan.eligible_question_count}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">Seçilen</p>
                            <p className="text-sm font-bold text-[var(--color-admin-ink)]">{plan.selected_question_count}</p>
                          </div>
                          <div className="flex items-center md:justify-end">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                plan.action === "create"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : plan.action === "update"
                                    ? "bg-sky-50 text-sky-700"
                                    : plan.action === "deactivate"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {plan.action === "create"
                                ? "Oluştur"
                                : plan.action === "update"
                                  ? "Güncelle"
                                  : plan.action === "deactivate"
                                    ? "Pasife Al"
                                    : "Atla"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-admin-line)] px-6 py-4">
              <p className="text-xs leading-5 text-[var(--color-admin-muted)]">
                Bu işlem sadece otomatik üretilmiş testleri günceller; manuel test kayıtlarına dokunmaz.
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-2xl border border-[var(--color-admin-line)] px-4 py-2.5 text-sm font-bold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                  onClick={() => void loadGenerationPreview(generationExamId, generationSubjectId)}
                  type="button"
                >
                  Önizlemeyi Yenile
                </button>
                <button
                  className="rounded-2xl bg-[var(--color-admin-accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                  disabled={generationApplying || generationLoading}
                  onClick={() => void handleApplyGeneration()}
                  type="button"
                >
                  {generationApplying ? "Oluşturuluyor..." : "Planı Uygula"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
