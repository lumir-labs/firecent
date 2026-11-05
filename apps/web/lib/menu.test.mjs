import assert from "node:assert/strict";
import { test } from "node:test";
import { isMenuActive, isMenuSectionActive } from "./menu.ts";

test("root path only matches root (no prefix bleed)", () => {
  assert.equal(isMenuActive("/billing", "/"), false);
  assert.equal(isMenuActive("/", "/"), true);
});

test("exact matches (trailing-slash tolerant)", () => {
  assert.equal(isMenuActive("/billing", "/billing"), true);
  assert.equal(isMenuActive("/billing/", "/billing"), true);
  assert.equal(isMenuActive("/organization/api-keys", "/organization/api-keys"), true);
});

test("parent sections do NOT highlight on child pages", () => {
  assert.equal(isMenuActive("/organization/api-keys", "/organization"), false);
});

test("similar prefixes do not match", () => {
  assert.equal(isMenuActive("/organization-x", "/organization"), false);
  assert.equal(isMenuActive("/profiles", "/profile"), false);
});

test("section highlights on exact item or section match", () => {
  assert.equal(isMenuSectionActive("/organization", { items: [{ path: "/organization" }] }), true);
  assert.equal(isMenuSectionActive("/organization/api-keys", { items: [{ path: "/organization" }, { path: "/organization/api-keys" }] }), true);
  assert.equal(isMenuSectionActive("/organization/api-keys", { items: [{ path: "/organization" }] }), false);
  assert.equal(isMenuSectionActive("/", { path: "/", items: [{ path: "/" }] }), true);
  assert.equal(isMenuSectionActive("/billing", { path: "/", items: [{ path: "/" }] }), false);
});
