import { describe, expect, test } from "bun:test";
import {
  decideMagicLinkBackoff,
  getMagicLinkNextWait,
  getMagicLinkRetryAfter,
  magicLinkWaitAfter,
  MAGIC_LINK_BACKOFF_RESET_SECONDS,
  MAGIC_LINK_COOLDOWN_CODE,
} from "./magic-link";

const T0 = 1_700_000_000_000;
const s = (n: number) => n * 1000;

describe("decideMagicLinkBackoff", () => {
  test("first request is allowed and starts the streak", () => {
    expect(decideMagicLinkBackoff(null, T0)).toEqual({
      allowed: true,
      next: { count: 1, last: T0 },
    });
  });

  test("second request waits 90s", () => {
    const state = { count: 1, last: T0 };
    expect(decideMagicLinkBackoff(state, T0 + s(10))).toEqual({
      allowed: false,
      retryAfter: 80,
    });
    expect(decideMagicLinkBackoff(state, T0 + s(90))).toEqual({
      allowed: true,
      next: { count: 2, last: T0 + s(90) },
    });
  });

  test("wait grows with the streak and caps at the last step", () => {
    expect(decideMagicLinkBackoff({ count: 3, last: T0 }, T0)).toEqual({
      allowed: false,
      retryAfter: 360,
    });
    expect(decideMagicLinkBackoff({ count: 50, last: T0 }, T0)).toEqual({
      allowed: false,
      retryAfter: 1440,
    });
  });

  test("streak resets after the quiet period", () => {
    const state = { count: 6, last: T0 };
    const later = T0 + s(MAGIC_LINK_BACKOFF_RESET_SECONDS);
    expect(decideMagicLinkBackoff(state, later)).toEqual({
      allowed: true,
      next: { count: 1, last: later },
    });
  });
});

describe("magicLinkWaitAfter / getMagicLinkNextWait", () => {
  test("wait for the next link follows the schedule", () => {
    expect(magicLinkWaitAfter(1)).toBe(90);
    expect(magicLinkWaitAfter(2)).toBe(180);
    expect(magicLinkWaitAfter(99)).toBe(1440);
  });

  test("reads retryAfter from a successful send", () => {
    expect(getMagicLinkNextWait({ status: true, retryAfter: 90 })).toBe(90);
    expect(getMagicLinkNextWait({ status: true })).toBeNull();
    expect(getMagicLinkNextWait(null)).toBeNull();
  });
});

describe("getMagicLinkRetryAfter", () => {
  test("reads retryAfter from the cooldown error", () => {
    expect(
      getMagicLinkRetryAfter({
        status: 429,
        code: MAGIC_LINK_COOLDOWN_CODE,
        retryAfter: 42,
      }),
    ).toBe(42);
  });

  test("falls back to 60s for other 429s (per-IP limiter)", () => {
    expect(getMagicLinkRetryAfter({ status: 429 })).toBe(60);
  });

  test("null for non rate-limit errors and success", () => {
    expect(getMagicLinkRetryAfter({ status: 500 })).toBeNull();
    expect(getMagicLinkRetryAfter(null)).toBeNull();
  });
});
