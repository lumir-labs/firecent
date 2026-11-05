import {
  Component,
  Database,
  Globe,
  Hexagon,
  MoonStar,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { getTranslations } from "next-intl/server";

const STACK = [
  { icon: Hexagon, label: "Next.js 16" },
  { icon: Database, label: "Prisma 7" },
  { icon: Workflow, label: "tRPC 11" },
  { icon: Globe, label: "next-intl" },
  { icon: Component, label: "Shadcn/ui" },
  { icon: MoonStar, label: "Tailwind v4" },
];

export async function LandingLogos() {
  const t = await getTranslations("Landing");

  return (
    <section className="border-y bg-muted/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          {t("logos.title")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {STACK.map(({ icon: Icon, label }) => (
            <Badge
              key={label}
              variant="outline"
              className="gap-1.5 bg-card px-3.5 py-1.5 text-sm font-medium"
            >
              <Icon className="size-4 text-primary" />
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
