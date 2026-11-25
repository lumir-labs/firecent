"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flame } from "lucide-react";

import { formatMoneyText } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MAX_CYCLES = 360;
const MIN_FLOOR = 15;
const MIN_PRINCIPAL_DIVISOR = 60;

type SimResult = {
  cycles: number;
  capped: boolean;
  totalPaid: number;
  totalInterest: number;
  firstPayment: number;
  firstPrincipal: number;
  firstInterest: number;
};

function simulateMinimumPayoff(
  debt: number,
  apr: number,
  cycleDays: number,
): SimResult {
  const rate = (apr / 100) * (cycleDays / 365);
  let bal = debt;
  let totalPaid = 0;
  let totalInterest = 0;
  let cycles = 0;
  let firstPayment = 0;
  let firstPrincipal = 0;
  let firstInterest = 0;

  while (bal > 0.01 && cycles < MAX_CYCLES) {
    const interest = bal * rate;
    const rawMin = Math.max(MIN_FLOOR, bal / MIN_PRINCIPAL_DIVISOR + interest);
    const payment = Math.min(bal + interest, rawMin);
    const principal = Math.max(0, payment - interest);

    if (cycles === 0) {
      firstPayment = payment;
      firstInterest = interest;
      firstPrincipal = principal;
    }

    bal = Math.max(0, bal - principal);
    totalPaid += payment;
    totalInterest += interest;
    cycles += 1;
  }

  return {
    cycles,
    capped: bal > 0.01,
    totalPaid,
    totalInterest,
    firstPayment,
    firstPrincipal,
    firstInterest,
  };
}

export function CardPayoffCard({
  debt,
  currency,
  interestRate,
  cycleDays,
  installmentsMonthly = 0,
  installmentsInterest = 0,
  onEditCard,
}: {
  debt: number;
  currency: string;
  interestRate: number | null;
  cycleDays: number;
  installmentsMonthly?: number;
  installmentsInterest?: number;
  onEditCard: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("Accounts.detail.payoff");

  const minSim = useMemo(() => {
    if (debt <= 0 || interestRate == null || interestRate <= 0) return null;
    return simulateMinimumPayoff(debt, interestRate, cycleDays);
  }, [debt, interestRate, cycleDays]);

  if (debt <= 0 && installmentsMonthly <= 0) return null;

  if (debt > 0 && (interestRate == null || interestRate <= 0)) {
    return (
      <Card variant="plain" className="flex items-center justify-between gap-3 p-4">
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          {t("missingApr")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onEditCard}
          className="shrink-0"
        >
          {t("addApr")}
        </Button>
      </Card>
    );
  }

  if (!minSim) return null;

  const totalCycleMin = minSim.firstPayment + installmentsMonthly;
  const totalCycleInterest = minSim.firstInterest + installmentsInterest;
  const totalCyclePrincipal = Math.max(0, totalCycleMin - totalCycleInterest);

  const formatDuration = (cycles: number, capped = false) => {
    if (capped) return t("over30Years");
    const totalMonths = Math.max(1, Math.round((cycles * cycleDays) / 30.4375));
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years > 0 && months > 0) return t("yearsMonths", { years, months });
    if (years > 0) return t("yearsOnly", { years });
    return t("monthsOnly", { months: Math.max(1, months) });
  };

  const fmt = (v: number) =>
    formatMoneyText(locale, v, currency, { tone: "plain" });

  const principalPct =
    totalCycleMin > 0
      ? Math.round((totalCyclePrincipal / totalCycleMin) * 100)
      : 0;
  const interestPct = Math.max(0, 100 - principalPct);
  const interestDominates = interestPct >= 50;
  const multiplier = debt > 0 ? minSim.totalPaid / debt : 1;

  return (
    <Card variant="plain" className="divide-y overflow-hidden">
      {/* Section 1: Minimum payment principal vs interest breakdown */}
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("eyebrow")}
          </span>
          <span className="num text-[14px] font-semibold text-foreground">
            ~{fmt(totalCycleMin)}
            <span className="ml-0.5 text-[11.5px] font-normal text-muted-foreground">
              {t("perCycle")}
            </span>
          </span>
        </div>

        {/* Split bar: principal vs interest */}
        <div
          aria-hidden="true"
          className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {principalPct > 0 && (
            <div
              className="h-full rounded-l-full bg-primary transition-all"
              style={{ width: `${principalPct}%` }}
            />
          )}
          {interestPct > 0 && (
            <div
              className={cn(
                "h-full rounded-r-full transition-all",
                interestDominates
                  ? "bg-destructive/85"
                  : "bg-amber-500 dark:bg-amber-400",
              )}
              style={{ width: `${interestPct}%` }}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px]">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-[3.5px] rounded-full bg-primary"
            />
            <span className="text-muted-foreground">{t("principal")}</span>
            <span className="num font-semibold text-foreground">
              {fmt(totalCyclePrincipal)}
            </span>
            <span className="num text-[11px] text-muted-foreground">
              ({principalPct}%)
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-[3.5px] rounded-full",
                interestDominates
                  ? "bg-destructive"
                  : "bg-amber-500 dark:bg-amber-400",
              )}
            />
            <span className="text-muted-foreground">{t("interest")}</span>
            <span
              className={cn(
                "num font-semibold",
                interestDominates
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              {fmt(totalCycleInterest)}
            </span>
            <span className="num text-[11px] text-muted-foreground">
              ({interestPct}%)
            </span>
          </span>
        </div>

        {installmentsMonthly > 0 && (
          <p className="num text-[11.5px] text-muted-foreground">
            {t("includesInstallments", { amount: fmt(installmentsMonthly) })}
          </p>
        )}
      </div>

      {/* Section 2: Real total cost if only paying minimum */}
      <div className="grid grid-cols-2 gap-3 bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11.5px] text-muted-foreground">
            {t("totalPaid")}
          </p>
          <p className="num mt-0.5 text-[17px] leading-tight font-semibold text-foreground">
            {fmt(minSim.totalPaid)}
          </p>
          <p className="num mt-0.5 text-[11.5px] font-medium text-destructive">
            {t("extraInterest", { amount: fmt(minSim.totalInterest) })}
          </p>
        </div>

        <div className="min-w-0 text-right">
          <p className="text-[11.5px] text-muted-foreground">
            {t("timeToPayoff")}
          </p>
          <p className="num mt-0.5 text-[17px] leading-tight font-semibold text-foreground">
            {formatDuration(minSim.cycles, minSim.capped)}
          </p>
          {multiplier >= 1.2 && (
            <span className="num mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              <Flame className="size-3" aria-hidden />
              {t("multiplier", { factor: multiplier.toFixed(1) })}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
