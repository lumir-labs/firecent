import assert from "node:assert/strict";
import { test } from "node:test";
import { hasApiKeyScope } from "./service.ts";
import { createOrgApiKeySchema } from "./schemas.ts";
import { MCP_MEMBERS_READ, MCP_ORG_READ } from "./service.ts";

test("empty scopes deny the required scope (deny-by-default)", () => {
  assert.equal(hasApiKeyScope({ scopes: [] }, "mcp:org:read"), false);
});

test("present scope allows", () => {
  assert.equal(
    hasApiKeyScope({ scopes: ["mcp:org:read"] }, "mcp:org:read"),
    true,
  );
});

test("missing scope with a non-empty list denies", () => {
  assert.equal(
    hasApiKeyScope({ scopes: ["mcp:org:read"] }, "mcp:members:read"),
    false,
  );
});

test("schema defaults to both MCP scopes (no dead keys are born)", () => {
  const parsed = createOrgApiKeySchema.parse({
    organizationId: "123e4567-e89b-12d3-a456-426614174000",
    name: "CI",
    expiresAt: null,
    scopes: undefined,
  });
  assert.deepEqual(
    [...parsed.scopes].sort(),
    [MCP_MEMBERS_READ, MCP_ORG_READ].sort(),
  );
});
