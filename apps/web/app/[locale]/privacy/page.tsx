import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isLocale } from "@/i18n/utils";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Legal" });
  return { title: t("privacyTitle") };
}

// Honest boilerplate template: replace it before processing real data.
// See the disclaimer in the README (AS-IS, no GDPR/CCPA/ISO/SOC2 compliance).
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Legal" });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">{t("privacyTitle")}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {t("companyPlaceholder")}
      </p>
      <p className="mt-4">{t("privacyBody")}</p>
    </main>
  );
}
