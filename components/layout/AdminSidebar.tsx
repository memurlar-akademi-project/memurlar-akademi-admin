"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BookOpenText,
  Boxes,
  Building2,
  BadgeCheck,
  Eye,
  ChevronDown,
  FileAudio2,
  FileUp,
  ListChecks,
  Files,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
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
    title: "Hap Bilgi",
    icon: Files,
    items: [
      { href: "/flashcardlar", label: "Hap Bilgiler", icon: Files },
      { href: "/flashcardlar/import", label: "Hap Bilgi Import", icon: FileUp },
    ],
  },
  {
    id: "exams",
    title: "Test ve Deneme",
    icon: Waypoints,
    items: [
      { href: "/testler", label: "Testler", icon: Waypoints },
      { href: "/denemeler", label: "Denemeler", icon: FileAudio2 },
    ],
  },
  {
    id: "operations",
    title: "Operasyon",
    icon: ShieldUser,
    items: [
      { href: "/kullanicilar", label: "Kullanıcılar", icon: ShieldUser },
      { href: "/siparisler", label: "Siparişler", icon: ReceiptText },
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
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

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
          <Link
            className={`admin-nav-item mb-3 ${isDashboardActive ? "admin-nav-item-active" : ""}`}
            href="/dashboard"
          >
            <LayoutDashboard size={17} />
            <span className="font-semibold">Dashboard</span>
          </Link>

          {navigation.map((group) => {
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="mb-2 rounded-[18px] border border-white/6 bg-white/[0.025] p-1">
                <button
                  className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[13px] font-extrabold text-white/78 transition hover:bg-white/5 hover:text-white"
                  type="button"
                  aria-expanded={visibleOpenGroups[group.id] ?? false}
                  onClick={() => toggleGroup(group.id)}
                >
                  <GroupIcon size={17} />
                  <span className="flex-1">{group.title}</span>
                  <ChevronDown
                    size={16}
                    className={`text-white/45 transition-transform ${visibleOpenGroups[group.id] ? "rotate-180" : ""}`}
                  />
                </button>

                {visibleOpenGroups[group.id] ? (
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
