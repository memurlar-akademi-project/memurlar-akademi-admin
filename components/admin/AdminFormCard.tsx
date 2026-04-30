import { ReactNode } from "react";

export function AdminFormCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-card p-5">
      <div className="border-b border-[var(--color-admin-line)] pb-4">
        <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--color-admin-muted)]">
          {description}
        </p>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}
