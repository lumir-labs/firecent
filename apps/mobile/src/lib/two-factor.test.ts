import { describe, expect, test } from "bun:test";
import {
  isInvalidTwoFactorCookieError,
  isValidBackupCode,
  isValidTotpCode,
} from "./two-factor";

describe("isValidTotpCode", () => {
  test("6 digits → true", () => {
    expect(isValidTotpCode("123456")).toBe(true);
  });

  test("empty, spaces, letters or wrong length → false", () => {
    expect(isValidTotpCode("")).toBe(false);
    expect(isValidTotpCode("   ")).toBe(false);
    expect(isValidTotpCode("12345")).toBe(false);
    expect(isValidTotpCode("1234567")).toBe(false);
    expect(isValidTotpCode("12a456")).toBe(false);
    expect(isValidTotpCode(" 123456 ")).toBe(true);
  });
});

describe("isValidBackupCode", () => {
  test("non-empty trimmed → true", () => {
    expect(isValidBackupCode("xxxx-xxxx")).toBe(true);
    expect(isValidBackupCode("  abc123  ")).toBe(true);
  });

  test("empty → false", () => {
    expect(isValidBackupCode("")).toBe(false);
    expect(isValidBackupCode("   ")).toBe(false);
  });
});

describe("isInvalidTwoFactorCookieError", () => {
  test("code INVALID_TWO_FACTOR_COOKIE → true", () => {
    expect(
      isInvalidTwoFactorCookieError({ code: "INVALID_TWO_FACTOR_COOKIE" }),
    ).toBe(true);
  });

  test("other codes, null or missing code → false", () => {
    expect(isInvalidTwoFactorCookieError({ code: "OTHER" })).toBe(false);
    expect(isInvalidTwoFactorCookieError({ message: "x" })).toBe(false);
    expect(isInvalidTwoFactorCookieError(null)).toBe(false);
    expect(isInvalidTwoFactorCookieError(undefined)).toBe(false);
  });
});
