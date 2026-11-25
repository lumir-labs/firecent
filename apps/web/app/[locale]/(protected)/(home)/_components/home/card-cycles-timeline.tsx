"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  AccountSwatch,
  SectionHeader,
  formatMoneyText,
} from "@/components/finance";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type CardTimelineItem = {
  id: number;
  name: string;
  color: string | null;
  accountNumber: string | null;
  currency: string;
  debt: number;
  cashPayment: number | null;
  creditLimit: number | null;
  interestRate: number | null;
  cycleDays: number;
  estimatedInterest: number | null;
  estimatedMinPayment: number;
  installmentsMonthly?: number;
  nextCutoffDate: string | null;
  cutoffInDays: number | null;
  nextDueDate: string | null;
  dueInDays: number | null;
};

function formatShortDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

function clampPct(days: number, windowDays: number): number {
  const raw = (days / Math.max(1, windowDays)) * 100;
  return Math.max(3, Math.min(97, raw));
}

export function CardCyclesTimeline({
  cards,
  primaryCurrency,
}: {
  cards: CardTimelineItem[];
  primaryCurrency: string;
}) {
  const locale = useLocale();
  const t = useTranslations("HomeV2.cardTimeline");

  if (cards.length === 0) return null;

  const sameCurrencyCards = cards.filter((c) => c.currency === primaryCurrency);
  const totalMinPayment = sameCurrencyCards.reduce(
    (sum, c) => sum + c.estimatedMinPayment,
    0,
  );
  const cardsWithInterest = sameCurrencyCards.filter(
    (c) => c.estimatedInterest != null,
  );
  const totalInterest = cardsWithInterest.reduce(
    (sum, c) => sum + (c.estimatedInterest ?? 0),
    0,
  );
  const hasAnyInterestConfig = cardsWithInterest.length > 0;

  // Shared horizontal scale across all cards so matching dates align vertically
  const sharedWindowDays = Math.max(
    30,
    ...cards.map((c) => Math.max(c.cutoffInDays ?? 0, c.dueInDays ?? 0)),
  );
  const midDays = Math.round(sharedWindowDays / 2);

  const shortCountdown = (days: number) =>
    days <= 0 ? t("today") : days === 1 ? t("tomorrow") : `${days}d`;

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader
        title={t("title")}
        action={{ label: t("manage"), href: "/accounts" }}
      />

      <Card variant="plain" className="overflow-hidden">
        {/* Compact summary + shared timeline scale header */}
        <div className="border-b bg-muted/30 px-3.5 pt-2.5 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px]">
            <div className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">
                {t("totalMinPayment")}
              </span>
              <span className="num font-semibold text-foreground">
                {totalMinPayment > 0 ? "~" : ""}
                {formatMoneyText(locale, totalMinPayment, primaryCurrency, {
                  tone: "plain",
                })}
              </span>
            </div>
            {hasAnyInterestConfig && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">
                  {t("estInterestTotal")}
                </span>
                <span
                  className={cn(
                    "num font-semibold",
                    totalInterest > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {totalInterest > 0 ? "~" : ""}
                  {formatMoneyText(locale, totalInterest, primaryCurrency, {
                    tone: "plain",
                  })}
                </span>
              </div>
            )}
          </div>

          <div
            aria-hidden="true"
            className="num mt-1.5 flex items-center justify-between text-[10px] font-medium tracking-wide text-muted-foreground/65"
          >
            <span className="capitalize">{t("today")}</span>
            <span>+{midDays}d</span>
            <span>+{sharedWindowDays}d</span>
          </div>
        </div>

        {/* Per-card compact rows on a shared horizontal calendar rail */}
        <div className="divide-y divide-border/60">
          {cards.map((card) => {
            const hasCutoff =
              card.nextCutoffDate != null && card.cutoffInDays != null;
            const hasDue = card.nextDueDate != null && card.dueInDays != null;
            const hasDates = hasCutoff || hasDue;

            const cutoffPct = hasCutoff
              ? clampPct(card.cutoffInDays!, sharedWindowDays)
              : null;
            const duePct = hasDue
              ? clampPct(card.dueInDays!, sharedWindowDays)
              : null;

            const isUrgentDue =
              card.debt > 0 && card.dueInDays != null && card.dueInDays <= 3;
            const isSoonDue =
              card.debt > 0 &&
              card.dueInDays != null &&
              card.dueInDays > 3 &&
              card.dueInDays <= 7;

            const soonestPct =
              cutoffPct != null && duePct != null
                ? Math.min(cutoffPct, duePct)
                : (duePct ?? cutoffPct ?? 0);

            const events: {
              kind: "cutoff" | "payment";
              days: number;
              date: string;
            }[] = [];
            if (hasCutoff) {
              events.push({
                kind: "cutoff",
                days: card.cutoffInDays!,
                date: card.nextCutoffDate!,
              });
            }
            if (hasDue) {
              events.push({
                kind: "payment",
                days: card.dueInDays!,
                date: card.nextDueDate!,
              });
            }
            events.sort((a, b) => a.days - b.days);

            const paymentBarColor = isUrgentDue
              ? "bg-destructive"
              : isSoonDue
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-primary";
            const paymentTextColor = isUrgentDue
              ? "text-destructive"
              : isSoonDue
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground";
            const progressFillColor = isUrgentDue
              ? "from-destructive/15 to-destructive/40"
              : isSoonDue
                ? "from-amber-500/15 to-amber-500/40"
                : "from-primary/12 to-primary/35";

            const metaParts: string[] = [];
            if (card.cashPayment != null) {
              metaParts.push(
                t("cashPaymentInline", {
                  amount: formatMoneyText(
                    locale,
                    card.cashPayment,
                    card.currency,
                    { tone: "plain" },
                  ),
                }),
              );
            } else if (card.debt > 0) {
              metaParts.push(
                t("balanceInline", {
                  amount: formatMoneyText(locale, card.debt, card.currency, {
                    tone: "plain",
                  }),
                }),
              );
            }
            if (card.installmentsMonthly && card.installmentsMonthly > 0) {
              metaParts.push(
                t("installmentsInline", {
                  amount: formatMoneyText(
                    locale,
                    card.installmentsMonthly,
                    card.currency,
                    { tone: "plain" },
                  ),
                }),
              );
            }
            if (card.interestRate != null) {
              metaParts.push(`${card.interestRate}%`);
            }

            return (
              <Link
                key={card.id}
                href={`/accounts/${card.id}`}
                className="flex flex-col gap-2 px-3.5 py-2.5 transition-colors hover:bg-accent/50"
              >
                {/* Row 1: card name + balance/APR on left · estimated min payment + est interest on right */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AccountSwatch
                      type="CREDIT_CARD"
                      color={card.color}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] leading-snug font-semibold text-foreground">
                        {card.name}
                      </p>
                      {metaParts.length > 0 && (
                        <p className="num truncate text-[11px] leading-tight text-muted-foreground">
                          {metaParts.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {card.debt === 0 ? (
                      <>
                        <span className="num block text-[14px] leading-snug font-medium text-muted-foreground">
                          {formatMoneyText(locale, 0, card.currency, {
                            tone: "plain",
                          })}
                        </span>
                        <span className="block text-[11px] leading-tight font-medium text-positive">
                          {t("paidOff")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span
                          title={t("minPaymentTooltip")}
                          className="num inline-flex items-baseline gap-1 text-[14px] leading-snug font-semibold text-foreground"
                        >
                          <span>
                            ~
                            {formatMoneyText(
                              locale,
                              card.estimatedMinPayment,
                              card.currency,
                              { tone: "plain" },
                            )}
                          </span>
                          <span className="text-[10.5px] font-medium text-muted-foreground">
                            {t("minPaymentLabel")}
                          </span>
                        </span>
                        {card.estimatedInterest != null ? (
                          <span
                            title={t("interestTooltip", {
                              days: String(card.cycleDays),
                            })}
                            className="num block text-[11px] leading-tight font-medium text-amber-600 dark:text-amber-400"
                          >
                            {t("estInterestShort", {
                              amount: formatMoneyText(
                                locale,
                                card.estimatedInterest,
                                card.currency,
                                { tone: "plain" },
                              ),
                            })}
                          </span>
                        ) : (
                          <span className="block text-[11px] leading-tight text-muted-foreground/70">
                            {t("noApr")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Row 2: thicker 8px timeline bar + vertical rounded pill notches + chronological legend */}
                {hasDates ? (
                  <div className="flex flex-col gap-1.5">
                    <div
                      aria-hidden="true"
                      className="relative h-2 w-full rounded-full bg-muted/85"
                    >
                      {/* Subtle mid-cycle reference tick */}
                      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/80" />

                      {/* Soft gradient progress fill from today to soonest milestone */}
                      {soonestPct > 0 && (
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r",
                            progressFillColor,
                          )}
                          style={{ width: `${soonestPct}%` }}
                        />
                      )}

                      {/* Subtle bridge between cutoff and payment when both are set */}
                      {cutoffPct != null && duePct != null && (
                        <span
                          className="absolute inset-y-0 rounded-full bg-sky-500/18 dark:bg-sky-400/20"
                          style={{
                            left: `${Math.min(cutoffPct, duePct)}%`,
                            width: `${Math.max(2, Math.abs(duePct - cutoffPct))}%`,
                          }}
                        />
                      )}

                      {/* Cutoff marker: slim vertical rounded pill (sky blue) */}
                      {cutoffPct != null && (
                        <span
                          className="absolute top-1/2 h-3.5 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500 ring-2 ring-card dark:bg-sky-400"
                          style={{ left: `${cutoffPct}%` }}
                        />
                      )}

                      {/* Payment due marker: slim vertical rounded pill (primary / amber / red) */}
                      {duePct != null && (
                        <span
                          className={cn(
                            "absolute top-1/2 h-3.5 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                            paymentBarColor,
                          )}
                          style={{ left: `${duePct}%` }}
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px]">
                      {events.map((ev) => {
                        const isPayment = ev.kind === "payment";
                        return (
                          <span
                            key={ev.kind}
                            className={cn(
                              "inline-flex items-center gap-1.5 text-muted-foreground",
                              events.length === 1 && "ml-auto",
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "h-2.5 w-[3.5px] shrink-0 rounded-full",
                                isPayment
                                  ? paymentBarColor
                                  : "bg-sky-500 dark:bg-sky-400",
                              )}
                            />
                            <span>
                              {isPayment ? t("payment") : t("cutoff")}
                            </span>
                            <span
                              className={cn(
                                "num font-medium",
                                isPayment
                                  ? paymentTextColor
                                  : "text-sky-700 dark:text-sky-300",
                              )}
                            >
                              {formatShortDate(ev.date, locale)}
                            </span>
                            <span className="num text-muted-foreground/80">
                              · {shortCountdown(ev.days)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t("noDates")}</span>
                    <span className="font-medium text-primary-text">
                      {t("configure")}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
