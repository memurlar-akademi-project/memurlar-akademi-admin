"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, BarChart3, CheckCircle2, Clock3, Loader2, LockKeyhole, Play, Plus, RadioTower, RefreshCw, Save, Send, Snowflake, UsersRound } from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { LiveExamParticipants } from "@/components/admin/live-exams/LiveExamParticipants";
import { LiveExamRankings } from "@/components/admin/live-exams/LiveExamRankings";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminLiveExamEvent, AdminLiveExamQuestionAnalytics, AdminMockExam } from "@/lib/types";

type IndexPayload = { events: AdminLiveExamEvent[]; mock_exams: AdminMockExam[] };
type DetailPayload = { event: AdminLiveExamEvent; analytics: AdminLiveExamQuestionAnalytics[] };

const initialForm = {
  mock_exam_id: "", title: "PAEM Türkiye Geneli Canlı Deneme", slug: "paem-turkiye-geneli-deneme-sinavi",
  access_type: "private" as "public" | "private",
  start_mode: "manual" as "scheduled" | "manual",
  registration_opens_at: "", starts_at: "", question_count: "100", duration_min: "120",
};

function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—"; }
function selectedQuestionCount(mockExam: AdminMockExam) { return mockExam.selected_question_count ?? mockExam.question_ids?.length ?? mockExam.question_count; }
function dateTimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function LiveExamWorkspace({ initialSelectedId = null }: { initialSelectedId?: number | null }) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [events, setEvents] = useState<AdminLiveExamEvent[]>([]);
  const [mockExams, setMockExams] = useState<AdminMockExam[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEditMode = initialSelectedId !== null;

  useEffect(() => { setTitle("Canlı Sınav Operasyonu"); return () => setTitle(null); }, [setTitle]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const response = await adminApiRequest<IndexPayload>("/admin/live-exams", { token });
      setEvents(response.data.events); setMockExams(response.data.mock_exams);
      setSelectedId((current) => current && response.data.events.some((event) => event.id === current) ? current : null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Canlı sınavlar alınamadı."); }
    finally { setLoading(false); }
  }, [token]);

  const loadDetail = useCallback(async (id: number) => {
    if (!token) return;
    try { const response = await adminApiRequest<DetailPayload>(`/admin/live-exams/${id}`, { token }); setDetail(response.data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Etkinlik detayı alınamadı."); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelectedId(initialSelectedId); }, [initialSelectedId]);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [loadDetail, selectedId]);
  useEffect(() => {
    if (!isEditMode || !detail) return;
    setForm({
      mock_exam_id: detail.event.mock_exam_id === null ? "" : String(detail.event.mock_exam_id),
      title: detail.event.title,
      slug: detail.event.slug,
      access_type: detail.event.access_type,
      start_mode: detail.event.start_mode,
      registration_opens_at: dateTimeLocal(detail.event.registration_opens_at),
      starts_at: dateTimeLocal(detail.event.starts_at),
      question_count: String(detail.event.question_count),
      duration_min: String(detail.event.duration_min),
    });
  }, [detail, isEditMode]);

  const selectedMock = useMemo(() => mockExams.find((item) => item.id === Number(form.mock_exam_id)), [form.mock_exam_id, mockExams]);

  async function submitEvent(e: FormEvent) {
    e.preventDefault(); if (!token || !selectedMock || busy) return;
    if (isEditMode && !selectedId) return;
    setBusy("save");
    try {
      const durationMs = Number(form.duration_min) * 60_000;
      const now = new Date();
      const start = form.start_mode === "manual" ? new Date(now.getTime() + 60_000) : new Date(form.starts_at);
      const registrationOpensAt = form.start_mode === "manual" ? new Date(now.getTime() - 60_000) : new Date(form.registration_opens_at);
      const waitingRoomOpensAt = form.start_mode === "manual"
        ? new Date(now.getTime() - 1_000)
        : new Date(Math.max(registrationOpensAt.getTime(), start.getTime() - 30 * 60_000));
      const lateEntryMs = Math.min(15 * 60_000, Math.max(30_000, Math.floor(durationMs / 2)));
      const endpoint = isEditMode ? `/admin/live-exams/${selectedId}` : "/admin/live-exams";
      const response = await adminApiRequest<{ event: AdminLiveExamEvent }>(endpoint, {
        token, method: isEditMode ? "PUT" : "POST", body: {
          exam_id: selectedMock.exam_id, mock_exam_id: selectedMock.id, title: form.title, slug: form.slug,
          access_type: form.access_type,
          start_mode: form.start_mode,
          question_count: Number(form.question_count), duration_min: Number(form.duration_min),
          registration_opens_at: registrationOpensAt.toISOString(),
          waiting_room_opens_at: waitingRoomOpensAt.toISOString(),
          starts_at: start.toISOString(), late_entry_ends_at: new Date(start.getTime() + lateEntryMs).toISOString(),
          ends_at: new Date(start.getTime() + durationMs).toISOString(),
          submission_grace_ends_at: new Date(start.getTime() + durationMs + 60_000).toISOString(),
        },
      });
      showToast({ tone: "success", title: isEditMode ? "Canlı sınav güncellendi" : "Canlı sınav oluşturuldu", description: response.data.event.title });
      if (isEditMode) {
        await load();
        await loadDetail(response.data.event.id);
      } else {
        router.push(`/canli-sinavlar/${response.data.event.id}`);
      }
    } catch (reason) { showToast({ tone: "error", title: isEditMode ? "Etkinlik güncellenemedi" : "Etkinlik oluşturulamadı", description: reason instanceof Error ? reason.message : "İşlem başarısız." }); }
    finally { setBusy(null); }
  }

  async function action(name: "freeze" | "start" | "rankings" | "publish-results") {
    if (!token || !selectedId || busy) return;
    if (name === "publish-results" && !window.confirm("Taslak sonuçlar kesinleştirilecek ve katılımcılara bildirim gönderilecek. Yayınlamak istiyor musun?")) return;
    if (name === "start" && !window.confirm("Sınav şimdi başlayacak ve süre bütün katılımcılar için işlemeye başlayacak. Başlatmak istiyor musun?")) return;
    setBusy(name);
    try {
      const response = await adminApiRequest(`/admin/live-exams/${selectedId}/${name}`, { token, method: "POST" });
      showToast({ tone: "success", title: response.message ?? "İşlem tamamlandı", description: detail?.event.title });
      await load(); await loadDetail(selectedId);
    } catch (reason) { showToast({ tone: "error", title: "İşlem tamamlanamadı", description: reason instanceof Error ? reason.message : "Beklenmeyen hata." }); }
    finally { setBusy(null); }
  }

  async function archiveEvent() {
    if (!token || !selectedId || busy || !detail) return;
    if (!window.confirm(`“${detail.event.title}” canlı sınavını arşivlemek istiyor musun? Kayıt silinmez ve kaynak deneme yeniden kullanılabilir hale gelir.`)) return;
    setBusy("cancel");
    try {
      const response = await adminApiRequest(`/admin/live-exams/${selectedId}/cancel`, { token, method: "POST" });
      showToast({ tone: "success", title: response.message ?? "Canlı sınav arşivlendi", description: detail.event.title });
      setDetail(null);
      await load();
    } catch (reason) { showToast({ tone: "error", title: "Canlı sınav arşivlenemedi", description: reason instanceof Error ? reason.message : "Beklenmeyen hata." }); }
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
      <div><Link href="/canli-sinavlar" className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"><ArrowLeft size={14} />Canlı sınav listesi</Link><div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-amber-600"><RadioTower size={16} /> Operasyon merkezi</div><h1 className="text-3xl font-black tracking-[-.04em] text-[var(--color-admin-ink)]">PAEM Türkiye Geneli</h1><p className="mt-2 text-sm text-[var(--color-admin-muted)]">Etkinliği hazırla, soruları dondur, cevap dağılımını kontrol et ve sonuçları iki adımda yayınla.</p></div>
      <button onClick={() => void load()} className="admin-button admin-button-secondary"><RefreshCw size={16} />Yenile</button>
    </section>
    {error ? <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
    <div className="grid gap-6 2xl:grid-cols-[390px_1fr]">
      <aside className="space-y-5">
        <form onSubmit={submitEvent} className="space-y-4 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] p-5">
          <div className="flex items-center gap-2">{isEditMode ? <Save size={17} /> : <Plus size={17} />}<h2 className="font-extrabold">{isEditMode ? "Etkinliği düzenle" : "Yeni etkinlik"}</h2></div>
          <label className="admin-field"><span>Kaynak deneme</span><select required value={form.mock_exam_id} onChange={(e) => { const mock = mockExams.find((item) => item.id === Number(e.target.value)); setForm({ ...form, mock_exam_id: e.target.value, question_count: String(mock ? selectedQuestionCount(mock) : 100), duration_min: String(mock?.duration_min ?? 120) }); }}><option value="">Seç</option>{mockExams.map((item) => <option key={item.id} value={item.id} disabled={selectedQuestionCount(item) === 0}>{item.title} · {selectedQuestionCount(item)} seçili soru · {item.status === "active" ? "yayında" : "taslak"}{item.sessions_count ? ` · ${item.sessions_count} eski oturum` : ""}</option>)}</select></label>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">Seçilen deneme, canlı etkinlik oluşturulunca normal deneme ekranlarından otomatik gizlenir. Etkinlik iptal edilince veya sonuçlar yayınlanınca tekrar kendi yayın durumuna döner.</p>
          <label className="admin-field"><span>Başlık</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="admin-field"><span>Slug</span><input required readOnly={isEditMode} title={isEditMode ? "Mevcut sınav güncellenirken slug korunur." : undefined} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
          <label className="admin-field"><span>Erişim</span><select value={form.access_type} onChange={(e) => { const accessType = e.target.value as "public" | "private"; setForm({ ...form, access_type: accessType, start_mode: accessType === "public" ? "scheduled" : form.start_mode }); }}><option value="private">Özel — yalnızca davetliler</option><option value="public">Herkese açık — uygun üyeler kayıt olabilir</option></select></label>
          <p className={`rounded-xl border p-3 text-xs font-semibold leading-5 ${form.access_type === "private" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>{form.access_type === "private" ? "Bu sınavı yalnızca aşağıdan davet ettiğin kullanıcılar görebilir ve açabilir." : "Bu sınav ilgili programa kayıtlı tüm aktif üyelerin panelinde görünür."}</p>
          <label className="admin-field"><span>Başlatma şekli</span><select value={form.start_mode} onChange={(e) => setForm({ ...form, start_mode: e.target.value as "scheduled" | "manual" })} disabled={form.access_type === "public"}><option value="manual">Panelden manuel başlat</option><option value="scheduled">Belirlenen saatte otomatik başlat</option></select></label>
          {form.start_mode === "manual" ? <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold leading-5 text-sky-900">Etkinliği oluştur, soruları dondur ve katılımcıları davet et. Hazır olduğunda etkinlik kartındaki “Sınavı başlat” düğmesine bas; gerçek başlangıç ve bitiş saatleri o anda hesaplanır.</p> : null}
          <div className="grid grid-cols-2 gap-3"><label className="admin-field"><span>Soru</span><input type="number" required value={form.question_count} onChange={(e) => setForm({ ...form, question_count: e.target.value })} /></label><label className="admin-field"><span>Dakika</span><input type="number" required value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} /></label></div>
          {form.start_mode === "scheduled" ? <><label className="admin-field"><span>Kayıt açılışı</span><input type="datetime-local" required value={form.registration_opens_at} onChange={(e) => setForm({ ...form, registration_opens_at: e.target.value })} /></label><label className="admin-field"><span>Sınav başlangıcı</span><input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label></> : null}
          <button className="admin-button admin-button-primary w-full justify-center" disabled={busy === "save"}>{busy === "save" ? <Loader2 className="animate-spin" size={16} /> : isEditMode ? <Save size={16} /> : <Plus size={16} />}{isEditMode ? "Değişiklikleri kaydet" : "Etkinliği oluştur"}</button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)]">
          <header className="border-b border-[var(--color-admin-line)] p-4 text-sm font-extrabold">Etkinlikler</header>
          {loading ? <div className="grid place-items-center p-10"><Loader2 className="animate-spin" /></div> : events.map((event) => <Link key={event.id} href={`/canli-sinavlar/${event.id}`} className={`block w-full border-b border-[var(--color-admin-line)] p-4 text-left transition hover:bg-black/[.025] ${selectedId === event.id ? "bg-amber-50" : ""}`}><div className="flex items-center justify-between gap-3"><strong className="text-sm">{event.title}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase">{event.phase}</span></div><small className="mt-2 block text-[var(--color-admin-muted)]">{event.start_mode === "manual" && !event.manually_started_at ? "Manuel başlatılacak" : formatDate(event.starts_at)} · {event.participations_count} katılımcı · {event.access_type === "private" ? "Özel" : "Herkese açık"}</small></Link>)}
        </section>
      </aside>
      <main>{detail ? <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">{detail.event.phase}</span><h2 className="mt-2 text-2xl font-black tracking-[-.03em]">{detail.event.title}</h2><p className="mt-2 text-sm text-[var(--color-admin-muted)]">{detail.event.start_mode === "manual" && !detail.event.manually_started_at ? "Panelden başlatılmayı bekliyor" : `${formatDate(detail.event.starts_at)} — ${formatDate(detail.event.ends_at)}`}</p></div><div className="flex flex-wrap gap-2"><button className="admin-button admin-button-secondary" onClick={() => void archiveEvent()} disabled={Boolean(busy) || Boolean(detail.event.results_published_at)}><Archive size={16} />Arşivle</button><button className="admin-button admin-button-secondary" onClick={() => void action("freeze")} disabled={Boolean(busy) || detail.event.participations_count > 0}><Snowflake size={16} />Soruları dondur</button>{detail.event.start_mode === "manual" && !detail.event.manually_started_at ? <button className="admin-button admin-button-primary" onClick={() => void action("start")} disabled={Boolean(busy) || detail.event.questions_count !== detail.event.question_count}><Play size={16} />Sınavı başlat</button> : null}<button className="admin-button admin-button-secondary" onClick={() => void action("rankings")} disabled={Boolean(busy) || !["reviewing", "ranked"].includes(detail.event.phase)}><BarChart3 size={16} />Sıralamayı oluştur</button><button className="admin-button admin-button-primary" onClick={() => void action("publish-results")} disabled={Boolean(busy) || detail.event.phase !== "ranked"}><Send size={16} />Yayınla ve bildir</button></div></div>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[var(--color-admin-line)] lg:grid-cols-4"><Metric icon={<UsersRound />} label="Katılımcı" value={detail.event.participations_count} /><Metric icon={<LockKeyhole />} label="Dondurulan soru" value={detail.event.questions_count} /><Metric icon={<BarChart3 />} label="Taslak sonuç" value={detail.event.results_count} /><Metric icon={<Clock3 />} label="Süre" value={`${detail.event.duration_min} dk`} /></div>
        </section>
        {detail.event.results_count > 0 ? (
          <LiveExamRankings
            eventId={detail.event.id}
            key={`${detail.event.id}-${detail.event.rankings_built_at ?? "unranked"}`}
            published={Boolean(detail.event.results_published_at)}
          />
        ) : null}
        <LiveExamParticipants accessType={detail.event.access_type} eventId={detail.event.id} key={detail.event.id} onChanged={() => { void load(); void loadDetail(detail.event.id); }} questionsFrozen={detail.event.questions_count === detail.event.question_count} />
        <section className="space-y-3"><div><h2 className="text-lg font-black">Soru kontrolü</h2><p className="text-sm text-[var(--color-admin-muted)]">Cevap dağılımını incele; gerekiyorsa anahtarı düzelt veya soruyu değerlendirme dışı bırak.</p></div>{detail.analytics.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-[var(--color-admin-muted)]">Önce soru paketini dondur.</div> : detail.analytics.map((question) => <QuestionReview key={question.id} question={question} busy={busy === `question-${question.id}`} onSave={saveQuestion} />)}</section>
      </div> : <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed px-8 text-center text-[var(--color-admin-muted)]">{isEditMode ? "Etkinlik bulunamadı." : "Önce etkinliği oluştur. Oluşturma tamamlanınca yeni etkinliğin soru dondurma ve kullanıcı davet ekranı açılacak."}</div>}</main>
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
