import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

import { routing, type Locale } from "./routing";
import { isLocale } from "./utils";

export default getRequestConfig(async ({ locale }) => {
  // `locale` is only set in edge cases (tests, explicit override).
  // In normal runtime it is read from the root param [locale] (Next 16.3+, no setRequestLocale).
  const paramValue = locale ?? (await rootParams.locale());

  if (!paramValue || !isLocale(paramValue)) {
    notFound();
  }

  const resolvedLocale: Locale = paramValue;

  return {
    locale: resolvedLocale,
    // Single source shared with mobile: packages/lib/src/messages/*.json
    messages: (await import(`../../../packages/lib/src/messages/${resolvedLocale}.json`))
      .default,
  };
});
