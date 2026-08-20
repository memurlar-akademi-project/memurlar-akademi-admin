"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Gavel, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";

type Dashboard = {
  latest_run: { scan_date: string; status: string; completed_at: string | null; document_count: number; matched_count: number; failure_message: string | null } | null;
  counts: { active_instruments: number; mapping_required: number; awaiting_relevance_approval: number; review_ready: number; excluded_documents: number };
  mail_enabled: boolean;
  publishing_enabled: boolean;
};

type Instrument = {
  id: number;
  subject_id: number | null;
  instrument_type: string;
  instrument_number: string | null;
  official_name: string;
  aliases: string[] | null;
  topic_ranges: Array<{ topic_id: number; start: number; end: number; include_special_articles?: boolean }> | null;
  mapping_status: string;
  is_active: boolean;
  subject?: { id: number; name: string } | null;
};

type Proposal = {
  id: number;
  target_type: "topic_content" | "question" | "derived_content";
  target_id: number | null;
  action: string;
  status: string;
  source_basis: string;
  confidence: number | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
};

type ChangeCase = {
  id: number;
  status: string;
  changed_articles: string[] | null;
  affected_topic_ids: number[] | null;
  summary: string | null;
  source_excerpt: string | null;
  source_details: { schema_version: number; segments: Array<{ segment_id: string; articles: string[]; operation: string; text: string; truncated: boolean }> } | null;
  instrument: Instrument | null;
  document: { id: number; title: string; source_url: string; issue_date: string; issue_number: string | null };
  proposals: Proposal[];
};

type MonitorSettings = { recipient_emails: string[]; mail_enabled: boolean; publishing_enabled: boolean };
type MonitorRun = { id: number; scan_date: string; status: string; started_at: string | null; completed_at: string | null; document_count: number; matched_count: number; failure_message: string | null };
type GazetteDocument = { id: number; issue_date: string; issue_number: string | null; title: string; source_url: string; exclusion_reason: string | null };

const statusLabels: Record<string, string> = {
  mapping_required: "Eşleştirme gerekli",
  awaiting_relevance_approval: "İlgililik onayı",
  drafting: "Taslak hazırlanıyor",
  review_ready: "Revizyon onayı",
  partially_published: "Kısmen yayınlandı",
  completed: "Tamamlandı",
  rejected: "İlgisiz",
  failed: "Hata",
};

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Snapshot({ value }: { value: Record<string, unknown> | null }) {
  return <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--color-admin-line)] bg-white p-3 text-xs leading-5 text-[var(--color-admin-muted)]">{value ? JSON.stringify(value, null, 2) : "—"}</pre>;
}

export default function LegalMonitoringPage() {
  const { token } = useAdminAuth();
  const { showToast } = useAdminToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [cases, setCases] = useState<ChangeCase[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [tab, setTab] = useState<"cases" | "instruments" | "history">("cases");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [settings, setSettings] = useState<MonitorSettings | null>(null);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [documents, setDocuments] = useState<GazetteDocument[]>([]);
  const [selectedProposalIds, setSelectedProposalIds] = useState<number[]>([]);
  const [instrumentForm, setInstrumentForm] = useState({ official_name: "", instrument_number: "", instrument_type: "kanun", aliases: "", topic_ranges: "[]", mapping_status: "mapping_required" });
  const selectedCase = useMemo(() => cases.find((item) => item.id === selectedCaseId) ?? null, [cases, selectedCaseId]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const [dashboardResponse, caseResponse, instrumentResponse, settingsResponse, runsResponse, documentsResponse] = await Promise.all([
        adminApiRequest<Dashboard>("/admin/legal-monitoring/dashboard", { token }),
        adminApiRequest<{ cases: ChangeCase[] }>(`/admin/legal-monitoring/cases${query}`, { token }),
        adminApiRequest<{ instruments: Instrument[] }>("/admin/legal-monitoring/instruments", { token }),
        adminApiRequest<MonitorSettings>("/admin/legal-monitoring/settings", { token }),
        adminApiRequest<{ runs: MonitorRun[] }>("/admin/legal-monitoring/runs", { token }),
        adminApiRequest<{ documents: GazetteDocument[] }>("/admin/legal-monitoring/documents?excluded=1&per_page=50", { token }),
      ]);
      setDashboard(dashboardResponse.data);
      setCases(caseResponse.data.cases);
      setInstruments(instrumentResponse.data.instruments);
      setSettings(settingsResponse.data);
      setRecipientEmails(settingsResponse.data.recipient_emails.join(", "));
      setRuns(runsResponse.data.runs);
      setDocuments(documentsResponse.data.documents);
      setSelectedCaseId((current) => current && caseResponse.data.cases.some((item) => item.id === current) ? current : caseResponse.data.cases[0]?.id ?? null);
    } catch (error) {
      showToast({ title: "Mevzuat takip verileri alınamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [showToast, status, token]);

  useEffect(() => { void load(); }, [load]);

  async function reviewCase(decision: "relevant" | "irrelevant") {
    if (!token || !selectedCase) return;
    setBusyId(`case-${selectedCase.id}`);
    try {
      await adminApiRequest(`/admin/legal-monitoring/cases/${selectedCase.id}/review`, { method: "POST", token, body: { decision } });
      showToast({ title: decision === "relevant" ? "Analiz başlatıldı" : "Vaka ilgisiz olarak kapatıldı", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Karar kaydedilemedi", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally { setBusyId(null); }
  }

  async function decideProposal(proposal: Proposal, decision: "publish" | "reject" | "regenerate") {
    if (!token) return;
    setBusyId(`proposal-${proposal.id}`);
    try {
      await adminApiRequest(`/admin/legal-monitoring/proposals/${proposal.id}/${decision}`, { method: "POST", token });
      showToast({ title: decision === "publish" ? "Revizyon yayınlandı" : decision === "regenerate" ? "Yeniden hazırlama başlatıldı" : "Revizyon reddedildi", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Revizyon kararı uygulanamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally { setBusyId(null); }
  }

  async function publishSelected() {
    if (!token || selectedProposalIds.length === 0) return;
    setBusyId("proposal-batch");
    try {
      await adminApiRequest("/admin/legal-monitoring/proposals/publish-batch", { method: "POST", token, body: { proposal_ids: selectedProposalIds } });
      setSelectedProposalIds([]);
      showToast({ title: "Seçili revizyonlar yayınlandı", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Toplu yayın uygulanamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally { setBusyId(null); }
  }

  async function toggleInstrument(instrument: Instrument) {
    if (!token) return;
    setBusyId(`instrument-${instrument.id}`);
    try {
      await adminApiRequest(`/admin/legal-monitoring/instruments/${instrument.id}`, {
        method: "PUT", token, body: { ...instrument, is_active: !instrument.is_active },
      });
      await load();
    } catch (error) {
      showToast({ title: "İzleme kaydı güncellenemedi", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally { setBusyId(null); }
  }

  function editInstrument(instrument: Instrument) {
    setEditingInstrument(instrument);
    setInstrumentForm({
      official_name: instrument.official_name,
      instrument_number: instrument.instrument_number ?? "",
      instrument_type: instrument.instrument_type,
      aliases: (instrument.aliases ?? []).join(", "),
      topic_ranges: JSON.stringify(instrument.topic_ranges ?? [], null, 2),
      mapping_status: instrument.mapping_status,
    });
  }

  async function saveInstrument() {
    if (!token || !editingInstrument) return;
    setBusyId(`instrument-${editingInstrument.id}`);
    try {
      const topicRanges = JSON.parse(instrumentForm.topic_ranges) as Instrument["topic_ranges"];
      await adminApiRequest(`/admin/legal-monitoring/instruments/${editingInstrument.id}`, {
        method: "PUT",
        token,
        body: {
          subject_id: editingInstrument.subject_id,
          instrument_type: instrumentForm.instrument_type,
          instrument_number: instrumentForm.instrument_number || null,
          official_name: instrumentForm.official_name,
          aliases: instrumentForm.aliases.split(",").map((item) => item.trim()).filter(Boolean),
          topic_ranges: topicRanges,
          mapping_status: instrumentForm.mapping_status,
          is_active: instrumentForm.mapping_status === "ready" ? editingInstrument.is_active : false,
        },
      });
      setEditingInstrument(null);
      showToast({ title: "Mevzuat eşleştirmesi kaydedildi", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Eşleştirme kaydedilemedi", description: error instanceof Error ? error.message : "Madde aralığı JSON’unu kontrol et.", tone: "error" });
    } finally { setBusyId(null); }
  }

  async function saveRecipients() {
    if (!token) return;
    setBusyId("settings");
    try {
      const emails = recipientEmails.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean);
      await adminApiRequest("/admin/legal-monitoring/settings", { method: "PUT", token, body: { recipient_emails: emails } });
      showToast({ title: "Günlük özet alıcıları kaydedildi", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Mail alıcıları kaydedilemedi", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-[var(--color-admin-accent)]"><Gavel size={18} /> Resmî Gazete kontrol hattı</div>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-admin-ink)]">Kesin mevzuat ve madde eşleştirmesi</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-admin-muted)]">Tarama her gün 10.00’da yapılır. AI yalnız mevzuat numarası/türü ve takip edilen madde aralığı kesin eşleştikten sonra devreye girer.</p>
          </div>
          <button className="admin-button admin-button-secondary" onClick={() => void load()} type="button"><RefreshCw size={17} /> Yenile</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Aktif mevzuat", dashboard?.counts.active_instruments ?? 0],
            ["Eşleştirme gerekli", dashboard?.counts.mapping_required ?? 0],
            ["İlgililik onayı", dashboard?.counts.awaiting_relevance_approval ?? 0],
            ["Revizyon onayı", dashboard?.counts.review_ready ?? 0],
            ["Elenen belge", dashboard?.counts.excluded_documents ?? 0],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4"><p className="text-xs font-bold text-[var(--color-admin-muted)]">{label}</p><p className="mt-2 text-2xl font-black text-[var(--color-admin-ink)]">{value}</p></div>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className={`rounded-full px-3 py-1.5 ${dashboard?.mail_enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>Mail {dashboard?.mail_enabled ? "açık" : "gözlem döneminde kapalı"}</span>
          <span className={`rounded-full px-3 py-1.5 ${dashboard?.publishing_enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>Yayın {dashboard?.publishing_enabled ? "açık" : "gözlem döneminde kapalı"}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Son tarama: {dateTime(dashboard?.latest_run?.completed_at)}</span>
        </div>
      </section>

      <div className="flex gap-2">
        <button className={tab === "cases" ? "admin-button admin-button-primary" : "admin-button admin-button-secondary"} onClick={() => setTab("cases")} type="button">Değişiklik Vakaları</button>
        <button className={tab === "instruments" ? "admin-button admin-button-primary" : "admin-button admin-button-secondary"} onClick={() => setTab("instruments")} type="button">İzlenen Mevzuatlar</button>
        <button className={tab === "history" ? "admin-button admin-button-primary" : "admin-button admin-button-secondary"} onClick={() => setTab("history")} type="button">Tarama ve Ayarlar</button>
      </div>

      {loading ? <div className="flex h-48 items-center justify-center"><LoaderCircle className="animate-spin text-[var(--color-admin-accent)]" /></div> : tab === "cases" ? (
        <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-4">
            <select className="admin-input mb-4" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tüm durumlar</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <div className="space-y-2">{cases.map((item) => <button key={item.id} className={`w-full rounded-2xl border p-4 text-left transition ${selectedCaseId === item.id ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-panel-soft)]" : "border-[var(--color-admin-line)] bg-white"}`} onClick={() => setSelectedCaseId(item.id)} type="button"><p className="font-black text-[var(--color-admin-ink)]">{item.instrument?.official_name ?? "Eşleştirme gerekli"}</p><p className="mt-1 text-xs text-[var(--color-admin-muted)]">{item.instrument?.instrument_number ? `${item.instrument.instrument_number} · ` : ""}{statusLabels[item.status] ?? item.status}</p><p className="mt-2 text-xs font-bold text-[var(--color-admin-accent)]">Madde: {item.changed_articles?.join(", ") || "çıkarılamadı"}</p></button>)}</div>
          </section>
          <section className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-5">
            {!selectedCase ? <p className="text-sm text-[var(--color-admin-muted)]">İncelenecek vaka yok.</p> : <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-[var(--color-admin-panel-soft)] px-3 py-1 text-xs font-black text-[var(--color-admin-accent)]">{statusLabels[selectedCase.status] ?? selectedCase.status}</span><h2 className="mt-3 text-xl font-black text-[var(--color-admin-ink)]">{selectedCase.instrument?.official_name ?? selectedCase.document.title}</h2><p className="mt-1 text-sm text-[var(--color-admin-muted)]">{selectedCase.summary}</p></div><a className="admin-button admin-button-secondary" href={selectedCase.document.source_url} rel="noreferrer" target="_blank">Resmî kaynak <ExternalLink size={16} /></a></div>
              <div className="grid gap-3 sm:grid-cols-3"><Info label="Mevzuat no" value={selectedCase.instrument?.instrument_number ?? "—"} /><Info label="Değişen madde" value={selectedCase.changed_articles?.join(", ") || "—"} /><Info label="Etkilenen konu" value={String(selectedCase.affected_topic_ids?.length ?? 0)} /></div>
              <div><h3 className="mb-2 text-sm font-black text-[var(--color-admin-ink)]">Madde bazlı Resmî kaynak paketi</h3><div className="space-y-3">{selectedCase.source_details?.segments?.length ? selectedCase.source_details.segments.map((segment) => <article key={segment.segment_id} className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4"><div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black"><span className="rounded-full bg-white px-2.5 py-1 text-[var(--color-admin-accent)]">Madde {segment.articles.join(", ")}</span><span className="rounded-full bg-white px-2.5 py-1 text-[var(--color-admin-muted)]">{segment.operation}</span>{segment.truncated ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">Metin sınırda kesildi · yalnız inceleme</span> : null}<span className="text-[var(--color-admin-muted)]">#{segment.segment_id}</span></div><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--color-admin-muted)]">{segment.text}</p></article>) : <p className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4 text-sm leading-6 text-[var(--color-admin-muted)]">{selectedCase.source_excerpt ?? "Metin kesiti bulunamadı."}</p>}</div></div>
              {selectedCase.status === "awaiting_relevance_approval" ? <div className="flex flex-wrap gap-3"><button className="admin-button admin-button-primary" disabled={busyId !== null} onClick={() => void reviewCase("relevant")} type="button"><ShieldCheck size={17} /> İlgili, taslak hazırla</button><button className="admin-button admin-button-secondary" disabled={busyId !== null} onClick={() => void reviewCase("irrelevant")} type="button"><XCircle size={17} /> İlgili değil</button></div> : null}
              {selectedCase.proposals.length > 0 ? <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-black text-[var(--color-admin-ink)]">Revizyon önerileri</h3><button className="admin-button admin-button-primary" disabled={!dashboard?.publishing_enabled || selectedProposalIds.length === 0 || busyId !== null} onClick={() => void publishSelected()} type="button"><CheckCircle2 size={16} /> Seçili {selectedProposalIds.length} öneriyi yayınla</button></div>{selectedCase.proposals.map((proposal) => <article key={proposal.id} className="rounded-2xl border border-[var(--color-admin-line)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2">{proposal.status === "pending" && proposal.target_type !== "derived_content" ? <input aria-label={`Öneri ${proposal.id} seç`} checked={selectedProposalIds.includes(proposal.id)} onChange={(event) => setSelectedProposalIds((current) => event.target.checked ? [...current, proposal.id] : current.filter((id) => id !== proposal.id))} type="checkbox" /> : null}<p className="font-black text-[var(--color-admin-ink)]">{proposal.target_type} #{proposal.target_id ?? "—"} · {proposal.action}</p></div><span className="text-xs font-bold text-[var(--color-admin-muted)]">Güven: %{proposal.confidence ?? 0} · {proposal.status}</span></div><p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">{proposal.source_basis}</p><div className="mt-3 grid gap-3 lg:grid-cols-2"><div><p className="mb-1 text-xs font-black">Önce</p><Snapshot value={proposal.before_snapshot} /></div><div><p className="mb-1 text-xs font-black">Sonra</p><Snapshot value={proposal.after_snapshot} /></div></div>{proposal.status === "pending" ? <div className="mt-4 flex flex-wrap gap-2"><button className="admin-button admin-button-primary" disabled={!dashboard?.publishing_enabled || busyId !== null || proposal.target_type === "derived_content"} onClick={() => void decideProposal(proposal, "publish")} type="button"><CheckCircle2 size={16} /> Onayla ve yayınla</button><button className="admin-button admin-button-secondary" disabled={busyId !== null} onClick={() => void decideProposal(proposal, "reject")} type="button"><XCircle size={16} /> Reddet</button><button className="admin-button admin-button-secondary" disabled={busyId !== null} onClick={() => void decideProposal(proposal, "regenerate")} type="button"><RefreshCw size={16} /> Yeniden hazırla</button></div> : null}</article>)}</div> : null}
            </div>}
          </section>
        </div>
      ) : tab === "instruments" ? (
        <div className="space-y-5">
          {editingInstrument ? <section className="rounded-[22px] border border-[var(--color-admin-accent)] bg-[var(--color-admin-panel)] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-[var(--color-admin-ink)]">Mevzuat eşleştirmesini doğrula</h2><p className="mt-1 text-sm text-[var(--color-admin-muted)]">Resmî ad, tür, numara ve topic–madde aralıklarını kontrol etmeden “Hazır” yapma.</p></div><button className="admin-button admin-button-secondary" onClick={() => setEditingInstrument(null)} type="button">Kapat</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-[var(--color-admin-ink)]">Resmî tam ad<input className="admin-input mt-2" value={instrumentForm.official_name} onChange={(event) => setInstrumentForm((current) => ({ ...current, official_name: event.target.value }))} /></label><label className="text-sm font-bold text-[var(--color-admin-ink)]">Mevzuat numarası<input className="admin-input mt-2" value={instrumentForm.instrument_number} onChange={(event) => setInstrumentForm((current) => ({ ...current, instrument_number: event.target.value }))} /></label><label className="text-sm font-bold text-[var(--color-admin-ink)]">Tür<select className="admin-input mt-2" value={instrumentForm.instrument_type} onChange={(event) => setInstrumentForm((current) => ({ ...current, instrument_type: event.target.value }))}><option value="kanun">Kanun</option><option value="yonetmelik">Yönetmelik</option><option value="cumhurbaskanligi_kararnamesi">Cumhurbaşkanlığı Kararnamesi</option><option value="diger">Diğer</option></select></label><label className="text-sm font-bold text-[var(--color-admin-ink)]">Kontrollü alternatif adlar<input className="admin-input mt-2" placeholder="DMK, 657 sayılı Kanun" value={instrumentForm.aliases} onChange={(event) => setInstrumentForm((current) => ({ ...current, aliases: event.target.value }))} /></label><label className="text-sm font-bold text-[var(--color-admin-ink)] md:col-span-2">Topic–madde aralıkları JSON<textarea className="admin-input mt-2 min-h-48 font-mono text-xs" value={instrumentForm.topic_ranges} onChange={(event) => setInstrumentForm((current) => ({ ...current, topic_ranges: event.target.value }))} /></label><label className="text-sm font-bold text-[var(--color-admin-ink)]">Doğrulama durumu<select className="admin-input mt-2" value={instrumentForm.mapping_status} onChange={(event) => setInstrumentForm((current) => ({ ...current, mapping_status: event.target.value }))}><option value="mapping_required">Eşleştirme gerekli</option><option value="ready">Hazır / doğrulandı</option></select></label></div><div className="mt-5"><button className="admin-button admin-button-primary" disabled={busyId !== null} onClick={() => void saveInstrument()} type="button"><ShieldCheck size={16} /> Doğrulamayı kaydet</button></div></section> : null}
          <section className="overflow-hidden rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]"><div className="border-b border-[var(--color-admin-line)] p-5"><h2 className="text-lg font-black text-[var(--color-admin-ink)]">Kesin mevzuat kayıt defteri</h2><p className="mt-1 text-sm text-[var(--color-admin-muted)]">Numarası, türü ve konu madde aralıkları doğrulanmayan kayıtlar aktif edilemez.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[var(--color-admin-panel-soft)] text-xs uppercase tracking-wide text-[var(--color-admin-muted)]"><tr><th className="p-4">Mevzuat</th><th className="p-4">Ders</th><th className="p-4">Kapsam</th><th className="p-4">Durum</th><th className="p-4">İşlem</th></tr></thead><tbody>{instruments.map((instrument) => <tr key={instrument.id} className="border-t border-[var(--color-admin-line)]"><td className="p-4"><p className="font-black text-[var(--color-admin-ink)]">{instrument.official_name}</p><p className="text-xs text-[var(--color-admin-muted)]">{instrument.instrument_type} · {instrument.instrument_number ?? "numarasız"}</p></td><td className="p-4">{instrument.subject?.name ?? "—"}</td><td className="p-4">{instrument.topic_ranges?.map((range) => `${range.start}-${range.end}`).join(", ") || "Eksik"}</td><td className="p-4">{instrument.mapping_status === "ready" ? <span className="text-emerald-700"><CheckCircle2 className="mr-1 inline" size={15} />Hazır</span> : <span className="text-amber-700"><AlertTriangle className="mr-1 inline" size={15} />Eşleştirme gerekli</span>}</td><td className="p-4"><div className="flex gap-2"><button className="admin-button admin-button-secondary" onClick={() => editInstrument(instrument)} type="button">Düzenle</button><button className="admin-button admin-button-secondary" disabled={instrument.mapping_status !== "ready" || busyId !== null} onClick={() => void toggleInstrument(instrument)} type="button">{instrument.is_active ? "Takibi kapat" : "Takibi aç"}</button></div></td></tr>)}</tbody></table></div></section>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-5">
            <h2 className="text-lg font-black text-[var(--color-admin-ink)]">Günlük özet alıcıları</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">Tarama 10.00, özet 10.15’te çalışır. Mail anahtarı ortam ayarından yönetilir; burada yalnız alıcılar değişir.</p>
            <textarea className="admin-input mt-4 min-h-28" placeholder="hukuk@example.com, editor@example.com" value={recipientEmails} onChange={(event) => setRecipientEmails(event.target.value)} />
            <div className="mt-3 flex flex-wrap items-center gap-3"><button className="admin-button admin-button-primary" disabled={busyId !== null} onClick={() => void saveRecipients()} type="button">Alıcıları kaydet</button><span className={`rounded-full px-3 py-1 text-xs font-bold ${settings?.mail_enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{settings?.mail_enabled ? "Mail gönderimi açık" : "Mail gönderimi gözlem döneminde kapalı"}</span></div>
          </section>
          <section className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-5">
            <h2 className="text-lg font-black text-[var(--color-admin-ink)]">Tarama geçmişi</h2>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto">{runs.length === 0 ? <p className="text-sm text-[var(--color-admin-muted)]">Henüz tarama kaydı yok.</p> : runs.map((run) => <div key={run.id} className="rounded-xl border border-[var(--color-admin-line)] p-3"><div className="flex justify-between gap-3"><p className="font-black text-[var(--color-admin-ink)]">{run.scan_date}</p><span className={run.status === "completed" ? "text-emerald-700" : "text-red-700"}>{run.status}</span></div><p className="mt-1 text-xs text-[var(--color-admin-muted)]">{run.document_count} belge · {run.matched_count} kesin eşleşme · {dateTime(run.completed_at)}</p>{run.failure_message ? <p className="mt-2 text-xs text-red-700">{run.failure_message}</p> : null}</div>)}</div>
          </section>
          <section className="rounded-[22px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-5 xl:col-span-2">
            <h2 className="text-lg font-black text-[var(--color-admin-ink)]">Elenen ve alakasız belgeler</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">Kesin eşleştirme kapısında elenen son 50 belge ve nedeni.</p>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[var(--color-admin-panel-soft)] text-xs uppercase text-[var(--color-admin-muted)]"><tr><th className="p-3">Tarih</th><th className="p-3">Belge</th><th className="p-3">Elenme nedeni</th><th className="p-3">Kaynak</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id} className="border-t border-[var(--color-admin-line)]"><td className="p-3">{document.issue_date}</td><td className="p-3 font-bold text-[var(--color-admin-ink)]">{document.title}</td><td className="p-3 text-[var(--color-admin-muted)]">{document.exclusion_reason ?? "—"}</td><td className="p-3"><a className="text-[var(--color-admin-accent)]" href={document.source_url} rel="noreferrer" target="_blank">Aç <ExternalLink className="inline" size={14} /></a></td></tr>)}</tbody></table>{documents.length === 0 ? <p className="p-4 text-sm text-[var(--color-admin-muted)]">Elenen belge yok.</p> : null}</div>
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-3"><p className="text-xs font-bold text-[var(--color-admin-muted)]">{label}</p><p className="mt-1 font-black text-[var(--color-admin-ink)]">{value}</p></div>;
}
