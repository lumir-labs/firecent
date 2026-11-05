import { routing, type Locale } from "./routing";

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

/** Absolute base URL for canonical/hreflang (set NEXT_PUBLIC_SITE_URL in .env) */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Locale for Intl.DateTimeFormat/toLocaleDateString based on the active locale.
 * Keeps the app convention (es → es-SV). Timezone is handled separately.
 */
export function getDateLocale(locale: Locale): string {
  return locale === "es" ? "es-SV" : "en-US";
}
