import { locale } from "next/root-params";
import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/utils";
import { redirect } from "@/i18n/navigation";

export default async function Page() {
  const localeValue = await locale();
  if (!isLocale(localeValue)) notFound();

  return redirect({ href: "/admin/dashboard", locale: localeValue });
}
