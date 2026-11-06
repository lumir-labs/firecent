import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme as useSystemScheme } from "react-native";
import { Uniwind } from "uniwind";
import * as SecureStore from "expo-secure-store";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme-preference";

type ThemeContextValue = {
  /** User's choice (persisted). `system` = follow the phone. */
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  /** Effective theme. This is what navigation, SystemUI and StatusBar must use. */
  resolved: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const systemScheme = useSystemScheme();

  // Saved preference (if any) on mount.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (isThemePreference(saved)) setThemeState(saved);
      })
      .catch(() => {
        // SecureStore may be unavailable (e.g. web without support):
        // ignored, and the `system` default remains in effect.
      });
  }, []);

  // Uniwind is now the theme owner: `light`/`dark` make it internally call
  // `Appearance.setColorScheme` (so native components —Alert, Modal,
  // dialogs— and `useColorScheme()` stay aligned), and `system` follows the
  // phone again. The `dark:` variant and the `@variant light` / `@variant
  // dark` variables in tokens/tokens.css stem from this.
  useEffect(() => {
    Uniwind.setTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {
      // no-op: the preference still applies in memory
    });
  }, []);

  const resolved: "light" | "dark" =
    theme === "system" ? (systemScheme === "dark" ? "dark" : "light") : theme;

  const value = useMemo(
    () => ({ theme, setTheme, resolved }),
    [theme, setTheme, resolved],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error("useThemePreference must be used within a <ThemeProvider>");
  return ctx;
}

// Version that does NOT throw outside the provider: for `ui` components that
// can live without it (they return null and the caller uses the system).
export function useThemePreferenceOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
