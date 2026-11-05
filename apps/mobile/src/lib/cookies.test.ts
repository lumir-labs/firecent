import { describe, expect, test } from "bun:test";
import {
  buildCookieHeader,
  hasPendingTwoFactorChallenge,
} from "./cookies";

describe("buildCookieHeader", () => {
  test("null or empty → empty header", () => {
    expect(buildCookieHeader(null)).toBe("");
    expect(buildCookieHeader("")).toBe("");
  });

  test("joins valid pairs with '; '", () => {
    const raw = JSON.stringify({
      "better-auth.session_token": { value: "abc", expires: null },
      other: { value: "123", expires: null },
    });
    expect(buildCookieHeader(raw)).toBe(
      "better-auth.session_token=abc; other=123",
    );
  });

  test("filters expired cookies and empty values", () => {
    const raw = JSON.stringify({
      expired: { value: "x", expires: new Date(0).toISOString() },
      empty: { value: "", expires: null },
      fresh: {
        value: "y",
        expires: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
    expect(buildCookieHeader(raw)).toBe("fresh=y");
  });

  test("invalid JSON → empty header (no throw)", () => {
    expect(buildCookieHeader("no-json{{{")).toBe("");
  });
});

describe("hasPendingTwoFactorChallenge", () => {
  test("detects the challenge cookie (dev and secure prefixes)", () => {
    expect(
      hasPendingTwoFactorChallenge("better-auth.two_factor=abc.600"),
    ).toBe(true);
    expect(
      hasPendingTwoFactorChallenge(
        "__Secure-better-auth.two_factor=abc.600; better-auth.session_token=x",
      ),
    ).toBe(true);
  });

  test("false without a two_factor cookie", () => {
    expect(hasPendingTwoFactorChallenge("")).toBe(false);
    expect(hasPendingTwoFactorChallenge("better-auth.session_token=x")).toBe(
      false,
    );
    // the trust-device cookie must not be mistaken for a pending challenge
    expect(hasPendingTwoFactorChallenge("better-auth.trust_device=x")).toBe(
      false,
    );
  });

  test("cookie values with '=' padding don't hide the name", () => {
    expect(
      hasPendingTwoFactorChallenge("other=a=b; better-auth.two_factor=a=b.600"),
    ).toBe(true);
    expect(hasPendingTwoFactorChallenge("better-auth.two_factor=a=b.600")).toBe(
      true,
    );
  });
});
