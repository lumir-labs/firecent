"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Download,
  Loader2,
  PlusSquare,
  Share,
  Smartphone,
} from "lucide-react";

import { SectionHeader } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { firecentToast } from "@/components/ui/sonner";
import {
  initPwaInstallListeners,
  usePwaInstall,
} from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils";

/**
 * Mounts once in the root layout so `beforeinstallprompt` is captured before
 * the user navigates to `/onboarding`, `/`, or `/settings`.
 */
export function PwaInstallBootstrap() {
  useEffect(() => {
    initPwaInstallListeners();
  }, []);
  return null;
}

/**
 * Contextual PWA install card:
 * - Non-iOS with available `beforeinstallprompt`: renders a 1-click Install button.
 * - iOS browser (not standalone): renders step-by-step instructions to add to Home Screen.
 * - Installed or unavailable: renders nothing.
 */
export function PwaInstallCard({
  variant = "onboarding",
  className,
}: {
  variant?: "onboarding" | "settings";
  className?: string;
}) {
  const t = useTranslations("Pwa");
  const { mode, installing, install } = usePwaInstall();

  if (mode !== "prompt" && mode !== "ios") {
    return null;
  }

  async function handleInstall() {
    const outcome = await install();
    if (outcome === "accepted") {
      firecentToast(t("installedToast"));
    }
  }

  const cardBody =
    mode === "prompt" ? (
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary-text">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-[14.5px] leading-snug font-semibold text-foreground">
              {t("installTitle")}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              {t("installBody")}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="touch"
          variant={variant === "settings" ? "default" : "outline"}
          disabled={installing}
          onClick={() => void handleInstall()}
          className="shrink-0 self-start sm:self-center"
        >
          {installing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          <span>{installing ? t("installing") : t("installCta")}</span>
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-3 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary-text">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[14.5px] leading-snug font-semibold text-foreground">
              {t("iosTitle")}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              {t("iosBody")}
            </p>
          </div>
        </div>

        <ol className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-3 text-[12.5px] text-foreground/90">
          <li className="flex items-center gap-2.5">
            <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary-text">
              1
            </span>
            <span className="flex flex-wrap items-center gap-1 leading-snug">
              <span>{t("iosStep1Before")}</span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-[11.5px] font-semibold text-foreground">
                <Share className="size-3 text-primary-text" aria-hidden />
                {t("iosShareLabel")}
              </span>
              <span>{t("iosStep1After")}</span>
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="num grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary-text">
              2
            </span>
            <span className="flex flex-wrap items-center gap-1 leading-snug">
              <span>{t("iosStep2Before")}</span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-[11.5px] font-semibold text-foreground">
                <PlusSquare className="size-3 text-primary-text" aria-hidden />
                {t("iosAddHomeLabel")}
              </span>
            </span>
          </li>
        </ol>
      </div>
    );

  if (variant === "settings") {
    return (
      <section className={cn("flex flex-col gap-3", className)}>
        <SectionHeader title={t("settingsSection")} />
        <Card variant="plain" className="p-4">
          {cardBody}
        </Card>
      </section>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-2xs",
        className,
      )}
    >
      {cardBody}
    </div>
  );
}
