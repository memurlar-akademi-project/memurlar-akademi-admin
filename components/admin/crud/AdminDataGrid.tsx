"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

type Props<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  emptyState: string;
};

export function AdminDataGrid<T>({
  data,
  columns,
  emptyState,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const pageSizeOptions = [8, 20, 50, 100];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 8,
      },
    },
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageSize = table.getState().pagination.pageSize;
  const firstRow = rows.length === 0 ? 0 : table.getState().pagination.pageIndex * pageSize + 1;
  const lastRow = rows.length === 0 ? 0 : firstRow + rows.length - 1;

  function renderControls(borderClassName: string) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 bg-[var(--color-admin-panel-soft)] px-5 py-3 ${borderClassName}`}>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--color-admin-muted)]">
          <span>
            {firstRow}-{lastRow} / {data.length} kayıt
          </span>
          <div className="flex items-center gap-2">
            <span>Göster</span>
            <select
              className="rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-admin-ink)] outline-none"
              onChange={(event) => table.setPageSize(Number(event.target.value))}
              value={pageSize}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-[var(--color-admin-muted)]">
            Sayfa {currentPage}/{Math.max(pageCount, 1)}
          </p>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderControls("border-b border-[var(--color-admin-line)]")}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className="px-5 py-4 text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="inline-flex cursor-pointer select-none items-center gap-2"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ChevronsUpDown size={13} className="opacity-60" />
                        </button>
                      ) : (
                        <div className="inline-flex cursor-default items-center gap-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-14 text-sm text-[var(--color-admin-muted)]"
                  colSpan={columns.length}
                >
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-admin-line)]/80 bg-[var(--color-admin-panel)] transition hover:bg-[var(--color-admin-panel-soft)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {renderControls("border-t border-[var(--color-admin-line)]")}
    </div>
  );
}
