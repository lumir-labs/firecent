export type CookieConsent = {
  readonly essential: true;
  readonly analytics: boolean;
  readonly updatedAt: string;
};

export const COOKIE_CONSENT_STORAGE_KEY = "fc:cookie-consent:v1";
export const COOKIE_CONSENT_CHANGE_EVENT = "fc:cookie-consent-changed";
export const COOKIE_CONSENT_OPEN_EVENT = "fc:cookie-consent-open";

export function parseCookieConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.analytics !== "boolean") return null;
    const updatedAt =
      typeof record.updatedAt === "string" && record.updatedAt.length > 0
        ? record.updatedAt
        : new Date(0).toISOString();
    return {
      essential: true,
      analytics: record.analytics,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function serializeCookieConsent(analytics: boolean): string {
  const payload: CookieConsent = {
    essential: true,
    analytics,
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

export function readCookieConsentRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveCookieConsent(analytics: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      serializeCookieConsent(analytics),
    );
  } catch {
    // Ignore storage quota / private mode errors
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
}
