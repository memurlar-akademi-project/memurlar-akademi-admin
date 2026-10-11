export type ReviewPeriod = { starts_at: string | null; ends_at: string | null };
export type ReviewOrder = {
  id: number;
  order_no: string;
  status: "completed" | "refunded";
  total_amount: string;
  ordered_at: string | null;
};
export type ReviewReceipt = {
  public_id: string;
  membership_id: number;
  reviewed_at: string;
  reviewed_by: number;
  allocations: Array<
    ReviewPeriod & {
      kind: "web" | "residual";
      order_id: number | null;
      grant_id: number;
    }
  >;
  excluded_orders: Array<
    ReviewPeriod & {
      order_id: number;
      reason: "prior_period" | "not_baseline_source";
      confirmed_no_access_source: true;
    }
  >;
};
export type LegacyReviewScope = {
  status: "review_required" | "reconciled" | "unavailable";
  scope_hash: string;
  membership_id: number;
  user_id: number;
  exam_id: number;
  baseline: ReviewPeriod;
  eligible_orders: ReviewOrder[];
  receipt: ReviewReceipt | null;
  notice: string;
};
export type PeriodDraft = {
  starts: string;
  ends: string;
  openStart: boolean;
  openEnd: boolean;
  note: string;
};
export type OrderDraft = PeriodDraft & {
  orderId: number;
  decision: "unreviewed" | "period" | "prior_period" | "not_baseline_source";
};
export type ReviewDraft = {
  orders: OrderDraft[];
  residuals: Array<PeriodDraft & { key: string }>;
  evidence: string;
  confirmed: boolean;
};

const iso =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("İnceleme yanıtı doğrulanamadı.");
  return value as Record<string, unknown>;
}
function positive(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new Error("İnceleme kimliği doğrulanamadı.");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("İnceleme metni doğrulanamadı.");
  return value;
}
function date(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !iso.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("Dönem tarihi saat dilimiyle girilmeli.");
  return value; // Keep provider/database microseconds; Date.toISOString would truncate them.
}
function period(value: Record<string, unknown>): ReviewPeriod {
  return { starts_at: date(value.starts_at), ends_at: date(value.ends_at) };
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("İnceleme listesi doğrulanamadı.");
  return value;
}
export function parseReviewReceipt(value: unknown): ReviewReceipt {
  const item = object(value);
  const id = text(item.public_id);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new Error("Karar kimliği doğrulanamadı.");
  const allocations = list(item.allocations).map(
    (value): ReviewReceipt["allocations"][number] => {
      const row = object(value);
      if (row.kind !== "web" && row.kind !== "residual")
        throw new Error("Kaynak türü doğrulanamadı.");
      const order_id = row.kind === "web" ? positive(row.order_id) : null;
      if (row.kind === "residual" && row.order_id !== null)
        throw new Error("Kalan hak siparişe bağlı olamaz.");
      return {
        ...period(row),
        kind: row.kind,
        order_id,
        grant_id: positive(row.grant_id),
      };
    },
  );
  const excluded_orders = list(item.excluded_orders).map(
    (value): ReviewReceipt["excluded_orders"][number] => {
      const row = object(value);
      if (
        (row.reason !== "prior_period" &&
          row.reason !== "not_baseline_source") ||
        row.confirmed_no_access_source !== true
      )
        throw new Error("Kaynak dışı karar doğrulanamadı.");
      return {
        ...period(row),
        order_id: positive(row.order_id),
        reason: row.reason,
        confirmed_no_access_source: true as const,
      };
    },
  );
  const ids = [
    ...allocations.flatMap((row) =>
      row.order_id === null ? [] : [row.order_id],
    ),
    ...excluded_orders.map((row) => row.order_id),
  ];
  if (new Set(ids).size !== ids.length || allocations.length === 0)
    throw new Error("Kararda tekrar eden veya eksik kaynak var.");
  const reviewed_at = date(item.reviewed_at);
  if (reviewed_at === null) throw new Error("Karar tarihi eksik.");
  return {
    public_id: id,
    membership_id: positive(item.membership_id),
    reviewed_by: positive(item.reviewed_by),
    reviewed_at,
    allocations,
    excluded_orders,
  };
}
export function parseLegacyReviewScope(value: unknown): LegacyReviewScope {
  const item = object(value);
  if (
    item.status !== "review_required" &&
    item.status !== "reconciled" &&
    item.status !== "unavailable"
  )
    throw new Error("İnceleme durumu doğrulanamadı.");
  if (
    typeof item.scope_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(item.scope_hash)
  )
    throw new Error("İnceleme sürümü doğrulanamadı.");
  const eligible_orders = list(item.eligible_orders).map(
    (value): ReviewOrder => {
      const row = object(value);
      if (row.status !== "completed" && row.status !== "refunded")
        throw new Error("Sipariş incelemeye uygun değil.");
      return {
        id: positive(row.id),
        order_no: text(row.order_no),
        status: row.status,
        total_amount: text(row.total_amount),
        ordered_at: date(row.ordered_at),
      };
    },
  );
  if (
    new Set(eligible_orders.map((row) => row.id)).size !==
    eligible_orders.length
  )
    throw new Error("Sipariş listesi tekrar ediyor.");
  const receipt =
    item.receipt === null ? null : parseReviewReceipt(item.receipt);
  const membership_id = positive(item.membership_id);
  if (
    (item.status === "reconciled") !== (receipt !== null) ||
    (receipt && receipt.membership_id !== membership_id)
  )
    throw new Error("İnceleme makbuzu bu üyeliğe ait değil.");
  return {
    status: item.status,
    scope_hash: item.scope_hash,
    membership_id,
    user_id: positive(item.user_id),
    exam_id: positive(item.exam_id),
    baseline: period(object(item.baseline)),
    eligible_orders,
    receipt,
    notice: text(item.notice),
  };
}
export function emptyPeriod(): PeriodDraft {
  return { starts: "", ends: "", openStart: false, openEnd: false, note: "" };
}
export function reviewDraft(scope: LegacyReviewScope): ReviewDraft {
  return {
    orders: scope.eligible_orders.map((order) => ({
      ...emptyPeriod(),
      orderId: order.id,
      decision: "unreviewed",
    })),
    residuals: [],
    evidence: "",
    confirmed: false,
  };
}
function periodBody(draft: PeriodDraft, baseline: ReviewPeriod, prior = false) {
  if (
    (!prior && draft.openStart && baseline.starts_at !== null) ||
    (!prior && draft.openEnd && baseline.ends_at !== null) ||
    (prior && (draft.openStart || draft.openEnd))
  )
    throw new Error("Bu dönem için açık uç kullanılamaz.");
  const starts_at = draft.openStart ? null : date(draft.starts.trim());
  const ends_at = draft.openEnd ? null : date(draft.ends.trim());
  const note = draft.note.trim();
  if (note.length < (prior ? 30 : 20) || note.length > 1000)
    throw new Error("Her dönem için açıklayıcı kanıt notu gerekli.");
  return { starts_at, ends_at, note };
}
export function reviewSubmission(
  scope: LegacyReviewScope,
  draft: ReviewDraft,
  requestKey: string,
) {
  if (
    scope.status !== "review_required" ||
    !draft.confirmed ||
    draft.evidence.trim().length < 30 ||
    draft.evidence.trim().length > 3000
  )
    throw new Error("İnceleme kanıtını ve açık onayı tamamlayın.");
  const expected = scope.eligible_orders.map((order) => order.id);
  if (
    draft.orders.length !== expected.length ||
    new Set(draft.orders.map((row) => row.orderId)).size !== expected.length ||
    draft.orders.some((row) => !expected.includes(row.orderId))
  )
    throw new Error("Tüm siparişler bir kez incelenmeli.");
  const allocations = draft.orders
    .filter((row) => row.decision === "period")
    .map((row) => ({
      kind: "web" as const,
      order_id: row.orderId,
      ...periodBody(row, scope.baseline),
    }));
  const residuals = draft.residuals.map((row) => ({
    kind: "residual" as const,
    order_id: null,
    ...periodBody(row, scope.baseline),
  }));
  const excluded_orders = draft.orders
    .filter((row) => row.decision !== "period")
    .map((row) => {
      if (row.decision === "unreviewed")
        throw new Error("Her siparişin dönem veya kaynak dışı kararını seçin.");
      if (row.decision === "prior_period")
        return {
          order_id: row.orderId,
          reason: row.decision,
          ...periodBody(row, scope.baseline, true),
          confirmed_no_access_source: true as const,
        };
      const note = row.note.trim();
      if (note.length < 30 || note.length > 1000)
        throw new Error("Kaynak dışı karar için kanıt notu gerekli.");
      return {
        order_id: row.orderId,
        reason: "not_baseline_source" as const,
        starts_at: null,
        ends_at: null,
        note,
        confirmed_no_access_source: true as const,
      };
    });
  if (!allocations.length && !residuals.length)
    throw new Error(
      "Eski dönemin tamamını kapsayan ödeme veya ayrı kalan hak gerekli.",
    );
  return {
    request_key: requestKey,
    scope_hash: scope.scope_hash,
    evidence_note: draft.evidence.trim(),
    allocations: [...allocations, ...residuals],
    excluded_orders,
  };
}

export function allowedOrderStatuses(current: string): string[] {
  return current === "refunded"
    ? ["refunded"]
    : current === "completed"
      ? ["completed", "refunded"]
      : ["pending", "completed", "failed", "cancelled"];
}
