"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Boxes,
  Building2,
  FileAudio2,
  FileUp,
  Files,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  ReceiptText,
  ScrollText,
  ShieldUser,
  Waypoints,
} from "lucide-react";

const navigation = [
  {
    title: "Ana",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Katalog",
    items: [
      { href: "/bakanliklar", label: "Bakanlıklar", icon: Building2 },
      { href: "/sinavlar", label: "Sınavlar", icon: GraduationCap },
      { href: "/dersler", label: "Dersler", icon: LibraryBig },
      { href: "/konular", label: "Konular", icon: BookOpenText },
    ],
  },
  {
    title: "İçerik",
    items: [
      { href: "/konular/import", label: "Konu Import", icon: FileUp },
      { href: "/icerik-importlari", label: "İçerik Importları", icon: FileUp },
      { href: "/sorular", label: "Sorular", icon: ScrollText },
      { href: "/testler", label: "Testler", icon: Waypoints },
      { href: "/ders-testleri", label: "Ders Testleri", icon: Waypoints },
      { href: "/flashcardlar", label: "Hap Bilgiler", icon: Files },
      { href: "/denemeler", label: "Denemeler", icon: FileAudio2 },
    ],
  },
  {
    title: "Operasyon",
    items: [
      { href: "/kullanicilar", label: "Kullanıcılar", icon: ShieldUser },
      { href: "/siparisler", label: "Siparişler", icon: ReceiptText },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen border-r border-[var(--color-admin-sidebar-line)] bg-[linear-gradient(180deg,var(--color-admin-sidebar)_0%,var(--color-admin-sidebar-2)_100%)] px-4 py-5 lg:block">
      <div className="flex h-full flex-col">
        <div className="rounded-[22px] border border-[var(--color-admin-sidebar-line)] bg-white/4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-white">
              <Boxes size={20} />
            </div>
            <div>
              <p className="text-[14px] font-extrabold tracking-[-0.03em] text-white">
                Memurlar Akademi
              </p>
              <p className="text-[10px] font-medium text-white/45">Admin Paneli</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex-1 overflow-y-auto pr-1">
          {navigation.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="px-3 pb-2 text-[9px] font-extrabold uppercase tracking-[0.22em] text-white/30">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      className={`admin-nav-item ${isActive ? "admin-nav-item-active" : ""}`}
                      href={item.href}
                    >
                      <Icon size={17} />
                      <span className="font-semibold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="rounded-[20px] border border-[var(--color-admin-sidebar-line)] bg-white/4 px-4 py-4 text-white/60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Not
          </p>
          <p className="mt-2 text-[13px] leading-5.5">
            Liste ekranı, ayrı oluşturma ve ayrı düzenleme sayfası bu panelin temel kalıbı.
          </p>
        </div>
      </div>
    </aside>
  );
}
