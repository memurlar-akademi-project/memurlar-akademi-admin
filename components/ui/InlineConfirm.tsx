"use client";

import { useEffect, useRef, useState } from "react";

export function InlineConfirm({
  trigger,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  confirmTone = "danger",
  disabled = false,
  busy = false,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "danger" | "primary";
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button disabled={disabled} onClick={() => setOpen((current) => !current)} type="button">
        {trigger}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-4">
          <p className="text-sm font-bold text-[var(--color-admin-ink)]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-admin-muted)]">{description}</p>

          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-xl border border-[var(--color-admin-line)] px-3 py-2 text-xs font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
              onClick={() => setOpen(false)}
              type="button"
            >
              {cancelLabel}
            </button>
            <button
              className={`rounded-xl px-3 py-2 text-xs font-semibold text-white transition ${
                confirmTone === "danger"
                  ? "bg-[var(--color-admin-danger)] hover:opacity-90"
                  : "bg-[var(--color-admin-accent)] hover:opacity-90"
              } ${busy ? "cursor-wait opacity-70" : ""}`}
              disabled={busy}
              onClick={async () => {
                await onConfirm();
                setOpen(false);
              }}
              type="button"
            >
              {busy ? "İşleniyor" : confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
