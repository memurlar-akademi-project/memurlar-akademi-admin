"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = {
  id: number;
  label: string;
  hint?: string;
};

export function AdminSearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Kayıt ara",
  emptyText = "Kayıt bulunamadı.",
  hideLabel = false,
  compact = false,
  buttonPlaceholder,
}: {
  label: string;
  options: Option[];
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  emptyText?: string;
  hideLabel?: boolean;
  compact?: boolean;
  buttonPlaceholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr");

    if (!normalized) {
      return options;
    }

    return options.filter((option) =>
      [option.label, option.hint]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalized),
    );
  }, [options, query]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updateDropdownPosition() {
      const rect = containerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setDropdownStyle({
        left: rect.left,
        top: rect.bottom + 8,
        width: rect.width,
      });
    }

    updateDropdownPosition();

    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  return (
    <div className={hideLabel ? undefined : "space-y-2"} ref={containerRef}>
      {!hideLabel ? (
        <span className="block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-admin-muted)]">
          {label}
        </span>
      ) : null}

      <div className="relative">
        <button
          className={`admin-input flex w-full items-center justify-between gap-3 text-left ${
            compact ? "h-10 text-sm" : "h-11"
          }`}
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className={selectedOption ? "text-[var(--color-admin-ink)]" : "text-[var(--color-admin-muted)]"}>
            {selectedOption?.label ?? buttonPlaceholder ?? `${label} seç`}
          </span>
          {selectedOption ? (
            <span
              className="text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
                setQuery("");
              }}
            >
              <X size={16} />
            </span>
          ) : (
            <span className="text-sm text-[var(--color-admin-muted)]">Seç</span>
          )}
        </button>

        {open && dropdownStyle
          ? createPortal(
              <div
                className="fixed z-[120] rounded-[18px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                ref={dropdownRef}
                style={{
                  left: dropdownStyle.left,
                  top: dropdownStyle.top,
                  width: dropdownStyle.width,
                }}
              >
            <input
              autoFocus
              className="admin-input h-11"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              value={query}
            />

            <div className="mt-3 max-h-72 overflow-y-auto rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)]">
              {filteredOptions.length === 0 ? (
                <p className="p-4 text-sm text-[var(--color-admin-muted)]">{emptyText}</p>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.id}
                    className={`w-full px-4 py-3 text-left transition hover:bg-[var(--color-admin-bg-raised)] ${
                      index !== filteredOptions.length - 1 ? "border-b border-[var(--color-admin-line)]/80" : ""
                    } ${option.id === value ? "bg-[var(--color-admin-accent-soft)]/60" : ""}`}
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    type="button"
                  >
                    <span className="block text-sm font-semibold text-[var(--color-admin-ink)]">{option.label}</span>
                    {option.hint ? (
                      <span className="mt-0.5 block text-xs text-[var(--color-admin-muted)]">{option.hint}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
