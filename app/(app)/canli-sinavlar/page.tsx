"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, Loader2, LockKeyhole, Plus, RadioTower, RefreshCw, Send, Snowflake, UsersRound } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminLiveExamEvent, AdminLiveExamQuestionAnalytics, AdminMockExam } from "@/lib/types";

type IndexPayload = { events: AdminLiveExamEvent[]; mock_exams: AdminMockExam[] };
type DetailPayload = { event: AdminLiveExamEvent; analytics: AdminLiveExamQuestionAnalytics[] };

const initialForm = {
  mock_exam_id: "", title: "PAEM Türkiye Geneli Canlı Deneme", slug: "paem-turkiye-geneli",
  registration_opens_at: "", starts_at: "", question_count: "100", duration_min: "120",
};

function localIso(value: string) { return new Date(value).toISOString(); }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—"; }

export default function AdminLiveExamsPage() {
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [events, setEvents] = useState<AdminLiveExamEvent[]>([]);
  const [mockExams, setMockExams] = useState<AdminMockExam[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setTitle("Canlı Sınav Operasyonu"); return () => setTitle(null); }, [setTitle]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const response = await adminApiRequest<IndexPayload>("/admin/live-exams", { token });
      setEvents(response.data.events); setMockExams(response.data.mock_exams);
      if (response.data.events[0]) setSelectedId((current) => current ?? response.data.events[0].id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Canlı sınavlar alınamadı."); }
    finally { setLoading(false); }
  }, [token]);

  const loadDetail = useCallback(async (id: number) => {
    if (!token) return;
    try { const response = await adminApiRequest<DetailPayload>(`/admin/live-exams/${id}`, { token }); setDetail(response.data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Etkinlik detayı alınamadı."); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [loadDetail, selectedId]);

  const selectedMock = useMemo(() => mockExams.find((item) => item.id === Number(form.mock_exam_id)), [form.mock_exam_id, mockExams]);

  async function createEvent(e: FormEvent) {
    e.preventDefault(); if (!token || !selectedMock || busy) return;
    setBusy("create");
    try {
      const start = new Date(form.starts_at);
      const response = await adminApiRequest<{ event: AdminLiveExamEvent }>("/admin/live-exams", {
        token, method: "POST", body: {
          exam_id: selectedMock.exam_id, mock_exam_id: selectedMock.id, title: form.title, slug: form.slug,
          question_count: Number(form.question_count), duration_min: Number(form.duration_min),
          registration_opens_at: localIso(form.registration_opens_at),
          waiting_room_opens_at: new Date(start.getTime() - 30 * 60_000).toISOString(),
          starts_at: start.toISOString(), late_entry_ends_at: new Date(start.getTime() + 15 * 60_000).toISOString(),
          ends_at: new Date(start.getTime() + Number(form.duration_min) * 60_000).toISOString(),
          submission_grace_ends_at: new Date(start.getTime() + (Number(form.duration_min) * 60_000) + 60_000).toISOString(),
        },
      });
      showToast({ tone: "success", title: "Canlı sınav oluşturuldu", description: response.data.event.title });
      setSelectedId(response.data.event.id); await load();
    } catch (reason) { showToast({ tone: "error", title: "Etkinlik oluşturulamadı", description: reason instanceof Error ? reason.message : "İşlem başarısız." }); }
    finally { setBusy(null); }
  }

  async function action(name: "freeze" | "rankings" | "publish-results") {
    if (!token || !selectedId || busy) return;
    if (name === "publish-results" && !window.confirm("Taslak sonuçlar kesinleştirilecek ve katılımcılara bildirim gönderilecek. Yayınlamak istiyor musun?")) return;
    setBusy(name);
    try {
      const response = await adminApiRequest(`/admin/live-exams/${selectedId}/${name}`, { token, method: "POST" });
      showToast({ tone: "success", title: response.message ?? "İşlem tamamlandı", description: detail?.event.title });
      await load(); await loadDetail(selectedId);
    } catch (reason) { showToast({ tone: "error", title: "İşlem tamamlanamadı", description: reason instanceof Error ? reason.message : "Beklenmeyen hata." }); }
    finally { setBusy(null); }
  }

  async function saveQuestion(question: AdminLiveExamQuestionAnalytics, correctToken: string | null, cancelled: boolean, note: string) {
    if (!token || !selectedId || busy) return;
    setBusy(`question-${question.id}`);
    try {
      await adminApiRequest(`/admin/live-exams/${selectedId}/questions/${question.id}`, {
        token, method: "PUT", body: { correct_option_token: correctToken, is_cancelled: cancelled, review_note: note || null },
      });
      showToast({ tone: "success", title: `${question.display_order}. soru güncellendi`, description: cancelled ? "Değerlendirme dışı" : "Cevap anahtarı kaydedildi" });
      await loadDetail(selectedId);
    } catch (reason) { showToast({ tone: "error", title: "Soru güncellenemedi", description: reason instanceof Error ? reason.message : "İşlem başarısız." }); }
    finally { setBusy(null); }
  }

  return <div className="space-y-6">
    <section className="flex flex-col gap-4 border-b border-[var(--color-admin-line)] pb-6 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-amber-600"><RadioTower size={16} /> Operasyon merkezi</div><h1 className="text-3xl font-black tracking-[-.04em] text-[var(--color-admin-ink)]">PAEM Türkiye Geneli</h1><p className="mt-2 text-sm text-[var(--color-admin-muted)]">Etkinliği hazırla, soruları dondur, cevap dağılımını kontrol et ve sonuçları iki adımda yayınla.</p></div>
      <button onClick={() => void load()} className="admin-button admin-button-secondary"><RefreshCw size={16} />Yenile</button>
    </section>
    {error ? <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    <div className="grid gap-6 2xl:grid-cols-[390px_1fr]">
      <aside className="space-y-5">
        <form onSubmit={createEvent} className="space-y-4 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] p-5">
          <div className="flex items-center gap-2"><Plus size={17} /><h2 className="font-extrabold">Yeni etkinlik</h2></div>
          <label className="admin-field"><span>Kaynak deneme</span><select required value={form.mock_exam_id} onChange={(e) => { const mock = mockExams.find((item) => item.id === Number(e.target.value)); setForm({ ...form, mock_exam_id: e.target.value, question_count: String(mock?.question_count ?? 100), duration_min: String(mock?.duration_min ?? 120) }); }}><option value="">Seç</option>{mockExams.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.question_count} soru</option>)}</select></label>
          <label className="admin-field"><span>Başlık</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="admin-field"><span>Slug</span><input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="admin-field"><span>Soru</span><input type="number" required value={form.question_count} onChange={(e) => setForm({ ...form, question_count: e.target.value })} /></label><label className="admin-field"><span>Dakika</span><input type="number" required value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} /></label></div>
          <label className="admin-field"><span>Kayıt açılışı</span><input type="datetime-local" required value={form.registration_opens_at} onChange={(e) => setForm({ ...form, registration_opens_at: e.target.value })} /></label>
          <label className="admin-field"><span>Sınav başlangıcı</span><input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
          <button className="admin-button admin-button-primary w-full justify-center" disabled={busy === "create"}>{busy === "create" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}Etkinliği oluştur</button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)]">
          <header className="border-b border-[var(--color-admin-line)] p-4 text-sm font-extrabold">Etkinlikler</header>
          {loading ? <div className="grid place-items-center p-10"><Loader2 className="animate-spin" /></div> : events.map((event) => <button key={event.id} onClick={() => setSelectedId(event.id)} className={`block w-full border-b border-[var(--color-admin-line)] p-4 text-left transition hover:bg-black/[.025] ${selectedId === event.id ? "bg-amber-50" : ""}`}><div className="flex items-center justify-between gap-3"><strong className="text-sm">{event.title}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase">{event.phase}</span></div><small className="mt-2 block text-[var(--color-admin-muted)]">{formatDate(event.starts_at)} · {event.participations_count} katılımcı</small></button>)}
        </section>
      </aside>
      <main>{detail ? <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">{detail.event.phase}</span><h2 className="mt-2 text-2xl font-black tracking-[-.03em]">{detail.event.title}</h2><p className="mt-2 text-sm text-[var(--color-admin-muted)]">{formatDate(detail.event.starts_at)} — {formatDate(detail.event.ends_at)}</p></div><div className="flex flex-wrap gap-2"><button className="admin-button admin-button-secondary" onClick={() => void action("freeze")} disabled={Boolean(busy) || detail.event.participations_count > 0}><Snowflake size={16} />Soruları dondur</button><button className="admin-button admin-button-secondary" onClick={() => void action("rankings")} disabled={Boolean(busy) || !["reviewing", "ranked"].includes(detail.event.phase)}><BarChart3 size={16} />Sıralamayı oluştur</button><button className="admin-button admin-button-primary" onClick={() => void action("publish-results")} disabled={Boolean(busy) || detail.event.phase !== "ranked"}><Send size={16} />Yayınla ve bildir</button></div></div>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--color-admin-line)] lg:grid-cols-4"><Metric icon={<UsersRound />} label="Katılımcı" value={detail.event.participations_count} /><Metric icon={<LockKeyhole />} label="Dondurulan soru" value={detail.event.questions_count} /><Metric icon={<BarChart3 />} label="Taslak sonuç" value={detail.event.results_count} /><Metric icon={<Clock3 />} label="Süre" value={`${detail.event.duration_min} dk`} /></div>
        </section>
        <section className="space-y-3"><div><h2 className="text-lg font-black">Soru kontrolü</h2><p className="text-sm text-[var(--color-admin-muted)]">Cevap dağılımını incele; gerekiyorsa anahtarı düzelt veya soruyu değerlendirme dışı bırak.</p></div>{detail.analytics.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-[var(--color-admin-muted)]">Önce soru paketini dondur.</div> : detail.analytics.map((question) => <QuestionReview key={question.id} question={question} busy={busy === `question-${question.id}`} onSave={saveQuestion} />)}</section>
      </div> : <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed text-[var(--color-admin-muted)]">Bir etkinlik seç.</div>}</main>
    </div>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <div className="flex items-center gap-3 bg-[var(--color-admin-card)] p-4"><span className="text-amber-600">{icon}</span><div><small className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-admin-muted)]">{label}</small><strong className="text-xl font-black">{value}</strong></div></div>; }

function QuestionReview({ question, busy, onSave }: { question: AdminLiveExamQuestionAnalytics; busy: boolean; onSave: (q: AdminLiveExamQuestionAnalytics, token: string | null, cancelled: boolean, note: string) => void }) {
  const [correct, setCorrect] = useState<string | null>(question.options.find((item) => item.is_correct)?.token ?? null);
  const [cancelled, setCancelled] = useState(question.is_cancelled);
  const [note, setNote] = useState(question.review_note ?? "");
  const total = Math.max(question.answered_count, 1);
  return <article className={`rounded-2xl border p-5 ${cancelled ? "border-red-200 bg-red-50/40" : "border-[var(--color-admin-line)] bg-[var(--color-admin-card)]"}`}><header className="flex items-start justify-between gap-4"><div><span className="text-xs font-extrabold text-amber-600">Soru {question.display_order}</span><p className="mt-2 max-w-4xl text-sm font-bold leading-6">{question.question_text}</p></div><label className="flex items-center gap-2 text-xs font-extrabold text-red-700"><input type="checkbox" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} />İptal</label></header><div className="mt-4 grid gap-2">{question.options.map((option) => <label key={option.token} className="grid grid-cols-[22px_30px_1fr_auto] items-center gap-2 rounded-xl border border-[var(--color-admin-line)] p-3"><input type="radio" name={`correct-${question.id}`} checked={correct === option.token} disabled={cancelled} onChange={() => setCorrect(option.token)} /><b>{option.label}</b><span className="text-sm">{option.option_text}</span><span className="min-w-28 text-right text-xs font-bold text-[var(--color-admin-muted)]">{option.answer_count} · %{Math.round((option.answer_count / total) * 100)}</span></label>)}</div><div className="mt-4 flex flex-col gap-3 lg:flex-row"><input className="admin-input flex-1" placeholder="İnceleme notu" value={note} onChange={(e) => setNote(e.target.value)} /><button className="admin-button admin-button-secondary justify-center" disabled={busy || (!cancelled && !correct)} onClick={() => onSave(question, correct, cancelled, note)}>{busy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}Kuralı kaydet</button></div></article>;
}
