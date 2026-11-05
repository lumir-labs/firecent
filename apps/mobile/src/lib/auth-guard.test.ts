import { describe, expect, test } from "bun:test";
import { isAuthenticatedSession } from "./auth-guard";

describe("isAuthenticatedSession", () => {
  test("session with user and no error → true", () => {
    expect(isAuthenticatedSession({ user: { id: "1" } }, null)).toBe(true);
  });

  test("with error → false even if user exists", () => {
    expect(isAuthenticatedSession({ user: { id: "1" } }, new Error("x"))).toBe(
      false,
    );
  });

  test("null/undefined session or no user → false", () => {
    expect(isAuthenticatedSession(null, null)).toBe(false);
    expect(isAuthenticatedSession(undefined, null)).toBe(false);
    expect(isAuthenticatedSession({}, null)).toBe(false);
  });
});
