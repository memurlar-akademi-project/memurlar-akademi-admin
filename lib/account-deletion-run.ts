import type { PreparationPreview } from "./account-deletion-preparation";
import type { DeletionScope } from "./account-deletion-scope";

export const cleanupPhases = {
  frozen: "Hesap donduruldu",
  sealed: "İşlem kapsamı kaydedildi",
  files_cleared: "Kişisel dosyalar kaldırıldı",
  records_cleared: "Kişisel kayıtlar kaldırıldı",
  verified: "Silme sonucu doğrulandı",
  completed: "Tamamlanma kaydı oluşturuldu",
} as const;
export type CleanupRun = {
  id: string;
  request_id: string;
  user_id: number;
  request_revision: number;
  phase: keyof typeof cleanupPhases;
  attempts: number;
  failure_code: string | null;
  started_at: string;
  last_attempt_at: string | null;
  completed_at: string | null;
  completion_available: false;
};
export type CleanupRunPreview = {
  request_id: string;
  user_id: number;
  request_revision: number;
  startup_enabled: boolean;
  execution_enabled: boolean;
  run: CleanupRun | null;
  completion_available: false;
};
export type CleanupStartInput = {
  request_key: string;
  expected_revision: number;
  preparation_id: string;
  scope_hash: string;
  background_jobs_reviewed: true;
  community_records_reviewed: boolean;
  financial_retention_reviewed: boolean;
  retention_basis: string | null;
  retention_until: string | null;
};
export type CleanupReview = {
  backgroundReviewed: boolean;
  communityReviewed: boolean;
  financialReviewed: boolean;
  retentionBasis: string;
  retentionUntil: string;
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Temizleme işlem bilgileri doğrulanamadı.");
  return value as Record<string, unknown>;
};
const uuid = (value: unknown) => typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;

export function readCleanupRun(value: unknown, requestId: string, userId: number, revision: number): CleanupRun {
  const data = object(value);
  if (!uuid(data.id) || data.request_id !== requestId || data.user_id !== userId ||
    !count(data.request_revision) || data.request_revision !== revision ||
    typeof data.phase !== "string" || !Object.hasOwn(cleanupPhases, data.phase) ||
    !count(data.attempts) || !date(data.started_at) ||
    (data.last_attempt_at !== null && !date(data.last_attempt_at)) ||
    (data.failure_code !== null && (typeof data.failure_code !== "string" || !/^[a-z0-9_]{1,100}$/.test(data.failure_code))) ||
    (data.completed_at !== null && !date(data.completed_at)) ||
    (data.phase === "completed") !== (data.completed_at !== null) || data.completion_available !== false)
    throw new Error("İşlem başka hesaba, talebe veya eski duruma ait. Listeyi yenile.");
  return data as CleanupRun;
}

export function readCleanupRunPreview(value: unknown, requestId: string, userId: number, revision: number): CleanupRunPreview {
  const data = object(value);
  if (data.request_id !== requestId || data.user_id !== userId || data.request_revision !== revision ||
    typeof data.startup_enabled !== "boolean" || typeof data.execution_enabled !== "boolean" || data.completion_available !== false)
    throw new Error("Temizleme durumu güncel taleple eşleşmiyor. Listeyi yenile.");
  let run: CleanupRun | null = null;
  if (data.run !== null) {
    const raw = object(data.run);
    // A later completion revision does not replace the immutable startup revision.
    if (!count(raw.request_revision) || Number(raw.request_revision) > revision || Number(raw.request_revision) < 1)
      throw new Error("Temizleme başlangıcı talep geçmişiyle eşleşmiyor.");
    run = readCleanupRun(raw, requestId, userId, Number(raw.request_revision));
  }
  return { ...(data as CleanupRunPreview), run };
}

export function cleanupResumeInput(preview: CleanupRunPreview): { run_id: string; expected_revision: number } {
  if (!preview.execution_enabled || !preview.run || preview.run.phase === "completed")
    throw new Error("İşlem çalıştırmaya açık değil. Güncel durumu kontrol et.");
  return { run_id: preview.run.id, expected_revision: preview.request_revision };
}

const communityKeys = new Set([
  "community_comments.community_post_id", "community_content_reports.target_id_post", "community_content_reports.target_id_comment",
]);
export function cleanupRequirements(scope: DeletionScope) {
  const present = scope.rows.filter((row) => row.count !== 0);
  return {
    financial: present.some((row) => row.group === "financial_review"),
    community: present.some((row) => row.group === "manual_review" && communityKeys.has(row.key)),
    blockers: [
      ...scope.issues.filter((issue) => !["community_content_survives", "apple_authorization_pending"].includes(issue.code)).map((issue) => issue.label),
      ...present.filter((row) => row.count === null || (row.group === "manual_review" && !communityKeys.has(row.key))).map((row) => `${row.label}: ek inceleme gerekiyor.`),
    ],
  };
}

export function cleanupStartInput(
  preview: CleanupRunPreview, preparation: PreparationPreview, scope: DeletionScope,
  review: CleanupReview, requestKey: string, today: string,
): CleanupStartInput {
  const same = (value: {request_id: string; user_id: number; request_revision: number}) =>
    value.request_id === preview.request_id && value.user_id === preview.user_id && value.request_revision === preview.request_revision;
  const seal = preparation.latest;
  if (!uuid(requestKey) || !preview.startup_enabled || preview.run || !same(preparation) || !same(scope) ||
    !scope.account_exists || !preparation.can_prepare || !preparation.scope_available ||
    !seal?.current || seal.request_id !== preview.request_id || seal.user_id !== preview.user_id ||
    seal.request_revision !== preview.request_revision || seal.scope_hash !== preparation.scope_hash ||
    seal.schema_revision !== preparation.schema_revision)
    throw new Error("İşleme başlamadan güncel hazırlık ve kapsam kontrolü gerekiyor.");
  const needs = cleanupRequirements(scope);
  if (needs.blockers.length || !review.backgroundReviewed || (needs.community && !review.communityReviewed))
    throw new Error("Gerekli incelemeleri tamamlayıp arka plan işlerini kontrol et.");
  const until = review.retentionUntil;
  const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(until) && date(`${until}T00:00:00Z`) &&
    new Date(`${until}T00:00:00Z`).toISOString().slice(0, 10) === until && until >= today;
  if (needs.financial && (!review.financialReviewed || !review.retentionBasis.trim() ||
    [...review.retentionBasis.trim()].length > 2000 || !validUntil))
    throw new Error("Mali saklama gerekçesi, son tarih ve inceleme onayı gerekiyor.");
  return {
    request_key: requestKey, expected_revision: preview.request_revision, preparation_id: seal.id,
    scope_hash: seal.scope_hash, background_jobs_reviewed: true,
    community_records_reviewed: needs.community && review.communityReviewed,
    financial_retention_reviewed: needs.financial && review.financialReviewed,
    retention_basis: needs.financial ? review.retentionBasis.trim() : null,
    retention_until: needs.financial ? until : null,
  };
}
