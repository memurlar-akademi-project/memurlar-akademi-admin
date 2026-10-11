export type DeletionScopeRow = {
  key: string;
  table: string | null;
  column: string | null;
  group: string;
  label: string;
  count: number | null;
  delete_rule: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION" | null;
  relation: "direct" | "dependent" | "reference" | "email" | "file";
};
export type DeletionScope = {
  request_id: string;
  user_id: number;
  request_revision: number;
  inspected_at: string;
  schema_revision: string;
  account_exists: boolean;
  rows: DeletionScopeRow[];
  groups: { id: string; label: string }[];
  issues: { code: string; label: string }[];
  completion_available: false;
  notice: string;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Kapsam bilgileri doğrulanamadı.");
  return value as Record<string, unknown>;
};
const text = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;
export function readDeletionScope(
  value: unknown,
  requestId: string,
  userId: number,
  revision: number,
): DeletionScope {
  const data = record(value);
  if (
    data.request_id !== requestId ||
    data.user_id !== userId ||
    data.request_revision !== revision ||
    typeof data.inspected_at !== "string" ||
    !Number.isFinite(Date.parse(data.inspected_at)) ||
    typeof data.schema_revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.schema_revision) ||
    typeof data.account_exists !== "boolean" ||
    data.completion_available !== false ||
    !text(data.notice) ||
    !Array.isArray(data.rows) ||
    !Array.isArray(data.groups) ||
    !Array.isArray(data.issues)
  )
    throw new Error(
      "Kapsam başka bir talebe veya eski duruma ait. Listeyi yenile.",
    );
  const groups = data.groups.map(record),
    rows = data.rows.map(record),
    issues = data.issues.map(record);
  const ids = new Set(groups.map((group) => group.id));
  if (
    groups.length === 0 ||
    ids.size !== groups.length ||
    groups.some((group) => !text(group.id) || !text(group.label)) ||
    new Set(rows.map((row) => row.key)).size !== rows.length ||
    rows.some(
      (row) =>
        !text(row.key) ||
        !text(row.label) ||
        !ids.has(row.group) ||
        (row.table !== null && !text(row.table)) ||
        (row.column !== null && !text(row.column)) ||
        (row.count !== null &&
          (!Number.isSafeInteger(row.count) || Number(row.count) < 0)) ||
        ![null, "CASCADE", "SET NULL", "RESTRICT", "NO ACTION"].includes(
          row.delete_rule as DeletionScopeRow["delete_rule"],
        ) ||
        !["direct", "dependent", "reference", "email", "file"].includes(
          String(row.relation),
        ),
    ) ||
    issues.some((issue) => !text(issue.code) || !text(issue.label))
  )
    throw new Error("Kapsam satırları doğrulanamadı.");
  return data as DeletionScope;
}
