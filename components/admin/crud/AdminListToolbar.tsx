"use client";

import type { ReactNode } from "react";

export function AdminListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3">
      {children}
    </div>
  );
}

export function AdminListToolbarRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-2.5">{children}</div>;
}

export function AdminListToolbarFields({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2.5">{children}</div>;
}

export function AdminListToolbarField({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function AdminListToolbarActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2">{children}</div>;
}

export function AdminListToolbarIconButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={title}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)]/35 hover:text-[var(--color-admin-ink)]"
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

export function AdminListToolbarMeta({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>;
}

export function AdminListToolbarMetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-admin-muted)]">
      {children}
    </span>
  );
}
