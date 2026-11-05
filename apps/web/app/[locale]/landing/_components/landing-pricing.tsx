import { Check } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { getTranslations } from "next-intl/server";

export async function LandingPricing() {
  const t = await getTranslations("Landing");

  const plans = [
    {
      name: t("pricing.starterName"),
      price: t("pricing.starterPrice"),
      period: t("pricing.starterPeriod"),
      desc: t("pricing.starterDesc"),
      cta: t("pricing.starterCta"),
      featured: false,
      features: [
        t("pricing.starterF1"),
        t("pricing.starterF2"),
        t("pricing.starterF3"),
        t("pricing.starterF4"),
      ],
    },
    {
      name: t("pricing.proName"),
      price: t("pricing.proPrice"),
      period: t("pricing.proPeriod"),
      desc: t("pricing.proDesc"),
      cta: t("pricing.proCta"),
      featured: true,
      features: [
        t("pricing.proF1"),
        t("pricing.proF2"),
        t("pricing.proF3"),
        t("pricing.proF4"),
        t("pricing.proF5"),
      ],
    },
    {
      name: t("pricing.enterpriseName"),
      price: t("pricing.enterprisePrice"),
      period: t("pricing.enterprisePeriod"),
      desc: t("pricing.enterpriseDesc"),
      cta: t("pricing.enterpriseCta"),
      featured: false,
      features: [
        t("pricing.enterpriseF1"),
        t("pricing.enterpriseF2"),
        t("pricing.enterpriseF3"),
        t("pricing.enterpriseF4"),
      ],
    },
  ];

  return (
    <section id="pricing" className="scroll-mt-20 bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {t("pricing.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                plan.featured &&
                  "border-primary shadow-lg ring-2 ring-primary/30",
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.featured && (
                    <Badge>{t("pricing.popular")}</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  )}
                </div>
                <CardDescription className="mt-1">{plan.desc}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Separator />
                <ul className="flex flex-col gap-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Link
                  href="/auth/login"
                  className={cn(
                    buttonVariants({
                      variant: plan.featured ? "default" : "outline",
                    }),
                    "w-full",
                  )}
                >
                  {plan.cta}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
