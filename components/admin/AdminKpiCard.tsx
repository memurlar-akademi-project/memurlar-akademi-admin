export function AdminKpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="admin-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-admin-muted)]">{label}</p>
          <p className="mt-4 text-4xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">
            {value}
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-admin-accent-soft)] p-3 text-[var(--color-admin-accent)]">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </span>
      </div>
    </div>
  );
}
