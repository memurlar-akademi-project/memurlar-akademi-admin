"use client";

import { ReactNode, useEffect, useState } from "react";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  tone = "danger",
  disabled = false,
  busy = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  return (
    <>
      <button disabled={disabled} onClick={() => setOpen(true)} type="button">
        {trigger}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[24px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel)] p-6">
            <h3 className="text-lg font-extrabold tracking-[-0.02em] text-[var(--color-admin-ink)]">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-admin-muted)]">{description}</p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-[var(--color-admin-line)] px-4 py-2.5 text-sm font-semibold text-[var(--color-admin-muted)] transition hover:text-[var(--color-admin-ink)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                {cancelLabel}
              </button>
              <button
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                  tone === "danger"
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
        </div>
      ) : null}
    </>
  );
}
