"use client";

import Link from "next/link";
import type { AdminReadiness } from "@/lib/types";

type ReadinessAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function AdminReadinessPanel({
  readiness,
  entityLabel = "Kayıt",
  actions = [],
}: {
  readiness?: AdminReadiness;
  entityLabel?: string;
  actions?: ReadinessAction[];
}) {
  if (!readiness) {
    return null;
  }

  const hasBlocking = readiness.blocking_reasons.length > 0;
  const hasWarnings = readiness.warnings.length > 0;

  if (!hasBlocking && !hasWarnings) {
    return null;
  }

  return (
    <div className="px-5 py-5">
      <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
        Hazırlık Durumu
      </h3>

      <div className="mt-4 space-y-3">
        {hasBlocking ? (
          <div className="rounded-[18px] border border-[var(--color-admin-danger-soft)] bg-[var(--color-admin-danger-soft)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--color-admin-danger)]">
              {entityLabel} şu anda aktif edilemez.
            </p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-admin-danger)]">
              {readiness.blocking_reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasWarnings ? (
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              Dikkat edilmesi gereken noktalar var.
            </p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
              {readiness.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map((action) =>
              action.href ? (
                <Link
                  key={`${action.label}-${action.href}`}
                  className="inline-flex items-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35 hover:text-[var(--color-admin-accent)]"
                  href={action.href}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  className="inline-flex items-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35 hover:text-[var(--color-admin-accent)]"
                  onClick={action.onClick}
                  type="button"
                >
                  {action.label}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
