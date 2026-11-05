import { useColorScheme as useRNColorScheme } from "react-native";

import { useThemePreferenceOptional } from "@/lib/theme-provider";

// Effective theme for IN-JS color decisions (icons, placeholders…).
//
// Inside the <ThemeProvider> it returns the resolved theme (manual choice or
// system). Important: the RN hook can be stale when a manual theme is set
// via `Appearance.setColorScheme` (its snapshot is not re-evaluated without a
// native event), while Uniwind does apply the override — using the raw hook
// leaves system icons on top of manual UI. Outside the
// provider, it falls back to the system as before.
export function useColorScheme(): "light" | "dark" {
  const preference = useThemePreferenceOptional();
  const system = useRNColorScheme();
  if (preference) return preference.resolved;
  return system === "dark" ? "dark" : "light";
}
