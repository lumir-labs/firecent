"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HandCoins, Plus, Wallet } from "lucide-react";
import { trpc } from "@app/api/client";

import {
  AccountRow,
  AccountRowSkeleton,
  Money,
  NavRow,
  PageHeader,
  StateBlock,
  formatMoneyText,
} from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountFormSheet } from "./account-form-sheet";

export function AccountsView() {
  const locale = useLocale();
  const t = useTranslations("Accounts");
  const tShell = useTranslations("Shell");
  const [addOpen, setAddOpen] = useState(false);

  const query = trpc.accounts.list.useQuery();
  const data = query.data;

  const renderGroup = (
    title: string,
    items: NonNullable<typeof data>["items"],
  ) => {
    if (items.length === 0) return null;
    const primaryCur = data?.primary?.currency ?? items[0].currency;
    const subtotal = items
      .filter((a) => a.currency === primaryCur)
      .reduce((sum, a) => sum + a.balance, 0);

    return (
      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-semibold tracking-tight text-muted-foreground">
            {title}
          </h2>
          <Money
            value={subtotal}
            currency={primaryCur}
            size="row-strong"
            tone="plain"
          />
        </div>
        <Card variant="plain" className="divide-y overflow-hidden">
          {items.map((acc) => {
            const isCard = acc.type === "CREDIT_CARD";
            const displayAmount =
              isCard &&
              acc.displayCreditMode === "AVAILABLE_CREDIT" &&
              acc.available != null
                ? acc.available
                : acc.balance;

            let secondary: React.ReactNode = undefined;
            if (isCard) {
              const parts: string[] = [];
              if (acc.nextDueDate && acc.dueInDays != null) {
                parts.push(
                  acc.dueInDays <= 0
                    ? t("dueToday")
                    : t("dueInDays", { days: String(acc.dueInDays) }),
                );
              } else if (
                acc.paymentDayType === "EVERY_X_DAYS" &&
                acc.paymentEveryDays
              ) {
                parts.push(
                  t("everyXDays", { days: String(acc.paymentEveryDays) }),
                );
              }
              if (acc.available != null) {
                parts.push(
                  t("available", {
                    amount: formatMoneyText(locale, acc.available, acc.currency, {
                      tone: "plain",
                    }),
                  }),
                );
              }
              if (parts.length > 0) {
                secondary = (
                  <span
                    className={
                      acc.dueInDays != null && acc.dueInDays <= 7
                        ? "text-warning"
                        : undefined
                    }
                  >
                    {parts.join(" · ")}
                  </span>
                );
              }
            }

            return (
              <AccountRow
                key={acc.id}
                name={acc.name}
                type={acc.type}
                last4={acc.accountNumber ?? undefined}
                balance={displayAmount}
                currency={acc.currency}
                finish={acc.color}
                hasCard={acc.hasCard}
                secondary={secondary}
                href={`/accounts/${acc.id}`}
              />
            );
          })}
        </Card>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        back="/"
        backLabel={tShell("nav.home")}
        actions={
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("addAccount")}
            onClick={() => setAddOpen(true)}
          >
            <Plus aria-hidden />
          </Button>
        }
        desktopActions={
          <Button size="touch" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span>{t("addAccount")}</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-5 lg:px-0">
        {query.isPending ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-56" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} variant="plain" className="divide-y overflow-hidden">
                  <AccountRowSkeleton />
                  <AccountRowSkeleton />
                </Card>
              ))}
            </div>
          </div>
        ) : query.isError ? (
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => query.refetch() }}
          />
        ) : !data || data.items.length === 0 ? (
          <StateBlock
            kind="empty"
            icon={Wallet}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={{ label: t("addAccount"), onClick: () => setAddOpen(true) }}
          />
        ) : (
          <>
            {/* Hero Balance */}
            {data.primary && (
              <section className="flex flex-col gap-1">
                <span className="text-[13px] text-muted-foreground">
                  {t("balanceLabel")}
                </span>
                <Money
                  value={data.primary.total}
                  currency={data.primary.currency}
                  size="hero"
                  tone="plain"
                  dimCents
                />
                {data.others.length > 0 && (
                  <p className="num text-[14px] font-medium text-muted-foreground">
                    {data.others
                      .map(
                        (o) =>
                          `+ ${formatMoneyText(locale, o.total, o.currency, { tone: "plain" })}`,
                      )
                      .join(" · ")}
                  </p>
                )}
                <p className="num text-[13px] text-muted-foreground">
                  {t("breakdown", {
                    inAccounts: formatMoneyText(
                      locale,
                      data.primary.inAccounts,
                      data.primary.currency,
                      { tone: "plain" },
                    ),
                    onCards: formatMoneyText(
                      locale,
                      data.primary.onCards,
                      data.primary.currency,
                      { tone: "plain" },
                    ),
                  })}
                </p>
              </section>
            )}

            {/* Account Groups */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
              {renderGroup(t("groups.cash"), data.groups.cash)}
              {renderGroup(t("groups.savings"), data.groups.savings)}
              {renderGroup(t("groups.cards"), data.groups.cards)}
            </div>

            {/* Debts link row */}
            <Card variant="plain" className="overflow-hidden">
              <NavRow
                icon={HandCoins}
                label={tShell("nav.debts")}
                preview={
                  data.debts.count > 0
                    ? formatMoneyText(
                        locale,
                        data.debts.total,
                        data.primary?.currency ?? "USD",
                        { tone: "plain" },
                      )
                    : t("noDebts")
                }
                href="/debts"
              />
            </Card>
          </>
        )}
      </div>

      <AccountFormSheet open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
