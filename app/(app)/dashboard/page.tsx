"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CircleDollarSign,
  ClipboardCheck,
  type LucideIcon,
  Gauge,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { adminApiRequest } from "@/lib/admin-api";
import type { AdminDashboard } from "@/lib/types";
import { SkeletonBlock } from "@/components/ui/Skeleton";

const numberFormatter = new Intl.NumberFormat("tr-TR");
const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type DashboardIconSource =
  | LucideIcon
  | {
      src: string;
      alt: string;
    };

const dashboardPrimaryStats = [
  {
    key: "today-logins",
    icon: { src: "/icons/dashboard-users.svg", alt: "Kullanıcı istatistik ikonu" },
    label: "Bugün Giriş Yapan",
  },
  {
    key: "active-users",
    icon: { src: "/icons/dashboard-activity.svg", alt: "Aktif kullanıcı ikonu" },
    label: "Şu An Aktif Kullanıcı",
  },
  {
    key: "weekly-orders",
    icon: { src: "/icons/dashboard-orders.svg", alt: "Sipariş ikonu" },
    label: "Bu Hafta Sipariş",
  },
  {
    key: "active-memberships",
    icon: { src: "/icons/dashboard-shield.svg", alt: "Aktif erişim ikonu" },
    label: "Aktif Erişim",
  },
  // Custom SVG example:
  // {
  //   key: "custom-stat",
  //   icon: { src: "/icons/dashboard-users.svg", alt: "Kullanıcı ikonu" },
  //   label: "Özel Kart",
  // },
] as const;

const dashboardInsights = [
  {
    key: "engagement",
    icon: { src: "/icons/dashboard-users.svg", alt: "Kullanıcı hareketi ikonu" },
    title: "Aktif Kullanıcı Hareketi",
    subtitle: "Bugün gerçekten çalışan kullanıcı ile 7 günlük tabanı birlikte izle.",
  },
  {
    key: "accuracy",
    icon: { src: "/icons/dashboard-gauge.svg", alt: "Doğruluk oranı ikonu" },
    title: "Doğruluk Oranı",
    subtitle: "Canlı performans kalitesini bugüne ve son 7 güne göre kıyasla.",
  },
] as const;

export default function DashboardPage() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await adminApiRequest<AdminDashboard>("/admin/dashboard", { token });

        if (!cancelled) {
          setData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Gösterge paneli yüklenirken hata oluştu.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const topExamRevenue = useMemo(() => {
    return Math.max(...(data?.exam_performance.map((item) => item.estimated_revenue) ?? [0]), 1);
  }, [data]);

  const maxCoverageQuestionCount = useMemo(() => {
    return Math.max(...(data?.subject_coverage.map((item) => item.question_count) ?? [0]), 1);
  }, [data]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-[var(--color-admin-danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-36 rounded-[20px]" />
          ))
        ) : (
          <>
            <DashboardStatCard
              icon={dashboardPrimaryStats[0].icon}
              label={dashboardPrimaryStats[0].label}
              value={numberFormatter.format(data?.today.logged_in_users ?? 0)}
              meta={`${numberFormatter.format(data?.totals.users ?? 0)} toplam kayıtlı kullanıcı`}
            />
            <DashboardStatCard
              icon={dashboardPrimaryStats[1].icon}
              label={dashboardPrimaryStats[1].label}
              value={numberFormatter.format(data?.engagement.currently_active_users ?? 0)}
              meta="Son 15 dakikada hareket eden kullanıcı"
            />
            <DashboardStatCard
              icon={dashboardPrimaryStats[2].icon}
              label={dashboardPrimaryStats[2].label}
              value={numberFormatter.format(data?.commerce.orders_this_week ?? 0)}
              meta={`${numberFormatter.format(data?.commerce.orders_total ?? 0)} toplam sipariş`}
            />
            <DashboardStatCard
              icon={dashboardPrimaryStats[3].icon}
              label={dashboardPrimaryStats[3].label}
              value={numberFormatter.format(data?.totals.active_memberships ?? 0)}
              meta={`${numberFormatter.format(data?.totals.active_memberships ?? 0)} aktif üyelik`}
            />
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-28 rounded-[20px]" />
          ))
        ) : (
          <>
            <DashboardMiniStat
              label="Yeni Kullanıcı"
              value={numberFormatter.format(data?.today.new_users ?? 0)}
              hint="Bugün açılan hesap"
            />
            <DashboardMiniStat
              label="Bugünkü Sipariş"
              value={numberFormatter.format(data?.today.orders ?? 0)}
              hint={currencyFormatter.format(data?.today.revenue ?? 0)}
            />
            <DashboardMiniStat
              label="Bugün Çözülen"
              value={numberFormatter.format(data?.today.questions_solved ?? 0)}
              hint={`${numberFormatter.format(data?.totals.questions ?? 0)} soru havuzda`}
            />
            <DashboardMiniStat
              label="Toplam Sipariş"
              value={numberFormatter.format(data?.commerce.orders_total ?? 0)}
              hint="Genel ticari hacim"
            />
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <>
            <SkeletonBlock className="h-44 rounded-[20px]" />
            <SkeletonBlock className="h-44 rounded-[20px]" />
          </>
        ) : (
          <>
            <DashboardInsightCard
              icon={dashboardInsights[0].icon}
              title={dashboardInsights[0].title}
              subtitle={dashboardInsights[0].subtitle}
              items={[
                {
                  label: "Bugün aktif kullanıcı",
                  value: numberFormatter.format(data?.engagement.active_users_today ?? 0),
                  hint: "Soru çözen veya deneme cevaplayan kullanıcı",
                },
                {
                  label: "Son 7 gün aktif kullanıcı",
                  value: numberFormatter.format(data?.engagement.active_users_last_7_days ?? 0),
                  hint: "Haftalık hareketli taban",
                },
              ]}
            />
            <DashboardInsightCard
              icon={dashboardInsights[1].icon}
              title={dashboardInsights[1].title}
              subtitle={dashboardInsights[1].subtitle}
              items={[
                {
                  label: "Bugünkü doğruluk",
                  value: `%${numberFormatter.format(data?.engagement.accuracy_rate_today ?? 0)}`,
                  hint: "Bugün cevaplanan sorular içinde doğru oranı",
                },
                {
                  label: "Son 7 gün doğruluk",
                  value: `%${numberFormatter.format(data?.engagement.accuracy_rate_last_7_days ?? 0)}`,
                  hint: "Kısa dönem kalite sinyali",
                },
              ]}
            />
          </>
        )}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.45fr_0.95fr]">
        <div className="admin-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">Son 7 Günlük Hareket</h2>
              <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                Kayıt ve çözülen soru yoğunluğunu aynı eksende birlikte izleyebilirsin.
              </p>
            </div>
            <div className="flex gap-4 text-xs font-semibold text-[var(--color-admin-muted)]">
              <LegendChip color="#2563eb" label="Yeni kayıt" />
              <LegendChip color="#0f9f6e" label="Çözülen soru" />
            </div>
          </div>

          {loading ? (
            <SkeletonBlock className="h-[280px] rounded-[18px]" />
          ) : (
            <DashboardLineChart data={data?.activity_last_7_days ?? []} />
          )}
        </div>

        <div className="admin-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">İçerik Sağlığı</h2>
              <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
                Hangi üretim alanında taslak birikiyor hızlıca gör.
              </p>
            </div>
            <ClipboardCheck className="size-5 text-[var(--color-admin-muted)]" />
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-28 rounded-[18px]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <ContentHealthCard
                label="Konular"
                active={data?.content_health.active_topics ?? 0}
                draft={data?.content_health.draft_topics ?? 0}
              />
              <ContentHealthCard
                label="Sorular"
                active={data?.content_health.active_questions ?? 0}
                draft={data?.content_health.draft_questions ?? 0}
              />
              <ContentHealthCard
                label="Testler"
                active={data?.content_health.active_tests ?? 0}
                draft={data?.content_health.draft_tests ?? 0}
              />
              <ContentHealthCard
                label="Denemeler"
                active={data?.content_health.active_mock_exams ?? 0}
                draft={data?.content_health.draft_mock_exams ?? 0}
              />
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="admin-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">Sınav Performansı</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
              Aktif üyelik ve tahmini gelir tarafında en çok hareket alan sınavlar.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-16 rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(data?.exam_performance ?? []).map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-admin-ink)]">{exam.name}</p>
                      <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                        {exam.ministry_name ?? "Bakanlık yok"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[var(--color-admin-ink)]">
                        {currencyFormatter.format(exam.estimated_revenue)}
                      </p>
                      <p className="text-xs text-[var(--color-admin-muted)]">Tahmini gelir</p>
                    </div>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-admin-panel-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-admin-accent)]"
                      style={{
                        width: `${Math.max((exam.estimated_revenue / topExamRevenue) * 100, 6)}%`,
                      }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-admin-muted)]">
                    <span>{numberFormatter.format(exam.active_membership_count)} aktif erişim</span>
                    <span>{numberFormatter.format(exam.paid_membership_count)} ücretli üyelik</span>
                    <span>{currencyFormatter.format(exam.price)} yıllık ücret</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">Ders Kapsamı</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
              Konu ve soru yoğunluğu yüksek dersleri hızlıca taramak için.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-14 rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(data?.subject_coverage ?? []).map((subject) => (
                <div key={subject.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-admin-ink)]">{subject.name}</p>
                      <p className="mt-1 text-xs text-[var(--color-admin-muted)]">
                        {numberFormatter.format(subject.active_topic_count)} aktif konu /{" "}
                        {numberFormatter.format(subject.topic_count)} toplam konu
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-[var(--color-admin-ink)]">
                        {numberFormatter.format(subject.question_count)}
                      </p>
                      <p className="text-xs text-[var(--color-admin-muted)]">soru</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-admin-panel-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-admin-ink)]"
                      style={{
                        width: `${Math.max((subject.question_count / maxCoverageQuestionCount) * 100, 5)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="admin-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">En Çok Çözülen Dersler</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
              Son 7 günde kullanıcıların en çok çalıştığı dersleri gösterir.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-16 rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(data?.subject_engagement.top_solved ?? []).map((subject, index) => (
                <SubjectSignalRow
                  key={subject.id}
                  index={index + 1}
                  name={subject.name}
                  primary={`${numberFormatter.format(subject.answered_count)} soru`}
                  secondary={`%${numberFormatter.format(subject.accuracy_rate)} doğruluk`}
                  tone="neutral"
                />
              ))}
            </div>
          )}
        </div>

        <div className="admin-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">Yakın Takip Gereken Dersler</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
              Cevaplanan soru içinde doğruluğu düşük kalan dersleri işaretler.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-16 rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(data?.subject_engagement.lowest_accuracy ?? []).map((subject, index) => (
                <SubjectSignalRow
                  key={subject.id}
                  index={index + 1}
                  name={subject.name}
                  primary={`%${numberFormatter.format(subject.accuracy_rate)} doğruluk`}
                  secondary={`${numberFormatter.format(subject.answered_count)} soru çözüldü`}
                  tone="warn"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="admin-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">Son Siparişler</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
              Yeni tahsilatları ve hangi kullanıcıya ait olduğunu hızlıca takip et.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-18 rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.recent_orders ?? []).map((order) => (
                <ActivityListRow
                  key={order.id}
                  title={order.user.name ?? "Kullanıcı yok"}
                  subtitle={`${order.plan_name ?? "Plan yok"} • ${order.user.email ?? "-"}`}
                  metaLeft={currencyFormatter.format(order.total_amount)}
                  metaRight={formatDateTime(order.ordered_at)}
                  badge={order.status}
                />
              ))}
            </div>
          )}
        </div>

        <div className="admin-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">Son Kayıtlar</h2>
            <p className="mt-1 text-sm text-[var(--color-admin-muted)]">
              Yeni kullanıcıların hangi sınav bağlamında sisteme girdiğini gösterir.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-18 rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.recent_users ?? []).map((user) => (
                <ActivityListRow
                  key={user.id}
                  title={user.name}
                  subtitle={`${user.exam_name ?? "Sınav bağlanmadı"} • ${user.email}`}
                  metaLeft={user.membership_type ? membershipLabel(user.membership_type) : "Üyelik yok"}
                  metaRight={formatDateTime(user.created_at)}
                  badge={user.membership_status ?? "unknown"}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardStatCard({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: DashboardIconSource;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="admin-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
            {label}
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">{value}</p>
          <p className="text-sm text-[var(--color-admin-muted)]">{meta}</p>
        </div>
        <DashboardIconBadge icon={Icon} />
      </div>
    </div>
  );
}

function DashboardMiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="admin-card px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
        {label}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">{value}</p>
        <p className="text-right text-xs leading-5 text-[var(--color-admin-muted)]">{hint}</p>
      </div>
    </div>
  );
}

function DashboardInsightCard({
  icon: Icon,
  title,
  subtitle,
  items,
}: {
  icon: DashboardIconSource;
  title: string;
  subtitle: string;
  items: Array<{
    label: string;
    value: string;
    hint: string;
  }>;
}) {
  return (
    <div className="admin-card p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-admin-muted)]">{subtitle}</p>
        </div>
        <DashboardIconBadge icon={Icon} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
              {item.label}
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">
              {item.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">{item.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardIconBadge({ icon }: { icon: DashboardIconSource }) {
  if (typeof icon === "function") {
    const IconComponent = icon;

    return (
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
        <IconComponent
          aria-hidden="true"
          className="size-[18px] shrink-0 text-[var(--color-admin-ink)]"
          strokeWidth={2.1}
        />
      </div>
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
      <Image
        src={icon.src}
        alt={icon.alt}
        width={18}
        height={18}
        className="size-[18px] shrink-0 object-contain"
      />
    </div>
  );
}

function ContentHealthCard({
  label,
  active,
  draft,
}: {
  label: string;
  active: number;
  draft: number;
}) {
  const total = Math.max(active + draft, 1);
  const activeRatio = (active / total) * 100;

  return (
    <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--color-admin-ink)]">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">
            {numberFormatter.format(active)}
          </p>
          <p className="text-xs text-[var(--color-admin-muted)]">aktif içerik</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-[var(--color-admin-ink)]">{numberFormatter.format(draft)}</p>
          <p className="text-xs text-[var(--color-admin-muted)]">taslak</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-admin-panel-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-admin-success)]"
          style={{ width: `${Math.max(activeRatio, 5)}%` }}
        />
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function DashboardLineChart({
  data,
}: {
  data: AdminDashboard["activity_last_7_days"];
}) {
  const width = 760;
  const height = 280;
  const paddingX = 24;
  const top = 18;
  const bottom = 34;
  const chartHeight = height - top - bottom;
  const chartWidth = width - paddingX * 2;
  const maxValue = Math.max(
    ...data.flatMap((item) => [item.registrations, item.questions_solved]),
    1,
  );

  const pointsFor = (key: "registrations" | "questions_solved") =>
    data
      .map((item, index) => {
        const x = paddingX + (chartWidth / Math.max(data.length - 1, 1)) * index;
        const y = top + chartHeight - (item[key] / maxValue) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");

  const registrationsPoints = pointsFor("registrations");
  const solvedPoints = pointsFor("questions_solved");

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
          {Array.from({ length: 4 }).map((_, index) => {
            const y = top + (chartHeight / 3) * index;
            return (
              <line
                key={index}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="var(--color-admin-line)"
                strokeDasharray="4 6"
              />
            );
          })}

          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={registrationsPoints}
          />
          <polyline
            fill="none"
            stroke="#0f9f6e"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={solvedPoints}
          />

          {data.map((item, index) => {
            const x = paddingX + (chartWidth / Math.max(data.length - 1, 1)) * index;
            const registrationsY = top + chartHeight - (item.registrations / maxValue) * chartHeight;
            const solvedY = top + chartHeight - (item.questions_solved / maxValue) * chartHeight;

            return (
              <g key={item.date}>
                <circle cx={x} cy={registrationsY} r="4" fill="#2563eb" />
                <circle cx={x} cy={solvedY} r="4" fill="#0f9f6e" />
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--color-admin-muted)"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {data.map((day) => (
          <div
            key={day.date}
            className="rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
              {day.label}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-admin-muted)]">Kayıt</span>
              <span className="font-semibold text-[var(--color-admin-ink)]">
                {numberFormatter.format(day.registrations)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--color-admin-muted)]">Soru</span>
              <span className="font-semibold text-[var(--color-admin-ink)]">
                {numberFormatter.format(day.questions_solved)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectSignalRow({
  index,
  name,
  primary,
  secondary,
  tone,
}: {
  index: number;
  name: string;
  primary: string;
  secondary: string;
  tone: "neutral" | "warn";
}) {
  return (
    <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              tone === "warn"
                ? "bg-[var(--color-admin-warn-soft)] text-[var(--color-admin-warn)]"
                : "bg-[var(--color-admin-panel-muted)] text-[var(--color-admin-ink)]"
            }`}
          >
            {index}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--color-admin-ink)]">{name}</p>
            <p className="mt-1 text-xs text-[var(--color-admin-muted)]">{secondary}</p>
          </div>
        </div>
        <p className="shrink-0 text-sm font-bold text-[var(--color-admin-ink)]">{primary}</p>
      </div>
    </div>
  );
}

function ActivityListRow({
  title,
  subtitle,
  metaLeft,
  metaRight,
  badge,
}: {
  title: string;
  subtitle: string;
  metaLeft: string;
  metaRight: string;
  badge: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--color-admin-ink)]">{title}</p>
          <p className="mt-1 truncate text-xs text-[var(--color-admin-muted)]">{subtitle}</p>
        </div>
        <span className="rounded-full bg-[var(--color-admin-panel-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
          {badge}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[var(--color-admin-ink)]">{metaLeft}</span>
        <span className="text-[var(--color-admin-muted)]">{metaRight}</span>
      </div>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return dateFormatter.format(new Date(value));
}

function membershipLabel(type: string) {
  if (type === "paid") {
    return "Ücretli";
  }

  if (type === "free") {
    return "Ücretsiz";
  }

  return type;
}
