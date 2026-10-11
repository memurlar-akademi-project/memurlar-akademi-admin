import assert from "node:assert/strict";
import { test } from "node:test";
const policy = (await import(
  new URL("../lib/legacy-web-review.ts", import.meta.url).href
)) as typeof import("../lib/legacy-web-review");
const { AdminApiError, adminApiRequest } = (await import(
  new URL("../lib/admin-api.ts", import.meta.url).href
)) as typeof import("../lib/admin-api");

const baseline = {
  starts_at: "2026-01-01T00:00:00.123456Z",
  ends_at: "2027-01-01T00:00:00.123456Z",
};
const scopeValue = {
  status: "review_required",
  scope_hash: "a".repeat(64),
  membership_id: 7,
  user_id: 2,
  exam_id: 3,
  baseline,
  eligible_orders: [
    {
      id: 10,
      order_no: "QA-CURRENT",
      status: "completed",
      total_amount: "1599.00",
      ordered_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 11,
      order_no: "QA-PRIOR",
      status: "completed",
      total_amount: "799.00",
      ordered_at: "2025-01-01T00:00:00Z",
    },
  ],
  receipt: null,
  notice: "Source review notice.",
};
const receiptValue = {
  public_id: "dc2f94b4-3f5c-4c97-8e8e-5c91c00a8426",
  membership_id: 7,
  reviewed_at: "2026-10-10T10:00:00Z",
  reviewed_by: 1,
  allocations: [{ kind: "web", order_id: 10, grant_id: 9, ...baseline }],
  excluded_orders: [
    {
      order_id: 11,
      reason: "prior_period",
      starts_at: "2025-01-01T00:00:00Z",
      ends_at: baseline.starts_at,
      confirmed_no_access_source: true,
    },
  ],
};
test("server periods keep microseconds and do not become inferred payment drafts", () => {
  const scope = policy.parseLegacyReviewScope(scopeValue);
  assert.equal(scope.baseline.starts_at, baseline.starts_at);
  const draft = policy.reviewDraft(scope);
  assert.ok(
    draft.orders.every(
      (row) =>
        row.decision === "unreviewed" &&
        row.starts === "" &&
        row.ends === "" &&
        row.note === "",
    ),
  );
  assert.throws(() => policy.reviewSubmission(scope, draft, "operation"));
});
test("reviewed current and prior payments serialize with explicit no-source consent", () => {
  const scope = policy.parseLegacyReviewScope(scopeValue);
  const draft = policy.reviewDraft(scope);
  draft.confirmed = true;
  draft.evidence =
    "Retained supporting records confirm every source and preserved access period.";
  draft.orders[0] = {
    ...draft.orders[0],
    decision: "period",
    starts: baseline.starts_at,
    ends: baseline.ends_at,
    note: "Current invoice and retained entitlement proof.",
  };
  draft.orders[1] = {
    ...draft.orders[1],
    decision: "prior_period",
    starts: "2025-01-01T00:00:00Z",
    ends: baseline.starts_at,
    note: "Earlier invoice confirms a separate fully expired entitlement.",
  };
  const body = policy.reviewSubmission(scope, draft, "same-operation-key");
  assert.equal(body.request_key, "same-operation-key");
  assert.equal(body.allocations[0].starts_at, baseline.starts_at);
  assert.equal(body.excluded_orders[0].confirmed_no_access_source, true);
  assert.equal(body.excluded_orders[0].order_id, 11);
  assert.equal(body.allocations[0].order_id, 10);
  assert.ok(!("grant_id" in body.allocations[0]));
  assert.throws(() =>
    policy.reviewSubmission(
      scope,
      { ...draft, orders: [draft.orders[0], draft.orders[0]] },
      "operation",
    ),
  );
  assert.throws(() =>
    policy.reviewSubmission(
      scope,
      { ...draft, orders: [draft.orders[0]] },
      "operation",
    ),
  );
  assert.throws(() =>
    policy.reviewSubmission(scope, { ...draft, confirmed: false }, "operation"),
  );
  assert.throws(() =>
    policy.reviewSubmission(
      scope,
      {
        ...draft,
        orders: [{ ...draft.orders[0], openEnd: true }, draft.orders[1]],
      },
      "operation",
    ),
  );
});
test("source-outside payments preserve an explicitly entered independent period", () => {
  const scope = policy.parseLegacyReviewScope(scopeValue);
  const draft = policy.reviewDraft(scope);
  draft.confirmed = true;
  draft.evidence =
    "Retained evidence shows both payments are unrelated to independently granted access.";
  draft.orders = draft.orders.map((row) => ({
    ...row,
    decision: "not_baseline_source",
    note: "Explicit retained evidence confirms this payment supplies no baseline access.",
  }));
  assert.throws(() => policy.reviewSubmission(scope, draft, "operation"));
  draft.residuals = [
    {
      ...policy.emptyPeriod(),
      key: "residual-1",
      starts: baseline.starts_at,
      ends: baseline.ends_at,
      note: "Retained independent administrative grant evidence.",
    },
  ];
  const body = policy.reviewSubmission(scope, draft, "operation");
  assert.equal(body.allocations[0].kind, "residual");
  assert.equal(body.allocations[0].order_id, null);
  assert.ok(
    body.excluded_orders.every(
      (row) =>
        row.reason === "not_baseline_source" &&
        row.starts_at === null &&
        row.ends_at === null,
    ),
  );
});
test("unknown or inconsistent server receipts never become success", () => {
  assert.equal(
    policy.parseReviewReceipt(receiptValue).allocations[0].starts_at,
    baseline.starts_at,
  );
  for (const invalid of [
    { ...receiptValue, reviewed_at: null },
    { ...receiptValue, public_id: "broken" },
    { ...receiptValue, allocations: [] },
    {
      ...receiptValue,
      excluded_orders: [
        {
          ...receiptValue.excluded_orders[0],
          confirmed_no_access_source: false,
        },
      ],
    },
    {
      ...receiptValue,
      excluded_orders: [{ ...receiptValue.excluded_orders[0], order_id: 10 }],
    },
  ])
    assert.throws(() => policy.parseReviewReceipt(invalid));
  assert.throws(() =>
    policy.parseLegacyReviewScope({ ...scopeValue, receipt: receiptValue }),
  );
  assert.throws(() =>
    policy.parseLegacyReviewScope({
      ...scopeValue,
      status: "reconciled",
      receipt: { ...receiptValue, membership_id: 8 },
    }),
  );
  assert.throws(() =>
    policy.parseLegacyReviewScope({
      ...scopeValue,
      eligible_orders: [
        scopeValue.eligible_orders[0],
        scopeValue.eligible_orders[0],
      ],
    }),
  );
});
test("terminal financial states expose only supported next actions", () => {
  assert.deepEqual(policy.allowedOrderStatuses("refunded"), ["refunded"]);
  assert.deepEqual(policy.allowedOrderStatuses("completed"), [
    "completed",
    "refunded",
  ]);
  assert.ok(!policy.allowedOrderStatuses("pending").includes("refunded"));
});
test("explicit HTTP rejection carries a status while network uncertainty stays an ordinary error", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ success: false, message: "Scope changed." }),
        { status: 409 },
      );
    await assert.rejects(
      adminApiRequest("/unit/scope", {
        method: "POST",
        body: { request_key: "fixed" },
      }),
      (error) => error instanceof AdminApiError && error.status === 409,
    );
    globalThis.fetch = async () => {
      throw new TypeError("Network fixture");
    };
    await assert.rejects(
      adminApiRequest("/unit/scope", {
        method: "POST",
        body: { request_key: "fixed" },
      }),
      (error) => error instanceof Error && !(error instanceof AdminApiError),
    );
  } finally {
    globalThis.fetch = previous;
  }
});
