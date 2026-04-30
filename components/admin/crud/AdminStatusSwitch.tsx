"use client";

type Props = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

export function AdminStatusSwitch({
  checked,
  disabled = false,
  label,
  onCheckedChange,
}: Props) {
  return (
    <label className="inline-flex items-center gap-3">
      <button
        aria-checked={checked}
        className={`relative h-7 w-12 rounded-full border transition ${
          checked
            ? "border-[var(--color-admin-accent)] bg-[var(--color-admin-accent)]"
            : "border-[var(--color-admin-line)] bg-[var(--color-admin-panel-muted)]"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
      <span className="text-sm font-semibold text-[var(--color-admin-muted)]">{label}</span>
    </label>
  );
}
