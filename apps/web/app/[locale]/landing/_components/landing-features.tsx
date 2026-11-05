import {
  Globe,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getTranslations } from "next-intl/server";

export async function LandingFeatures() {
  const t = await getTranslations("Landing");

  const features = [
    { icon: Users, title: t("features.authTitle"), desc: t("features.authDesc") },
    { icon: Globe, title: t("features.i18nTitle"), desc: t("features.i18nDesc") },
    { icon: Workflow, title: t("features.apiTitle"), desc: t("features.apiDesc") },
    { icon: Palette, title: t("features.uiTitle"), desc: t("features.uiDesc") },
    { icon: ShieldCheck, title: t("features.rolesTitle"), desc: t("features.rolesDesc") },
    {
      icon: LayoutDashboard,
      title: t("features.themeTitle"),
      desc: t("features.themeDesc"),
    },
  ];

  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {t("features.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <CardTitle className="mt-4">{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
