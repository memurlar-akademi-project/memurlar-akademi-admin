import { ReactNode } from "react";

export function AdminWorkspace({
  title,
  description,
  toolbar,
  list,
  form,
}: {
  title: string;
  description: string;
  toolbar?: ReactNode;
  list: ReactNode;
  form: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="admin-card flex flex-wrap items-end justify-between gap-4 px-6 py-5">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--color-admin-muted)]">
            {description}
          </p>
        </div>
        {toolbar}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
        {list}
        {form}
      </div>
    </div>
  );
}
