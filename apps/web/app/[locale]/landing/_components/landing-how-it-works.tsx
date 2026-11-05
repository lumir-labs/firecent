import { ArrowRight, Copy, Paintbrush, Rocket } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getTranslations } from "next-intl/server";

export async function LandingHowItWorks() {
  const t = await getTranslations("Landing");

  const steps = [
    { icon: Copy, title: t("how.step1Title"), desc: t("how.step1Desc") },
    { icon: Paintbrush, title: t("how.step2Title"), desc: t("how.step2Desc") },
    { icon: Rocket, title: t("how.step3Title"), desc: t("how.step3Desc") },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {t("how.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {t("how.title")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("how.subtitle")}</p>
        </div>

        <div className="relative mt-12 grid gap-4 md:grid-cols-3">
          <div
            aria-hidden
            className="absolute top-10 right-[16%] left-[16%] hidden h-px bg-border md:block"
          />
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <Card key={title} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="relative flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Icon className="size-5" />
                  </span>
                  <Badge variant="secondary">0{i + 1}</Badge>
                </div>
                <CardTitle className="mt-4">{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            {t("how.cta")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
