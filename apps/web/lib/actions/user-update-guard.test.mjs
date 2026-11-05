import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALLOWED_USER_UPDATE_KEYS,
  isUserUpdateAllowed,
} from "./user-update-guard.ts";

test("allows scalars and legitimate relations", () => {
  assert.equal(
    isUserUpdateAllowed({
      firstName: "Anna",
      lastName: "Rivers",
      roles: { set: [{ id: 1 }] },
    }),
    true,
  );
});

test("rejects emailVerified/deletedAt/pwdReset", () => {
  assert.equal(isUserUpdateAllowed({ emailVerified: true }), false);
  assert.equal(isUserUpdateAllowed({ deletedAt: new Date() }), false);
  assert.equal(isUserUpdateAllowed({ pwdReset: true }), false);
});

test("rejects direct email (login change requires re-verification)", () => {
  assert.equal(isUserUpdateAllowed({ email: "new@x.com" }), false);
});

test("ALLOWED doesn't contain sensitive fields", () => {
  for (const k of ["emailVerified", "deletedAt", "pwdReset"]) {
    assert.ok(!ALLOWED_USER_UPDATE_KEYS.includes(k));
  }
});
