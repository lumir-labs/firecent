/**
 * Money formatting shared by the dashboard.
 * US-style separators in both languages ($2,770.05 — never "US$" or
 * "2770,05"), the short "$" symbol and a typographic minus (−).
 */

const MINUS = "−";

export const moneyLocale = (locale: string) =>
  locale.startsWith("es") ? "es-US" : locale;

export function moneyParts(
  locale: string,
  value: number,
  currency: string,
  signed = false,
): Intl.NumberFormatPart[] {
  const signDisplay = signed ? "exceptZero" : "auto";
  let out: Intl.NumberFormatPart[];
  try {
    out = new Intl.NumberFormat(moneyLocale(locale), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      signDisplay,
    }).formatToParts(value);
  } catch {
    // `currency` is free text in the DB: an invalid ISO code must not crash.
    out = new Intl.NumberFormat(moneyLocale(locale), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay,
    })
      .formatToParts(value)
      .concat([
        { type: "literal", value: " " },
        { type: "currency", value: currency },
      ]);
  }
  return out.map((p) => (p.type === "minusSign" ? { ...p, value: MINUS } : p));
}

export const formatMoney = (
  locale: string,
  value: number,
  currency: string,
  signed = false,
) =>
  moneyParts(locale, value, currency, signed)
    .map((p) => p.value)
    .join("");
