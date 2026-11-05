"use client";

import { useLocale, useTranslations } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { isLocale } from "@/i18n/utils";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onSelectChange = (value: string) => {
    const nextLocale: Locale = isLocale(value) ? value : routing.defaultLocale;
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-switcher" className="sr-only">
        {t("label")}
      </label>
      <select
        id="language-switcher"
        value={locale}
        onChange={(e) => onSelectChange(e.target.value)}
        className="bg-background rounded-md border px-2 py-1 text-sm"
      >
        {routing.locales.map((cur) => (
          <option key={cur} value={cur}>
            {t("locale", { locale: cur })}
          </option>
        ))}
      </select>
    </div>
  );
}
