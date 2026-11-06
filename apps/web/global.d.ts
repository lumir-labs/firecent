import type { Locale } from "./i18n/routing";
import messages from "@app/lib/messages/es.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
