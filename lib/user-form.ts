import type { AdminUser } from "./types";

export type UserFormValues = {
  name: string;
  email: string;
  password: string;
  status: "active" | "passive";
  exam_ids: number[];
  active_exam_id: number | null;
  membership_type: "preserve" | "free" | "paid";
  membership_status: "active" | "passive";
};

export function userFormValues(user: AdminUser): UserFormValues {
  const memberships = user.memberships?.length
    ? user.memberships
    : user.membership ? [{ ...user.membership, id: 0, is_selected: true }] : [];
  const examIds = memberships.map((membership) => membership.exam?.id)
    .filter((id): id is number => typeof id === "number");

  return {
    name: user.name, email: user.email, password: "", status: user.status,
    exam_ids: examIds,
    active_exam_id: memberships.find((membership) => membership.is_selected)?.exam?.id ?? examIds[0] ?? null,
    membership_type: "preserve",
    membership_status: user.membership?.status === "passive" ? "passive" : "active",
  };
}

/** Keep purchase-derived access separate from explicit panel commands. */
export function userFormSubmission(form: UserFormValues, original: AdminUser | null) {
  const baseline = original ? userFormValues(original) : null;
  const body: Record<string, string | number | number[] | undefined> = {};
  for (const field of ["name", "email", "status", "membership_status"] as const) {
    if (!baseline || form[field] !== baseline[field]) body[field] = form[field];
  }
  if (form.password) body.password = form.password;
  if (form.membership_type !== "preserve") body.membership_type = form.membership_type;
  const ids = [...new Set(form.exam_ids)].sort((a, b) => a - b);
  const originalIds = baseline ? [...new Set(baseline.exam_ids)].sort((a, b) => a - b) : [];
  if (!baseline || form.active_exam_id !== baseline.active_exam_id || JSON.stringify(ids) !== JSON.stringify(originalIds)) {
    body.exam_ids = ids;
    body.active_exam_id = form.active_exam_id ?? undefined;
  }
  return body;
}
