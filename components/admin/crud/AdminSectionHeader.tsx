import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export function AdminSectionHeader({
  title,
  actions,
  backHref,
}: {
  title: string;
  actions?: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            aria-label="Listeye dön"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:border-[var(--color-admin-accent)] hover:text-[var(--color-admin-accent)]"
            href={backHref}
          >
            <ArrowLeft size={16} />
          </Link>
        ) : null}
        <h1 className="truncate text-[1.4rem] font-extrabold tracking-[-0.03em] text-[var(--color-admin-ink)]">
          {title}
        </h1>
      </div>
      {actions}
    </div>
  );
}
