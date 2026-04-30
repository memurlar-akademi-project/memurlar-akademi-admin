import Link from "next/link";
import { ArrowRight, Save } from "lucide-react";
import { AdminTableCard } from "@/components/admin/crud/AdminTableCard";

export function AdminFormActionsCard({
  formId,
  saving,
  cancelHref,
  relatedLinks = [],
  submitLabel = "Kaydet",
  savingLabel = "Kaydediliyor",
}: {
  formId: string;
  saving: boolean;
  cancelHref: string;
  relatedLinks?: Array<{
    href: string;
    label: string;
  }>;
  submitLabel?: string;
  savingLabel?: string;
}) {
  return (
    <AdminTableCard>
      <div className="px-5 py-5">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--color-admin-muted)]">
          İşlemler
        </h3>
        <div className="mt-4 flex gap-2">
          <button
            className="admin-button admin-button-primary min-w-0 flex-1 justify-center"
            disabled={saving}
            form={formId}
            type="submit"
          >
            <Save size={16} />
            {saving ? savingLabel : submitLabel}
          </button>
          <Link className="admin-button admin-button-secondary min-w-0 flex-1 justify-center" href={cancelHref}>
            İptal
          </Link>
        </div>

        {relatedLinks.length ? (
          <div className="mt-4 space-y-2 border-t border-[var(--color-admin-line)] pt-4">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                className="flex items-center justify-between rounded-[16px] border border-[var(--color-admin-line)] bg-[var(--color-admin-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-admin-ink)] transition hover:border-[var(--color-admin-accent)]/35"
                href={link.href}
              >
                <span>{link.label}</span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </AdminTableCard>
  );
}
