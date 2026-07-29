"use client";

import {
  CircleCheck,
  Camera,
  ExternalLink,
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
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState("");

  const load = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const [parasutResponse, metaResponse] = await Promise.all([
        adminApiRequest<ParasutIntegration>("/admin/integrations/parasut", { token }),
        adminApiRequest<MetaIntegration>("/admin/integrations/meta", { token }),
      ]);
      setIntegration(parasutResponse.data);
      setMetaIntegration(metaResponse.data);
      setSelectedPageId(metaResponse.data.selected_page?.id ?? metaResponse.data.available_pages[0]?.id ?? "");
    } catch (error) {
      showToast({ title: "Paraşüt bağlantı durumu alınamadı", description: error instanceof Error ? error.message : undefined, tone: "error" });
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

  const isReady = integration?.configured && integration.authorized;
  const isMetaReady = metaIntegration?.configured && metaIntegration.authorized && metaIntegration.selected_page;

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
                  ? `${metaIntegration.selected_page?.name} için onaylı yayın akışı kullanılabilir.`
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
