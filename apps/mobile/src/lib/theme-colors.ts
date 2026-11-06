import { useCSSVariable } from "uniwind";

/**
 * Theme colors for IN-JS styling (icon `color`, charts, React Navigation,
 * alpha tints) — the props that cannot take a `className`.
 *
 * Values are read from Uniwind's RESOLVED theme store (the same one that
 * paints `className`), so they come straight from
 * packages/lib/src/tokens/tokens.css — the single source — and re-render on
 * theme change (system or manual via Uniwind.setTheme).
 *
 * To expose another token in JS, add its name to THEME_COLOR_NAMES (it must
 * exist in tokens.css).
 */
const THEME_COLOR_NAMES = [
  "background",
  "foreground",
  "card",
  "primary",
  "primary-foreground",
  "secondary-foreground",
  "muted-foreground",
  "destructive",
  "border",
  "input",
  "ring",
] as const;

export type ThemeColorName = (typeof THEME_COLOR_NAMES)[number];
export type ThemeColors = Record<ThemeColorName, string>;

const VAR_NAMES = THEME_COLOR_NAMES.map((name) => `--${name}`);

// Only if Uniwind could not resolve a var (misconfigured CSS). Neutral gray:
// visible on both themes, and obviously "wrong" so it gets noticed.
const UNRESOLVED = "#888888";

const toColor = (value: string | number | undefined): string =>
  typeof value === "string" && value.length > 0 ? value : UNRESOLVED;

/** All exposed theme colors, resolved for the current theme. */
export function useThemeColors(): ThemeColors {
  const values = useCSSVariable(VAR_NAMES);
  return Object.fromEntries(
    THEME_COLOR_NAMES.map((name, i) => [name, toColor(values[i])]),
  ) as ThemeColors;
}

/** A single theme color, resolved for the current theme. */
export function useThemeColor(name: ThemeColorName): string {
  return toColor(useCSSVariable(`--${name}`));
}
