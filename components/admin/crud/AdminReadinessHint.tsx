"use client";

import type { AdminReadiness } from "@/lib/types";

export function AdminReadinessHint({
  readiness,
}: {
  readiness?: AdminReadiness;
}) {
  if (!readiness) {
    return null;
  }

  if (!readiness.can_activate && readiness.blocking_reasons.length > 0) {
    return (
      <p className="mt-1 text-xs font-medium text-[var(--color-admin-danger)]">
        {readiness.blocking_reasons[0]}
      </p>
    );
  }

  if (readiness.warnings.length > 0) {
    return (
      <p className="mt-1 text-xs font-medium text-amber-700">
        {readiness.warnings[0]}
      </p>
    );
  }

  return null;
}
