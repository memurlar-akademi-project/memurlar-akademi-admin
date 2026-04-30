"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

export function AdminFilterMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  compact = false,
  showSelectedLabel = true,
}: {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (next: T) => void;
  icon: React.ReactNode;
  compact?: boolean;
  showSelectedLabel?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className={`flex items-center rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-bg-raised)] text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35 ${
          compact ? "h-10 gap-1.5 px-2.5 text-xs" : "h-11 gap-2 px-3 text-sm font-medium"
        }`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="text-[var(--color-admin-muted)]">{icon}</span>
        {showSelectedLabel ? <span>{selected?.label ?? label}</span> : null}
        <ChevronDown size={15} className="text-[var(--color-admin-muted)]" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-admin-muted)]">
            {label}
          </p>
          <div className="space-y-1">
            {options.map((option) => (
              <button
                key={option.value}
                className={`flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-left text-sm transition ${
                  option.value === value
                    ? "bg-[var(--color-admin-accent-soft)]/60 text-[var(--color-admin-ink)]"
                    : "text-[var(--color-admin-ink)] hover:bg-[var(--color-admin-panel-soft)]"
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                type="button"
              >
                <span>{option.label}</span>
                {option.value === value ? <Check size={15} className="text-[var(--color-admin-accent)]" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
