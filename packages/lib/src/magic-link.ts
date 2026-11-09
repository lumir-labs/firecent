/**
 * Magic-link anti-abuse: per-email exponential backoff.
 *
 * Shared by the server (apps/web/lib/magic-link-backoff.ts enforces it) and
 * the clients (web + mobile read the 429 to show a countdown). Pure, no I/O.
 *
 * The N-th link requested for the same email must wait
 * MAGIC_LINK_BACKOFF_SECONDS[N-1] since the previous one (the last step
 * repeats). The counter resets after MAGIC_LINK_BACKOFF_RESET_SECONDS without
 * requests, or when the user signs in with a link.
 */
export const MAGIC_LINK_BACKOFF_SECONDS = [0, 90, 180, 360, 720, 1440];

export const MAGIC_LINK_BACKOFF_RESET_SECONDS = 3600;

/** `code` of the 429 the server answers while an email is cooling down. */
export const MAGIC_LINK_COOLDOWN_CODE = "MAGIC_LINK_COOLDOWN";

/** Fallback for a 429 without `retryAfter` (the per-IP limiter's). */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

export type MagicLinkBackoffState = {
  /** Links sent in the current streak. */
  count: number;
  /** Epoch ms of the last link sent. */
  last: number;
};

export type MagicLinkBackoffDecision =
  | { allowed: true; next: MagicLinkBackoffState }
  | { allowed: false; retryAfter: number };

/** Seconds the next link must wait once `count` links were sent in the streak. */
export function magicLinkWaitAfter(count: number): number {
  const steps = MAGIC_LINK_BACKOFF_SECONDS;
  return steps[Math.min(Math.max(count, 0), steps.length - 1)]!;
}

export function decideMagicLinkBackoff(
  state: MagicLinkBackoffState | null,
  now: number,
): MagicLinkBackoffDecision {
  const elapsed = state ? now - state.last : Infinity;
  if (!state || elapsed >= MAGIC_LINK_BACKOFF_RESET_SECONDS * 1000) {
    return { allowed: true, next: { count: 1, last: now } };
  }
  const waitMs = magicLinkWaitAfter(state.count) * 1000;
  if (elapsed < waitMs) {
    return { allowed: false, retryAfter: Math.ceil((waitMs - elapsed) / 1000) };
  }
  return { allowed: true, next: { count: state.count + 1, last: now } };
}

/** Countdown label: `1:30`, `0:05`. */
export function formatMagicLinkWait(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Seconds until a resend is allowed, from a successful `signIn.magicLink`
 * response (the server adds `retryAfter`); `null` if absent.
 */
export function getMagicLinkNextWait(data: unknown): number | null {
  const retryAfter = (data as { retryAfter?: unknown } | null)?.retryAfter;
  return typeof retryAfter === "number" && retryAfter > 0
    ? Math.ceil(retryAfter)
    : null;
}

/**
 * Seconds to wait before retrying, from a better-auth client error; `null`
 * when the error isn't a rate limit.
 */
export function getMagicLinkRetryAfter(
  error: { status?: number; code?: string; retryAfter?: unknown } | null,
): number | null {
  if (!error) return null;
  if (
    error.code === MAGIC_LINK_COOLDOWN_CODE &&
    typeof error.retryAfter === "number"
  ) {
    return Math.max(1, Math.ceil(error.retryAfter));
  }
  return error.status === 429 ? DEFAULT_RETRY_AFTER_SECONDS : null;
}
