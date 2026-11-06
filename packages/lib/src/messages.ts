import esMessages from "./messages/es.json";
import enMessages from "./messages/en.json";

export const routing = {
  locales: ["es", "en"],
  // English-first product default (matches apps/web/i18n/routing.ts).
  defaultLocale: "en",
} as const;

export type Locale = (typeof routing.locales)[number];

/**
 * Single source of truth for ES/EN messages for web and mobile.
 * - Web: loaded in apps/web/i18n/request.ts; next-intl generates
 *   `messages/es.d.json.ts` here (git-ignored) for strict argument types.
 * - Mobile: imported directly with `import { esMessages } from "@app/lib/messages"`.
 */
export const messages = { es: esMessages, en: enMessages } as const;

export type Messages = typeof esMessages;
export type MessageKey = LeafPaths<Messages>;

type LeafPaths<T, P extends string = ""> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? LeafPaths<T[K], `${P}${K & string}.`>
    : `${P}${K & string}`;
}[keyof T];

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

/**
 * Initial locale from a BCP-47 tag ("es-SV" → "es"); if it does not match,
 * defaults to `routing.defaultLocale` ("en", same convention as
 * apps/web/i18n/routing.ts).
 * On mobile it is fed with expo-localization: getLocales()[0]?.languageTag.
 */
export function localeFromDeviceTag(tag: string | null | undefined): Locale {
  const prefix = tag?.split("-")[0]?.toLowerCase();
  return prefix && isLocale(prefix) ? prefix : routing.defaultLocale;
}

/** App convention (es → es-SV), same as getDateLocale on the web. */
export function getDateLocale(locale: Locale): string {
  return locale === "es" ? "es-SV" : "en-US";
}

/**
 * i18n keys for the greeting based on the local time. `satisfies` validates at
 * compile-time that each value actually exists in the JSONs (MessageKey).
 */
export const DAY_GREETING_KEYS = {
  morning: "Home.dayGreeting.morning",
  afternoon: "Home.dayGreeting.afternoon",
  evening: "Home.dayGreeting.evening",
} as const satisfies Record<string, MessageKey>;

/**
 * Greeting key (`Home.dayGreeting.*`) based on the local time.
 * Returns a MessageKey to pass straight to `t()` so each app (web/mobile)
 * translates it without duplicating texts here.
 */
export function dayGreetingKey(now: Date = new Date()): MessageKey {
  const hour = now.getHours();
  if (hour < 12) return DAY_GREETING_KEYS.morning;
  if (hour < 18) return DAY_GREETING_KEYS.afternoon;
  return DAY_GREETING_KEYS.evening;
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
}
