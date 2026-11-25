"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Scale,
  Wifi,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  ChangeLine,
  DayHeader,
  FieldRow,
  Money,
  PageHeader,
  SectionHeader,
  StatPair,
  StateBlock,
  TransactionRow,
  TransactionRowSkeleton,
  formatMoneyText,
  localizeCategoryName,
  resolveAccountFinish,
  resolveTransferFlow,
} from "@/components/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { useShell } from "../../../_components/shell/shell-context";
import { TransactionDetailSheet } from "../../../transactions/_components/transaction-detail-sheet";
import { AccountFormSheet } from "../../_components/account-form-sheet";
import { CardInstallmentsSection } from "./card-installments-section";
import { CardPayoffCard } from "./card-payoff-card";

export function AccountDetailView({ accountId }: { accountId: number }) {
  const locale = useLocale();
  const t = useTranslations("Accounts");
  const tTx = useTranslations("TransactionsV2");
  const tShell = useTranslations("Shell");
  const router = useRouter();
  const { openAddTransaction } = useShell();
  const utils = trpc.useUtils();

  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [actualBalanceStr, setActualBalanceStr] = useState("");
  const [detailRecordId, setDetailRecordId] = useState<number | null>(null);

  const accountQuery = trpc.accounts.get.useQuery({ id: accountId });
  const recordsQuery = trpc.records.list.useQuery({ accountId, limit: 10 });

  const invalidateAll = async () => {
    await Promise.all([
      utils.accounts.get.invalidate({ id: accountId }),
      utils.accounts.list.invalidate(),
      utils.records.list.invalidate(),
      utils.dashboard.home.invalidate(),
      utils.dashboard.netWorth.invalidate(),
    ]);
  };

  const adjustMutation = trpc.accounts.adjustBalance.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      setAdjustOpen(false);
      firecentToast(t("detail.balanceAdjusted"));
    },
  });

  const archiveMutation = trpc.accounts.archive.useMutation({
    onSuccess: async (res) => {
      await invalidateAll();
      if (res.archived) {
        router.push("/accounts");
        firecentToast(t("detail.archived"), {
          action: {
            label: t("detail.undo"),
            onClick: () =>
              archiveMutation.mutate({ id: accountId, archived: false }),
          },
        });
      } else {
        firecentToast(t("detail.restored"));
      }
    },
  });

  const acc = accountQuery.data;
  const rows = recordsQuery.data?.items ?? [];

  const groupedByDay = useMemo(() => {
    const groups: { date: string; items: typeof rows }[] = [];
    for (const r of rows) {
      const key = r.date ?? "undated";
      const last = groups[groups.length - 1];
      if (last && last.date === key) last.items.push(r);
      else groups.push({ date: key, items: [r] });
    }
    return groups;
  }, [rows]);

  if (accountQuery.isPending) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-4 lg:px-0">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-12 w-56" />
        <Card variant="plain" className="divide-y overflow-hidden">
          <TransactionRowSkeleton />
          <TransactionRowSkeleton />
          <TransactionRowSkeleton />
        </Card>
      </div>
    );
  }

  if (accountQuery.isError || !acc) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-4 lg:px-0">
        <PageHeader title={t("title")} back="/accounts" />
        <StateBlock
          kind="error"
          action={{ label: t("retry"), onClick: () => accountQuery.refetch() }}
        />
      </div>
    );
  }

  const isCard = acc.type === "CREDIT_CARD";
  const usedPct =
    isCard && acc.creditLimit && acc.creditLimit > 0
      ? Math.min(100, Math.round((acc.debt / acc.creditLimit) * 100))
      : 0;

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("detail.moreActions")}
          />
        }
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {acc.isOwner && (
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            <span>{t("detail.editAccount")}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            setActualBalanceStr(
              isCard ? String(acc.debt) : String(acc.balance),
            );
            setAdjustOpen(true);
          }}
        >
          <Scale className="size-4" />
          <span>{t("detail.adjustBalance")}</span>
        </DropdownMenuItem>
        {acc.isOwner && (
          <DropdownMenuItem
            onClick={() =>
              archiveMutation.mutate({ id: acc.id, archived: true })
            }
            className="text-destructive"
          >
            <Archive className="size-4" />
            <span>{t("detail.archive")}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={acc.name}
        back="/accounts"
        backLabel={t("title")}
        actions={menu}
        desktopActions={
          <>
            <Button
              size="touch"
              onClick={() => openAddTransaction({ accountId: acc.id })}
            >
              <Plus className="size-4" aria-hidden />
              <span>{tShell("addTransaction")}</span>
            </Button>
            {menu}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-5 lg:grid-cols-12 lg:items-start lg:px-0">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
          {(() => {
            const finish = resolveAccountFinish(acc.color);
            const isDebitCard = acc.type === "CHECKING_ACCOUNT";
            const useCardHero =
              isCard || isDebitCard || finish?.kind === "metallic";
            if (useCardHero) {
              const bg =
                finish?.cardBackground ??
                "linear-gradient(135deg, #2b3446 0%, #141c2c 48%, #090e18 100%)";
              const ink = finish?.ink ?? "#f8fafc";
              const mutedInk = finish?.mutedInk ?? "rgba(248,250,252,0.72)";
              const border = finish?.border ?? "rgba(255,255,255,0.14)";
              const cardKindLabel = isCard
                ? t("detail.creditBadge")
                : isDebitCard
                  ? t("detail.debitBadge")
                  : t(`types.${acc.type}` as never);

              return (
                <section
                  style={{ background: bg, color: ink, borderColor: border }}
                  className="relative flex min-w-0 flex-col justify-between gap-2.5 overflow-hidden rounded-[22px] border px-5 py-4 shadow-[0_12px_28px_-16px_rgba(11,18,32,0.45)] sm:gap-3 sm:rounded-3xl sm:px-6 sm:py-5"
                >
                  {/* Subtle top-left specular sheen for physical card depth */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(115% 85% at 10% 0%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 44%, transparent 72%)",
                    }}
                  />

                  {/* Top row: prominent card name + minimal EMV chip & contactless mark */}
                  <div className="relative flex items-center justify-between gap-3">
                    <h2 className="min-w-0 truncate text-[19px] leading-tight font-semibold tracking-[-0.02em] sm:text-[21px]">
                      {acc.name}
                    </h2>
                    <div
                      aria-hidden="true"
                      className="flex shrink-0 items-center gap-1.5"
                    >
                      <svg
                        viewBox="0 0 36 26"
                        fill="none"
                        className="h-[20px] w-[28px] opacity-55 sm:h-[22px] sm:w-[31px]"
                      >
                        <rect
                          x="1"
                          y="1"
                          width="34"
                          height="24"
                          rx="4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="currentColor"
                          fillOpacity="0.12"
                        />
                        <path
                          d="M1 10h10M25 10h10M1 16h10M25 16h10M13.5 1v24M22.5 1v24"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeOpacity="0.7"
                        />
                      </svg>
                      <Wifi className="size-3.5 rotate-90 opacity-50" strokeWidth={2} />
                    </div>
                  </div>

                  {/* Center: balance / debt */}
                  <div className="relative flex flex-col gap-0.5">
                    <span
                      className="text-[12px] font-medium sm:text-[13px]"
                      style={{ color: mutedInk }}
                    >
                      {isCard ? t("detail.youOwe") : t("balanceLabel")}
                    </span>
                    <Money
                      value={isCard ? acc.debt : acc.balance}
                      currency={acc.currency}
                      size="sheet"
                      tone="plain"
                      surface="tinted"
                      dimCents
                      className="sm:text-[36px] sm:leading-[40px]"
                    />
                  </div>

                  {/* Credit limit usage bar (when configured) */}
                  {isCard && acc.creditLimit != null && (
                    <div className="relative flex flex-col gap-1">
                      <div
                        role="progressbar"
                        aria-valuenow={usedPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t("detail.creditUsage")}
                        className="h-1.5 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: "rgba(0,0,0,0.22)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${usedPct}%`,
                            backgroundColor: ink,
                          }}
                        />
                      </div>
                      <div
                        className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11.5px] font-medium"
                        style={{ color: mutedInk }}
                      >
                        <span>
                          {t("available", {
                            amount: formatMoneyText(
                              locale,
                              acc.available ?? 0,
                              acc.currency,
                              { tone: "plain" },
                            ),
                          })}
                        </span>
                        <span className="num">
                          {t("detail.ofLimit", {
                            limit: formatMoneyText(
                              locale,
                              acc.creditLimit,
                              acc.currency,
                              { tone: "plain" },
                            ),
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bottom row: last-4 / currency on left · CRÉDITO / DÉBITO on right */}
                  <div className="relative flex items-baseline justify-between gap-3">
                    <span
                      className="num truncate text-[11.5px] font-medium tracking-[0.12em] uppercase sm:text-[12px]"
                      style={{ color: mutedInk }}
                    >
                      {acc.accountNumber
                        ? `···· ${acc.accountNumber} · ${acc.currency}`
                        : acc.currency}
                    </span>
                    <span
                      className="shrink-0 text-[11.5px] font-semibold tracking-[0.16em] uppercase sm:text-[12px]"
                      style={{ color: ink, opacity: 0.9 }}
                    >
                      {cardKindLabel}
                    </span>
                  </div>
                </section>
              );
            }

            return (
              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {finish && (
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: finish.accent }}
                    />
                  )}
                  <span className="text-[13px] text-muted-foreground">
                    {t("balanceLabel")}
                  </span>
                </div>
                <Money
                  value={acc.balance}
                  currency={acc.currency}
                  size="hero"
                  tone="plain"
                  dimCents
                />
                <ChangeLine
                  value={acc.monthChange}
                  currency={acc.currency}
                  context={t("detail.thisMonth")}
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Badge variant="neutral">
                    {t(`types.${acc.type}` as never)}
                  </Badge>
                  {acc.accountNumber && (
                    <Badge variant="neutral">···· {acc.accountNumber}</Badge>
                  )}
                  <Badge variant="neutral">{acc.currency}</Badge>
                </div>
              </section>
            );
          })()}

          {isCard ? (
            <>
              <Card variant="plain" className="divide-y overflow-hidden">
                <FieldRow
                  label={t("detail.cashPayment")}
                  value={
                    acc.cashPayment != null && acc.lastCutoffDate ? (
                      <span className="flex flex-col items-end">
                        <span className="num font-semibold text-foreground">
                          {formatMoneyText(locale, acc.cashPayment, acc.currency, {
                            tone: "plain",
                          })}
                          {acc.cashPayment === 0 && (
                            <span className="ml-1.5 text-[11.5px] font-medium text-positive">
                              · {t("detail.cashPaymentCovered")}
                            </span>
                          )}
                        </span>
                        <span className="num text-[11.5px] font-normal text-muted-foreground">
                          {t("detail.cashPaymentHint", {
                            date: acc.lastCutoffDate,
                          })}
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditOpen(true)}
                        className="text-[13px] font-medium text-primary-text hover:underline"
                      >
                        {t("detail.cashPaymentNoCutoff")}
                      </button>
                    )
                  }
                />
                <FieldRow
                  label={t("detail.cutoffDate")}
                  value={
                    acc.cutoffDayType === "EVERY_X_DAYS" && acc.cutoffEveryDays
                      ? acc.nextCutoffDate
                        ? `${acc.nextCutoffDate}${acc.cutoffInDays != null ? ` (${acc.cutoffInDays}d)` : ""} · ${t("everyXDays", { days: String(acc.cutoffEveryDays) })}`
                        : t("everyXDays", { days: String(acc.cutoffEveryDays) })
                      : acc.nextCutoffDate
                        ? `${acc.nextCutoffDate}${acc.cutoffInDays != null ? ` (${acc.cutoffInDays}d)` : ""}`
                        : "—"
                  }
                />
                <FieldRow
                  label={t("detail.paymentDue")}
                  value={
                    acc.paymentDayType === "EVERY_X_DAYS" && acc.paymentEveryDays
                      ? acc.nextDueDate
                        ? `${acc.nextDueDate}${acc.dueInDays != null ? ` (${acc.dueInDays}d)` : ""} · ${t("everyXDays", { days: String(acc.paymentEveryDays) })}`
                        : t("everyXDays", { days: String(acc.paymentEveryDays) })
                      : acc.nextDueDate
                        ? `${acc.nextDueDate}${acc.dueInDays != null ? ` (${acc.dueInDays}d)` : ""}`
                        : "—"
                  }
                />
                <FieldRow
                  label={t("form.apr")}
                  value={acc.interestRate != null ? `${acc.interestRate}%` : "—"}
                />
              </Card>

              <CardPayoffCard
                debt={acc.revolvingDebt}
                currency={acc.currency}
                interestRate={acc.interestRate}
                cycleDays={
                  acc.paymentDayType === "EVERY_X_DAYS" && acc.paymentEveryDays
                    ? acc.paymentEveryDays
                    : acc.cutoffDayType === "EVERY_X_DAYS" && acc.cutoffEveryDays
                      ? acc.cutoffEveryDays
                      : 30
                }
                installmentsMonthly={acc.installmentsSummary.monthlyTotal}
                installmentsInterest={acc.installmentsSummary.monthlyInterest}
                onEditCard={() => setEditOpen(true)}
              />

              <CardInstallmentsSection
                accountId={acc.id}
                currency={acc.currency}
                installments={acc.installments}
                monthlyTotal={acc.installmentsSummary.monthlyTotal}
              />
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <StatPair
                items={[
                  {
                    icon: ArrowDownLeft,
                    label: t("detail.moneyIn"),
                    value: acc.monthIn,
                    currency: acc.currency,
                  },
                  {
                    icon: ArrowUpRight,
                    label: t("detail.moneyOut"),
                    value: acc.monthOut,
                    currency: acc.currency,
                  },
                ]}
              />
              <p className="px-1 text-[12px] text-muted-foreground">
                {t("detail.includesTransfers")}
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
          <SectionHeader
            title={t("detail.recentTransactions")}
            action={{
              label: t("detail.seeAll"),
              href: `/transactions?account=${acc.id}`,
            }}
          />

          {recordsQuery.isPending ? (
            <Card variant="plain" className="divide-y overflow-hidden">
              <TransactionRowSkeleton />
              <TransactionRowSkeleton />
              <TransactionRowSkeleton />
            </Card>
          ) : rows.length === 0 ? (
            <Card
              variant="plain"
              className="p-6 text-center text-[14px] text-muted-foreground"
            >
              {t("detail.noTransactions")}
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {groupedByDay.map((group) => (
                <div key={group.date} className="flex flex-col gap-2">
                  <DayHeader
                    date={group.date}
                    net={group.items.reduce((s, r) => s + r.amount, 0)}
                    currency={acc.currency}
                  />
                  <Card variant="plain" className="divide-y overflow-hidden">
                    {group.items.map((r) => {
                      const isTransfer = r.transfer || r.type === "TRANSFER";
                      const flow = isTransfer
                        ? resolveTransferFlow(
                            r.amount,
                            r.account,
                            r.transferAccount,
                          )
                        : undefined;
                      const catName = r.category
                        ? localizeCategoryName(r.category, locale)
                        : null;
                      const title = isTransfer
                        ? r.note || r.account.name
                        : r.payee || catName || r.note || r.account.name;
                      return (
                        <TransactionRow
                          key={r.id}
                          title={title}
                          category={
                            r.category && catName
                              ? {
                                  icon: r.category.icon,
                                  name: catName,
                                  color: r.category.color,
                                }
                              : { icon: null, name: tTx("detail.uncategorized") }
                          }
                          account={r.account.name}
                          accountColor={r.account.color}
                          transfer={flow}
                          note={isTransfer ? r.note : undefined}
                          amount={r.amount}
                          currency={r.currency}
                          kind={isTransfer ? "TRANSFER" : r.type}
                          onClick={() => setDetailRecordId(r.id)}
                        />
                      );
                    })}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AccountFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        account={acc}
      />

      <ResponsiveSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title={t("detail.adjustBalance")}
        closeLabel={tShell("close")}
        desktop="dialog"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = Number.parseFloat(actualBalanceStr);
            if (!Number.isFinite(parsed)) return;
            adjustMutation.mutate({
              id: acc.id,
              actualBalance: isCard ? -Math.abs(parsed) : parsed,
            });
          }}
          className="flex flex-col gap-4 px-5"
        >
          <p className="text-[13px] text-muted-foreground">
            {t("detail.adjustDescription")}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {isCard ? t("form.currentDebt") : t("detail.realBalance")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              step="0.01"
              autoFocus
              value={actualBalanceStr}
              onChange={(e) => setActualBalanceStr(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            size="touch"
            disabled={adjustMutation.isPending}
            className="w-full"
          >
            {adjustMutation.isPending
              ? t("form.saving")
              : t("detail.saveAdjustment")}
          </Button>
        </form>
      </ResponsiveSheet>

      <TransactionDetailSheet
        recordId={detailRecordId}
        onClose={() => setDetailRecordId(null)}
      />
    </div>
  );
}
