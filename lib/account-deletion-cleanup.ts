export type CleanupVerification = {
  request_id: string;
  user_id: number;
  request_revision: number;
  inspected_at: string;
  preparation_id: string | null;
  rows: {
    key: string;
    group: string;
    label: string;
    owner_linked: number | null;
    sealed_records_remaining: number;
    sealed_records_expected?: number;
    sealed_records_preserved?: number | null;
  }[];
  issues: { code: string; key?: string; label: string }[];
  mapped_personal_records_clear: boolean;
  completion_available: false;
  notice: string;
};

export type CompletionReceipt = {
  completion_id: string;
  request_id: string;
  preparation_id: string;
  user_id: number;
  request_revision: number;
  completed_at: string;
  confirmation_status: "queued" | "sending" | "accepted" | "failed" | null;
};
export type CompletionPreview = {
  verification: CleanupVerification | null;
  verification_digest: string | null;
  can_complete: boolean;
  issuance_enabled: boolean;
  retention_disclosure: string;
  requires_financial_review: boolean;
  latest: CompletionReceipt | null;
};
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const hash = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export function readCompletionReceipt(
  value: unknown,
  requestId: string,
  userId: number,
  revision: number,
): CompletionReceipt {
  const data = object(value);
  if (
    !uuid(data.completion_id) ||
    !uuid(data.preparation_id) ||
    data.request_id !== requestId ||
    data.user_id !== userId ||
    data.request_revision !== revision ||
    typeof data.completed_at !== "string" ||
    !Number.isFinite(Date.parse(data.completed_at)) ||
    ![null, "queued", "sending", "accepted", "failed"].includes(
      data.confirmation_status as string | null,
    )
  )
    throw new Error(
      "Tamamlanma kaydı güncel taleple eşleşmiyor. Listeyi yenile.",
    );
  return data as CompletionReceipt;
}

export function readCompletionPreview(
  value: unknown,
  requestId: string,
  userId: number,
  revision: number,
): CompletionPreview {
  const data = object(value);
  if (
    typeof data.can_complete !== "boolean" ||
    typeof data.issuance_enabled !== "boolean" ||
    typeof data.requires_financial_review !== "boolean" ||
    !text(data.retention_disclosure)
  )
    throw new Error("Tamamlanma kontrolü doğrulanamadı.");
  if (data.latest !== null) {
    readCompletionReceipt(data.latest, requestId, userId, revision);
    if (
      data.verification !== null ||
      data.verification_digest !== null ||
      data.can_complete || data.requires_financial_review
    )
      throw new Error("Tamamlanmış talep yeniden işleme açılamaz.");
  } else {
    const report = readCleanupVerification(
      data.verification,
      requestId,
      userId,
      revision,
    );
    const financialRequired = report.rows.some(
      (row) => row.group === "financial_review" && (row.sealed_records_expected ?? 0) > 0,
    );
    if (
      data.requires_financial_review !== financialRequired ||
      (report.preparation_id === null && data.verification_digest !== null) ||
      (report.preparation_id !== null && !hash(data.verification_digest)) ||
      (data.can_complete &&
        (!data.issuance_enabled || !completionReviewReady(report)))
    )
      throw new Error("Tamamlanma kapısı kontrol sonucuyla uyuşmuyor.");
  }
  return data as CompletionPreview;
}

function completionReviewReady(report: CleanupVerification): boolean {
  if (!report.preparation_id || !report.rows.length ||
    (!report.mapped_personal_records_clear && !report.issues.length)) return false;
  const financialKeys = new Set<string>();
  for (const row of report.rows) {
    if (row.owner_linked !== 0) return false;
    if (row.group === "financial_review") {
      if (!count(row.sealed_records_expected) ||
        row.sealed_records_preserved !== row.sealed_records_expected ||
        row.sealed_records_remaining !== row.sealed_records_expected) return false;
      if (row.sealed_records_expected! > 0) financialKeys.add(row.key);
    } else if (row.sealed_records_remaining !== 0) return false;
  }
  return report.rows.filter((row) => row.key === "users.id").length === 1 &&
    report.issues.every((issue) => issue.code === "financial_retention_unverified" &&
      !!issue.key && financialKeys.has(issue.key));
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Silme sonrası kontrol bilgileri doğrulanamadı.");
  return value as Record<string, unknown>;
}
const text = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" && value.length <= 2000;
const count = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;

export function readCleanupVerification(
  value: unknown,
  requestId: string,
  userId: number,
  revision: number,
): CleanupVerification {
  const data = object(value);
  if (
    data.request_id !== requestId ||
    data.user_id !== userId ||
    data.request_revision !== revision ||
    typeof data.inspected_at !== "string" ||
    !Number.isFinite(Date.parse(data.inspected_at)) ||
    (data.preparation_id !== null &&
      !(
        typeof data.preparation_id === "string" &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          data.preparation_id,
        )
      )) ||
    !Array.isArray(data.rows) ||
    !Array.isArray(data.issues) ||
    typeof data.mapped_personal_records_clear !== "boolean" ||
    data.completion_available !== false ||
    !text(data.notice)
  )
    throw new Error(
      "Kontrol başka talebe veya eski duruma ait. Listeyi yenile.",
    );
  const seen = new Set<string>();
  for (const raw of data.rows) {
    const row = object(raw);
    if (
      typeof row.key !== "string" ||
      !/^[a-z0-9_.]+$/.test(row.key) ||
      seen.has(row.key) ||
      !text(row.group) ||
      !text(row.label) ||
      (row.owner_linked !== null && !count(row.owner_linked)) ||
      !count(row.sealed_records_remaining)
      || (row.sealed_records_expected !== undefined && !count(row.sealed_records_expected))
      || (row.sealed_records_preserved !== undefined && row.sealed_records_preserved !== null && !count(row.sealed_records_preserved))
    )
      throw new Error("Kalan veri sayıları doğrulanamadı.");
    seen.add(row.key);
  }
  for (const raw of data.issues) {
    const issue = object(raw);
    if (
      !text(issue.code) ||
      !text(issue.label) ||
      (issue.key !== undefined &&
        (typeof issue.key !== "string" || !/^[a-z0-9_.]+$/.test(issue.key)))
    )
      throw new Error("Kontrol engelleri doğrulanamadı.");
  }
  if (
    data.mapped_personal_records_clear &&
    (data.preparation_id === null ||
      data.rows.length === 0 ||
      data.issues.length > 0 ||
      data.rows.some((raw) => {
        const row = object(raw);
        return row.owner_linked !== 0 || row.sealed_records_remaining !== 0;
      }))
  )
    throw new Error("Temizleme sonucu mevcut kayıtlarla uyuşmuyor.");
  return data as CleanupVerification;
}
