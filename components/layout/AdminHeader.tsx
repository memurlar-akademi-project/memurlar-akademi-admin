"use client";

import { ArrowLeft, Bell, ChevronDown, LogOut, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { useAdminPageMeta } from "@/components/providers/AdminPageMetaProvider";
import { AdminThemeToggle } from "@/components/layout/AdminThemeToggle";

function resolvePageMeta(pathname: string) {
  if (pathname === "/dashboard") {
    return { title: "Dashboard" };
  }

  if (pathname === "/bakanliklar") {
    return { title: "Bakanlıklar" };
  }

  if (pathname === "/bakanliklar/yeni") {
    return { title: "Yeni Bakanlık", backHref: "/bakanliklar" };
  }

  if (/^\/bakanliklar\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Bakanlık Düzenle", backHref: "/bakanliklar" };
  }

  if (pathname === "/sinavlar") {
    return { title: "Sınavlar" };
  }

  if (pathname === "/sinavlar/yeni") {
    return { title: "Yeni Sınav", backHref: "/sinavlar" };
  }

  if (/^\/sinavlar\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Sınav Düzenle", backHref: "/sinavlar" };
  }

  if (pathname === "/dersler") {
    return { title: "Dersler" };
  }

  if (pathname === "/dersler/yeni") {
    return { title: "Yeni Ders", backHref: "/dersler" };
  }

  if (/^\/dersler\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Ders Düzenle", backHref: "/dersler" };
  }

  if (pathname === "/konular") {
    return { title: "Konular" };
  }

  if (pathname === "/konular/yeni") {
    return { title: "Yeni Konu", backHref: "/konular" };
  }

  if (pathname === "/konular/import") {
    return { title: "Konu Import", backHref: "/konular" };
  }

  if (/^\/konular\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Konu Düzenle", backHref: "/konular" };
  }

  if (pathname === "/konu-icerikleri") {
    return { title: "Konu İçerikleri" };
  }

  if (pathname === "/icerik-importlari") {
    return { title: "İçerik Importları" };
  }

  if (pathname === "/icerik-importlari/yeni") {
    return { title: "Yeni İçerik Importu", backHref: "/icerik-importlari" };
  }

  if (/^\/icerik-importlari\/\d+\/incele$/.test(pathname)) {
    return { title: "Import İncele", backHref: "/icerik-importlari" };
  }

  if (pathname === "/sorular") {
    return { title: "Sorular" };
  }

  if (pathname === "/sorular/incele") {
    return { title: "Soru İnceleme", backHref: "/sorular" };
  }

  if (pathname === "/sorular/onayla") {
    return { title: "Soru Onayla", backHref: "/sorular" };
  }

  if (pathname === "/sorular/import") {
    return { title: "Soru Import", backHref: "/sorular" };
  }

  if (pathname === "/sorular/dogru-yanlis-import") {
    return { title: "D/Y Soru Import", backHref: "/sorular" };
  }

  if (/^\/sorular\/import\/\d+\/incele$/.test(pathname)) {
    return { title: "Soru Import İncele", backHref: "/sorular/import" };
  }

  if (pathname === "/kullanicilar") {
    return { title: "Kullanıcılar" };
  }

  if (pathname === "/kullanicilar/yeni") {
    return { title: "Yeni Kullanıcı", backHref: "/kullanicilar" };
  }

  if (/^\/kullanicilar\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Kullanıcı Düzenle", backHref: "/kullanicilar" };
  }

  if (pathname === "/siparisler") {
    return { title: "Siparişler" };
  }

  if (/^\/siparisler\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Sipariş Düzenle", backHref: "/siparisler" };
  }

  if (pathname === "/testler") {
    return { title: "Testler" };
  }

  if (pathname === "/testler/yeni") {
    return { title: "Yeni Test", backHref: "/testler" };
  }

  if (/^\/testler\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Test Düzenle", backHref: "/testler" };
  }

  if (pathname === "/ders-testleri") {
    return { title: "Ders Testleri" };
  }

  if (pathname === "/ders-testleri/yeni") {
    return { title: "Yeni Ders Testi", backHref: "/ders-testleri" };
  }

  if (/^\/ders-testleri\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Ders Testi Düzenle", backHref: "/ders-testleri" };
  }

  if (pathname === "/flashcardlar") {
    return { title: "Hap Bilgiler" };
  }

  if (pathname === "/flashcardlar/yeni") {
    return { title: "Yeni Hap Bilgi", backHref: "/flashcardlar" };
  }

  if (pathname === "/flashcardlar/import") {
    return { title: "Hap Bilgi Import", backHref: "/flashcardlar" };
  }

  if (/^\/flashcardlar\/import\/\d+\/incele$/.test(pathname)) {
    return { title: "Hap Bilgi Import İncele", backHref: "/flashcardlar/import" };
  }

  if (/^\/flashcardlar\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Hap Bilgi Düzenle", backHref: "/flashcardlar" };
  }

  if (pathname === "/podcast") {
    return { title: "Podcast" };
  }

  if (pathname === "/podcast/yeni") {
    return { title: "Yeni Podcast Dersi", backHref: "/podcast" };
  }

  if (/^\/podcast\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Podcast Dersi Düzenle", backHref: "/podcast" };
  }

  if (pathname === "/denemeler") {
    return { title: "Denemeler" };
  }

  if (pathname === "/denemeler/yeni") {
    return { title: "Yeni Deneme", backHref: "/denemeler" };
  }

  if (/^\/denemeler\/\d+\/duzenle$/.test(pathname)) {
    return { title: "Deneme Düzenle", backHref: "/denemeler" };
  }

  return { title: "Admin" };
}

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useAdminAuth();
  const { title: dynamicTitle } = useAdminPageMeta();
  const [menuOpen, setMenuOpen] = useState(false);

  const pageMeta = useMemo(() => resolvePageMeta(pathname), [pathname]);

  function handleLogout() {
    logout();
    router.replace("/giris");
  }

  return (
    <header className="admin-card flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        {pageMeta.backHref ? (
          <Link
            aria-label="Geri dön"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={pageMeta.backHref}
          >
            <ArrowLeft size={16} />
          </Link>
        ) : null}

        <h2 className="truncate text-[1.3rem] font-extrabold tracking-[-0.04em] text-[var(--color-admin-ink)]">
          {dynamicTitle ?? pageMeta.title}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden min-w-[300px] items-center gap-3 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-4 py-2.5 text-[var(--color-admin-muted)] xl:flex">
          <Search size={16} />
          <span className="text-[13px]">Modül veya kayıt ara...</span>
        </div>

        <AdminThemeToggle />

        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:-translate-y-0.5 hover:text-[var(--color-admin-ink)]"
          type="button"
        >
          <Bell size={18} />
        </button>

        <div className="relative">
          <button
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-left transition hover:-translate-y-0.5"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--color-admin-accent-soft)] text-xs font-extrabold text-[var(--color-admin-accent)]">
              {session?.user.name?.slice(0, 2).toUpperCase() ?? "AD"}
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px] font-bold text-[var(--color-admin-ink)]">
                {session?.user.name ?? "Admin"}
              </p>
              <p className="text-[11px] text-[var(--color-admin-muted)]">Sistem Yöneticisi</p>
            </div>
            <ChevronDown size={16} className="text-[var(--color-admin-muted)]" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.8rem)] z-40 min-w-[240px] rounded-[20px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-2 shadow-[var(--color-admin-shadow)]">
              <div className="rounded-2xl px-3 py-3">
                <p className="text-sm font-bold text-[var(--color-admin-ink)]">
                  {session?.user.email}
                </p>
                <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                  Tek yetki seviyesi: admin
                </p>
              </div>
              <button
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-[var(--color-admin-danger)] transition hover:bg-[var(--color-admin-danger-soft)]"
                onClick={handleLogout}
                type="button"
              >
                <LogOut size={17} />
                Çıkış Yap
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
