"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Plus,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  ChangeLine,
  Money,
  NatureSwatch,
  PaceLegend,
  SectionHeader,
  Sparkline,
  StatPair,
  StateBlock,
  StepList,
  TransactionRow,
  UpcomingRow,
  formatMoneyText,
} from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useShell } from "../shell/shell-context";
import { TransactionDetailSheet } from "../../transactions/_components/transaction-detail-sheet";

function getGreetingKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 19) return "afternoon";
  return "evening";
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function HomeView({ userName }: { userName: string }) {
  const locale = useLocale();
  const t = useTranslations("HomeV2");
  const tShell = useTranslations("Shell");
  const { activeSpace, openAddTransaction } = useShell();
  const [detailId, setDetailId] = useState<number | null>(null);

  const month = currentMonthStr();
  const query = trpc.dashboard.home.useQuery({ month });
  const data = query.data;

  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const greeting = t(`greeting.${getGreetingKey()}`, { name: firstName });
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-4 lg:px-0 lg:pt-8">
        <Skeleton className="hidden h-8 w-64 lg:block" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <Skeleton className="h-56 w-full rounded-3xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="hidden h-56 w-full rounded-2xl lg:block" />
          </div>
        </div>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <div className="px-5 pt-6 lg:px-0">
        <StateBlock
          kind="error"
          action={{ label: t("retry"), onClick: () => query.refetch() }}
        />
      </div>
    );
  }

  const primaryCurrency = data.balance?.currency ?? data.monthSummary.currency;
  const totalNatureSpent =
    data.monthSummary.byNature.DEBO +
    data.monthSummary.byNature.NECESITO +
    data.monthSummary.byNature.QUIERO;

  const owePct =
    totalNatureSpent > 0
      ? (data.monthSummary.byNature.DEBO / totalNatureSpent) * 100
      : 0;
  const needPct =
    totalNatureSpent > 0
      ? (data.monthSummary.byNature.NECESITO / totalNatureSpent) * 100
      : 0;
  const wantPct =
    totalNatureSpent > 0
      ? (data.monthSummary.byNature.QUIERO / totalNatureSpent) * 100
      : 0;

  return (
    <div className="flex flex-col gap-6 px-5 pt-2 lg:px-0 lg:pt-8">
      {/* Desktop greeting header */}
      <header className="hidden items-center justify-between gap-4 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] leading-[32px] font-semibold tracking-[-0.02em]">
            {greeting}
          </h1>
          <p className="text-[13px] capitalize text-muted-foreground">
            {todayLabel}
            {activeSpace ? ` · ${activeSpace.name}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-touch"
            nativeButton={false}
            aria-label={tShell("nav.notifications")}
            render={<Link href="/notifications" />}
          >
            <Bell aria-hidden />
          </Button>
          <Button size="touch" onClick={() => openAddTransaction()}>
            <Plus className="size-4" aria-hidden />
            <span>{tShell("addTransaction")}</span>
          </Button>
        </div>
      </header>

      {/* Empty Space state */}
      {data.isEmpty ? (
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl bg-hero p-6 text-hero-foreground">
            <p className="text-[13px] text-hero-foreground/70">
              {t("balanceLabel")}
            </p>
            <Money
              value={0}
              currency="USD"
              size="hero"
              tone="plain"
              surface="hero"
              dimCents
              className="mt-1 opacity-75"
            />
          </div>

          <section className="flex flex-col gap-3">
            <SectionHeader title={t("onboarding.title")} />
            <StepList
              steps={[
                {
                  title: t("onboarding.step1Title"),
                  body: t("onboarding.step1Body"),
                  done: false,
                  active: true,
                  href: "/accounts",
                },
                {
                  title: t("onboarding.step2Title"),
                  body: t("onboarding.step2Body"),
                  done: false,
                  active: false,
                  href: "/transactions",
                },
                {
                  title: t("onboarding.step3Title"),
                  body: t("onboarding.step3Body"),
                  done: false,
                  active: false,
                  href: "/budget",
                },
              ]}
            />
          </section>
        </div>
      ) : (
        /* Main 12-col desktop / 1-col mobile layout (H1) */
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left column (lg: 1–7): Balance Hero + Coming up */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            {/* Block 1 · Hero Balance Card */}
            <Link
              href="/accounts"
              className="block rounded-3xl bg-hero p-6 text-hero-foreground transition-opacity hover:opacity-95"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-hero-foreground/70">
                  {t("balanceLabel")}
                </span>
                <span className="text-[12px] font-medium text-hero-foreground/60">
                  {t("viewAccounts")}
                </span>
              </div>

              <div className="mt-1 flex flex-col gap-1">
                <Money
                  value={data.balance?.amount ?? 0}
                  currency={primaryCurrency}
                  size="hero"
                  tone="plain"
                  surface="hero"
                  dimCents
                />
                {data.balance && data.balance.others.length > 0 && (
                  <p className="num text-[13px] text-hero-foreground/70">
                    {data.balance.others
                      .map(
                        (o) =>
                          `+ ${formatMoneyText(locale, o.amount, o.currency, { tone: "plain" })}`,
                      )
                      .join(" · ")}
                  </p>
                )}
              </div>

              <div className="mt-2">
                <ChangeLine
                  value={data.change}
                  currency={primaryCurrency}
                  context={t("thisMonthContext")}
                  surface="hero"
                />
              </div>

              {data.trend.length >= 2 && (
                <div className="mt-5">
                  <Sparkline
                    points={data.trend.map((p) => p.value)}
                    ariaLabel={t("trendAria")}
                    surface="hero"
                    className="h-20 w-full lg:h-36"
                  />
                  <div className="mt-2 flex justify-between text-[11px] text-hero-foreground/55">
                    {data.trend.map((p, idx) => (
                      <span key={`${p.label}-${idx}`}>{p.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </Link>

            {/* Block 3 · Coming up (next 7 days) */}
            <section className="flex flex-col gap-3">
              <SectionHeader title={t("comingUp")} />
              <Card variant="plain" className="divide-y overflow-hidden">
                {data.upcoming.length === 0 ? (
                  <p className="p-4 text-[14px] text-muted-foreground">
                    {t("nothingDue")}
                  </p>
                ) : (
                  data.upcoming.map((item) => (
                    <UpcomingRow
                      key={item.id}
                      date={item.date}
                      title={item.title}
                      amount={item.amount}
                      currency={item.currency}
                      kind="EXPENSE"
                      subtitle={t("cardPayment")}
                      mode="due"
                      dueInDays={item.dueInDays}
                      href={`/accounts/${item.accountId}`}
                    />
                  ))
                )}
              </Card>
            </section>
          </div>

          {/* Right column (lg: 8–12): This month + Recent activity (desktop) */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            {/* Block 2 · This month */}
            <section className="flex flex-col gap-3">
              <SectionHeader
                title={t("thisMonth")}
                action={{ label: t("setPlan"), href: "/budget" }}
              />
              <StatPair
                items={[
                  {
                    icon: ArrowDownLeft,
                    label: t("moneyIn"),
                    value: data.monthSummary.in,
                    currency: primaryCurrency,
                  },
                  {
                    icon: ArrowUpRight,
                    label: t("moneyOut"),
                    value: data.monthSummary.out,
                    currency: primaryCurrency,
                  },
                ]}
              />

              {/* Owe / Need / Want stacked bar */}
              <Card variant="plain" className="flex flex-col gap-3 p-4">
                <div
                  role="img"
                  aria-label={t("natureBreakdownAria")}
                  className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  {owePct > 0 && (
                    <div
                      className="h-full bg-nature-owe"
                      style={{ width: `${owePct}%` }}
                    />
                  )}
                  {needPct > 0 && (
                    <div
                      className="h-full bg-nature-need"
                      style={{ width: `${needPct}%` }}
                    />
                  )}
                  {wantPct > 0 && (
                    <div
                      className="h-full bg-nature-want"
                      style={{ width: `${wantPct}%` }}
                    />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  {(["DEBO", "NECESITO", "QUIERO"] as const).map((nature) => (
                    <div key={nature} className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <NatureSwatch nature={nature} />
                        <span>{t(`nature.${nature}`)}</span>
                      </span>
                      <Money
                        value={data.monthSummary.byNature[nature]}
                        currency={primaryCurrency}
                        size="inline"
                        tone="plain"
                        className="font-semibold text-foreground"
                      />
                    </div>
                  ))}
                </div>

                <PaceLegend
                  label={t("daysLeft", { days: String(data.monthSummary.daysLeft) })}
                />
              </Card>
            </section>

            {/* Block 4 (Desktop only per H1) · Recent activity */}
            <section className="hidden flex-col gap-3 lg:flex">
              <SectionHeader
                title={t("recentActivity")}
                action={{
                  label: t("allTransactions"),
                  href: "/transactions",
                }}
              />
              <Card variant="plain" className="divide-y overflow-hidden">
                {data.recent.length === 0 ? (
                  <p className="p-4 text-[14px] text-muted-foreground">
                    {t("noRecent")}
                  </p>
                ) : (
                  data.recent.map((r) => (
                    <TransactionRow
                      key={r.id}
                      title={r.title}
                      category={
                        r.category
                          ? { icon: r.category.icon, name: r.category.name }
                          : { icon: null, name: r.accountName }
                      }
                      account={r.accountName}
                      amount={r.amount}
                      currency={r.currency}
                      kind={r.type}
                      onClick={() => setDetailId(r.id)}
                    />
                  ))
                )}
              </Card>
            </section>
          </div>
        </div>
      )}

      <TransactionDetailSheet
        recordId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
