import assert from "node:assert/strict";
import { test } from "node:test";
const policy = (await import(
  new URL("../lib/account-deletion-preparation.ts", import.meta.url).href
)) as typeof import("../lib/account-deletion-preparation");
const requestId = "72a35519-75ab-44e5-8594-f35a514dd020";
const receipt = {
  id: "b988acba-5baf-4b2f-a226-aeece09bc2c9",
  request_id: requestId,
  user_id: 1756,
  request_revision: 2,
  scope_hash: "a".repeat(64),
  schema_revision: "b".repeat(64),
  prepared_at: "2026-10-10T11:00:00Z",
  current: true,
  completion_available: false,
};
const preview = {
  request_id: requestId,
  user_id: 1756,
  request_revision: 2,
  scope_hash: receipt.scope_hash,
  schema_revision: receipt.schema_revision,
  scope_available: true,
  can_prepare: true,
  completion_available: false,
  latest: receipt,
  notice: "Preparation does not delete the account.",
};
test("cross-account, stale revision and fabricated completion receipts are rejected", () => {
  assert.equal(
    policy.readPreparationReceipt(receipt, requestId, 1756, 2).current,
    true,
  );
  for (const change of [
    { user_id: 1758 },
    { request_id: receipt.id },
    { request_revision: 3 },
    { request_revision: 1 },
    { prepared_at: "invalid" },
    { scope_hash: "bad" },
    { completion_available: true },
    { id: "fake-success" },
  ])
    assert.throws(() =>
      policy.readPreparationReceipt(
        { ...receipt, ...change },
        requestId,
        1756,
        2,
      ),
    );
});
test("a saved seal cannot claim current when source schema or owner scope differs", () => {
  assert.equal(
    policy.readPreparationPreview(preview, requestId, 1756, 2).latest?.id,
    receipt.id,
  );
  for (const change of [
    { user_id: 1758 },
    { request_revision: 1 },
    { schema_revision: "c".repeat(64) },
    { scope_hash: "d".repeat(64) },
    { completion_available: true },
    { notice: "" },
  ])
    assert.throws(() =>
      policy.readPreparationPreview(
        { ...preview, ...change },
        requestId,
        1756,
        2,
      ),
    );
});
test("an unavailable current account preserves a stale receipt and forbids preparation", () => {
  const value = {
    ...preview,
    scope_available: false,
    scope_hash: null,
    can_prepare: false,
    latest: { ...receipt, current: false, request_revision: 1 },
  };
  assert.equal(
    policy.readPreparationPreview(value, requestId, 1756, 2).latest?.current,
    false,
  );
  assert.throws(() =>
    policy.readPreparationPreview(
      { ...value, can_prepare: true },
      requestId,
      1756,
      2,
    ),
  );
  assert.throws(() =>
    policy.readPreparationPreview(
      { ...value, latest: receipt },
      requestId,
      1756,
      2,
    ),
  );
});
