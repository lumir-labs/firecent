"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  Layers,
  Percent,
  Plus,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

import { AI_ASSISTANT_NAME } from "@app/lib";
import { PwaInstallCard } from "@/components/common/pwa-install-card";
import { FirecentMark, Money } from "@/components/finance";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Miniature illustrative Card Cycle Rail using Firecent's exact timeline tokens
 * (sky-blue cutoff pill + violet payment pill) so new users see the value of
 * credit card tracking before adding their first card.
 */
function MiniCardCyclePreview({
  previewTag,
  cardName,
  cashLabel,
  noInterestLabel,
  cutoffLabel,
  dueLabel,
}: {
  previewTag: string;
  cardName: string;
  cashLabel: string;
  noInterestLabel: string;
  cutoffLabel: string;
  dueLabel: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border bg-muted/35 p-3.5"
    >
      {/* Row 1: card identity + preview tag */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white shadow-xs"
            style={{
              background:
                "linear-gradient(135deg, #1e293b 0%, #0f172a 55%, #334155 100%)",
            }}
          >
            <CreditCard className="size-4 opacity-90" />
          </span>
          <span className="truncate text-[13.5px] font-semibold text-foreground">
            {cardName}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-background/80 px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-muted-foreground ring-1 ring-border/70">
          {previewTag}
        </span>
      </div>

      {/* Row 2: statement balance + 0% interest badge */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className="num text-[12px] font-medium whitespace-nowrap text-muted-foreground">
          {cashLabel}
        </p>
        <span className="shrink-0 rounded-full bg-positive/10 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-positive">
          {noInterestLabel}
        </span>
      </div>

      {/* Signature 8px cycle rail */}
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="relative h-2 w-full rounded-full bg-muted">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/15 to-primary/35"
            style={{ width: "42%" }}
          />
          <span
            className="absolute inset-y-0 rounded-full bg-sky-500/20 dark:bg-sky-400/22"
            style={{ left: "42%", width: "36%" }}
          />
          <span
            className="absolute top-1/2 h-3.5 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500 ring-2 ring-card dark:bg-sky-400"
            style={{ left: "42%" }}
          />
          <span
            className="absolute top-1/2 h-3.5 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
            style={{ left: "78%" }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-[3.5px] rounded-full bg-sky-500 dark:bg-sky-400" />
            <span className="num font-medium text-sky-700 dark:text-sky-300">
              {cutoffLabel}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-[3.5px] rounded-full bg-primary" />
            <span className="num font-medium text-foreground">{dueLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Polished new-user Home Launchpad shown when a Space has 0 accounts.
 * Draws users directly into Firecent's two core pillars:
 *   1) Credit card cycle, statement-balance & interest tracking
 *   2) Blaze AI statement import & financial Q&A
 */
export function HomeEmptyLaunchpad({
  greeting,
  onAddCreditCard,
  onAddAccount,
}: {
  greeting: string;
  onAddCreditCard: () => void;
  onAddAccount: () => void;
}) {
  const t = useTranslations("HomeV2");
  const aiVars = { aiName: AI_ASSISTANT_NAME };

  return (
    <div className="flex flex-col gap-6">
      {/* Hero command card */}
      <section className="relative overflow-hidden rounded-3xl bg-hero p-6 text-hero-foreground sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/20 blur-3xl"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[18px] font-semibold tracking-[-0.015em] text-hero-foreground lg:hidden">
              {greeting}
            </p>

            <p className="mt-2 text-[13px] font-medium text-hero-foreground/65 lg:mt-0">
              {t("balanceLabel")}
            </p>
            <Money
              value={0}
              currency="USD"
              size="hero"
              tone="plain"
              surface="hero"
              dimCents
              className="mt-0.5 opacity-85"
            />
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-hero-foreground/75">
              {t("onboarding.heroHint", aiVars)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0">
            <Button
              type="button"
              size="touch"
              onClick={onAddCreditCard}
              className="shadow-[0_10px_24px_-8px_color-mix(in_srgb,var(--primary)_80%,transparent)]"
            >
              <CreditCard className="size-4" aria-hidden />
              <span>{t("onboarding.addCreditCardCta")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={onAddAccount}
              className="border-hero-border bg-white/6 text-hero-foreground ring-0 hover:bg-white/12 hover:text-hero-foreground"
            >
              <Wallet className="size-4" aria-hidden />
              <span>{t("onboarding.addAccountCta")}</span>
            </Button>
          </div>
        </div>

        {/* Integrated 3-step quick-start strip inside the Hero */}
        <div className="relative mt-6 border-t border-hero-border/80 pt-4">
          <p className="mb-3 text-[11.5px] font-semibold tracking-wide text-hero-foreground/60 uppercase">
            {t("onboarding.title")}
          </p>
          <ol className="grid gap-2.5 sm:grid-cols-3">
            <li aria-current="step">
              <button
                type="button"
                onClick={onAddCreditCard}
                className="group flex h-full w-full items-start gap-3 rounded-2xl border border-primary/45 bg-primary/14 p-3 text-left transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
                  1
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug font-semibold text-hero-foreground">
                    {t("onboarding.step1Title")}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-hero-foreground/70">
                    {t("onboarding.step1Body")}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-hero-foreground/60 transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </li>

            <li>
              <Link
                href="/assistant"
                className="group flex h-full items-start gap-3 rounded-2xl border border-hero-border bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-hero-border bg-white/5 text-[12px] font-semibold text-hero-foreground/80">
                  2
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug font-semibold text-hero-foreground">
                    {t("onboarding.step2Title", aiVars)}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-hero-foreground/65">
                    {t("onboarding.step2Body")}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-hero-foreground/45 transition-transform group-hover:translate-x-0.5 group-hover:text-hero-foreground/80"
                />
              </Link>
            </li>

            <li>
              <Link
                href="/budget"
                className="group flex h-full items-start gap-3 rounded-2xl border border-hero-border bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-hero-border bg-white/5 text-[12px] font-semibold text-hero-foreground/80">
                  3
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug font-semibold text-hero-foreground">
                    {t("onboarding.step3Title")}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-hero-foreground/65">
                    {t("onboarding.step3Body")}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-hero-foreground/45 transition-transform group-hover:translate-x-0.5 group-hover:text-hero-foreground/80"
                />
              </Link>
            </li>
          </ol>
        </div>
      </section>

      {/* Dual-Superpower Asymmetric Feature Grid */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Pillar 1: Credit Card Tracking (7 cols) */}
        <section className="flex flex-col justify-between gap-5 rounded-3xl border bg-card p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-semibold text-primary-text">
                <CreditCard className="size-3.5" aria-hidden />
                {t("onboarding.cardsEyebrow")}
              </span>
            </div>

            <div>
              <h2 className="text-[19px] leading-snug font-semibold tracking-[-0.015em] text-foreground sm:text-[20px]">
                {t("onboarding.cardsTitle")}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {t("onboarding.cardsBody")}
              </p>
            </div>

            <MiniCardCyclePreview
              previewTag={t("onboarding.cardsPreviewTag")}
              cardName={t("onboarding.cardsPreviewName")}
              cashLabel={t("onboarding.cardsPreviewCash")}
              noInterestLabel={t("onboarding.cardsPreviewNoInterest")}
              cutoffLabel={t("onboarding.cardsPreviewCutoff")}
              dueLabel={t("onboarding.cardsPreviewDue")}
            />

            <div className="flex flex-wrap gap-2 text-[12px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1">
                <CalendarClock className="size-3.5 text-primary-text" aria-hidden />
                {t("onboarding.cardsPillCash")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1">
                <Percent className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                {t("onboarding.cardsPillInterest")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1">
                <Layers className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
                {t("onboarding.cardsPillInstallments")}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="button" size="touch" onClick={onAddCreditCard}>
              <Plus className="size-4" aria-hidden />
              <span>{t("onboarding.cardsPrimaryCta")}</span>
            </Button>
            <Link
              href="/accounts"
              className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span>{t("onboarding.cardsSecondaryCta")}</span>
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </section>

        {/* Pillar 2: Blaze AI (5 cols) */}
        <section className="flex flex-col justify-between gap-5 rounded-3xl border border-assistant-border bg-assistant p-5 sm:p-6 lg:col-span-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-assistant-border bg-card shadow-2xs">
                <FirecentMark className="h-5" />
              </span>
              <span className="text-[13px] font-semibold text-assistant-accent">
                {t("onboarding.aiEyebrow", aiVars)}
              </span>
            </div>

            <div>
              <h2 className="text-[19px] leading-snug font-semibold tracking-[-0.015em] text-foreground sm:text-[20px]">
                {t("onboarding.aiTitle")}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/80">
                {t("onboarding.aiBody", aiVars)}
              </p>
            </div>

            <ul className="divide-y divide-assistant-border/60 rounded-2xl border border-assistant-border/80 bg-card/85 text-[13px]">
              <li className="flex items-center gap-2.5 px-3.5 py-2.5 font-medium text-foreground">
                <FileSpreadsheet
                  className="size-4 shrink-0 text-assistant-accent"
                  aria-hidden
                />
                <span>{t("onboarding.aiFeatureFormats")}</span>
              </li>
              <li className="flex items-center gap-2.5 px-3.5 py-2.5 font-medium text-foreground">
                <CheckCircle2
                  className="size-4 shrink-0 text-positive"
                  aria-hidden
                />
                <span>{t("onboarding.aiFeatureReconcile")}</span>
              </li>
              <li className="flex items-center gap-2.5 px-3.5 py-2.5 font-medium text-foreground">
                <ShieldCheck
                  className="size-4 shrink-0 text-primary-text"
                  aria-hidden
                />
                <span>{t("onboarding.aiFeatureSafe")}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Link
              href="/assistant"
              className={cn(
                buttonVariants({ size: "touch" }),
                "w-full justify-center bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              <FirecentMark className="h-4" />
              <span>{t("onboarding.aiPrimaryCta", aiVars)}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <p className="text-center text-[11.5px] text-foreground/65">
              {t("onboarding.aiFootnote")}
            </p>
          </div>
        </section>
      </div>

      {/* PWA install prompt (non-iOS when available) or iOS Add-to-Home-Screen guide; disappears once onboarding finishes */}
      <PwaInstallCard variant="onboarding" />
    </div>
  );
}

/**
 * Compact spotlight shown in the active Home view when the user has accounts
 * (e.g. checking/cash) but hasn't added a credit card yet.
 */
export function CreditCardSetupSpotlight({
  onAddCreditCard,
}: {
  onAddCreditCard: () => void;
}) {
  const t = useTranslations("HomeV2.spotlights");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <section className="relative rounded-2xl border bg-card p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("cardBannerDismiss")}
        className="absolute top-2 right-2 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="flex flex-col gap-3.5 pr-7 sm:flex-row sm:items-center sm:justify-between sm:pr-8">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary-text">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold tracking-wide text-primary-text uppercase">
              {t("cardBannerEyebrow")}
            </p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-foreground">
              {t("cardBannerTitle")}
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              {t("cardBannerBody")}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="touch"
          variant="outline"
          onClick={onAddCreditCard}
          className="shrink-0 self-start sm:self-center"
        >
          <Plus className="size-4" aria-hidden />
          <span>{t("cardBannerCta")}</span>
        </Button>
      </div>
    </section>
  );
}

/**
 * Compact Blaze AI doorway rendered on the active Home screen so users can
 * jump straight into statement reconciliation or financial Q&A.
 */
export function BlazeHomeSpotlight() {
  const t = useTranslations("HomeV2.spotlights");
  const aiVars = { aiName: AI_ASSISTANT_NAME };

  return (
    <section className="rounded-2xl border border-assistant-border bg-assistant p-4">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-assistant-accent">
        <FirecentMark className="h-4.5" />
        <span>{t("blazeEyebrow", aiVars)}</span>
      </div>
      <h2 className="mt-2 text-[15.5px] leading-snug font-semibold text-foreground">
        {t("blazeTitle")}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">
        {t("blazeBody", aiVars)}
      </p>
      <div className="mt-3.5">
        <Link
          href="/assistant"
          className={cn(
            buttonVariants({ variant: "outline", size: "touch" }),
            "border-assistant-border bg-card text-foreground ring-assistant-border hover:bg-card/80",
          )}
        >
          <span>{t("blazeCta", aiVars)}</span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
