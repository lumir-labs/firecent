"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Minus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { trpc } from "@app/api/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney as money, moneyParts as parts } from "@/lib/money";
import { cn } from "@/lib/utils";

const HIDDEN = "••••••";
const MONTHS_BACK = 12;

type Scope = "me" | "household";

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Local month keys, newest first: the current month and the 11 before it. */
function recentMonths(now: Date) {
  return Array.from({ length: MONTHS_BACK }, (_, i) =>
    monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)),
  );
}

function monthLabel(
  locale: string,
  key: string,
  withYear: boolean,
  capitalize = true,
) {
  const [y, m] = key.split("-").map(Number);
  const name = new Intl.DateTimeFormat(locale, {
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(y, m - 1, 1));
  return capitalize
    ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
    : name;
}

function previousMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 2, 1));
}

/** Big amount: the decimals render smaller so the integer part leads. */
function BigAmount({
  value,
  currency,
  hidden,
}: {
  value: number;
  currency: string;
  hidden: boolean;
}) {
  const locale = useLocale();
  if (hidden) return <span aria-hidden>{HIDDEN}</span>;
  return (
    <>
      {parts(locale, value, currency).map((part, i) =>
        part.type === "decimal" || part.type === "fraction" ? (
          <span
            key={i}
            className={cn(
              "text-2xl font-semibold",
              value < 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

/** Decorative wave, painted with theme tokens only. */
function Wave() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute right-0 bottom-0 -z-10 h-full w-3/5"
    >
      <defs>
        <linearGradient id="nw-wave-a" x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "var(--chart-5)", stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: "var(--primary)", stopOpacity: 0.55 }} />
        </linearGradient>
        <linearGradient id="nw-wave-b" x1="0" x2="1">
          <stop offset="0" style={{ stopColor: "var(--chart-2)", stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: "var(--chart-3)", stopOpacity: 0.45 }} />
        </linearGradient>
      </defs>
      <path
        d="M0 200 C120 190 210 150 290 110 C340 85 375 70 400 40 L400 200Z"
        fill="url(#nw-wave-a)"
      />
      <path d="M120 200 C220 190 300 170 400 120 L400 200Z" fill="url(#nw-wave-b)" />
    </svg>
  );
}

export function NetWorthCard({ className }: { className?: string }) {
  const t = useTranslations("Home.netWorth");
  const locale = useLocale();
  const [now] = useState(() => new Date());
  const months = recentMonths(now);
  const [month, setMonth] = useState(months[0]);
  const [scope, setScope] = useState<Scope>("me");
  const [hidden, setHidden] = useState(false);

  const { data, isPending, isError, refetch, isRefetching } =
    trpc.dashboard.netWorth.useQuery(
      { scope, month },
      { placeholderData: keepPreviousData },
    );

  const withYear = (key: string) => key.slice(0, 4) !== String(now.getFullYear());
  const labelOf = (key: string) => monthLabel(locale, key, withYear(key));
  const showScope = (data?.memberCount ?? 1) > 1;
  const prev = previousMonthKey(month);

  return (
    <Card
      // Always-dark surface: scoping `.dark` re-resolves every token below it.
      className={cn(
        "dark relative isolate gap-0 border-0 py-5 text-foreground sm:py-6",
        className,
      )}
      style={{
        background:
          "linear-gradient(150deg, color-mix(in srgb, var(--primary) 26%, var(--background)) 0%, var(--card) 70%)",
      }}
    >
      <Wave />
      <div className="flex flex-col gap-5 px-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
            <Wallet className="size-4 shrink-0" />
            <span className="truncate">{t("title")}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setHidden((h) => !h)}
              aria-pressed={hidden}
              aria-label={hidden ? t("show") : t("hide")}
            >
              {hidden ? <EyeOff /> : <Eye />}
            </Button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showScope && (
              <div
                role="group"
                aria-label={t("scopeLabel")}
                className="flex h-8 items-center gap-0.5 rounded-md border border-foreground/10 bg-foreground/5 p-0.5"
              >
                {(["me", "household"] as const).map((s) => (
                  <Button
                    key={s}
                    size="xs"
                    variant="ghost"
                    aria-pressed={scope === s}
                    onClick={() => setScope(s)}
                    className={cn(
                      "h-full px-3 text-muted-foreground",
                      scope === s &&
                        "bg-foreground text-background hover:bg-foreground hover:text-background",
                    )}
                  >
                    {s === "me" ? t("scopeMe") : t("scopeHousehold")}
                  </Button>
                ))}
              </div>
            )}
            <Select value={month} onValueChange={(v) => v && setMonth(v)}>
              <SelectTrigger
                size="sm"
                aria-label={t("monthLabel")}
                className="border-foreground/10 bg-foreground/5 font-medium"
              >
                <SelectValue>{(v: string) => labelOf(v ?? month)}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {labelOf(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-11 w-56" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{t("error")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              {t("retry")}
            </Button>
          </div>
        ) : !data.primary ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Body
            d={data.primary}
            others={data.others}
            hidden={hidden}
            // Mid-sentence: no forced capital ("vs. octubre").
            prevMonth={monthLabel(locale, prev, withYear(prev), false)}
          />
        )}
      </div>
    </Card>
  );
}

function Body({
  d,
  others,
  hidden,
  prevMonth,
}: {
  d: {
    currency: string;
    netWorth: number;
    delta: number;
    deltaPct: number | null;
  };
  others: string[];
  hidden: boolean;
  prevMonth: string;
}) {
  const t = useTranslations("Home.netWorth");
  const locale = useLocale();
  const fmt = (v: number, signed = false) =>
    hidden ? HIDDEN : money(locale, v, d.currency, signed);
  const trend = d.delta > 0 ? "up" : d.delta < 0 ? "down" : "flat";
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "text-4xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl",
          d.netWorth < 0 && "text-destructive",
        )}
      >
        <BigAmount value={d.netWorth} currency={d.currency} hidden={hidden} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {d.deltaPct !== null && (
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold tabular-nums",
              trend === "up" && "bg-emerald-500/15 text-emerald-400",
              trend === "down" && "bg-destructive/15 text-destructive",
              trend === "flat" && "bg-foreground/10 text-muted-foreground",
            )}
          >
            <TrendIcon className="size-3.5" />
            {hidden ? HIDDEN : `${Math.abs(d.deltaPct).toFixed(1)}%`}
          </span>
        )}
        <span>
          {t("vsMonth", { amount: fmt(d.delta, true), month: prevMonth })}
        </span>
      </div>

      {others.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("otherCurrencies", { currencies: others.join(", ") })}
        </p>
      )}
    </div>
  );
}
