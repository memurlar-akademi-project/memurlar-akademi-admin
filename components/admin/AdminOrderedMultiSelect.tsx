"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";

type Option = {
  id: number;
  label: string;
  hint?: string;
};

export function AdminOrderedMultiSelect({
  label,
  options,
  value,
  onChange,
  helperText,
}: {
  label: string;
  options: Option[];
  value: number[];
  onChange: (next: number[]) => void;
  helperText?: string;
}) {
  const [query, setQuery] = useState("");

  const selectedOptions = useMemo(
    () => value.map((id) => options.find((option) => option.id === id)).filter(Boolean) as Option[],
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    return options.filter((option) => {
      if (value.includes(option.id)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [option.label, option.hint]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized);
    });
  }, [options, query, value]);

  function add(nextId: number) {
    if (value.includes(nextId)) {
      return;
    }

    onChange([...value, nextId]);
  }

  function remove(nextId: number) {
    onChange(value.filter((currentId) => currentId !== nextId));
  }

  function move(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= value.length || fromIndex === toIndex) {
      return;
    }

    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  function setOrder(id: number, nextPosition: number) {
    const fromIndex = value.indexOf(id);

    if (fromIndex === -1) {
      return;
    }

    const toIndex = Math.min(Math.max(nextPosition - 1, 0), value.length - 1);
    move(fromIndex, toIndex);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-[var(--color-admin-ink)]">{label}</label>
        {helperText ? (
          <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">{helperText}</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="space-y-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Ders Havuzu
            </p>
            <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
              {filteredOptions.length} uygun kayıt
            </span>
          </div>

          <input
            className="admin-input h-11"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ders ara"
            value={query}
          />

          <div className="h-72 overflow-y-auto rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]">
            {filteredOptions.length === 0 ? (
              <p className="p-4 text-sm text-[var(--color-admin-muted)]">Eklenebilecek ders bulunamadı.</p>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.id}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--color-admin-bg-raised)] ${
                    index !== filteredOptions.length - 1 ? "border-b border-[var(--color-admin-line)]/80" : ""
                  }`}
                  onClick={() => add(option.id)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--color-admin-ink)]">
                      {option.label}
                    </span>
                    {option.hint ? (
                      <span className="mt-0.5 block text-xs text-[var(--color-admin-muted)]">{option.hint}</span>
                    ) : null}
                  </span>
                  <span className="inline-flex h-7 items-center rounded-full border border-[var(--color-admin-line)] px-3 text-xs font-semibold text-[var(--color-admin-muted)]">
                    Ekle
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
              Seçili Dersler
            </p>
            <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
              {value.length} ders seçildi
            </span>
          </div>

          <div className="h-72 overflow-y-auto rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)]">
            {selectedOptions.length === 0 ? (
              <p className="p-4 text-sm text-[var(--color-admin-muted)]">
                Sağ tarafta sıralanacak ders yok. Soldan ders ekleyebilirsin.
              </p>
            ) : (
              selectedOptions.map((option, index) => (
                <div
                  key={option.id}
                  className={`flex items-center gap-3 px-4 py-3 transition ${
                    index !== selectedOptions.length - 1 ? "border-b border-[var(--color-admin-line)]/80" : ""
                  }`}
                >
                  <input
                    className="h-9 w-14 shrink-0 rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-2 text-center text-sm font-semibold text-[var(--color-admin-ink)] outline-none"
                    min={1}
                    onChange={(event) => setOrder(option.id, Number(event.target.value || index + 1))}
                    type="number"
                    value={index + 1}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--color-admin-ink)]">
                      {option.label}
                    </p>
                    {option.hint ? (
                      <p className="mt-0.5 text-xs text-[var(--color-admin-muted)]">{option.hint}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                      onClick={() => move(index, index - 1)}
                      type="button"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                      onClick={() => move(index, index + 1)}
                      type="button"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-danger)]"
                      onClick={() => remove(option.id)}
                      type="button"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedOptions.length > 0 ? (
            <div className="rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] px-4 py-3 text-xs leading-5 text-[var(--color-admin-muted)]">
              <span className="inline-flex items-center gap-2 font-semibold text-[var(--color-admin-ink)]">
                <Check size={14} className="text-[var(--color-admin-accent)]" />
                Sıralama sınav içinde gösterim sırasını belirler.
              </span>
              <p className="mt-2">
                Yukarı-aşağı butonları ya da sıra numarası ile düzenleyebilirsin.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
