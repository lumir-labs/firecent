import { ArrowRight, Play, Sparkles } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { getTranslations } from "next-intl/server";

export async function LandingHero() {
  const t = await getTranslations("Landing");

  const stats = [
    { value: t("hero.stat1Value"), label: t("hero.stat1Label") },
    { value: t("hero.stat2Value"), label: t("hero.stat2Label") },
    { value: t("hero.stat3Value"), label: t("hero.stat3Label") },
    { value: t("hero.stat4Value"), label: t("hero.stat4Label") },
  ];

  const bars = [38, 62, 45, 78, 55, 90, 68, 82, 58, 74, 96, 70];

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,var(--primary)_0%,transparent_70%)] opacity-15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-16 pb-12 text-center sm:px-6 md:pt-24">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
          <Sparkles className="size-3" />
          {t("hero.badge")}
        </Badge>

        <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
          {t("hero.title")}{" "}
          <span className="bg-gradient-to-r from-primary via-primary to-chart-2 bg-clip-text text-transparent">
            {t("hero.titleAccent")}
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
          {t("hero.subtitle")}
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            {t("hero.primaryCta")}
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full sm:w-auto",
            )}
          >
            <Play className="size-4" />
            {t("hero.secondaryCta")}
          </a>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">{t("hero.note")}</p>

        <div className="mt-8 flex items-center gap-3">
          <div className="flex -space-x-2">
            {["VR", "DF", "CD", "+9"].map((initials) => (
              <Avatar key={initials} className="ring-2 ring-background">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="font-semibold">4.9/5</span>
            <span className="text-muted-foreground">· {t("hero.mockRating")}</span>
          </div>
        </div>

        <Card className="mt-12 w-full max-w-4xl gap-0 overflow-hidden py-0 text-left shadow-xl">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-chart-4/70" />
            <span className="size-2.5 rounded-full bg-chart-1/70" />
            <span className="ml-3 hidden rounded-md bg-muted px-3 py-1 font-mono text-xs text-muted-foreground sm:block">
              {t("hero.mockUrl")}
            </span>
            <Badge variant="secondary" className="ml-auto">
              {t("hero.mockLive")}
            </Badge>
          </div>
          <CardContent className="grid gap-4 p-4 sm:p-6 md:grid-cols-3">
            {[
              { label: t("hero.kpi1"), value: "$12,480", delta: "+18%" },
              { label: t("hero.kpi2"), value: "2,347", delta: "+12%" },
              { label: t("hero.kpi3"), value: "1.8%", delta: "-0.4%" },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-lg border bg-card p-4"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">
                    {kpi.value}
                  </span>
                  <Badge variant="secondary" className="text-[11px]">
                    {kpi.delta}
                  </Badge>
                </div>
              </div>
            ))}
            <div className="rounded-lg border bg-card p-4 md:col-span-2">
              <div className="flex h-32 items-end gap-1.5">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={
                      i === 10
                        ? "flex-1 rounded-sm bg-primary"
                        : "flex-1 rounded-sm bg-primary/25"
                    }
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              {[t("hero.act1"), t("hero.act2"), t("hero.act3")].map((row, i) => (
                <div
                  key={row}
                  className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs"
                >
                  <span
                    className={
                      i === 0
                        ? "size-2 rounded-full bg-primary"
                        : "size-2 rounded-full bg-muted-foreground/40"
                    }
                  />
                  {row}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <dl className="mt-10 grid w-full max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <dt className="order-2 text-xs text-muted-foreground">
                {s.label}
              </dt>
              <dd className="order-1 text-2xl font-extrabold tracking-tight">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
