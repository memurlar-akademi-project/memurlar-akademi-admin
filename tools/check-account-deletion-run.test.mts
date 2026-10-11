import assert from "node:assert/strict";
import { test } from "node:test";
import type { PreparationPreview } from "../lib/account-deletion-preparation";
import type { DeletionScope } from "../lib/account-deletion-scope";
import type { CleanupReview, CleanupRunPreview } from "../lib/account-deletion-run";
const policy = await import(new URL("../lib/account-deletion-run.ts", import.meta.url).href) as typeof import("../lib/account-deletion-run");

const requestId = "e0f21392-6261-41a4-9d8f-9800aa01f399";
const key = "2025ee3c-1835-4c12-9f24-4519a7f38f5d";
const preview: CleanupRunPreview = { request_id: requestId, user_id: 5016, request_revision: 2, startup_enabled: true, execution_enabled: false, run: null, completion_available: false };
const preparation: PreparationPreview = {
  request_id: requestId, user_id: 5016, request_revision: 2, scope_hash: "a".repeat(64), schema_revision: "b".repeat(64),
  scope_available: true, can_prepare: true, completion_available: false, notice: "Test preparation",
  latest: { id: key, request_id: requestId, user_id: 5016, request_revision: 2, scope_hash: "a".repeat(64), schema_revision: "b".repeat(64), prepared_at: "2026-10-11T04:00:00Z", current: true, completion_available: false },
};
const scope: DeletionScope = {
  request_id: requestId, user_id: 5016, request_revision: 2, inspected_at: "2026-10-11T04:00:00Z", schema_revision: "b".repeat(64),
  account_exists: true, rows: [], groups: [{ id: "identity", label: "Identity" }], issues: [], completion_available: false, notice: "Test scope",
};
const review: CleanupReview = { backgroundReviewed: true, communityReviewed: false, financialReviewed: false, retentionBasis: "", retentionUntil: "" };
const run = { id: key, request_id: requestId, user_id: 5016, request_revision: 3, phase: "frozen", attempts: 0, failure_code: null, started_at: "2026-10-11T04:00:00Z", last_attempt_at: null, completed_at: null, completion_available: false };
const row = (key: string, group: string, count: number | null = 1) => ({ key, group, count, label: "Test records", table: "test_records", column: "user_id", delete_rule: null, relation: "direct" as const });

test("startup receipts bind owner, request and revision; freezing never claims completion", () => {
  assert.equal(policy.readCleanupRun(run, requestId, 5016, 3).phase, "frozen");
  for (const patch of [{ user_id: 1780 }, { request_id: key }, { request_revision: 2 }, { phase: "unknown" },
    { phase: "toString" }, { attempts: -1 }, { attempts: 1.5 }, { started_at: "bad" }, { failure_code: "<private error>" },
    { completed_at: run.started_at }, { completion_available: true }])
    assert.throws(() => policy.readCleanupRun({ ...run, ...patch }, requestId, 5016, 3));
  assert.throws(() => policy.readCleanupRun({ ...run, phase: "completed" }, requestId, 5016, 3));
  assert.equal(policy.readCleanupRun({ ...run, phase: "completed", completed_at: run.started_at }, requestId, 5016, 3).phase, "completed");
});

test("closed startup preserves an existing run and its original revision after completion", () => {
  const started = { ...preview, request_revision: 3, startup_enabled: false, run };
  assert.equal(policy.readCleanupRunPreview(started, requestId, 5016, 3).run?.id, key);
  assert.equal(policy.readCleanupRunPreview({ ...started, request_revision: 4 }, requestId, 5016, 4).run?.request_revision, 3);
  for (const patch of [{ user_id: 1780 }, { request_revision: 2 }, { run: { ...run, user_id: 1780 } }, { run: { ...run, request_revision: 4 } }, { completion_available: true }])
    assert.throws(() => policy.readCleanupRunPreview({ ...started, ...patch }, requestId, 5016, 3));
});

test("startup requires current matching preparation and cannot create another operation", () => {
  const input = policy.cleanupStartInput(preview, preparation, scope, review, key, "2026-10-11");
  assert.equal(input.request_key, key);
  assert.equal(input.preparation_id, preparation.latest!.id);
  assert.equal(input.financial_retention_reviewed, false);
  assert.equal(input.retention_basis, null);
  for (const patch of [{ startup_enabled: false }, { run }, { user_id: 1780 }, { request_revision: 3 }])
    assert.throws(() => policy.cleanupStartInput({ ...preview, ...patch } as CleanupRunPreview, preparation, scope, review, key, "2026-10-11"));
  for (const patch of [{ can_prepare: false }, { scope_available: false }, { latest: { ...preparation.latest!, current: false } }, { latest: { ...preparation.latest!, user_id: 1780 } }, { scope_hash: "c".repeat(64) }])
    assert.throws(() => policy.cleanupStartInput(preview, { ...preparation, ...patch }, scope, review, key, "2026-10-11"));
  // The scope and preparation hashes cover different metadata and are intentionally different.
  assert.equal(policy.cleanupStartInput(preview, preparation, { ...scope, schema_revision: "c".repeat(64) }, review, key, "2026-10-11").preparation_id, preparation.latest!.id);
  for (const patch of [{ account_exists: false }, { user_id: 1780 }])
    assert.throws(() => policy.cleanupStartInput(preview, preparation, { ...scope, ...patch }, review, key, "2026-10-11"));
});

test("community approval only covers defined dependent records, not arbitrary actor records", () => {
  const comments = { ...scope, rows: [row("community_comments.community_post_id", "manual_review")] };
  assert.throws(() => policy.cleanupStartInput(preview, preparation, comments, review, key, "2026-10-11"));
  assert.equal(policy.cleanupStartInput(preview, preparation, comments, { ...review, communityReviewed: true }, key, "2026-10-11").community_records_reviewed, true);
  for (const rows of [[row("support_requests.reviewed_by", "manual_review")], [row("unknown.user_id", "profile", null)]])
    assert.throws(() => policy.cleanupStartInput(preview, preparation, { ...scope, rows }, { ...review, communityReviewed: true }, key, "2026-10-11"));
  assert.throws(() => policy.cleanupStartInput(preview, preparation, scope, { ...review, backgroundReviewed: false }, key, "2026-10-11"));
});

test("financial decision rejects missing, expired and impossible dates without inventing policy", () => {
  const financial = { ...scope, rows: [row("invoices.user_id", "financial_review")] };
  const decision = { ...review, financialReviewed: true, retentionBasis: "  Reviewed test policy  ", retentionUntil: "2027-10-11" };
  const input = policy.cleanupStartInput(preview, preparation, financial, decision, key, "2026-10-11");
  assert.equal(input.retention_basis, "Reviewed test policy");
  assert.equal(input.financial_retention_reviewed, true);
  for (const patch of [{ financialReviewed: false }, { retentionBasis: " " }, { retentionUntil: "2026-10-10" }, { retentionUntil: "2027-02-30" }, { retentionUntil: "invalid" }])
    assert.throws(() => policy.cleanupStartInput(preview, preparation, financial, { ...decision, ...patch }, key, "2026-10-11"));
  // Previously typed decisions must not leak into a later scope with no fiscal rows.
  assert.equal(policy.cleanupStartInput(preview, preparation, scope, decision, key, "2026-10-11").retention_basis, null);
});

test("unknown scope blockers cannot be acknowledged away", () => {
  const issues = [{ code: "apple_authorization_pending", label: "Provider stage pending" }, { code: "community_content_survives", label: "Community stage pending" }];
  assert.equal(policy.cleanupRequirements({ ...scope, issues }).blockers.length, 0);
  assert.throws(() => policy.cleanupStartInput(preview, preparation, { ...scope, issues: [...issues, { code: "unknown_reference", label: "Inspect unknown relation" }] }, { ...review, communityReviewed: true }, key, "2026-10-11"));
});

test("resume uses the existing run and current request revision without creating a new approval", () => {
  const started = policy.readCleanupRunPreview({ ...preview, request_revision: 3, execution_enabled: true, run }, requestId, 5016, 3);
  assert.deepEqual(policy.cleanupResumeInput(started), { run_id: key, expected_revision: 3 });
  for (const patch of [{ execution_enabled: false }, { run: null }, { run: { ...started.run!, phase: "completed" as const, completed_at: run.started_at } }])
    assert.throws(() => policy.cleanupResumeInput({ ...started, ...patch }));
  assert.throws(() => policy.readCleanupRunPreview({ ...preview, execution_enabled: "yes" }, requestId, 5016, 2));
});
