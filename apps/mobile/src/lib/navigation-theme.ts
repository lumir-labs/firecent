import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { semanticTokens } from "@app/lib/tokens/semantic";

/**
 * React Navigation theme (tab bar, screen backgrounds, headers).
 *
 * The values come DIRECTLY from the single source of tokens
 * (packages/lib/src/tokens/semantic.ts) — they cannot drift from the CSS
 * because both consume the same module. React Navigation does not read CSS
 * variables, which is why only the 6 colors the navigation uses are copied
 * here: tab bar background = `card`, screen background = `background`.
 */
const fonts: Theme["fonts"] = {
  regular: { fontFamily: "Inter_400Regular", fontWeight: "400" },
  medium: { fontFamily: "Inter_600SemiBold", fontWeight: "500" },
  bold: { fontFamily: "Inter_700Bold", fontWeight: "700" },
  heavy: { fontFamily: "Inter_700Bold", fontWeight: "900" },
};

export const lightNavigationTheme: Theme = {
  ...DefaultTheme,
  fonts,
  colors: {
    ...DefaultTheme.colors,
    primary: semanticTokens.light.primary,
    background: semanticTokens.light.background,
    card: semanticTokens.light.card,
    text: semanticTokens.light.foreground,
    border: semanticTokens.light.border,
    notification: semanticTokens.light.destructive,
  },
};

export const darkNavigationTheme: Theme = {
  ...DarkTheme,
  fonts,
  colors: {
    ...DarkTheme.colors,
    primary: semanticTokens.dark.primary,
    background: semanticTokens.dark.background,
    card: semanticTokens.dark.card,
    text: semanticTokens.dark.foreground,
    border: semanticTokens.dark.border,
    notification: semanticTokens.dark.destructive,
  },
};
