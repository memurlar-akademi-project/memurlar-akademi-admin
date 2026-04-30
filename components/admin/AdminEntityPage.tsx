import { ReactNode } from "react";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
};

type Props<T> = {
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  items: T[];
  onRefresh: () => void;
  columns: Array<Column<T>>;
};

export function AdminEntityPage<T extends { id: number }>({
  title,
  description,
  loading,
  error,
  items,
  onRefresh,
  columns,
}: Props<T>) {
  return (
    <div className="space-y-6">
      <section className="admin-card flex flex-wrap items-end justify-between gap-4 px-6 py-5">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-admin-ink)]">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--color-admin-muted)]">
            {description}
          </p>
        </div>
        <button
          className="admin-button admin-button-secondary"
          onClick={onRefresh}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Yenile
        </button>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-[var(--color-admin-danger)]">
          {error}
        </div>
      ) : null}

      <section className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-5">
            <AdminTableSkeleton rows={7} />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-sm text-[var(--color-admin-muted)]">
            Kayıt bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
                  {columns.map((column) => (
                    <th
                      key={column.header}
                      className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]"
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    {columns.map((column) => (
                      <td
                        key={`${item.id}-${column.header}`}
                        className="px-5 py-4 text-sm text-[var(--color-admin-ink)]"
                      >
                        {column.render
                          ? column.render(item)
                          : String(
                              (item as Record<string, unknown>)[String(column.key)] ?? "-",
                            )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
