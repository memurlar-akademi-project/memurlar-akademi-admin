import assert from "node:assert/strict";
import test from "node:test";
const { deletionUserFilter } = (await import(
  new URL("../lib/account-deletion-request-filter.ts", import.meta.url).href
)) as typeof import("../lib/account-deletion-request-filter");

test("an absent filter keeps the general list; exact positive IDs scope the list", () => {
  assert.deepEqual(deletionUserFilter([]), { userId: null, invalid: false });
  assert.deepEqual(deletionUserFilter(["1758"]), {
    userId: 1758,
    invalid: false,
  });
});
test("malformed, ambiguous and unsafe owner links never fall back to all users", () => {
  for (const values of [
    [""],
    ["0"],
    ["-1"],
    ["1.5"],
    ["1e3"],
    [" 1758"],
    ["01758"],
    ["NaN"],
    ["9007199254740992"],
    ["1758", "1756"],
    ["1758", "1758"],
  ])
    assert.deepEqual(deletionUserFilter(values), {
      userId: null,
      invalid: true,
    });
});
