"use client";

export function FinancialRetentionFields({
  disabled, reviewed, basis, until, today, onReviewed, onBasis, onUntil,
}: {
  disabled: boolean;
  reviewed: boolean;
  basis: string;
  until: string;
  today: string;
  onReviewed: (value: boolean) => void;
  onBasis: (value: string) => void;
  onUntil: (value: string) => void;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-slate-200 p-3">
      <legend className="px-1 font-semibold">Mali kayıtların saklama kararı</legend>
      <label className="block space-y-1">
        <span>Saklama gerekçesi</span>
        <textarea value={basis} onChange={(event) => onBasis(event.target.value)} maxLength={2000} rows={3} className="block w-full rounded-xl border bg-white p-3" />
      </label>
      <label className="block space-y-1">
        <span>Saklama son tarihi</span>
        <input type="date" min={today} value={until} onChange={(event) => onUntil(event.target.value)} className="block max-w-full rounded-xl border bg-white p-3" />
      </label>
      <label className="flex items-start gap-2 leading-6">
        <input type="checkbox" checked={reviewed} onChange={(event) => onReviewed(event.target.checked)} className="mt-1" />
        Saklanan mali kayıtları, gerekçeyi ve son tarihi kontrol ettim. Bu açıklama tamamlanma bildirimine eklenecek.
      </label>
    </fieldset>
  );
}
