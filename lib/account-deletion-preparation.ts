export type PreparationReceipt = {
  id: string;
  request_id: string;
  user_id: number;
  request_revision: number;
  scope_hash: string;
  schema_revision: string;
  prepared_at: string;
  current: boolean;
  completion_available: false;
};
export type PreparationPreview = {
  request_id: string;
  user_id: number;
  request_revision: number;
  scope_hash: string | null;
  schema_revision: string;
  scope_available: boolean;
  can_prepare: boolean;
  completion_available: false;
  latest: PreparationReceipt | null;
  notice: string;
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Hazırlık bilgileri doğrulanamadı.");
  return value as Record<string, unknown>;
};
const hash = (value: unknown) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function readPreparationReceipt(
  value: unknown,
  requestId: string,
  userId: number,
  revision: number,
): PreparationReceipt {
  const data = object(value);
  if (
    !uuid(data.id) ||
    data.request_id !== requestId ||
    data.user_id !== userId ||
    !Number.isSafeInteger(data.request_revision) ||
    Number(data.request_revision) < 0 ||
    Number(data.request_revision) > revision ||
    !hash(data.scope_hash) ||
    !hash(data.schema_revision) ||
    typeof data.prepared_at !== "string" ||
    !Number.isFinite(Date.parse(data.prepared_at)) ||
    typeof data.current !== "boolean" ||
    (data.current && data.request_revision !== revision) ||
    data.completion_available !== false
  )
    throw new Error(
      "Hazırlık kaydı başka talebe veya doğrulanamayan duruma ait.",
    );
  return data as PreparationReceipt;
}
export function readPreparationPreview(
  value: unknown,
  requestId: string,
  userId: number,
  revision: number,
): PreparationPreview {
  const data = object(value);
  if (
    data.request_id !== requestId ||
    data.user_id !== userId ||
    data.request_revision !== revision ||
    !hash(data.schema_revision) ||
    typeof data.scope_available !== "boolean" ||
    typeof data.can_prepare !== "boolean" ||
    (data.scope_available
      ? !hash(data.scope_hash)
      : data.scope_hash !== null) ||
    (!data.scope_available && data.can_prepare) ||
    data.completion_available !== false ||
    typeof data.notice !== "string" ||
    data.notice.trim() === ""
  )
    throw new Error("Hazırlık kapsamı değişmiş. Listeyi yenile.");
  const latest =
    data.latest === null
      ? null
      : readPreparationReceipt(data.latest, requestId, userId, revision);
  if (
    latest?.current &&
    (!data.scope_available ||
      latest.scope_hash !== data.scope_hash ||
      latest.schema_revision !== data.schema_revision)
  )
    throw new Error("Hazırlık kaydı güncel kapsamla uyuşmuyor.");
  return { ...(data as PreparationPreview), latest };
}
