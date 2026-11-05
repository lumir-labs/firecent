import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import {
  isLocale,
  localeFromDeviceTag,
  type Locale,
  type MessageKey,
} from "@app/lib/messages";
import { translate } from "./translate";

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function deviceLocale(): Locale {
  try {
    const locales = getLocales();
    return localeFromDeviceTag(locales[0]?.languageTag ?? null);
  } catch {
    // Device locale unavailable: fall back to the product default ("en").
    return localeFromDeviceTag(null);
  }
}

const STORAGE_KEY = "locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  // Saved language (if any) on mount; otherwise the device locale stays.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (saved && isLocale(saved)) setLocaleState(saved);
      })
      .catch(() => {
        // SecureStore may be unavailable: ignored.
      });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    SecureStore.setItemAsync(STORAGE_KEY, l).catch(() => {
      // no-op: the language still applies in memory
    });
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an <I18nProvider>");
  return ctx;
}
