/** Invalid or ambiguous deep links must never silently display another owner. */
export function deletionUserFilter(
  values: readonly string[],
): { userId: number | null; invalid: false } | { userId: null; invalid: true } {
  if (!values.length) return { userId: null, invalid: false };
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0]))
    return { userId: null, invalid: true };
  const userId = Number(values[0]);
  return Number.isSafeInteger(userId)
    ? { userId, invalid: false }
    : { userId: null, invalid: true };
}
