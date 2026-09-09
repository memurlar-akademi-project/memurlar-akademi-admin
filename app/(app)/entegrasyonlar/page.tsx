"use client";

import {
  CircleCheck,
  Camera,
  Copy,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  PlugZap,
  RefreshCcw,
  Share2,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { useAdminToast } from "@/components/providers/AdminToastProvider";
import { adminApiRequest } from "@/lib/admin-api";

type ParasutIntegration = {
  configured: boolean;
  authorized: boolean;
  callback_mode: string;
  authorized_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
};

type MetaPage = {
  id: string;
  name: string;
  instagram_account_id: string | null;
  instagram_username: string | null;
};

type MetaIntegration = {
  configured: boolean;
  authorized: boolean;
  callback_url: string;
  available_pages: MetaPage[];
  selected_page: MetaPage | null;
  authorized_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
  capabilities: Record<string, MetaOrganicCapability>;
  automation: false;
  human_approval_required: true;
};

type MetaOrganicCapability = {
  ready: boolean;
  required_scopes: string[];
  missing_scopes: string[];
  required_page_tasks: string[];
  missing_page_tasks: string[];
  endpoint_status: string;
};

type MetaAdsAccount = {
  id: string;
  name: string;
  account_status: number | null;
  currency: string | null;
  timezone_name: string | null;
};

type MetaAdsIntegration = {
  configured: boolean;
  authorized: boolean;
  callback_url: string;
  available_accounts: MetaAdsAccount[];
  selected_account: MetaAdsAccount | null;
  authorized_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
  automation: false;
  change_approval_required: true;
  capability: {
    ready: boolean;
    required_scopes: string[];
    missing_scopes: string[];
    selected_account: boolean;
    automation: false;
    change_approval_required: true;
  };
};

type MetaAdsReport = {
  since: string;
  until: string;
  active_campaign_count: number;
  active_campaigns: Array<{ id: string; name: string }>;
};

type SocialAgentConnection = {
  connected: boolean;
  created_at: string | null;
  last_used_at: string | null;
};

type MetaAdsAgentConnection = SocialAgentConnection & {
  expires_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function IntegrationsPage() {
  const { token } = useAdminAuth();
  const { setTitle } = useAdminPageMeta();
  const { showToast } = useAdminToast();
  const [integration, setIntegration] = useState<ParasutIntegration | null>(null);
  const [metaIntegration, setMetaIntegration] = useState<MetaIntegration | null>(null);
  const [metaAdsIntegration, setMetaAdsIntegration] = useState<MetaAdsIntegration | null>(null);
  const [metaAdsReport, setMetaAdsReport] = useState<MetaAdsReport | null>(null);
  const [metaAdsAgent, setMetaAdsAgent] = useState<MetaAdsAgentConnection | null>(null);
  const [metaAdsAgentToken, setMetaAdsAgentToken] = useState("");
  const [socialAgent, setSocialAgent] = useState<SocialAgentConnection | null>(null);
  const [socialAgentToken, setSocialAgentToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selectedAdAccountId, setSelectedAdAccountId] = useState("");

  const load = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const [parasutResponse, metaResponse, metaAdsResponse, metaAdsAgentResponse, socialAgentResponse] = await Promise.all([
        adminApiRequest<ParasutIntegration>("/admin/integrations/parasut", { token }),
        adminApiRequest<MetaIntegration>("/admin/integrations/meta", { token }),
        adminApiRequest<MetaAdsIntegration>("/admin/integrations/meta-ads", { token }),
        adminApiRequest<MetaAdsAgentConnection>("/admin/integrations/meta-ads-agent", { token }),
        adminApiRequest<SocialAgentConnection>("/admin/integrations/social-agent", { token }),
      ]);
      setIntegration(parasutResponse.data);
      setMetaIntegration(metaResponse.data);
      setMetaAdsIntegration(metaAdsResponse.data);
      setMetaAdsAgent(metaAdsAgentResponse.data);
      setSocialAgent(socialAgentResponse.data);
      setSelectedPageId(metaResponse.data.selected_page?.id ?? metaResponse.data.available_pages[0]?.id ?? "");
      setSelectedAdAccountId(metaAdsResponse.data.selected_account?.id ?? metaAdsResponse.data.available_accounts[0]?.id ?? "");
    } catch (error) {
      showToast({ title: "Entegrasyon durumları alınamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    setTitle("Entegrasyonlar");
  }, [setTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectParasut() {
    if (!token) return;

    setConnecting(true);
    try {
      const response = await adminApiRequest<{ authorization_url: string }>("/admin/integrations/parasut/start", {
        method: "POST",
        token,
      });
      window.location.assign(response.data.authorization_url);
    } catch (error) {
      setConnecting(false);
      showToast({ title: "Paraşüt yetkilendirmesi başlatılamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function connectMeta() {
    if (!token) return;

    setMetaBusy(true);
    try {
      const response = await adminApiRequest<{ authorization_url: string }>("/admin/integrations/meta/start", {
        method: "POST",
        token,
      });
      window.location.assign(response.data.authorization_url);
    } catch (error) {
      setMetaBusy(false);
      showToast({ title: "Meta bağlantısı başlatılamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function selectMetaPage() {
    if (!token || !selectedPageId) return;

    setMetaBusy(true);
    try {
      await adminApiRequest("/admin/integrations/meta/select-page", {
        method: "POST",
        token,
        body: { page_id: selectedPageId },
      });
      showToast({ title: "Memurlar Akademi sayfası seçildi", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Sayfa seçilemedi", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function disconnectMeta() {
    if (!token || !window.confirm("Meta bağlantısı kesilsin mi? Saklanan erişim anahtarları temizlenecek.")) return;

    setMetaBusy(true);
    try {
      await adminApiRequest("/admin/integrations/meta/disconnect", { method: "POST", token });
      showToast({ title: "Meta bağlantısı kesildi", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Meta bağlantısı kesilemedi", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function connectMetaAds() {
    if (!token) return;

    setMetaBusy(true);
    try {
      const response = await adminApiRequest<{ authorization_url: string }>("/admin/integrations/meta-ads/start", {
        method: "POST",
        token,
      });
      window.location.assign(response.data.authorization_url);
    } catch (error) {
      setMetaBusy(false);
      showToast({ title: "Meta Ads bağlantısı başlatılamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function selectMetaAdsAccount() {
    if (!token || !selectedAdAccountId) return;

    setMetaBusy(true);
    setMetaAdsReport(null);
    try {
      await adminApiRequest("/admin/integrations/meta-ads/select-account", {
        method: "POST",
        token,
        body: { account_id: selectedAdAccountId },
      });
      showToast({ title: "Memurlar Akademi reklam hesabı seçildi", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Reklam hesabı seçilemedi", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function disconnectMetaAds() {
    if (!token || !window.confirm("Meta Ads bağlantısı kesilsin mi? Saklanan erişim anahtarları temizlenecek.")) return;

    setMetaBusy(true);
    setMetaAdsReport(null);
    try {
      await adminApiRequest("/admin/integrations/meta-ads/disconnect", { method: "POST", token });
      showToast({ title: "Meta Ads bağlantısı kesildi", tone: "success" });
      await load();
    } catch (error) {
      showToast({ title: "Meta Ads bağlantısı kesilemedi", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function loadMetaAdsReport() {
    if (!token || !isMetaAdsReady) return;

    setMetaBusy(true);
    try {
      const response = await adminApiRequest<MetaAdsReport>("/admin/integrations/meta-ads/report", { token });
      setMetaAdsReport(response.data);
      showToast({ title: "Meta Ads raporu alındı", description: `Aktif kampanya: ${response.data.active_campaign_count}`, tone: "success" });
    } catch (error) {
      showToast({ title: "Meta Ads raporu alınamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function rotateMetaAdsAgentToken() {
    if (!token || !window.confirm("Meta Ads uzmanı için yeni API anahtarı oluşturulsun mu? Varsa önceki anahtar hemen geçersiz olur.")) return;

    setMetaBusy(true);
    setMetaAdsAgentToken("");
    try {
      const response = await adminApiRequest<{ plain_text_token: string; created_at: string | null; expires_at: string | null }>("/admin/integrations/meta-ads-agent/rotate", {
        method: "POST",
        token,
      });
      setMetaAdsAgentToken(response.data.plain_text_token);
      setMetaAdsAgent({
        connected: true,
        created_at: response.data.created_at,
        expires_at: response.data.expires_at,
        last_used_at: null,
      });
      showToast({ title: "Meta Ads uzmanı anahtarı oluşturuldu", description: "Anahtarı şimdi güvenli anahtar kasasına kopyala; bu ekrandan ayrılınca tekrar gösterilmez.", tone: "success" });
    } catch (error) {
      showToast({ title: "Meta Ads uzmanı anahtarı oluşturulamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function copyMetaAdsAgentToken() {
    if (!metaAdsAgentToken) return;
    await navigator.clipboard.writeText(metaAdsAgentToken);
    showToast({ title: "Meta Ads uzmanı anahtarı panoya kopyalandı", tone: "success" });
  }

  async function disconnectMetaAdsAgent() {
    if (!token || !window.confirm("Meta Ads uzmanının API erişimi kaldırılsın mı? Uzman canlı rapor ve değişiklik önizlemesi alamaz.")) return;

    setMetaBusy(true);
    try {
      await adminApiRequest("/admin/integrations/meta-ads-agent", { method: "DELETE", token });
      setMetaAdsAgentToken("");
      setMetaAdsAgent({ connected: false, created_at: null, expires_at: null, last_used_at: null });
      showToast({ title: "Meta Ads uzmanı erişimi kaldırıldı", tone: "success" });
    } catch (error) {
      showToast({ title: "Meta Ads uzmanı erişimi kaldırılamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function rotateSocialAgentToken() {
    if (!token || !window.confirm("Yeni ajan anahtarı oluşturulsun mu? Varsa önceki ajan anahtarı hemen geçersiz olur.")) return;

    setMetaBusy(true);
    setSocialAgentToken("");
    try {
      const response = await adminApiRequest<{ plain_text_token: string; created_at: string | null }>("/admin/integrations/social-agent/rotate", {
        method: "POST",
        token,
      });
      setSocialAgentToken(response.data.plain_text_token);
      setSocialAgent({
        connected: true,
        created_at: response.data.created_at,
        last_used_at: null,
      });
      showToast({ title: "Ajan anahtarı oluşturuldu", description: "Anahtarı şimdi kopyala; bu ekrandan ayrılınca tekrar gösterilmez.", tone: "success" });
    } catch (error) {
      showToast({ title: "Ajan anahtarı oluşturulamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  async function copySocialAgentToken() {
    if (!socialAgentToken) return;
    await navigator.clipboard.writeText(socialAgentToken);
    showToast({ title: "Ajan anahtarı panoya kopyalandı", tone: "success" });
  }

  async function disconnectSocialAgent() {
    if (!token || !window.confirm("Sosyal medya ajanının yayın erişimi kaldırılsın mı?")) return;

    setMetaBusy(true);
    try {
      await adminApiRequest("/admin/integrations/social-agent", { method: "DELETE", token });
      setSocialAgentToken("");
      setSocialAgent({ connected: false, created_at: null, last_used_at: null });
      showToast({ title: "Ajan bağlantısı kaldırıldı", tone: "success" });
    } catch (error) {
      showToast({ title: "Ajan bağlantısı kaldırılamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setMetaBusy(false);
    }
  }

  const isReady = integration?.configured && integration.authorized;
  const isMetaReady = Boolean(metaIntegration?.configured && metaIntegration.capabilities?.publishing?.ready);
  const isMetaAdsReady = Boolean(metaAdsIntegration?.configured && metaAdsIntegration.capability?.ready);

  return (
    <div className="max-w-4xl space-y-5">
      <AdminTableCard>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-700">
                <Share2 size={22} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">Meta Sosyal Medya</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-admin-muted)]">
                  Memurlar Akademi Facebook Sayfasını ve ona bağlı profesyonel Instagram hesabını güvenli yayın akışına bağlar.
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || metaBusy || !metaIntegration?.configured}
              onClick={() => void connectMeta()}
              type="button"
            >
              {metaBusy ? <LoaderCircle className="animate-spin" size={17} /> : <ExternalLink size={17} />}
              {metaIntegration?.authorized ? "Yetkiyi Yenile" : "Meta'ya Bağlan"}
            </button>
          </div>

          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${isMetaReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {isMetaReady ? <CircleCheck className="mt-0.5 shrink-0" size={18} /> : <TriangleAlert className="mt-0.5 shrink-0" size={18} />}
            <div>
              <p className="text-sm font-bold">
                {isMetaReady ? "Yayın bağlantısı hazır" : metaIntegration?.configured ? "Bağlantı veya sayfa seçimi bekleniyor" : "Sunucu yapılandırması bekleniyor"}
              </p>
              <p className="mt-1 text-sm leading-5 opacity-80">
                {isMetaReady
                  ? `${metaIntegration?.selected_page?.name} için onaylı yayın akışı kullanılabilir.`
                  : "Önce Meta uygulama ayarları tamamlanır, ardından yetkili hesap bağlanır ve Memurlar Akademi Sayfası seçilir."}
              </p>
            </div>
          </div>

          {metaIntegration?.authorized && metaIntegration.available_pages.length > 0 ? (
            <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] p-4">
              <label className="text-sm font-bold text-[var(--color-admin-ink)]" htmlFor="meta-page">
                Yayın yapılacak Facebook Sayfası
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <select
                  className="h-11 flex-1 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-3 text-sm text-[var(--color-admin-ink)]"
                  id="meta-page"
                  onChange={(event) => setSelectedPageId(event.target.value)}
                  value={selectedPageId}
                >
                  {metaIntegration.available_pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}{page.instagram_username ? ` · @${page.instagram_username}` : " · Instagram bağlı değil"}
                    </option>
                  ))}
                </select>
                <button
                  className="admin-button admin-button-primary"
                  disabled={metaBusy || !selectedPageId}
                  onClick={() => void selectMetaPage()}
                  type="button"
                >
                  Sayfayı Seç
                </button>
              </div>
            </div>
          ) : null}

          {metaIntegration?.selected_page ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <StatusItem label="Facebook" value={metaIntegration.selected_page.name} />
              <StatusItem
                label="Instagram"
                value={metaIntegration.selected_page.instagram_username ? `@${metaIntegration.selected_page.instagram_username}` : "Profesyonel hesap bağlı değil"}
              />
            </dl>
          ) : null}

          {metaIntegration?.capabilities ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CapabilityItem label="İçerik planlama ve yayınlama" capability={metaIntegration.capabilities.publishing} />
              <CapabilityItem label="Facebook yorum yönetimi" capability={metaIntegration.capabilities.facebook_comments} />
              <CapabilityItem label="Facebook mesaj yönetimi" capability={metaIntegration.capabilities.facebook_messages} />
              <CapabilityItem label="Instagram yorum yönetimi" capability={metaIntegration.capabilities.instagram_comments} />
              <CapabilityItem label="Instagram mesaj yönetimi" capability={metaIntegration.capabilities.instagram_messages} />
              <CapabilityItem label="Organik içgörüler" capability={metaIntegration.capabilities.organic_insights} />
            </div>
          ) : null}

          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-900">
            Bu bağlantı yalnız organik sosyal operasyonlara aittir. Reklam hesabı, kampanya, hedef kitle, bütçe ve teklif yetkileri aşağıdaki Meta Ads Uzmanı bağlantısında ayrı tutulur.
          </p>

          {metaIntegration?.last_error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">Son hata: {metaIntegration.last_error}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <button className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline" onClick={() => void load()} type="button">
              <RefreshCcw size={15} /> Durumu yenile
            </button>
            {metaIntegration?.authorized ? (
              <button className="inline-flex items-center gap-2 text-sm font-bold text-rose-700 hover:underline" disabled={metaBusy} onClick={() => void disconnectMeta()} type="button">
                <Unplug size={15} /> Bağlantıyı kes
              </button>
            ) : null}
          </div>

          <p className="flex items-center gap-2 text-xs leading-5 text-[var(--color-admin-muted)]">
            <Camera size={15} /> Erişim anahtarları bu ekranda gösterilmez; şifrelenmiş olarak backend tarafında saklanır.
          </p>
        </div>
      </AdminTableCard>

      <AdminTableCard>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-700">
                <PlugZap size={22} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">Meta Ads Uzmanı</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-admin-muted)]">
                  Uzmanın yalnız insan isteğiyle raporlama yapacağı ve açık onaydan sonra tekil kampanya değişikliği uygulayacağı reklam hesabını bağlar.
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || metaBusy || !metaAdsIntegration?.configured}
              onClick={() => void connectMetaAds()}
              type="button"
            >
              {metaBusy ? <LoaderCircle className="animate-spin" size={17} /> : <ExternalLink size={17} />}
              {metaAdsIntegration?.authorized ? "Yetkiyi Yenile" : "Meta Ads'e Bağlan"}
            </button>
          </div>

          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${isMetaAdsReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {isMetaAdsReady ? <CircleCheck className="mt-0.5 shrink-0" size={18} /> : <TriangleAlert className="mt-0.5 shrink-0" size={18} />}
            <div>
              <p className="text-sm font-bold">
                {isMetaAdsReady ? "Reklam hesabı hazır" : metaAdsIntegration?.configured ? "Bağlantı veya hesap seçimi bekleniyor" : "Sunucu yapılandırması bekleniyor"}
              </p>
              <p className="mt-1 text-sm leading-5 opacity-80">
                {isMetaAdsReady
                  ? `${metaAdsIntegration?.selected_account?.name} için görev-tetiklemeli raporlama etkin. Değişiklikler her işlemde açık onay ister.`
                  : "Meta hesabını yetkilendir, ardından uzmanın çalışacağı tek reklam hesabını seç."}
              </p>
            </div>
          </div>

          {metaAdsIntegration?.authorized && metaAdsIntegration.available_accounts.length > 0 ? (
            <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] p-4">
              <label className="text-sm font-bold text-[var(--color-admin-ink)]" htmlFor="meta-ads-account">
                Uzmanın çalışacağı reklam hesabı
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <select
                  className="h-11 flex-1 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-card)] px-3 text-sm text-[var(--color-admin-ink)]"
                  id="meta-ads-account"
                  onChange={(event) => setSelectedAdAccountId(event.target.value)}
                  value={selectedAdAccountId}
                >
                  {metaAdsIntegration.available_accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name || account.id}{account.currency ? ` · ${account.currency}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  className="admin-button admin-button-primary"
                  disabled={metaBusy || !selectedAdAccountId}
                  onClick={() => void selectMetaAdsAccount()}
                  type="button"
                >
                  Hesabı Seç
                </button>
              </div>
            </div>
          ) : null}

          {metaAdsIntegration?.selected_account ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <StatusItem label="Reklam hesabı" value={metaAdsIntegration.selected_account.name || metaAdsIntegration.selected_account.id} />
              <StatusItem label="Para birimi" value={metaAdsIntegration.selected_account.currency ?? "-"} />
            </dl>
          ) : null}

          {isMetaAdsReady ? (
            <div className={`rounded-2xl border p-4 ${metaAdsAgent?.connected ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-bold text-[var(--color-admin-ink)]">Uzmanın API erişimi</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--color-admin-muted)]">
                    Tarayıcı kullanmadan, yalnız seçili hesap için canlı rapor ve onay-korumalı değişiklik akışı sağlar.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-admin-muted)]">
                    {metaAdsAgent?.connected
                  ? `Oluşturma: ${formatDate(metaAdsAgent.created_at)} · Son kullanım: ${formatDate(metaAdsAgent.last_used_at)} · Siz iptal edene kadar geçerli.`
                      : "Anahtar oluşturulduğunda uzman görevi doğrudan Meta Marketing API üzerinden yürütür."}
                  </p>
                </div>
                <button className="admin-button admin-button-primary" disabled={metaBusy} onClick={() => void rotateMetaAdsAgentToken()} type="button">
                  {metaBusy ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />}
                  {metaAdsAgent?.connected ? "Anahtarı Yenile" : "API Anahtarı Oluştur"}
                </button>
              </div>

              {metaAdsAgentToken ? (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-3">
                  <p className="text-sm font-bold text-indigo-950">Bu anahtar yalnızca şimdi gösteriliyor</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input aria-label="Meta Ads uzmanı anahtarı" className="h-11 min-w-0 flex-1 rounded-xl border border-indigo-300 bg-white px-3 font-mono text-xs text-slate-900" readOnly type="password" value={metaAdsAgentToken} />
                    <button className="admin-button admin-button-primary" onClick={() => void copyMetaAdsAgentToken()} type="button"><Copy size={16} /> Panoya Kopyala</button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-indigo-800">Anahtarı yalnız bu cihazın güvenli anahtar kasasına kaydet; mesaj, e-posta veya dosya ile paylaşma.</p>
                </div>
              ) : null}

              {metaAdsAgent?.connected ? (
                <button className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-bold text-rose-700 hover:underline" disabled={metaBusy} onClick={() => void disconnectMetaAdsAgent()} type="button">
                  <Unplug size={15} /> API erişimini kaldır
                </button>
              ) : null}
            </div>
          ) : null}

          {metaAdsReport ? (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
              <p className="text-sm font-bold">İnsan isteğiyle alınan son rapor</p>
              <p className="mt-1 text-sm leading-5">{metaAdsReport.since} – {metaAdsReport.until} · Aktif kampanya: <strong>{metaAdsReport.active_campaign_count}</strong></p>
              {metaAdsReport.active_campaigns.length > 0 ? (
                <ul className="mt-3 list-inside list-disc text-sm leading-6">
                  {metaAdsReport.active_campaigns.map((campaign) => <li key={campaign.id}>{campaign.name || campaign.id}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}

          {metaAdsIntegration?.capability?.missing_scopes.length ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
              Meta Ads bağlantısında eksik izinler: {metaAdsIntegration.capability.missing_scopes.join(", ")}. Yetkiyi yenileyip aynı reklam hesabını yeniden seçin.
            </p>
          ) : null}

          <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-5 text-indigo-900">
            Bu bağlantı yalnız seçilen reklam hesabına aittir. Arka plan otomasyonu yoktur; her reklam değişikliği tam hedef ve değişiklik gösterildikten sonra ayrı insan onayı ister.
          </p>

          {metaAdsIntegration?.last_error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">Son hata: {metaAdsIntegration.last_error}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            {isMetaAdsReady ? (
              <button className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:underline" disabled={metaBusy} onClick={() => void loadMetaAdsReport()} type="button">
                <RefreshCcw size={15} /> Son 30 Gün Raporunu Al
              </button>
            ) : null}
            <button className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:underline" onClick={() => void load()} type="button">
              <RefreshCcw size={15} /> Durumu yenile
            </button>
            {metaAdsIntegration?.authorized ? (
              <button className="inline-flex items-center gap-2 text-sm font-bold text-rose-700 hover:underline" disabled={metaBusy} onClick={() => void disconnectMetaAds()} type="button">
                <Unplug size={15} /> Bağlantıyı kes
              </button>
            ) : null}
          </div>
        </div>
      </AdminTableCard>

      <AdminTableCard>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
                <KeyRound size={22} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">Sosyal Medya Ajanı</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-admin-muted)]">
                  Ajana yalnızca onaylı sosyal medya taslaklarını yükleme ve yayınlama yetkisi verir. Kullanıcılar, siparişler ve diğer yönetim alanları bu anahtarla açılamaz.
                </p>
              </div>
            </div>
            <button
              className="admin-button admin-button-primary"
              disabled={loading || metaBusy || !isMetaReady}
              onClick={() => void rotateSocialAgentToken()}
              type="button"
            >
              {metaBusy ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />}
              {socialAgent?.connected ? "Anahtarı Yenile" : "Ajanı Bağla"}
            </button>
          </div>

          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${socialAgent?.connected ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {socialAgent?.connected ? <CircleCheck className="mt-0.5 shrink-0" size={18} /> : <TriangleAlert className="mt-0.5 shrink-0" size={18} />}
            <div>
              <p className="text-sm font-bold">{socialAgent?.connected ? "Ajan erişimi aktif" : "Ajan bağlantısı bekleniyor"}</p>
              <p className="mt-1 text-sm leading-5 opacity-80">
                {socialAgent?.connected
                  ? `Oluşturma: ${formatDate(socialAgent.created_at)} · Son kullanım: ${formatDate(socialAgent.last_used_at)}`
                  : "Meta bağlantısı hazır olduktan sonra tek kullanımlık kurulum anahtarı oluştur."}
              </p>
            </div>
          </div>

          {socialAgentToken ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-950">Bu anahtar yalnızca şimdi gösteriliyor</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  aria-label="Sosyal medya ajanı anahtarı"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-3 font-mono text-xs text-slate-900"
                  readOnly
                  type="password"
                  value={socialAgentToken}
                />
                <button className="admin-button admin-button-primary" onClick={() => void copySocialAgentToken()} type="button">
                  <Copy size={16} /> Panoya Kopyala
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-800">Anahtarı mesaj, e-posta veya dosya ile paylaşma. Kurulumdan sonra cihazın güvenli anahtar kasasında tutulur.</p>
            </div>
          ) : null}

          {socialAgent?.connected ? (
            <button className="inline-flex w-fit items-center gap-2 text-sm font-bold text-rose-700 hover:underline" disabled={metaBusy} onClick={() => void disconnectSocialAgent()} type="button">
              <Unplug size={15} /> Ajan erişimini kaldır
            </button>
          ) : null}
        </div>
      </AdminTableCard>

      <AdminTableCard>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-admin-accent)]/10 text-[var(--color-admin-accent)]">
                <PlugZap size={22} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">Paraşüt e-Fatura</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-admin-muted)]">
                  Ödeme tamamlandığında faturalar Paraşüt&apos;e iletilir; e-belge PDF&apos;i hazır olunca kullanıcıya e-posta ile gönderilir.
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-admin-accent)] px-4 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || connecting}
              onClick={() => void connectParasut()}
              type="button"
            >
              {connecting ? <LoaderCircle className="animate-spin" size={17} /> : <ExternalLink size={17} />}
              {isReady ? "Bağlantıyı Yenile" : "Paraşüt'e Bağlan"}
            </button>
          </div>

          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${isReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {isReady ? <CircleCheck className="mt-0.5 shrink-0" size={18} /> : <TriangleAlert className="mt-0.5 shrink-0" size={18} />}
            <div>
              <p className="text-sm font-bold">{isReady ? "Bağlantı aktif" : "Yetkilendirme bekleniyor"}</p>
              <p className="mt-1 text-sm leading-5 opacity-80">
                {isReady
                  ? "Yeni ödemeler otomatik olarak fatura sürecine alınır."
                  : "Butona tıklayıp Paraşüt hesabında izin ver. Başarılı dönüşte bekleyen faturalar da otomatik işleme alınır."}
              </p>
            </div>
          </div>

          {integration?.last_error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">Son hata: {integration.last_error}</p>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-2">
            <StatusItem label="OAuth yetkilendirmesi" value={integration?.authorized ? "Tamamlandı" : "Bekleniyor"} />
            <StatusItem label="Son yetkilendirme" value={formatDate(integration?.authorized_at ?? null)} />
            <StatusItem label="Son token yenileme" value={formatDate(integration?.last_refreshed_at ?? null)} />
            <StatusItem label="Callback adresi" value={integration?.callback_mode ?? "Yükleniyor"} compact />
          </dl>

          <button className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[var(--color-admin-accent)] hover:underline" onClick={() => void load()} type="button">
            <RefreshCcw size={15} /> Durumu yenile
          </button>
        </div>
      </AdminTableCard>
    </div>
  );
}

function StatusItem({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 py-3">
      <dt className="text-xs font-semibold text-[var(--color-admin-muted)]">{label}</dt>
      <dd className={`mt-1 font-bold text-[var(--color-admin-ink)] ${compact ? "break-all text-xs leading-5" : "text-sm"}`}>{value}</dd>
    </div>
  );
}

function CapabilityItem({ label, capability }: { label: string; capability?: MetaOrganicCapability }) {
  const ready = capability?.ready ?? false;
  const missing = capability?.missing_scopes ?? [];
  const implemented = capability?.endpoint_status === "implemented";
  const detail = ready
    ? "Hazır"
    : !implemented
      ? "Meta App Review ve güvenli API uçları bekleniyor"
      : missing.length > 0
        ? `Eksik izin: ${missing.join(", ")}`
        : "Bağlantı ve hedef seçimi bekleniyor";

  return (
    <div className={`rounded-xl border px-4 py-3 ${ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className="text-xs font-semibold text-[var(--color-admin-muted)]">{label}</p>
      <p className={`mt-1 text-sm font-bold ${ready ? "text-emerald-800" : "text-amber-900"}`}>{detail}</p>
    </div>
  );
}
