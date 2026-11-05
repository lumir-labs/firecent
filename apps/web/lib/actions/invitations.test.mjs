import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INVITE_ROLES,
  invitationStatusOf,
  isDuplicateMemberError,
  parseInviteInput,
} from "./invitation-helpers.ts";

test("member/admin/owner role valid, empty rejected", () => {
  assert.deepEqual(INVITE_ROLES, ["member", "admin", "owner"]);
  assert.ok(parseInviteInput({ email: "a@x.com", role: "member" }).ok);
  assert.ok(!parseInviteInput({ email: "a@x.com", role: "" }).ok);
  assert.ok(!parseInviteInput({ email: "no-email", role: "member" }).ok);
});

test("unique P2002 error is detected as a duplicate member", () => {
  assert.equal(
    isDuplicateMemberError({ code: "P2002", meta: { target: ["organizationId", "userId"] } }),
    true,
  );
  assert.equal(isDuplicateMemberError(new Error("boom")), false);
});

test("statusOf: expired, revoked/canceled, accepted, pending", () => {
  const past = new Date(Date.now() - 1000);
  const future = new Date(Date.now() + 3600_000);
  assert.equal(
    invitationStatusOf({ status: "pending", expiresAt: past }),
    "expired",
  );
  assert.equal(
    invitationStatusOf({ status: "pending", expiresAt: future }),
    "pending",
  );
  assert.equal(
    invitationStatusOf({ status: "accepted", expiresAt: future }),
    "accepted",
  );
  assert.equal(
    invitationStatusOf({ status: "canceled", expiresAt: future }),
    "canceled",
  );
});
