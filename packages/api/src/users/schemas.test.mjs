import assert from "node:assert/strict";
import { test } from "node:test";
import { updateOwnSchema } from "./schemas.ts";

test("accepts profile scalars and trims them", () => {
  const parsed = updateOwnSchema.parse({ firstName: "  Ana " });
  assert.equal(parsed.firstName, "Ana");
});

test("rejects email (immutable login via own tRPC)", () => {
  assert.throws(() => updateOwnSchema.parse({ email: "x@y.z" }));
});

test("rejects emailVerified/deletedAt/roles (strict)", () => {
  assert.throws(() => updateOwnSchema.parse({ emailVerified: true }));
  assert.throws(() => updateOwnSchema.parse({ deletedAt: new Date() }));
  assert.throws(() => updateOwnSchema.parse({ roles: { set: [] } }));
});

test("empty is ok (all optional)", () => {
  const parsed = updateOwnSchema.parse({});
  assert.equal(parsed.firstName, undefined);
});
