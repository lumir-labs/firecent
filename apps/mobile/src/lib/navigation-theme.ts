import { useMemo } from "react";
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useThemeColors } from "@/lib/theme-colors";

/**
 * React Navigation theme (tab bar, screen backgrounds, headers).
 *
 * React Navigation does not read CSS variables, so the 6 colors it uses are
 * read from the RESOLVED tokens (packages/lib/src/tokens/tokens.css, via
 * Uniwind) — they cannot drift from the CSS and follow manual theme changes.
 * Tab bar background = `card`, screen background = `background`.
 */
const fonts: Theme["fonts"] = {
  regular: { fontFamily: "Inter_400Regular", fontWeight: "400" },
  medium: { fontFamily: "Inter_600SemiBold", fontWeight: "500" },
  bold: { fontFamily: "Inter_700Bold", fontWeight: "700" },
  heavy: { fontFamily: "Inter_700Bold", fontWeight: "900" },
};

export function useNavigationTheme(scheme: "light" | "dark"): Theme {
  const c = useThemeColors();
  return useMemo(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: scheme === "dark",
      fonts,
      colors: {
        ...base.colors,
        primary: c.primary,
        background: c.background,
        card: c.card,
        text: c.foreground,
        border: c.border,
        notification: c.destructive,
      },
    };
  }, [scheme, c.primary, c.background, c.card, c.foreground, c.border, c.destructive]);
}
