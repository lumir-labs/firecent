import assert from "node:assert/strict";
import { test } from "node:test";
import { detectPermissionEscalationRisk } from "./escalation-detector.ts";

test("detects base role contamination when granting admin permissions to 'user'", () => {
  const risk = detectPermissionEscalationRisk({
    roleName: "user",
    currentPermissionKeys: ["apikeys:list"],
    newPermissionKey: "users:update",
  });

  assert.ok(risk !== null);
  assert.equal(risk.severity, "critical");
  assert.equal(risk.rule, "base_role_administrative_exposure");
});

test("detects meta-permission grant for permissions:update", () => {
  const risk = detectPermissionEscalationRisk({
    roleName: "operator",
    currentPermissionKeys: [],
    newPermissionKey: "permissions:update",
  });

  assert.ok(risk !== null);
  assert.equal(risk.severity, "critical");
  assert.equal(risk.rule, "meta_permission_grant");
});

test("detects toxic combination: roles:update + users:update", () => {
  const risk = detectPermissionEscalationRisk({
    roleName: "manager",
    currentPermissionKeys: ["roles:update"],
    newPermissionKey: "users:update",
  });

  assert.ok(risk !== null);
  assert.equal(risk.severity, "critical");
  assert.equal(risk.rule, "toxic_combination");
  assert.ok(risk.toxicPermissions.includes("roles:update"));
  assert.ok(risk.toxicPermissions.includes("users:update"));
});

test("detects toxic combination: permissions:update + roles:update", () => {
  const risk = detectPermissionEscalationRisk({
    roleName: "manager",
    currentPermissionKeys: ["permissions:update"],
    newPermissionKey: "roles:update",
  });

  assert.ok(risk !== null);
  assert.equal(risk.rule, "toxic_combination");
  assert.ok(risk.toxicPermissions.includes("permissions:update"));
});

test("returns null for safe permissions without toxic combinations", () => {
  const risk = detectPermissionEscalationRisk({
    roleName: "auditor",
    currentPermissionKeys: ["apikeys:list", "organizations:read"],
    newPermissionKey: "organization-members:list",
  });

  assert.equal(risk, null);
});
