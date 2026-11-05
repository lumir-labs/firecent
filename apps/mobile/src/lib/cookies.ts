/**
 * Rebuilds the `Cookie` header from what better-auth's
 * `expoClient` persisted in SecureStore (key `stackgoat_cookie`).
 *
 * Pure and free of native imports so it can be tested with `bun test` (gap G6).
 */
type StoredCookie = { value: string; expires: string | null };

export function buildCookieHeader(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed: Record<string, StoredCookie> = JSON.parse(raw);
    const parts: string[] = [];
    for (const [key, val] of Object.entries(parsed)) {
      if (!val?.value) continue;
      if (val.expires && new Date(val.expires).getTime() < Date.now()) continue;
      parts.push(`${key}=${val.value}`);
    }
    return parts.join("; ");
  } catch {
    return "";
  }
}

/**
 * True when a `Cookie` header (as rebuilt by `buildCookieHeader` /
 * `client.getCookie()`) carries a NON-EXPIRED pending 2FA challenge.
 *
 * The server sets `{cookiePrefix}.two_factor` while a TOTP challenge is
 * pending and expires it on successful verify, so its presence means the
 * user should still see the code step (used to restore it after an app
 * remount on foreground). Matching must not confuse the unrelated
 * `trust_device` cookie.
 */
export function hasPendingTwoFactorChallenge(cookieHeader: string): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split("; ").some((pair) => {
    const eq = pair.indexOf("=");
    if (eq === -1) return false;
    const name = pair.slice(0, eq).trim();
    return /(^|\.)two_factor$/.test(name);
  });
}
