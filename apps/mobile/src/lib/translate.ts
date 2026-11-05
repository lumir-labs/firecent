import {
  interpolate,
  messages,
  type Locale,
  type MessageKey,
} from "@app/lib/messages";

/**
 * Lookup `t(key, vars)` from the I18nProvider as a pure function (gap G6):
 * resolves in the active locale with fallback `en` → `es` (English-first)
 * and returns the key if it does not exist in either.
 *
 * `dicts` is injectable for tests; in production the single-source
 * `@app/lib/messages` is used.
 */
type Dicts = Record<Locale, unknown>;

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (typeof acc === "object" && acc !== null && k in acc) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
  dicts: Dicts = messages as unknown as Dicts,
): string {
  const raw = get(dicts[locale], key);
  if (typeof raw !== "string") {
    const en = get(dicts.en, key);
    if (typeof en === "string") return interpolate(en, vars);
    const es = get(dicts.es, key);
    return typeof es === "string" ? interpolate(es, vars) : key;
  }
  return interpolate(raw, vars);
}
