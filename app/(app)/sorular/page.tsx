"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  PauseCircle,
  Plus,
  RefreshCcw,
  SquarePen,
  Trash2,
  Upload,
} from "lucide-react";
import { AdminDataGrid } from "@/components/admin/crud/AdminDataGrid";
import { AdminFilterMenu } from "@/components/admin/crud/AdminFilterMenu";
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
import type { AdminExam, AdminMinistry, AdminQuestion, AdminSubject, AdminTopic } from "@/lib/types";

export default function QuestionsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const { items, setItems, loading, error, refresh } = useAdminList<AdminQuestion>({
    endpoint: "/admin/questions",
    responseKey: "questions",
  });
  const { items: ministries } = useAdminList<AdminMinistry>({
    endpoint: "/admin/ministries",
    responseKey: "ministries",
  });
  const { items: exams } = useAdminList<AdminExam>({
    endpoint: "/admin/exams",
    responseKey: "exams",
  });
  const { items: subjects } = useAdminList<AdminSubject>({
    endpoint: "/admin/subjects",
    responseKey: "subjects",
  });
  const { items: topics } = useAdminList<AdminTopic>({
    endpoint: "/admin/topics",
    responseKey: "topics",
  });

  const [query, setQuery] = useState("");
  const [selectedMinistryId, setSelectedMinistryId] = useState("all");
  const [selectedExamId, setSelectedExamId] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<"all" | "multiple_choice" | "true_false">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "passive">("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);

  const filteredExams = useMemo(
    () =>
      selectedMinistryId === "all"
        ? exams
        : exams.filter((exam) => exam.ministry?.id === Number(selectedMinistryId)),
    [exams, selectedMinistryId],
  );

  const filteredSubjects = useMemo(() => {
    if (selectedExamId !== "all") {
      return subjects.filter((subject) =>
        topics.some((topic) => topic.subject_id === subject.id && (topic.exam_ids ?? []).includes(Number(selectedExamId))),
      );
    }

    if (selectedMinistryId === "all") {
      return subjects;
    }

    const visibleExamIds = new Set(filteredExams.map((exam) => exam.id));
    return subjects.filter((subject) =>
      topics.some((topic) => topic.subject_id === subject.id && (topic.exam_ids ?? []).some((examId) => visibleExamIds.has(examId))),
    );
  }, [filteredExams, selectedExamId, selectedMinistryId, subjects, topics]);

  const filteredTopics = useMemo(
    () => {
      const visibleExamIds = new Set(filteredExams.map((exam) => exam.id));

      return topics.filter((topic) => {
        if (selectedSubjectId !== "all" && String(topic.subject_id) !== selectedSubjectId) {
          return false;
        }

        if (!filteredSubjects.some((subject) => subject.id === topic.subject_id)) {
          return false;
        }

        if (selectedExamId !== "all") {
          return (topic.exam_ids ?? []).includes(Number(selectedExamId));
        }

        if (selectedMinistryId !== "all") {
          return (topic.exam_ids ?? []).some((examId) => visibleExamIds.has(examId));
        }

        return true;
      });
    },
    [filteredExams, filteredSubjects, selectedExamId, selectedMinistryId, selectedSubjectId, topics],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    const visibleExamIds = new Set(filteredExams.map((exam) => exam.id));

    return items.filter((item) => {
      const topic = topics.find((entry) => entry.id === item.topic_id) ?? null;

      if (selectedMinistryId !== "all") {
        if (!topic || !(topic.exam_ids ?? []).some((examId) => visibleExamIds.has(examId))) {
          return false;
        }
      }

      if (selectedExamId !== "all") {
        if (!topic || !(topic.exam_ids ?? []).includes(Number(selectedExamId))) {
          return false;
        }
      }

      if (selectedSubjectId !== "all" && item.topic?.subject?.id !== Number(selectedSubjectId)) {
        return false;
      }

      if (selectedTopicId !== null && item.topic_id !== selectedTopicId) {
        return false;
      }

      if (questionTypeFilter !== "all" && item.question_type !== questionTypeFilter) {
        return false;
      }

      if (difficultyFilter !== "all" && item.difficulty !== difficultyFilter) {
        return false;
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const haystack = [
        item.question_text,
        item.topic?.name,
        item.topic?.subject?.name,
        item.correct_answer_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");

      return haystack.includes(normalized);
    });
  }, [
    difficultyFilter,
    filteredExams,
    items,
    query,
    questionTypeFilter,
    selectedExamId,
    selectedMinistryId,
    selectedSubjectId,
    selectedTopicId,
    statusFilter,
    topics,
  ]);

  const visibleApprovableQuestionIds = useMemo(
    () => filteredRows.filter((item) => item.status !== "active").map((item) => item.id),
    [filteredRows],
  );
  const visibleApprovableQuestionIdSet = useMemo(
    () => new Set(visibleApprovableQuestionIds),
    [visibleApprovableQuestionIds],
  );
  const selectedBulkCount = selectedQuestionIds.filter((questionId) =>
    visibleApprovableQuestionIdSet.has(questionId),
  ).length;
  const allVisibleApprovableSelected =
    visibleApprovableQuestionIds.length > 0 && selectedBulkCount === visibleApprovableQuestionIds.length;

  useEffect(() => {
    const activeQuestionIds = new Set(items.filter((item) => item.status !== "active").map((item) => item.id));
    setSelectedQuestionIds((current) => current.filter((questionId) => activeQuestionIds.has(questionId)));
  }, [items]);

  function toggleQuestionSelection(question: AdminQuestion) {
    if (question.status === "active") {
      return;
    }

    setSelectedQuestionIds((current) =>
      current.includes(question.id)
        ? current.filter((questionId) => questionId !== question.id)
        : [...current, question.id],
    );
  }

  function toggleVisibleSelection() {
    setSelectedQuestionIds((current) => {
      if (allVisibleApprovableSelected) {
        return current.filter((questionId) => !visibleApprovableQuestionIdSet.has(questionId));
      }

      return Array.from(new Set([...current, ...visibleApprovableQuestionIds]));
    });
  }

  async function handleBulkActivate() {
    if (!token) {
      return;
    }

    const questionIds = selectedQuestionIds.filter((questionId) => visibleApprovableQuestionIdSet.has(questionId));
    if (questionIds.length === 0) {
      return;
    }

    setBulkBusy(true);

    try {
      const response = await adminApiRequest<{
        updated_count: number;
        questions: AdminQuestion[];
      }>("/admin/questions/bulk-status", {
        token,
        method: "POST",
        body: {
          question_ids: questionIds,
          status: "active",
        },
      });

      const updatedById = new Map(response.data.questions.map((question) => [question.id, question]));
      setItems((current) => current.map((item) => updatedById.get(item.id) ?? item));
      setSelectedQuestionIds([]);

      showToast({
        tone: "success",
        title: "Seçili sorular aktife alındı",
        description: `${response.data.updated_count} soru aktif olarak soru havuzuna eklendi.`,
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Toplu onay başarısız",
        description: submitError instanceof Error ? submitError.message : "Seçili sorular aktife alınamadı.",
      });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleStatusChange(question: AdminQuestion, checked: boolean) {
    if (!token) {
      return;
    }

    setBusyId(question.id);

    try {
      const response = await adminApiRequest<{ question: AdminQuestion }>(`/admin/questions/${question.id}`, {
        token,
        method: "PUT",
        body: {
          topic_id: question.topic_id,
          question_type: question.question_type,
          difficulty: question.difficulty,
          status: checked ? "active" : "passive",
          is_free: Boolean(question.is_free),
          free_preview_order: question.free_preview_order ?? null,
          is_past_exam_question: Boolean(question.is_past_exam_question),
          question_text: question.question_text,
          correct_answer_text: question.correct_answer_text,
          explanation_text: question.explanation_text,
          published_at: question.published_at,
          options: question.options ?? [],
        },
      });

      setItems((current) =>
        current.map((item) => (item.id === question.id ? response.data.question : item)),
      );
      showToast({
        tone: "success",
        title: checked ? "Soru aktife alındı" : "Soru pasife alındı",
        description: question.topic?.name ?? "Soru havuzu",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Durum güncellenemedi",
        description: submitError instanceof Error ? submitError.message : "Soru kaydı başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(question: AdminQuestion) {
    if (!token) {
      return;
    }

    setBusyId(question.id);

    try {
      await adminApiRequest(`/admin/questions/${question.id}`, {
        token,
        method: "DELETE",
      });

      setItems((current) => current.filter((item) => item.id !== question.id));
      showToast({
        tone: "success",
        title: "Soru silindi",
        description: question.topic?.name ?? "Soru havuzu",
      });
    } catch (submitError) {
      showToast({
        tone: "error",
        title: "Soru silinemedi",
        description: submitError instanceof Error ? submitError.message : "Silme işlemi başarısız oldu.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const topicOptions = useMemo(
    () =>
      filteredTopics.map((topic) => ({
        id: topic.id,
        label: topic.name,
        hint: topic.subject?.name,
      })),
    [filteredTopics],
  );

  const ministryOptions = useMemo(
    () =>
      ministries.map((ministry) => ({
        id: ministry.id,
        label: ministry.name,
        hint: `${ministry.exam_count} sınav`,
      })),
    [ministries],
  );

  const examOptions = useMemo(
    () =>
      filteredExams.map((exam) => ({
        id: exam.id,
        label: exam.name,
        hint: exam.ministry?.name,
      })),
    [filteredExams],
  );

  const subjectOptions = useMemo(
    () =>
      filteredSubjects.map((subject) => ({
        id: subject.id,
        label: subject.name,
        hint: `${subject.topic_count} konu`,
      })),
    [filteredSubjects],
  );

  const columns: ColumnDef<AdminQuestion>[] = [
    {
      id: "select",
      enableSorting: false,
      header: () => (
        <input
          aria-label="Görünen aktif olmayan soruları seç"
          checked={allVisibleApprovableSelected}
          className="h-4 w-4 accent-[var(--color-admin-accent)]"
          disabled={bulkBusy || visibleApprovableQuestionIds.length === 0}
          onChange={toggleVisibleSelection}
          type="checkbox"
        />
      ),
      cell: ({ row }) => {
        const isApprovable = row.original.status !== "active";

        return (
          <input
            aria-label="Soruyu toplu onay için seç"
            checked={selectedQuestionIds.includes(row.original.id) && isApprovable}
            className="h-4 w-4 accent-[var(--color-admin-accent)] disabled:opacity-40"
            disabled={!isApprovable || bulkBusy}
            onChange={() => toggleQuestionSelection(row.original)}
            type="checkbox"
          />
        );
      },
    },
    {
      accessorKey: "question_text",
      header: "Soru",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[540px]">
          <p className="overflow-hidden text-sm font-bold leading-6 text-[var(--color-admin-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {row.original.question_text ?? ""}
          </p>
          <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
            {row.original.topic?.subject?.name ?? "Ders yok"} · {row.original.topic?.name ?? "Konu yok"}
          </p>
          <AdminReadinessHint readiness={row.original.readiness} />
        </div>
      ),
    },
    {
      accessorKey: "question_type",
      header: "Tip",
      cell: ({ row }) => (
        <span className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.question_type === "multiple_choice" ? "Çoktan Seçmeli" : "Doğru / Yanlış"}
        </span>
      ),
    },
    {
      accessorKey: "difficulty",
      header: "Zorluk",
      cell: ({ row }) => (
        <span className="font-semibold text-[var(--color-admin-ink)]">
          {row.original.difficulty === "easy"
            ? "Kolay"
            : row.original.difficulty === "medium"
              ? "Orta"
              : "Zor"}
        </span>
      ),
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
          {row.original.status === "active"
            ? "Aktif"
            : row.original.status === "draft"
              ? "Taslak"
              : "Pasif"}
        </span>
      ),
    },
    {
      accessorKey: "free",
      header: "Erişim",
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-admin-ink)]">
            {row.original.is_free ? "Free Preview" : "Üyelik"}
          </p>
          <p className="text-xs text-[var(--color-admin-muted)]">
            {row.original.is_past_exam_question ? "Çıkmış Soru" : "Standart"}
          </p>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Aksiyon",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={`/sorular/${row.original.id}/duzenle`}
          >
            <SquarePen size={16} />
          </Link>
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel={row.original.status === "active" ? "Pasife Al" : "Aktife Al"}
            description={
              row.original.status === "active"
                ? "Bu soru öğrenci akışlarından çıkarılır."
                : "Bu soru tekrar aktif hale getirilir."
            }
            onConfirm={() => handleStatusChange(row.original, row.original.status !== "active")}
            title={row.original.status === "active" ? "Soru pasife alınsın mı?" : "Soru aktife alınsın mı?"}
            tone={row.original.status === "active" ? "danger" : "primary"}
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">
                {row.original.status === "active" ? <PauseCircle size={16} /> : <CheckCircle2 size={16} />}
              </span>
            }
          />
          <ConfirmDialog
            busy={busyId === row.original.id}
            confirmLabel="Soruyu Sil"
            description="Soru kalıcı olarak silinir. Bağlı şık kayıtları da kaldırılır."
            onConfirm={() => handleDelete(row.original)}
            title="Soru silinsin mi?"
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-danger)] hover:text-[var(--color-admin-danger)]">
                <Trash2 size={16} />
              </span>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminTableCard>
        <AdminListToolbar>
          <AdminListToolbarRow>
            <AdminListToolbarFields>
              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[300px]">
                  <input
                    className="admin-input h-10 text-sm"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Soru metni, ders veya konu ara"
                    value={query}
                  />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[240px]">
                <AdminSearchSelect
                  buttonPlaceholder="Bakanlık seç"
                  compact
                  emptyText="Bakanlık bulunamadı."
                  hideLabel
                  label="Bakanlık"
                  onChange={(value) => {
                    setSelectedMinistryId(value === null ? "all" : String(value));
                    setSelectedExamId("all");
                    setSelectedSubjectId("all");
                    setSelectedTopicId(null);
                  }}
                  options={ministryOptions}
                  placeholder="Bakanlık ara"
                  value={selectedMinistryId === "all" ? null : Number(selectedMinistryId)}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[240px]">
                <AdminSearchSelect
                  buttonPlaceholder="Sınav seç"
                  compact
                  emptyText="Sınav bulunamadı."
                  hideLabel
                  label="Sınav"
                  onChange={(value) => {
                    setSelectedExamId(value === null ? "all" : String(value));
                    setSelectedSubjectId("all");
                    setSelectedTopicId(null);
                  }}
                  options={examOptions}
                  placeholder="Sınav ara"
                  value={selectedExamId === "all" ? null : Number(selectedExamId)}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[240px]">
                <AdminSearchSelect
                  buttonPlaceholder="Ders seç"
                  compact
                  emptyText="Ders bulunamadı."
                  hideLabel
                  label="Ders"
                  onChange={(value) => {
                    setSelectedSubjectId(value === null ? "all" : String(value));
                    setSelectedTopicId(null);
                  }}
                  options={subjectOptions}
                  placeholder="Ders ara"
                  value={selectedSubjectId === "all" ? null : Number(selectedSubjectId)}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[220px] flex-1 sm:max-w-[260px]">
                <AdminSearchSelect
                  buttonPlaceholder="Konu seç"
                  compact
                  emptyText="Filtreye uygun konu bulunamadı."
                  hideLabel
                  label="Konu"
                  onChange={setSelectedTopicId}
                  options={topicOptions}
                  placeholder="Konu ara"
                  value={selectedTopicId}
                />
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[170px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setQuestionTypeFilter(event.target.value as typeof questionTypeFilter)}
                  value={questionTypeFilter}
                >
                  <option value="all">Tüm tipler</option>
                  <option value="multiple_choice">Çoktan Seçmeli</option>
                  <option value="true_false">Doğru / Yanlış</option>
                </select>
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[170px]">
                <select
                  className="admin-input h-10 appearance-none pr-9 text-sm leading-none"
                  onChange={(event) => setDifficultyFilter(event.target.value as typeof difficultyFilter)}
                  value={difficultyFilter}
                >
                  <option value="all">Tüm zorluklar</option>
                  <option value="easy">Kolay</option>
                  <option value="medium">Orta</option>
                  <option value="hard">Zor</option>
                </select>
              </AdminListToolbarField>

              <AdminListToolbarField className="min-w-[190px]">
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

              <AdminListToolbarField className="self-end pb-[1px]">
                <AdminFilterMenu
                  compact
                  icon={<ArrowUpDown size={15} />}
                  label="Filtreleri Temizle"
                  onChange={() => {
                    setQuery("");
                    setSelectedMinistryId("all");
                    setSelectedExamId("all");
                    setSelectedSubjectId("all");
                    setSelectedTopicId(null);
                    setQuestionTypeFilter("all");
                    setDifficultyFilter("all");
                    setStatusFilter("all");
                  }}
                  options={[{ value: "reset", label: "Filtreleri sıfırla" }]}
                  showSelectedLabel={false}
                  value={"reset"}
                />
              </AdminListToolbarField>
            </AdminListToolbarFields>

            <AdminListToolbarActions>
              <button
                className="admin-button admin-button-secondary"
                disabled={bulkBusy || selectedBulkCount === 0}
                onClick={handleBulkActivate}
                type="button"
              >
                <CheckCircle2 size={16} />
                Seçili {selectedBulkCount} soruyu aktif yap
              </button>
              <AdminListToolbarIconButton onClick={refresh} title="Yenile">
                <RefreshCcw size={15} />
              </AdminListToolbarIconButton>
                <Link className="admin-button admin-button-secondary" href="/sorular/import">
                  <Upload size={16} />
                </Link>
                <Link className="admin-button admin-button-primary" href="/sorular/yeni">
                  <Plus size={16} />
                </Link>
            </AdminListToolbarActions>
          </AdminListToolbarRow>

          <AdminListToolbarMeta>
            <AdminListToolbarMetaPill>{filteredRows.length} soru</AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.status === "active").length} aktif
            </AdminListToolbarMetaPill>
            <AdminListToolbarMetaPill>
              {items.filter((item) => item.question_type === "multiple_choice").length} test
            </AdminListToolbarMetaPill>
          </AdminListToolbarMeta>
        </AdminListToolbar>

        {loading ? (
          <AdminTableSkeleton rows={8} />
        ) : error ? (
          <div className="px-5 py-8 text-sm text-[var(--color-admin-danger)]">{error}</div>
        ) : (
          <AdminDataGrid columns={columns} data={filteredRows} emptyState="Filtrelere uygun soru bulunamadı." />
        )}
      </AdminTableCard>
    </div>
  );
}
