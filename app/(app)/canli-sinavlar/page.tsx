"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Plus, RadioTower, RefreshCw, UsersRound } from "lucide-react";
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
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminLiveExamEvent, AdminMockExam } from "@/lib/types";

type IndexPayload = { events: AdminLiveExamEvent[]; mock_exams: AdminMockExam[] };

const phaseLabels: Record<string, string> = {
  scheduled: "Planlandı",
  registration_open: "Kayıt açık",
  waiting_room: "Bekleme salonu",
  live: "Canlı",
  grace: "Ek süre",
  reviewing: "İnceleniyor",
  ranked: "Sıralandı",
  published: "Yayınlandı",
  cancelled: "Arşivlendi",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function phaseStyle(phase: string) {
  if (phase === "live") return "border-red-200 bg-red-50 text-red-700";
  if (["registration_open", "waiting_room"].includes(phase)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (phase === "published") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (["reviewing", "ranked", "grace"].includes(phase)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function LiveExamsPage() {
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const [events, setEvents] = useState<AdminLiveExamEvent[]>([]);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setTitle("Canlı Sınavlar"); return () => setTitle(null); }, [setTitle]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await adminApiRequest<IndexPayload>("/admin/live-exams", { token });
      setEvents(response.data.events);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Canlı sınavlar alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    return events.filter((event) => {
      if (phase !== "all" && event.phase !== phase) return false;
      if (!normalized) return true;
      return [event.title, event.exam?.name, event.mock_exam?.title]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [events, phase, query]);

  const columns: ColumnDef<AdminLiveExamEvent>[] = [
    {
      accessorKey: "title",
      header: "Canlı sınav",
      cell: ({ row }) => <div className="max-w-[420px]"><p className="text-sm font-bold text-[var(--color-admin-ink)]">{row.original.title}</p><p className="mt-1 text-xs text-[var(--color-admin-muted)]">{row.original.mock_exam?.title ?? row.original.exam?.name ?? "Kaynak belirtilmedi"}</p></div>,
    },
    {
      accessorKey: "starts_at",
      header: "Başlangıç",
      cell: ({ row }) => <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-[var(--color-admin-ink)]"><CalendarDays size={15} className="text-amber-600" />{formatDate(row.original.starts_at)}</span>,
    },
    {
      id: "scope",
      header: "Kapsam",
      cell: ({ row }) => <div className="text-sm font-semibold text-[var(--color-admin-ink)]">{row.original.question_count} soru<p className="mt-1 text-xs font-medium text-[var(--color-admin-muted)]">{row.original.duration_min} dakika</p></div>,
    },
    {
      accessorKey: "participations_count",
      header: "Katılımcı",
      cell: ({ row }) => <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-admin-ink)]"><UsersRound size={15} className="text-[var(--color-admin-muted)]" />{row.original.participations_count}</span>,
    },
    {
      accessorKey: "phase",
      header: "Durum",
      cell: ({ row }) => <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${phaseStyle(row.original.phase)}`}>{phaseLabels[row.original.phase] ?? row.original.phase}</span>,
    },
    {
      id: "actions",
      header: "Aksiyon",
      cell: ({ row }) => <div className="flex justify-end"><Link href={`/canli-sinavlar/${row.original.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 text-xs font-bold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]">Yönet <ArrowRight size={15} /></Link></div>,
    },
  ];

  const activeCount = events.filter((event) => ["registration_open", "waiting_room", "live"].includes(event.phase)).length;
  const participantCount = events.reduce((total, event) => total + event.participations_count, 0);

  return <div className="space-y-5">
    <section className="flex flex-col gap-4 border-b border-[var(--color-admin-line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-amber-600"><RadioTower size={16} />Canlı sınav yönetimi</div><h1 className="text-3xl font-black tracking-[-.04em] text-[var(--color-admin-ink)]">Canlı Sınavlar</h1><p className="mt-2 text-sm text-[var(--color-admin-muted)]">Planlanan sınavları izle; kayıt, yayın ve sonuç operasyonuna tek noktadan geç.</p></div>
      <Link href="/canli-sinavlar/yeni" className="admin-button admin-button-primary justify-center"><Plus size={16} />Yeni canlı sınav</Link>
    </section>

    <AdminTableCard>
      <AdminListToolbar>
        <AdminListToolbarRow>
          <AdminListToolbarFields>
            <AdminListToolbarField className="min-w-[240px] flex-1 sm:max-w-[380px]"><input className="admin-input h-10 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sınav veya kaynak deneme ara" /></AdminListToolbarField>
            <AdminListToolbarField className="min-w-[190px]"><select className="admin-input h-10 appearance-none pr-9 text-sm" value={phase} onChange={(event) => setPhase(event.target.value)}><option value="all">Tüm durumlar</option>{Object.entries(phaseLabels).filter(([value]) => value !== "cancelled").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></AdminListToolbarField>
          </AdminListToolbarFields>
          <AdminListToolbarActions><AdminListToolbarIconButton onClick={() => void load()} title="Yenile"><RefreshCw size={15} /></AdminListToolbarIconButton></AdminListToolbarActions>
        </AdminListToolbarRow>
        <AdminListToolbarMeta><AdminListToolbarMetaPill>{filteredEvents.length} sınav</AdminListToolbarMetaPill><AdminListToolbarMetaPill>{activeCount} aktif operasyon</AdminListToolbarMetaPill><AdminListToolbarMetaPill>{participantCount} toplam katılımcı</AdminListToolbarMetaPill></AdminListToolbarMeta>
      </AdminListToolbar>
      {loading ? <AdminTableSkeleton /> : error ? <div className="px-5 py-10 text-sm text-[var(--color-admin-danger)]">{error}</div> : <AdminDataGrid columns={columns} data={filteredEvents} emptyState="Henüz aktif bir canlı sınav yok. Yeni canlı sınav oluşturarak başlayabilirsin." />}
    </AdminTableCard>
  </div>;
}
