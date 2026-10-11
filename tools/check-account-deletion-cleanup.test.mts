import assert from "node:assert/strict";
import { test } from "node:test";
const {
  readCleanupVerification,
  readCompletionPreview,
  readCompletionReceipt,
} = (await import(
  new URL("../lib/account-deletion-cleanup.ts", import.meta.url).href
)) as typeof import("../lib/account-deletion-cleanup");

test("completion preview cannot open a closed or unverified operation", () => {
  const preview = {
    verification: report,
    verification_digest: null,
    can_complete: false,
    issuance_enabled: false,
    retention_disclosure: "Synthetic test disclosure.",
    requires_financial_review: false,
    latest: null,
  };
  assert.equal(readCompletionPreview(preview, id, 1756, 2).can_complete, false);
  assert.throws(() =>
    readCompletionPreview({ ...preview, can_complete: true }, id, 1756, 2),
  );
  assert.throws(() =>
    readCompletionPreview(
      { ...preview, verification_digest: "fake" },
      id,
      1756,
      2,
    ),
  );
  assert.throws(() =>
    readCompletionPreview(
      { ...preview, verification: { ...report, user_id: 1780 } },
      id,
      1756,
      2,
    ),
  );
});

test("completed receipt binds current request revision and actual delivery state", () => {
  const receipt = {
    completion_id: id,
    preparation_id: id,
    request_id: id,
    user_id: 1756,
    request_revision: 3,
    completed_at: "2026-10-11T04:00:00Z",
    confirmation_status: "queued",
  };
  assert.equal(
    readCompletionReceipt(receipt, id, 1756, 3).confirmation_status,
    "queued",
  );
  for (const patch of [
    { user_id: 1780 },
    { request_revision: 2 },
    { confirmation_status: "delivered" },
    { completed_at: "invalid" },
  ])
    assert.throws(() =>
      readCompletionReceipt({ ...receipt, ...patch }, id, 1756, 3),
    );
  const preview = {
    verification: null,
    verification_digest: null,
    latest: receipt,
    can_complete: false,
    issuance_enabled: false,
    retention_disclosure: "Synthetic test disclosure.",
    requires_financial_review: false,
  };
  assert.equal(
    readCompletionPreview(preview, id, 1756, 3).latest?.completion_id,
    id,
  );
  assert.throws(() =>
    readCompletionPreview({ ...preview, can_complete: true }, id, 1756, 3),
  );
});

const id = "ba270ffb-18dd-40f9-8fb7-e79a5eaa05bb";
const report = {
  request_id: id,
  user_id: 1756,
  request_revision: 2,
  inspected_at: "2026-10-11T01:00:00Z",
  preparation_id: null,
  rows: [],
  issues: [
    { code: "preparation_missing", label: "Hazırlık kaydı bulunamadı." },
  ],
  mapped_personal_records_clear: false,
  completion_available: false,
  notice: "Kontrol hesap silmez.",
};
test("financial review never bypasses personal, missing or modified record blockers", () => {
  const financial = {
    key: "invoices.user_id", group: "financial_review", label: "Faturalar", owner_linked: 0,
    sealed_records_remaining: 2, sealed_records_expected: 2, sealed_records_preserved: 2,
  };
  const verification = {
    ...report, preparation_id: id,
    rows: [{ key: "users.id", group: "identity", label: "Hesap", owner_linked: 0, sealed_records_remaining: 0 }, financial],
    issues: [{ code: "financial_retention_unverified", key: financial.key, label: "Saklama kararı gerekli." }],
  };
  const preview = {
    verification, verification_digest: "a".repeat(64), can_complete: true, issuance_enabled: true,
    requires_financial_review: true, retention_disclosure: "Synthetic test disclosure.", latest: null,
  };
  assert.equal(readCompletionPreview(preview, id, 1756, 2).can_complete, true);
  for (const patch of [
    { owner_linked: 1 }, { sealed_records_remaining: 1 }, { sealed_records_preserved: 1 },
    { sealed_records_preserved: null }, { sealed_records_expected: undefined },
  ]) assert.throws(() => readCompletionPreview({ ...preview, verification: {
    ...verification, rows: [verification.rows[0], { ...financial, ...patch }],
  } }, id, 1756, 2));
  for (const issue of [
    { code: "apple_revocation_unverified", label: "Apple iptali gerekli." },
    { code: "private_archive_remaining", label: "Arşiv kaldı." },
    { code: "financial_retention_unverified", key: "unsealed", label: "Kapsam uyuşmuyor." },
  ]) assert.throws(() => readCompletionPreview({ ...preview, verification: {
    ...verification, issues: [...verification.issues, issue],
  } }, id, 1756, 2));
  assert.throws(() => readCompletionPreview({ ...preview, requires_financial_review: false }, id, 1756, 2));
  assert.throws(() => readCompletionPreview({ ...preview, issuance_enabled: false }, id, 1756, 2));
});
test("another owner, request, revision or claimed completion cannot enter the current card", () => {
  assert.equal(
    readCleanupVerification(report, id, 1756, 2).issues[0].code,
    "preparation_missing",
  );
  for (const patch of [
    { user_id: 1758 },
    { request_revision: 1 },
    { request_id: "other" },
    { completion_available: true },
  ])
    assert.throws(() =>
      readCleanupVerification({ ...report, ...patch }, id, 1756, 2),
    );
});
test("a clean flag cannot override remaining records, missing preparation or blockers", () => {
  const clean = {
    ...report,
    preparation_id: id,
    issues: [],
    mapped_personal_records_clear: true,
    rows: [
      {
        key: "users.id",
        group: "identity",
        label: "Hesap",
        owner_linked: 0,
        sealed_records_remaining: 0,
      },
    ],
  };
  assert.equal(
    readCleanupVerification(clean, id, 1756, 2).mapped_personal_records_clear,
    true,
  );
  for (const patch of [
    { preparation_id: null },
    { issues: report.issues },
    { rows: [] },
    { rows: [{ ...clean.rows[0], owner_linked: 1 }] },
    { rows: [{ ...clean.rows[0], sealed_records_remaining: 1 }] },
    { rows: [{ ...clean.rows[0], owner_linked: null }] },
  ])
    assert.throws(() =>
      readCleanupVerification({ ...clean, ...patch }, id, 1756, 2),
    );
});
test("invalid counts and duplicate record sections fail closed", () => {
  const row = {
    key: "community_posts.user_id",
    group: "community",
    label: "Paylaşımlar",
    owner_linked: 0,
    sealed_records_remaining: 1,
  };
  for (const rows of [
    [{ ...row, sealed_records_remaining: -1 }],
    [{ ...row, owner_linked: 1.5 }],
    [row, row],
  ])
    assert.throws(() =>
      readCleanupVerification({ ...report, rows }, id, 1756, 2),
    );
});
