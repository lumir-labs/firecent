import type { ColorName, DayInput, Nature } from "./types";

/** Literal classes so Tailwind sees them. Tile = icon chip, bar = solid fill. */
export const COLOR_TILE: Record<ColorName, string> = {
  DEFAULT: "bg-brand-default text-brand-default-foreground",
  GRAY: "bg-brand-gray text-brand-gray-foreground",
  BROWN: "bg-brand-brown text-brand-brown-foreground",
  ORANGE: "bg-brand-orange text-brand-orange-foreground",
  YELLOW: "bg-brand-yellow text-brand-yellow-foreground",
  GREEN: "bg-brand-green text-brand-green-foreground",
  BLUE: "bg-brand-blue text-brand-blue-foreground",
  PURPLE: "bg-brand-purple text-brand-purple-foreground",
  PINK: "bg-brand-pink text-brand-pink-foreground",
  RED: "bg-brand-red text-brand-red-foreground",
};

export const NATURE_BG: Record<Nature, string> = {
  DEBO: "bg-nature-owe",
  NECESITO: "bg-nature-need",
  QUIERO: "bg-nature-want",
};

/** i18n key under `Finance.nature`. */
export const NATURE_KEY: Record<Nature, "owe" | "need" | "want"> = {
  DEBO: "owe",
  NECESITO: "need",
  QUIERO: "want",
};

/**
 * Normalizes a calendar day to a Date at UTC midnight. Format it with
 * `timeZone: "UTC"` so server and client print the same day.
 */
export function toUtcDay(day: DayInput): Date {
  if (day instanceof Date) {
    return new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    );
  }
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** Whole days from `a` to `b` (both calendar days). */
export function dayDiff(a: DayInput, b: DayInput): number {
  return Math.round(
    (toUtcDay(b).getTime() - toUtcDay(a).getTime()) / 86_400_000,
  );
}

export const clamp01 = (n: number) =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

/** Skeleton fill on the always-dark hero card (`bg-muted` would glow there). */
export const HERO_SKELETON = "bg-hero-foreground/10";
