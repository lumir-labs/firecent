import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  // English-first product: `/` opens at /en. next-intl still negotiates
  // Accept-Language + cookie, so Spanish devices keep getting /es.
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Strips the locale prefix (/es, /en) from a pathname.
 * The localized router re-adds it, so manually-built callbackUrls must be
 * stripped first.
 */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/");
  // segments[0] === "" due to the leading slash; segments[1] may be a locale.
  const maybeLocale = segments[1];
  if (
    maybeLocale &&
    (routing.locales as readonly string[]).includes(maybeLocale)
  ) {
    const rest = segments.slice(2).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname;
}
