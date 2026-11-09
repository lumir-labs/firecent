import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  decideMagicLinkBackoff,
  MAGIC_LINK_BACKOFF_RESET_SECONDS,
  MAGIC_LINK_COOLDOWN_CODE,
  magicLinkWaitAfter,
  type MagicLinkBackoffState,
} from "@app/lib/magic-link";

/**
 * Per-email exponential backoff for `/sign-in/magic-link` (schedule in
 * @app/lib/magic-link). Complements the per-IP `rateLimit` rule in auth.ts:
 * that one stops a single client hammering the endpoint; this one stops
 * email-bombing one inbox from many IPs.
 *
 * State lives in the `Verification` table (identifier = hash of the email,
 * no schema change, shared across instances). A successful
 * `/magic-link/verify` resets the streak. Read-then-write is not atomic: a
 * burst of concurrent requests can slip one extra link through, which the
 * per-IP limit already bounds.
 *
 * A 429 here reveals nothing about account existence: magic links also sign
 * up, so every email is a valid target.
 *
 * Type NOTE: handlers cast to `never` for the same reason as
 * `signInTwoFactorHook` in auth.ts (keeps plugin inference intact).
 */

async function identifierFor(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `magic-link-backoff:${hex}`;
}

function parseState(value: string | undefined): MagicLinkBackoffState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MagicLinkBackoffState>;
    if (typeof parsed.count === "number" && typeof parsed.last === "number") {
      return { count: parsed.count, last: parsed.last };
    }
  } catch {
    // Corrupt row: treat as a fresh streak.
  }
  return null;
}

const enforceBackoff = createAuthMiddleware(async (ctx) => {
  const email = (ctx.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string" || email.trim() === "") return;

  const adapter = ctx.context.internalAdapter;
  const identifier = await identifierFor(email);
  const row = await adapter.findVerificationValue(identifier);
  const now = Date.now();
  const state =
    row && new Date(row.expiresAt).getTime() > now ? parseState(row.value) : null;

  const decision = decideMagicLinkBackoff(state, now);
  if (!decision.allowed) {
    throw new APIError(
      "TOO_MANY_REQUESTS",
      {
        code: MAGIC_LINK_COOLDOWN_CODE,
        message: `Please wait ${decision.retryAfter}s before requesting another link.`,
        retryAfter: decision.retryAfter,
      },
      { "X-Retry-After": String(decision.retryAfter) },
    );
  }

  const value = JSON.stringify(decision.next);
  const expiresAt = new Date(now + MAGIC_LINK_BACKOFF_RESET_SECONDS * 1000);
  if (row) {
    await adapter.updateVerificationByIdentifier(identifier, {
      value,
      expiresAt,
    });
  } else {
    await adapter.createVerificationValue({ identifier, value, expiresAt });
  }
});

/**
 * On a successful send, tell the client how long until a resend is allowed
 * (`{ status: true, retryAfter }`) so the UI can show the countdown.
 */
const exposeNextWait = createAuthMiddleware(async (ctx) => {
  const returned = ctx.context.returned as { status?: unknown } | undefined;
  if (!returned || returned.status !== true) return;
  const email = (ctx.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string") return;
  const row = await ctx.context.internalAdapter.findVerificationValue(
    await identifierFor(email),
  );
  const state = parseState(row?.value);
  if (!state) return;
  return ctx.json({ status: true, retryAfter: magicLinkWaitAfter(state.count) });
});

const resetOnSignIn = createAuthMiddleware(async (ctx) => {
  const email = ctx.context.newSession?.user.email;
  if (!email) return;
  await ctx.context.internalAdapter.deleteVerificationByIdentifier(
    await identifierFor(email),
  );
});

/**
 * Must be registered BEFORE `signInTwoFactorHook`: that hook clears
 * `newSession` on 2FA accounts, and clicking the link already proves
 * ownership of the inbox.
 */
export const magicLinkBackoff: BetterAuthPlugin = {
  id: "magic-link-backoff",
  hooks: {
    before: [
      {
        matcher: (context) => context.path === "/sign-in/magic-link",
        handler: enforceBackoff as never,
      },
    ],
    after: [
      {
        matcher: (context) => context.path === "/sign-in/magic-link",
        handler: exposeNextWait as never,
      },
      {
        matcher: (context) => context.path === "/magic-link/verify",
        handler: resetOnSignIn as never,
      },
    ],
  },
};
