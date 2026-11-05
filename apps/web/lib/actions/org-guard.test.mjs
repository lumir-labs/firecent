import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveActiveOrg } from "./org-guard.ts";

test("uses activeOrganizationId if it belongs to memberships", () => {
  assert.equal(resolveActiveOrg(["a", "b"], "b"), "b");
});

test("falls back to memberships[0] if active doesn't belong", () => {
  assert.equal(resolveActiveOrg(["a", "b"], "z"), "a");
});

test("falls back to memberships[0] when there is no active", () => {
  assert.equal(resolveActiveOrg(["a", "b"], null), "a");
});

test("undefined when there are no memberships", () => {
  assert.equal(resolveActiveOrg([], "b"), undefined);
});
