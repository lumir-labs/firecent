"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  CategoryIcon,
  FieldRow,
  Money,
  NatureBar,
  NatureSwatch,
  PaceLegend,
  PageHeader,
  StateBlock,
  formatMoneyText,
} from "@/components/finance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BudgetView() {
  const locale = useLocale();
  const t = useTranslations("Budget");
  const tShell = useTranslations("Shell");
  const utils = trpc.useUtils();

  const [month, setMonth] = useState(currentMonthStr);
  const [editOpen, setEditOpen] = useState(false);
  const [limitTarget, setLimitTarget] = useState<{
    categoryId: number;
    name: string;
    currentLimit: number | null;
    spent: number;
  } | null>(null);

  const query = trpc.budgets.get.useQuery(
    { month },
    { placeholderData: keepPreviousData },
  );
  const categoriesQuery = trpc.categories.list.useQuery({ type: "EXPENSE" });
  const data = query.data;

  const copyMutation = trpc.budgets.copyPrevious.useMutation({
    onSuccess: async () => {
      await utils.budgets.get.invalidate({ month });
      firecentToast(t("copiedToast"));
    },
  });

  const invalidate = async () => {
    await utils.budgets.get.invalidate({ month });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        back="/more"
        backLabel={tShell("nav.more")}
        actions={
          <Button
            variant="text"
            size="touch"
            onClick={() => setEditOpen(true)}
          >
            {data?.hasPlan ? t("editPlan") : t("createPlan")}
          </Button>
        }
        desktopActions={
          <Button size="touch" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            <span>{data?.hasPlan ? t("editPlan") : t("createPlan")}</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-5 lg:px-0">
        {/* Month bar */}
        <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-2">
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("prevMonth")}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="text-[15px] font-semibold capitalize">
            {formatMonthLabel(month)}
          </span>
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("nextMonth")}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        {query.isPending ? (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-12 w-48" />
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
            </div>
          </div>
        ) : query.isError || !data ? (
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => query.refetch() }}
          />
        ) : !data.hasPlan || !data.plan ? (
          <div className="flex flex-col gap-5">
            <StateBlock
              kind="empty"
              icon={Target}
              title={t("emptyTitle", { month: formatMonthLabel(month) })}
              body={t("emptyBody")}
              action={{
                label: t("createPlan"),
                onClick: () => setEditOpen(true),
              }}
            />
            {data.hasPreviousPlan && (
              <div className="flex justify-center">
                <Button
                  variant="text"
                  size="touch"
                  disabled={copyMutation.isPending}
                  onClick={() => copyMutation.mutate({ month })}
                >
                  {t("copyPrevious")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Top row: Hero + Income card */}
            <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
              <section className="flex flex-col gap-2 lg:col-span-7">
                <span className="text-[13px] text-muted-foreground">
                  {data.plan.leftToSpend < 0
                    ? t("overPlan")
                    : data.isPastMonth
                      ? t("leftOver")
                      : t("leftToSpend")}
                </span>
                <Money
                  value={Math.abs(data.plan.leftToSpend)}
                  currency={data.currency}
                  size="hero"
                  tone="plain"
                  dimCents
                  className={cn(
                    data.plan.leftToSpend < 0 && "text-destructive",
                  )}
                />
                <p className="num text-[14px] text-muted-foreground">
                  {t("spentOfPlanned", {
                    spent: formatMoneyText(
                      locale,
                      data.totalSpent,
                      data.currency,
                      { tone: "plain" },
                    ),
                    planned: formatMoneyText(
                      locale,
                      data.plan.totalPlanned,
                      data.currency,
                      { tone: "plain" },
                    ),
                  })}
                </p>
                {data.isCurrentMonth && (
                  <PaceLegend
                    label={t("paceCaption", {
                      pct: String(Math.round(data.pace * 100)),
                    })}
                  />
                )}
              </section>

              <Card
                variant="plain"
                className="divide-y overflow-hidden lg:col-span-5"
              >
                <FieldRow
                  label={t("income.expected")}
                  value={formatMoneyText(
                    locale,
                    data.plan.expectedIncome,
                    data.currency,
                    { tone: "plain" },
                  )}
                />
                <FieldRow
                  label={t("income.inPlan")}
                  value={formatMoneyText(
                    locale,
                    data.plan.totalPlanned,
                    data.currency,
                    { tone: "plain" },
                  )}
                />
                <FieldRow
                  label={t("income.notPlanned")}
                  value={formatMoneyText(
                    locale,
                    data.plan.notPlanned,
                    data.currency,
                    { tone: "plain" },
                  )}
                />
              </Card>
            </div>

            {/* 3 Buckets: Owe / Need / Want */}
            <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
              {data.plan.buckets.map((bucket) => (
                <Card
                  key={bucket.nature}
                  variant="plain"
                  className="flex flex-col gap-4 p-4"
                >
                  <NatureBar
                    nature={bucket.nature}
                    spent={bucket.spent}
                    planned={bucket.planned}
                    currency={data.currency}
                    pace={data.isCurrentMonth ? data.pace : undefined}
                  />

                  {/* Limited categories */}
                  {bucket.limited.length > 0 && (
                    <div className="flex flex-col gap-3 border-t pt-3">
                      {bucket.limited.map((cat) => {
                        const pct =
                          cat.limit > 0
                            ? Math.min(100, (cat.spent / cat.limit) * 100)
                            : 0;
                        return (
                          <div
                            key={cat.categoryId}
                            className="flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-[13px]">
                              <Link
                                href={`/transactions?month=${month}&category=${cat.categoryId}`}
                                className="flex min-w-0 items-center gap-2 font-medium hover:underline"
                              >
                                <CategoryIcon icon={cat.icon} size="sm" />
                                <span className="truncate">{cat.name}</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  setLimitTarget({
                                    categoryId: cat.categoryId,
                                    name: cat.name,
                                    currentLimit: cat.limit,
                                    spent: cat.spent,
                                  })
                                }
                                className="num shrink-0 text-[12px] text-muted-foreground hover:text-foreground"
                              >
                                {formatMoneyText(
                                  locale,
                                  cat.spent,
                                  data.currency,
                                  { tone: "plain" },
                                )}{" "}
                                /{" "}
                                {formatMoneyText(
                                  locale,
                                  cat.limit,
                                  data.currency,
                                  { tone: "plain", trimZeroCents: true },
                                )}
                              </button>
                            </div>
                            <div
                              role="progressbar"
                              aria-valuenow={Math.round(pct)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  cat.status === "over"
                                    ? "bg-destructive"
                                    : cat.status === "above_pace"
                                      ? "bg-warning"
                                      : "bg-primary",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p
                              className={cn(
                                "flex items-center gap-1 text-[11px]",
                                cat.status === "over"
                                  ? "text-destructive"
                                  : cat.status === "above_pace"
                                    ? "text-warning"
                                    : "text-muted-foreground",
                              )}
                            >
                              {cat.status === "over" && (
                                <>
                                  <AlertCircle className="size-3" />
                                  <span>
                                    {t("status.overBy", {
                                      amount: formatMoneyText(
                                        locale,
                                        cat.spent - cat.limit,
                                        data.currency,
                                        { tone: "plain" },
                                      ),
                                    })}
                                  </span>
                                </>
                              )}
                              {cat.status === "above_pace" && (
                                <>
                                  <TrendingUp className="size-3" />
                                  <span>
                                    {t("status.abovePace", {
                                      perDay: formatMoneyText(
                                        locale,
                                        cat.perDayLeft,
                                        data.currency,
                                        { tone: "plain" },
                                      ),
                                    })}
                                  </span>
                                </>
                              )}
                              {cat.status === "on_pace" && (
                                <span>{t("status.onPace")}</span>
                              )}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Other spent categories (without explicit limit) */}
                  {bucket.otherSpent.length > 0 && (
                    <div className="flex flex-col gap-2 border-t pt-3">
                      {bucket.otherSpent.map((c) => (
                        <div
                          key={c.categoryId}
                          className="flex items-center justify-between gap-2 text-[13px]"
                        >
                          <Link
                            href={`/transactions?month=${month}&category=${c.categoryId}`}
                            className="truncate text-muted-foreground hover:text-foreground"
                          >
                            {c.name}
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setLimitTarget({
                                categoryId: c.categoryId,
                                name: c.name,
                                currentLimit: null,
                                spent: c.spent,
                              })
                            }
                            className="num text-[13px] font-medium hover:text-primary-text"
                          >
                            {formatMoneyText(locale, c.spent, data.currency, {
                              tone: "plain",
                            })}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add category limit trigger */}
                  <div className="flex items-center justify-between border-t pt-2 text-[12px] text-muted-foreground">
                    <span>
                      {t("flexible", {
                        amount: formatMoneyText(
                          locale,
                          bucket.flexible,
                          data.currency,
                          { tone: "plain" },
                        ),
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const firstCat = (categoriesQuery.data ?? []).find(
                          (c) => (c.spendingNature ?? "NECESITO") === bucket.nature,
                        );
                        if (firstCat) {
                          setLimitTarget({
                            categoryId: firstCat.id,
                            name: firstCat.name,
                            currentLimit: null,
                            spent: 0,
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1 font-medium text-primary-text hover:underline"
                    >
                      <Plus className="size-3.5" />
                      <span>{t("addLimit")}</span>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit Plan Sheet */}
      {data && (
        <EditPlanSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          month={month}
          currency={data.currency}
          hasPreviousPlan={data.hasPreviousPlan}
          initial={
            data.plan
              ? {
                  expectedIncome: data.plan.expectedIncome,
                  DEBO:
                    data.plan.buckets.find((b) => b.nature === "DEBO")
                      ?.planned ?? 0,
                  NECESITO:
                    data.plan.buckets.find((b) => b.nature === "NECESITO")
                      ?.planned ?? 0,
                  QUIERO:
                    data.plan.buckets.find((b) => b.nature === "QUIERO")
                      ?.planned ?? 0,
                }
              : data.suggestion
          }
          isSuggested={!data.hasPlan}
          onSaved={invalidate}
        />
      )}

      {/* Category Limit Sheet */}
      {limitTarget && data && (
        <CategoryLimitSheet
          target={limitTarget}
          categories={categoriesQuery.data ?? []}
          month={month}
          currency={data.currency}
          onClose={() => setLimitTarget(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

function EditPlanSheet({
  open,
  onOpenChange,
  month,
  currency,
  hasPreviousPlan,
  initial,
  isSuggested,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  currency: string;
  hasPreviousPlan: boolean;
  initial: {
    expectedIncome: number;
    DEBO: number;
    NECESITO: number;
    QUIERO: number;
  };
  isSuggested: boolean;
  onSaved: () => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("Budget");
  const tShell = useTranslations("Shell");

  const [income, setIncome] = useState(String(initial.expectedIncome || ""));
  const [debo, setDebo] = useState(String(initial.DEBO || ""));
  const [necesito, setNecesito] = useState(String(initial.NECESITO || ""));
  const [quiero, setQuiero] = useState(String(initial.QUIERO || ""));

  const saveMutation = trpc.budgets.upsertPlan.useMutation({
    onSuccess: async () => {
      await onSaved();
      firecentToast(t("planSaved"));
      onOpenChange(false);
    },
  });

  const copyMutation = trpc.budgets.copyPrevious.useMutation({
    onSuccess: async () => {
      await onSaved();
      firecentToast(t("copiedToast"));
      onOpenChange(false);
    },
  });

  const nIncome = Number.parseFloat(income) || 0;
  const nDebo = Number.parseFloat(debo) || 0;
  const nNecesito = Number.parseFloat(necesito) || 0;
  const nQuiero = Number.parseFloat(quiero) || 0;
  const totalPlanned = nDebo + nNecesito + nQuiero;
  const diff = nIncome - totalPlanned;
  const pct = (v: number) =>
    nIncome > 0 ? `${((v / nIncome) * 100).toFixed(1)}%` : "0%";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("editPlanTitle", { month: formatMonthLabel(month) })}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate({
            month,
            expectedIncome: nIncome,
            DEBO: nDebo,
            NECESITO: nNecesito,
            QUIERO: nQuiero,
          });
        }}
        className="flex flex-col gap-4 px-5"
      >
        {isSuggested && (
          <Alert variant="notice">
            <AlertDescription>{t("suggestedHint")}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("income.expected")}
          </label>
          <Input
            size="touch"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="0"
          />
        </div>

        {(
          [
            { key: "DEBO", val: debo, set: setDebo, num: nDebo },
            { key: "NECESITO", val: necesito, set: setNecesito, num: nNecesito },
            { key: "QUIERO", val: quiero, set: setQuiero, num: nQuiero },
          ] as const
        ).map((item) => (
          <div key={item.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 font-medium">
                <NatureSwatch nature={item.key} />
                <span>{t(`nature.${item.key}`)}</span>
              </span>
              <span className="num text-muted-foreground">{pct(item.num)}</span>
            </div>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={item.val}
              onChange={(e) => item.set(e.target.value)}
              placeholder="0"
            />
          </div>
        ))}

        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2.5 text-[13px]">
          <span className="text-muted-foreground">
            {diff < 0 ? t("overIncome") : t("income.notPlanned")}
          </span>
          <span
            className={cn(
              "num font-semibold",
              diff < 0 ? "text-warning" : "text-foreground",
            )}
          >
            {formatMoneyText(locale, Math.abs(diff), currency, {
              tone: "plain",
            })}
          </span>
        </div>

        <Button
          type="submit"
          size="touch"
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {t("savePlan")}
        </Button>

        {hasPreviousPlan && (
          <Button
            type="button"
            variant="text"
            size="touch"
            disabled={copyMutation.isPending}
            onClick={() => copyMutation.mutate({ month })}
            className="w-full"
          >
            {t("copyPrevious")}
          </Button>
        )}
      </form>
    </ResponsiveSheet>
  );
}

function CategoryLimitSheet({
  target,
  categories,
  month,
  currency,
  onClose,
  onSaved,
}: {
  target: {
    categoryId: number;
    name: string;
    currentLimit: number | null;
    spent: number;
  };
  categories: { id: number; name: string }[];
  month: string;
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("Budget");
  const tShell = useTranslations("Shell");

  const [catId, setCatId] = useState(target.categoryId);
  const [limitStr, setLimitStr] = useState(
    target.currentLimit != null ? String(target.currentLimit) : "",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const mutation = trpc.budgets.setCategoryLimit.useMutation({
    onSuccess: async () => {
      await onSaved();
      firecentToast(t("limitSaved"));
      onClose();
    },
    onError: (e) => setErrMsg(e.message),
  });

  return (
    <ResponsiveSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("limitSheetTitle")}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrMsg(null);
          const n = Number.parseFloat(limitStr);
          if (!Number.isFinite(n) || n <= 0) return;
          mutation.mutate({ month, categoryId: catId, limit: n });
        }}
        className="flex flex-col gap-4 px-5"
      >
        {errMsg && (
          <Alert variant="notice-warning">
            <AlertCircle className="size-4" />
            <AlertDescription>{errMsg}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("category")}
          </label>
          <select
            value={catId}
            onChange={(e) => setCatId(Number(e.target.value))}
            className="h-12 w-full rounded-xl border bg-card px-3.5 text-[15px] outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("monthlyLimit")}
          </label>
          <Input
            size="touch"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            autoFocus
            value={limitStr}
            onChange={(e) => setLimitStr(e.target.value)}
            placeholder="500"
          />
          {target.spent > 0 && (
            <p className="text-[12px] text-muted-foreground">
              {t("spentSoFar", {
                amount: formatMoneyText(locale, target.spent, currency, {
                  tone: "plain",
                }),
              })}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="touch"
          disabled={mutation.isPending}
          className="w-full"
        >
          {t("saveLimit")}
        </Button>

        {target.currentLimit != null && (
          <Button
            type="button"
            variant="ghost"
            size="touch"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ month, categoryId: catId, limit: null })
            }
            className="w-full text-destructive"
          >
            {t("removeLimit")}
          </Button>
        )}
      </form>
    </ResponsiveSheet>
  );
}
