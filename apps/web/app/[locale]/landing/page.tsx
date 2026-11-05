import { locale } from "next/root-params";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { isLocale } from "@/i18n/utils";

import { LandingCta } from "./_components/landing-cta";
import { LandingFaq } from "./_components/landing-faq";
import { LandingFeatures } from "./_components/landing-features";
import { LandingFooter } from "./_components/landing-footer";
import { LandingHero } from "./_components/landing-hero";
import { LandingHowItWorks } from "./_components/landing-how-it-works";
import { LandingLogos } from "./_components/landing-logos";
import { LandingNavbar } from "./_components/landing-navbar";
import { LandingPricing } from "./_components/landing-pricing";
import { LandingShowcase } from "./_components/landing-showcase";
import { LandingTestimonials } from "./_components/landing-testimonials";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "Landing" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function LandingPage() {
  const localeValue = await locale();
  if (!isLocale(localeValue)) notFound();

  return (
    <div className="min-h-dvh scroll-smooth bg-background text-foreground">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingLogos />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingShowcase />
        <LandingPricing />
        <LandingTestimonials />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
