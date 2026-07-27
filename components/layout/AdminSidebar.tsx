"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BookOpenText,
  Boxes,
  Building2,
  BadgeCheck,
  Clock3,
  Eye,
  ChevronDown,
  FileAudio2,
  FileUp,
  ListChecks,
  Gauge,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LibraryBig,
  MessagesSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  PencilRuler,
  PlugZap,
  ReceiptText,
  ScrollText,
  ShieldUser,
  Sparkles,
  Waypoints,
} from "lucide-react";

const navigation = [
  {
    id: "exam-setup",
    title: "Sınav Yapısı",
    icon: GraduationCap,
    items: [
      { href: "/bakanliklar", label: "Bakanlıklar", icon: Building2 },
      { href: "/sinavlar", label: "Sınavlar", icon: GraduationCap },
    ],
  },
  {
    id: "lessons",
    title: "Dersler",
    icon: LibraryBig,
    items: [
      { href: "/dersler", label: "Ders Listesi", icon: LibraryBig },
      { href: "/konular", label: "Konular", icon: BookOpenText },
      { href: "/konular/import", label: "Konu Import", icon: FileUp },
      { href: "/sureler", label: "Süre/Kural Dokümanı", icon: Clock3 },
    ],
  },
  {
    id: "questions",
    title: "Sorular",
    icon: ScrollText,
    items: [
      { href: "/sorular", label: "Sorular", icon: ScrollText },
      { href: "/sorular/preview", label: "Soru Preview", icon: Eye },
      { href: "/sorular/onayla", label: "Soru Onayla", icon: BadgeCheck },
      { href: "/sorular/kalite", label: "Soru Kalite", icon: Gauge },
      { href: "/sorular/agent-uret", label: "Agent Soru Üret", icon: Sparkles },
      { href: "/sorular/import", label: "Soru Import", icon: FileUp },
      { href: "/sorular/dogru-yanlis", label: "D/Y Soruları", icon: ListChecks },
      { href: "/sorular/dogru-yanlis-import", label: "D/Y Import", icon: ListChecks },
    ],
  },
  {
    id: "study",
    title: "Bilgi Kartı",
    icon: Layers,
    items: [
      { href: "/flashcardlar", label: "Bilgi Kartları", icon: Layers },
      { href: "/flashcardlar/import", label: "Bilgi Kartı Import", icon: FileUp },
    ],
  },
  {
    id: "exams",
    title: "Test ve Deneme",
    icon: Waypoints,
    items: [
      { href: "/testler", label: "Testler", icon: Waypoints },
      { href: "/denemeler", label: "Denemeler", icon: FileAudio2 },
      { href: "/denemeler/soru-preview", label: "Deneme Soruları Preview", icon: Eye },
      { href: "/denemeler/preview", label: "Deneme Preview", icon: PencilRuler },
    ],
  },
  {
    id: "page-management",
    title: "Sayfa Yönetimi",
    icon: Newspaper,
    items: [
      { href: "/sayfa-yonetimi/bloglar", label: "Bloglar", icon: Newspaper },
    ],
  },
  {
    id: "operations",
    title: "Operasyon",
    icon: ShieldUser,
    items: [
      { href: "/kullanicilar", label: "Kullanıcılar", icon: ShieldUser },
      { href: "/siparisler", label: "Siparişler", icon: ReceiptText },
      { href: "/entegrasyonlar", label: "Entegrasyonlar", icon: PlugZap },
      { href: "/topluluk", label: "Topluluk Onayı", icon: MessagesSquare },
    ],
  },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function findActiveHref(pathname: string) {
  return navigation
    .flatMap((group) => group.items)
    .filter((item) => isItemActive(pathname, item.href))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href ?? null;
}

function findActiveGroupId(pathname: string) {
  const activeHref = findActiveHref(pathname);

  if (!activeHref) {
    return null;
  }

  return navigation.find((group) => group.items.some((item) => item.href === activeHref))?.id ?? null;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);
  const activeGroupId = findActiveGroupId(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    return navigation.reduce<Record<string, boolean>>((accumulator, group, index) => {
      accumulator[group.id] = activeGroupId ? group.id === activeGroupId : index === 0;

      return accumulator;
    }, {});
  });
  const visibleOpenGroups = useMemo(() => (
    activeGroupId ? { ...openGroups, [activeGroupId]: true } : openGroups
  ), [activeGroupId, openGroups]);

  const isDashboardActive = pathname === "/dashboard";

  function toggleGroup(groupId: string) {
    if (collapsed) {
      setCollapsed(false);
    }

    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen border-r border-[var(--color-admin-sidebar-line)] bg-[linear-gradient(180deg,var(--color-admin-sidebar)_0%,var(--color-admin-sidebar-2)_100%)] py-5 transition-[width] duration-200 lg:block ${
        collapsed ? "w-[88px] px-3" : "w-[286px] px-4"
      }`}
    >
      <button
        aria-label={collapsed ? "Sidebarı aç" : "Sidebarı kapat"}
        className="absolute right-0 top-1/2 z-30 flex h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-[var(--color-admin-sidebar-line)] bg-[var(--color-admin-sidebar-2)] text-white/70 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition hover:bg-white/10 hover:text-white"
        onClick={() => setCollapsed((current) => !current)}
        type="button"
      >
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
      </button>

      <div className="flex h-full flex-col">
        <div className={`rounded-[22px] border border-[var(--color-admin-sidebar-line)] bg-white/4 py-4 ${collapsed ? "px-2" : "px-4"}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-white">
              <Boxes size={20} />
            </div>
            <div className={collapsed ? "sr-only" : ""}>
              <p className="text-[14px] font-extrabold tracking-[-0.03em] text-white">
                Memurlar Akademi
              </p>
              <p className="text-[10px] font-medium text-white/45">Admin Paneli</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex-1 overflow-y-auto pr-1">
          <Link
            aria-label={collapsed ? "Gösterge Paneli" : undefined}
            className={`admin-nav-item mb-3 ${collapsed ? "justify-center px-0" : ""} ${isDashboardActive ? "admin-nav-item-active" : ""}`}
            href="/dashboard"
            title={collapsed ? "Gösterge Paneli" : undefined}
          >
            <LayoutDashboard size={17} />
            <span className={collapsed ? "sr-only" : "font-semibold"}>Gösterge Paneli</span>
          </Link>

          {navigation.map((group) => {
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="mb-2 rounded-[18px] border border-white/6 bg-white/[0.025] p-1">
                <button
                  className={`flex w-full items-center rounded-[14px] py-2.5 text-left text-[13px] font-extrabold text-white/78 transition hover:bg-white/5 hover:text-white ${
                    collapsed ? "justify-center px-0" : "gap-3 px-3"
                  }`}
                  type="button"
                  aria-expanded={visibleOpenGroups[group.id] ?? false}
                  onClick={() => toggleGroup(group.id)}
                  title={collapsed ? group.title : undefined}
                >
                  <GroupIcon size={17} />
                  <span className={collapsed ? "sr-only" : "flex-1"}>{group.title}</span>
                  {collapsed ? null : (
                    <ChevronDown
                      size={16}
                      className={`text-white/45 transition-transform ${visibleOpenGroups[group.id] ? "rotate-180" : ""}`}
                    />
                  )}
                </button>

                {!collapsed && visibleOpenGroups[group.id] ? (
                  <div className="mt-1 space-y-1 border-t border-white/6 pt-1">
                    {group.items.map((item) => {
                      const isActive = activeHref === item.href;
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
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
