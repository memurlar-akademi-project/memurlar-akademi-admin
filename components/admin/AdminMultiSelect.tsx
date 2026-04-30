import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";

type Option = {
  id: number;
  label: string;
  hint?: string;
};

export function AdminMultiSelect({
  label,
  options,
  value,
  onChange,
  helperText,
  searchPlaceholder = "Kayıt ara",
  selectedSummaryLabel = "kayıt seçildi",
  emptyStateText = "Seçilebilir kayıt bulunmuyor.",
  hideSelectedFromOptions = false,
  showSelectedChips = true,
}: {
  label: string;
  options: Option[];
  value: number[];
  onChange: (next: number[]) => void;
  helperText?: string;
  searchPlaceholder?: string;
  selectedSummaryLabel?: string;
  emptyStateText?: string;
  hideSelectedFromOptions?: boolean;
  showSelectedChips?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");
    const baseOptions = hideSelectedFromOptions
      ? options.filter((option) => !value.includes(option.id))
      : options;

    if (!normalized) {
      return baseOptions;
    }

    return baseOptions.filter((option) =>
      [option.label, option.hint]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized),
    );
  }, [hideSelectedFromOptions, options, query, value]);

  function toggle(nextId: number) {
    onChange(
      value.includes(nextId)
        ? value.filter((currentId) => currentId !== nextId)
        : [...value, nextId],
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-semibold text-[var(--color-admin-ink)]">{label}</label>
        {helperText ? (
          <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">{helperText}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <input
            className="admin-input h-11"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            value={query}
          />
        </div>
        <span className="text-xs font-semibold text-[var(--color-admin-muted)]">
          {value.length} {selectedSummaryLabel}
        </span>
      </div>

      {showSelectedChips && value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {options
            .filter((option) => value.includes(option.id))
            .map((option) => (
              <span
                key={option.id}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35"
              >
                <Check size={12} className="text-[var(--color-admin-accent)]" />
                {option.label}
                <button
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-danger)]"
                  onClick={() => toggle(option.id)}
                  type="button"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
        </div>
      ) : null}

      <div className="h-72 overflow-y-auto rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
        {filteredOptions.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-admin-muted)]">{emptyStateText}</p>
        ) : (
          filteredOptions.map((option, index) => {
            const selected = value.includes(option.id);

            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition ${
                  index !== filteredOptions.length - 1 ? "border-b border-[var(--color-admin-line)]/80" : ""
                } ${selected ? "bg-[var(--color-admin-accent-soft)]/60" : "hover:bg-[var(--color-admin-bg-raised)]"}`}
              >
                <input
                  checked={selected}
                  className="mt-1 h-4 w-4 rounded border-[var(--color-admin-line)] text-[var(--color-admin-accent)] focus:ring-[var(--color-admin-accent)]"
                  onChange={() => toggle(option.id)}
                  type="checkbox"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--color-admin-ink)]">
                    {option.label}
                  </span>
                  {option.hint ? (
                    <span className="mt-0.5 block text-xs text-[var(--color-admin-muted)]">
                      {option.hint}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
