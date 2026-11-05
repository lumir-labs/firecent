/**
 * Pure 2FA helpers for the mobile sign-in (mirror of the web
 * `login-form.tsx` TOTP step). Extracted as pure so they can be tested
 * with `bun test` — the UI in `sign-in.tsx` only calls them.
 */

/** TOTP codes are 6 digits (surrounding spaces allowed, like the web). */
export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/** Backup codes (`xxxx-xxxx`): any non-empty value after trimming. */
export function isValidBackupCode(code: string): boolean {
  return code.trim().length > 0;
}

/**
 * Challenge cookie expired (10 min) or consumed: without it there is
 * no way to recover the context → ask for a new link, not a dead-end
 * (same `INVALID_TWO_FACTOR_COOKIE` check as the web login-form).
 */
export function isInvalidTwoFactorCookieError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "INVALID_TWO_FACTOR_COOKIE"
  );
}
