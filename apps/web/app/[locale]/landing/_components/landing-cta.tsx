import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { getTranslations } from "next-intl/server";

export async function LandingCta() {
  const t = await getTranslations("Landing");

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <Card className="relative overflow-hidden border-primary/20 bg-primary py-12 text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_80%_at_50%_50%,black,transparent)]"
        />
        <CardContent className="relative flex flex-col items-center px-6 text-center">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {t("cta.title")}
          </h2>
          <p className="mt-4 max-w-xl text-primary-foreground/80">
            {t("cta.subtitle")}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/auth/login"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "w-full sm:w-auto",
              )}
            >
              {t("cta.primaryCta")}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto",
              )}
            >
              {t("cta.secondaryCta")}
            </Link>
          </div>
          <p className="mt-4 text-xs text-primary-foreground/70">
            {t("cta.note")}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
