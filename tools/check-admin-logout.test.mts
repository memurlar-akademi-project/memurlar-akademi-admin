import assert from "node:assert/strict";
import test from "node:test";
const { endAdminSession } = (await import(
  new URL("../lib/admin-logout.ts", import.meta.url).href
)) as typeof import("../lib/admin-logout");

test("local credentials clear before server work and revocation uses only the captured token", async () => {
  const events: string[] = [];
  const result = await endAdminSession(
    "old-test-token",
    () => events.push("clear"),
    async (token) => {
      assert.deepEqual(events, ["clear"]);
      assert.equal(token, "old-test-token");
      events.push("revoke");
    },
  );
  assert.equal(result, true);
  assert.deepEqual(events, ["clear", "revoke"]);
});

test("failed revocation still clears this device and does not claim server success", async () => {
  let clearCount = 0;
  assert.equal(
    await endAdminSession(
      "old-test-token",
      () => clearCount++,
      async () => {
        throw Error("offline");
      },
    ),
    false,
  );
  assert.equal(clearCount, 1);
});

test("a late server result cannot clear a newer session", async () => {
  let current = "old-test-token",
    release!: () => void;
  const pending = endAdminSession(
    current,
    () => {
      current = "";
    },
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  current = "new-test-token";
  release();
  assert.equal(await pending, true);
  assert.equal(current, "new-test-token");
});

test("an absent local token clears local state without an anonymous server request", async () => {
  let cleared = false;
  assert.equal(
    await endAdminSession(
      null,
      () => {
        cleared = true;
      },
      async () => {
        assert.fail("must not call server");
      },
    ),
    true,
  );
  assert.equal(cleared, true);
});
