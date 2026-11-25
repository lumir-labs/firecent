"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  Check,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { trpc } from "@app/api/client";

import { formatMoneyText } from "@/components/finance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { firecentToast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type CardInstallmentItem = {
  id: number;
  title: string;
  totalAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  monthlyAmount: number;
  interestRate: number;
  startDate: string;
  includedInBalance: boolean;
  note: string | null;
  remainingInstallments: number;
  remainingTotal: number;
  remainingPrincipal: number;
  monthlyInterest: number;
};

const QUICK_TERMS = [3, 6, 12, 18, 24] as const;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function calcMonthlyPayment(
  total: number,
  installments: number,
  annualRate: number,
): number {
  if (total <= 0 || installments < 1) return 0;
  if (annualRate <= 0) return Math.round((total / installments) * 100) / 100;
  const r = annualRate / 100 / 12;
  const pmt = (total * r) / (1 - Math.pow(1 + r, -installments));
  return Math.round(pmt * 100) / 100;
}

export function CardInstallmentsSection({
  accountId,
  currency,
  installments,
  monthlyTotal,
}: {
  accountId: number;
  currency: string;
  installments: CardInstallmentItem[];
  monthlyTotal: number;
}) {
  const locale = useLocale();
  const t = useTranslations("Accounts.detail.installments");
  const utils = trpc.useUtils();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CardInstallmentItem | null>(null);

  const invalidate = async () => {
    await Promise.all([
      utils.accounts.get.invalidate({ id: accountId }),
      utils.accounts.list.invalidate(),
      utils.dashboard.home.invalidate(),
    ]);
  };

  const updatePaidMutation = trpc.accounts.updateInstallment.useMutation({
    onSuccess: async () => {
      await invalidate();
    },
  });

  const deleteMutation = trpc.accounts.deleteInstallment.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("deleted"));
    },
  });

  const fmt = (v: number) =>
    formatMoneyText(locale, v, currency, { tone: "plain" });

  return (
    <>
      <Card variant="plain" className="divide-y overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold text-foreground">
              {t("title")}
            </h3>
            {monthlyTotal > 0 && (
              <p className="num text-[11.5px] text-muted-foreground">
                {fmt(monthlyTotal)}
                {t("perMonth")}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            <span>{t("add")}</span>
          </Button>
        </div>

        {installments.length === 0 ? (
          <p className="px-4 py-3.5 text-[12.5px] leading-snug text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          installments.map((item) => {
            const done = item.remainingInstallments <= 0;
            const pct = Math.min(
              100,
              Math.round((item.paidInstallments / item.totalInstallments) * 100),
            );
            const busy = updatePaidMutation.isPending || deleteMutation.isPending;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col gap-2 px-4 py-3",
                  done && "opacity-65",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-semibold text-foreground">
                        {item.title}
                      </span>
                      {done ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-positive/12 px-2 py-0.5 text-[10.5px] font-semibold text-positive">
                          <Check className="size-2.5" aria-hidden />
                          {t("paidOff")}
                        </span>
                      ) : item.interestRate <= 0 ? (
                        <span className="inline-flex items-center rounded-full bg-positive/12 px-2 py-0.5 text-[10.5px] font-semibold text-positive">
                          {t("zeroInterest")}
                        </span>
                      ) : (
                        <span className="num inline-flex items-center rounded-full bg-amber-500/12 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">
                          {t("withInterestRate", {
                            rate: String(item.interestRate),
                          })}
                        </span>
                      )}
                    </div>
                    <p className="num mt-0.5 text-[11.5px] text-muted-foreground">
                      {t("progress", {
                        paid: String(item.paidInstallments),
                        total: String(item.totalInstallments),
                      })}
                      {!done && (
                        <>
                          {" · "}
                          {t("remainingCount", {
                            count: item.remainingInstallments,
                          })}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="num text-[14px] font-semibold text-foreground">
                      {fmt(item.monthlyAmount)}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {t("perMonth")}
                      </span>
                    </p>
                    {!done && (
                      <p className="num text-[11px] text-muted-foreground">
                        {t("remainingAmount", {
                          amount: fmt(item.remainingTotal),
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      done ? "bg-positive" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Compact action bar */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    {!done && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          updatePaidMutation.mutate({
                            id: item.id,
                            paidInstallments: item.paidInstallments + 1,
                          })
                        }
                        className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 px-2.5 text-[11.5px] font-semibold text-primary-text transition-colors hover:bg-primary/15 disabled:opacity-50"
                      >
                        <Check className="size-3" aria-hidden />
                        <span>{t("markPaid")}</span>
                      </button>
                    )}
                    {item.paidInstallments > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={t("undoPaid")}
                        title={t("undoPaid")}
                        onClick={() =>
                          updatePaidMutation.mutate({
                            id: item.id,
                            paidInstallments: Math.max(
                              0,
                              item.paidInstallments - 1,
                            ),
                          })
                        }
                        className="grid size-7 place-items-center rounded-full border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        <Minus className="size-3" aria-hidden />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t("edit")}
                      title={t("edit")}
                      onClick={() => {
                        setEditing(item);
                        setFormOpen(true);
                      }}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={t("delete")}
                      title={t("delete")}
                      onClick={() => deleteMutation.mutate({ id: item.id })}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <InstallmentFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        accountId={accountId}
        editing={editing}
        onSaved={invalidate}
      />
    </>
  );
}

function InstallmentFormSheet({
  open,
  onOpenChange,
  accountId,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  editing: CardInstallmentItem | null;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("Accounts.detail.installments");
  const tShell = useTranslations("Shell");

  const [title, setTitle] = useState("");
  const [hasInterest, setHasInterest] = useState(false);
  const [interestRate, setInterestRate] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("12");
  const [paidInstallments, setPaidInstallments] = useState("0");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [startDate, setStartDate] = useState(() => todayIso());
  const [includedInBalance, setIncludedInBalance] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (editing) {
      setTitle(editing.title);
      setHasInterest(editing.interestRate > 0);
      setInterestRate(editing.interestRate > 0 ? String(editing.interestRate) : "");
      setTotalInstallments(String(editing.totalInstallments));
      setPaidInstallments(String(editing.paidInstallments));
      setMonthlyAmount(editing.monthlyAmount.toFixed(2));
      setTotalAmount(editing.totalAmount.toFixed(2));
      setStartDate(editing.startDate);
      setIncludedInBalance(editing.includedInBalance);
    } else {
      setTitle("");
      setHasInterest(false);
      setInterestRate("");
      setTotalInstallments("12");
      setPaidInstallments("0");
      setMonthlyAmount("");
      setTotalAmount("");
      setStartDate(todayIso());
      setIncludedInBalance(true);
    }
  }, [open, editing]);

  const createMutation = trpc.accounts.createInstallment.useMutation({
    onSuccess: async () => {
      await onSaved();
      firecentToast(t("created"));
      onOpenChange(false);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const updateMutation = trpc.accounts.updateInstallment.useMutation({
    onSuccess: async () => {
      await onSaved();
      firecentToast(t("updated"));
      onOpenChange(false);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function syncFromTotal(nextTotalStr: string, nextCountStr: string, nextRate: number) {
    const tot = Number.parseFloat(nextTotalStr);
    const n = Number.parseInt(nextCountStr, 10);
    if (Number.isFinite(tot) && tot > 0 && Number.isFinite(n) && n >= 1) {
      const m = calcMonthlyPayment(tot, n, nextRate);
      if (m > 0) setMonthlyAmount(m.toFixed(2));
    }
  }

  function syncFromMonthly(nextMonthlyStr: string, nextCountStr: string, nextRate: number) {
    const m = Number.parseFloat(nextMonthlyStr);
    const n = Number.parseInt(nextCountStr, 10);
    if (Number.isFinite(m) && m > 0 && Number.isFinite(n) && n >= 1) {
      if (nextRate <= 0) {
        setTotalAmount((m * n).toFixed(2));
      } else {
        const r = nextRate / 100 / 12;
        const pv = (m * (1 - Math.pow(1 + r, -n))) / r;
        if (Number.isFinite(pv) && pv > 0) setTotalAmount(pv.toFixed(2));
      }
    }
  }

  const parsedRate = hasInterest
    ? Math.max(0, Number.parseFloat(interestRate) || 0)
    : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || isPending) return;
    setErrorMsg(null);

    const n = Number.parseInt(totalInstallments, 10);
    const paid = Number.parseInt(paidInstallments, 10) || 0;
    const m = Number.parseFloat(monthlyAmount);
    const tot = Number.parseFloat(totalAmount);

    if (!Number.isFinite(n) || n < 1 || n > 120) return;
    const finalMonthly =
      Number.isFinite(m) && m > 0
        ? m
        : Number.isFinite(tot) && tot > 0
          ? calcMonthlyPayment(tot, n, parsedRate)
          : 0;
    const finalTotal =
      Number.isFinite(tot) && tot > 0
        ? tot
        : finalMonthly > 0
          ? Math.round(finalMonthly * n * 100) / 100
          : 0;

    if (finalMonthly <= 0 || finalTotal <= 0) return;

    const payload = {
      title: title.trim(),
      totalAmount: finalTotal,
      totalInstallments: n,
      paidInstallments: Math.max(0, Math.min(paid, n)),
      monthlyAmount: finalMonthly,
      interestRate: parsedRate,
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : todayIso(),
      includedInBalance,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate({ accountId, ...payload });
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("editTitle") : t("addTitle")}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-col gap-4 overflow-x-hidden px-5"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("name")}
          </label>
          <Input
            size="touch"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t("interestMode")}
          </span>
          <ToggleGroup
            variant="segmented"
            value={[hasInterest ? "with" : "zero"]}
            onValueChange={(vals) => {
              const v = vals[0];
              if (!v) return;
              const nextWith = v === "with";
              setHasInterest(nextWith);
              const nextRate = nextWith
                ? Math.max(0, Number.parseFloat(interestRate) || 0)
                : 0;
              if (totalAmount) syncFromTotal(totalAmount, totalInstallments, nextRate);
            }}
            className="w-full"
          >
            <ToggleGroupItem value="zero" className="flex-1 text-[12px]">
              {t("modeZero")}
            </ToggleGroupItem>
            <ToggleGroupItem value="with" className="flex-1 text-[12px]">
              {t("modeWithInterest")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {hasInterest && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("apr")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              min="0"
              max="200"
              step="any"
              value={interestRate}
              onChange={(e) => {
                const v = e.target.value;
                setInterestRate(v);
                if (totalAmount) {
                  syncFromTotal(
                    totalAmount,
                    totalInstallments,
                    Math.max(0, Number.parseFloat(v) || 0),
                  );
                }
              }}
              placeholder="18.0"
            />
          </div>
        )}

        {/* Quick term pills + total/paid counts */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TERMS.map((term) => {
              const active = totalInstallments === String(term);
              return (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    const s = String(term);
                    setTotalInstallments(s);
                    if (totalAmount) syncFromTotal(totalAmount, s, parsedRate);
                    else if (monthlyAmount)
                      syncFromMonthly(monthlyAmount, s, parsedRate);
                  }}
                  className={cn(
                    "num h-7 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary-text"
                      : "bg-card text-muted-foreground hover:bg-accent",
                  )}
                >
                  {term}m
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <label className="text-[12px] font-medium text-muted-foreground">
                {t("totalInstallments")}
              </label>
              <Input
                size="touch"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                value={totalInstallments}
                onChange={(e) => {
                  const s = e.target.value;
                  setTotalInstallments(s);
                  if (totalAmount) syncFromTotal(totalAmount, s, parsedRate);
                  else if (monthlyAmount)
                    syncFromMonthly(monthlyAmount, s, parsedRate);
                }}
                placeholder="12"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label className="text-[12px] font-medium text-muted-foreground">
                {t("paidInstallments")}
              </label>
              <Input
                size="touch"
                type="number"
                inputMode="numeric"
                min="0"
                max="120"
                value={paidInstallments}
                onChange={(e) => setPaidInstallments(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("monthlyAmount")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={monthlyAmount}
              onChange={(e) => {
                setMonthlyAmount(e.target.value);
                syncFromMonthly(e.target.value, totalInstallments, parsedRate);
              }}
              placeholder="77.74"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("totalAmount")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={totalAmount}
              onChange={(e) => {
                setTotalAmount(e.target.value);
                syncFromTotal(e.target.value, totalInstallments, parsedRate);
              }}
              placeholder="932.88"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-muted-foreground">
            {t("startDate")}
          </label>
          <Input
            size="touch"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="num"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
          <div className="pr-3">
            <p className="text-[13.5px] font-medium">{t("includedInBalance")}</p>
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {t("includedInBalanceHint")}
            </p>
          </div>
          <Switch
            checked={includedInBalance}
            onCheckedChange={setIncludedInBalance}
          />
        </div>

        {errorMsg && (
          <Alert variant="notice-warning">
            <AlertCircle className="size-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          size="touch"
          disabled={
            !title.trim() ||
            (!monthlyAmount && !totalAmount) ||
            isPending
          }
          className="w-full"
        >
          {isPending
            ? t("saving")
            : editing
              ? t("saveChanges")
              : t("save")}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}
