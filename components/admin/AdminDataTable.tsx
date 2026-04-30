import { ReactNode } from "react";
import { AdminTableSkeleton } from "@/components/ui/Skeleton";

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
};

export function AdminDataTable<T extends { id: number }>({
  title,
  subtitle,
  columns,
  rows,
  loading,
  error,
  activeId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  columns: Array<Column<T>>;
  rows: T[];
  loading: boolean;
  error: string | null;
  activeId?: number | null;
  onSelect?: (item: T) => void;
}) {
  return (
    <section className="admin-card overflow-hidden">
      <div className="border-b border-[var(--color-admin-line)] px-5 py-4">
        <h2 className="text-lg font-bold text-[var(--color-admin-ink)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-admin-muted)]">{subtitle}</p>
      </div>

      {error ? (
        <div className="border-b border-red-100 bg-red-50 px-5 py-4 text-sm text-[var(--color-admin-danger)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="p-5">
          <AdminTableSkeleton rows={8} />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-sm text-[var(--color-admin-muted)]">
          Bu filtreye uygun kayıt bulunmuyor.
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
              {rows.map((row) => {
                const active = activeId === row.id;

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 last:border-b-0 ${
                      onSelect ? "cursor-pointer" : ""
                    } ${active ? "bg-blue-50/70" : "hover:bg-slate-50/70"}`}
                    onClick={() => onSelect?.(row)}
                  >
                    {columns.map((column) => (
                      <td
                        key={`${row.id}-${column.header}`}
                        className="px-5 py-4 text-sm text-[var(--color-admin-ink)]"
                      >
                        {column.render
                          ? column.render(row)
                          : String(
                              (row as Record<string, unknown>)[String(column.key)] ?? "-",
                            )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
