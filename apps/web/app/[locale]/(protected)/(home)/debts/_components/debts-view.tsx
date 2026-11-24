"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HandCoins,
  Info,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  FieldRow,
  Money,
  PageHeader,
  SectionHeader,
  StateBlock,
  formatMoneyText,
} from "@/components/finance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type DebtTab = "ME_TO_ANYONE" | "ANYONE_TO_ME";

const CURRENCIES = ["USD", "MXN", "EUR", "CAD", "GBP", "COP", "ARS", "BRL"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DebtsView() {
  const locale = useLocale();
  const t = useTranslations("Debts");
  const tShell = useTranslations("Shell");
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<DebtTab>("ANYONE_TO_ME");
  const [showSettled, setShowSettled] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [payDebtId, setPayDebtId] = useState<number | null>(null);

  const query = trpc.debts.list.useQuery();
  const data = query.data;

  const invalidateAll = async () => {
    await Promise.all([
      utils.debts.list.invalidate(),
      utils.debts.get.invalidate(),
      utils.accounts.list.invalidate(),
      utils.accounts.get.invalidate(),
      utils.records.list.invalidate(),
      utils.dashboard.home.invalidate(),
    ]);
  };

  type DebtItem = NonNullable<typeof data>["youOwe"][number];

  const renderCard = (d: DebtItem) => {
    // Wallet/DB convention: ME_TO_ANYONE = I lent (owed to you), ANYONE_TO_ME = I borrowed (you owe)
    const isOwedToYou = d.type === "ME_TO_ANYONE";
    const dueWarn = d.dueInDays != null && d.dueInDays <= 7 && d.dueInDays >= 0;
    const overdue = d.dueInDays != null && d.dueInDays < 0;

    return (
      <Card
        key={d.id}
        variant="plain"
        onClick={() => setSelectedId(d.id)}
        className="flex cursor-pointer flex-col gap-2.5 p-4 transition-colors hover:bg-accent/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {d.name}
            </p>
            {d.note && (
              <p className="truncate text-[13px] text-muted-foreground">
                {d.note}
              </p>
            )}
          </div>
          <Money
            value={d.remainingAmount}
            currency={d.currency}
            size="row-strong"
            tone="plain"
            className={cn(d.paidBack && "text-muted-foreground line-through")}
          />
        </div>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={Math.round(d.progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={d.name}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              d.paidBack || isOwedToYou ? "bg-positive" : "bg-primary",
            )}
            style={{ width: `${d.progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span className="num truncate">
            {d.paidAmount > 0
              ? isOwedToYou
                ? t("receivedOf", {
                    paid: formatMoneyText(locale, d.paidAmount, d.currency, {
                      tone: "plain",
                    }),
                    total: formatMoneyText(locale, d.totalAmount, d.currency, {
                      tone: "plain",
                    }),
                  })
                : t("paidOf", {
                    paid: formatMoneyText(locale, d.paidAmount, d.currency, {
                      tone: "plain",
                    }),
                    total: formatMoneyText(locale, d.totalAmount, d.currency, {
                      tone: "plain",
                    }),
                  })
              : isOwedToYou
                ? t("nothingReceived")
                : t("nothingPaid")}
          </span>
          {d.payBackDate && !d.paidBack && (
            <span
              className={cn(
                "shrink-0 font-medium",
                overdue
                  ? "text-destructive"
                  : dueWarn
                    ? "text-warning"
                    : "text-muted-foreground",
              )}
            >
              {t("byDate", { date: d.payBackDate })}
            </span>
          )}
          {d.paidBack && (
            <Badge variant="positive">{t("settledBadge")}</Badge>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        back="/more"
        backLabel={tShell("nav.more")}
        actions={
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("addDebt")}
            onClick={() => setAddOpen(true)}
          >
            <Plus aria-hidden />
          </Button>
        }
        desktopActions={
          <Button size="touch" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span>{t("addDebt")}</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-5 lg:px-0">
        {query.isPending ? (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-12 w-48" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          </div>
        ) : query.isError || !data ? (
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => query.refetch() }}
          />
        ) : data.totalCount === 0 ? (
          <StateBlock
            kind="empty"
            icon={HandCoins}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={{ label: t("addDebt"), onClick: () => setAddOpen(true) }}
          />
        ) : (
          <>
            {/* Hero totals */}
            <section className="flex flex-col gap-1.5">
              <span className="text-[13px] text-muted-foreground">
                {t("youOweLabel")}
              </span>
              <Money
                value={data.youOweTotal}
                currency={data.currency}
                size="hero"
                tone="plain"
                dimCents
              />
              {data.owedToYouTotal > 0 && (
                <p className="flex items-center gap-1.5 text-[14px]">
                  <ArrowDownLeft
                    className="size-4 text-positive"
                    aria-hidden
                  />
                  <Money
                    value={data.owedToYouTotal}
                    currency={data.currency}
                    size="inline"
                    tone="plain"
                    className="font-semibold text-positive"
                  />
                  <span className="text-muted-foreground">
                    {t("owedToYouInline")}
                  </span>
                </p>
              )}
            </section>

            {/* Calm notice */}
            <Alert variant="notice">
              <Info className="size-4" />
              <AlertDescription>{t("trackedApartNotice")}</AlertDescription>
            </Alert>

            {/* Mobile segmented toggle */}
            <div className="lg:hidden">
              <ToggleGroup
                variant="segmented"
                value={[tab]}
                onValueChange={(vals) => {
                  const next = vals[0] as DebtTab | undefined;
                  if (next) setTab(next);
                }}
                className="w-full"
              >
                <ToggleGroupItem value="ANYONE_TO_ME" className="flex-1">
                  {t("tabs.youOwe", { count: String(data.youOwe.length) })}
                </ToggleGroupItem>
                <ToggleGroupItem value="ME_TO_ANYONE" className="flex-1">
                  {t("tabs.owedToYou", {
                    count: String(data.owedToYou.length),
                  })}
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="mt-4 flex flex-col gap-3">
                {tab === "ANYONE_TO_ME" ? (
                  data.youOwe.length === 0 ? (
                    <Card
                      variant="plain"
                      className="p-6 text-center text-[14px] text-muted-foreground"
                    >
                      {t("emptyYouOwe")}
                    </Card>
                  ) : (
                    data.youOwe.map(renderCard)
                  )
                ) : data.owedToYou.length === 0 ? (
                  <Card
                    variant="plain"
                    className="p-6 text-center text-[14px] text-muted-foreground"
                  >
                    {t("emptyOwedToYou")}
                  </Card>
                ) : (
                  data.owedToYou.map(renderCard)
                )}
              </div>
            </div>

            {/* Desktop side-by-side 2-column layout */}
            <div className="hidden gap-6 lg:grid lg:grid-cols-2 lg:items-start">
              <section className="flex flex-col gap-3">
                <SectionHeader
                  title={t("tabs.youOwe", {
                    count: String(data.youOwe.length),
                  })}
                />
                {data.youOwe.length === 0 ? (
                  <Card
                    variant="plain"
                    className="p-6 text-center text-[14px] text-muted-foreground"
                  >
                    {t("emptyYouOwe")}
                  </Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.youOwe.map(renderCard)}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeader
                  title={t("tabs.owedToYou", {
                    count: String(data.owedToYou.length),
                  })}
                />
                {data.owedToYou.length === 0 ? (
                  <Card
                    variant="plain"
                    className="p-6 text-center text-[14px] text-muted-foreground"
                  >
                    {t("emptyOwedToYou")}
                  </Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.owedToYou.map(renderCard)}
                  </div>
                )}
              </section>
            </div>

            {/* Collapsible Settled section */}
            {data.settled.length > 0 && (
              <section className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettled((v) => !v)}
                  className="flex h-11 items-center justify-between rounded-xl px-2 text-[14px] font-semibold text-muted-foreground hover:bg-accent"
                >
                  <span>
                    {t("settledSection", {
                      count: String(data.settled.length),
                    })}
                  </span>
                  {showSettled ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                {showSettled && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {data.settled.map(renderCard)}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Debt Detail Panel */}
      <DebtDetailSheet
        debtId={selectedId}
        onClose={() => setSelectedId(null)}
        onRecordPayment={(id) => {
          setSelectedId(null);
          setPayDebtId(id);
        }}
        onChanged={invalidateAll}
      />

      {/* Record Payment Sheet */}
      <RecordPaymentSheet
        debtId={payDebtId}
        onClose={() => setPayDebtId(null)}
        onSaved={invalidateAll}
      />

      {/* Add Debt Sheet */}
      <AddDebtSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultCurrency={data?.currency ?? "USD"}
        onCreated={invalidateAll}
      />
    </div>
  );
}

function DebtDetailSheet({
  debtId,
  onClose,
  onRecordPayment,
  onChanged,
}: {
  debtId: number | null;
  onClose: () => void;
  onRecordPayment: (id: number) => void;
  onChanged: () => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("Debts");
  const tShell = useTranslations("Shell");

  const detail = trpc.debts.get.useQuery(
    { id: debtId ?? 0 },
    { enabled: debtId !== null },
  );

  const settleMutation = trpc.debts.settle.useMutation({
    onSuccess: async (res) => {
      await onChanged();
      firecentToast(res.paidBack ? t("detail.settledToast") : t("detail.reopenedToast"));
    },
  });

  const restoreMutation = trpc.debts.restore.useMutation({
    onSuccess: async () => {
      await onChanged();
      firecentToast(t("detail.restoredToast"));
    },
  });

  const deleteMutation = trpc.debts.delete.useMutation({
    onSuccess: async (_, vars) => {
      await onChanged();
      onClose();
      firecentToast(t("detail.deletedToast"), {
        action: {
          label: t("detail.undo"),
          onClick: () => restoreMutation.mutate({ id: vars.id }),
        },
      });
    },
  });

  const d = detail.data;
  const isOwedToYou = d?.type === "ME_TO_ANYONE";

  return (
    <ResponsiveSheet
      open={debtId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={d?.name ?? t("title")}
      closeLabel={tShell("close")}
      desktop="panel"
    >
      {detail.isPending ? (
        <div className="flex flex-col gap-4 px-5">
          <Skeleton className="mx-auto h-10 w-36" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ) : detail.isError || !d ? (
        <div className="px-5">
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => detail.refetch() }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-5">
          <div className="flex flex-col items-center gap-1 pt-2 text-center">
            <span className="text-[13px] text-muted-foreground">
              {d.paidBack
                ? t("settledBadge")
                : isOwedToYou
                  ? t("detail.stillOwesYou", { name: d.name })
                  : t("detail.youStillOwe", { name: d.name })}
            </span>
            <Money
              value={d.remainingAmount}
              currency={d.currency}
              size="sheet"
              tone="plain"
            />
          </div>

          <div
            role="progressbar"
            aria-valuenow={Math.round(d.progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full",
                d.paidBack || isOwedToYou ? "bg-positive" : "bg-primary",
              )}
              style={{ width: `${d.progressPct}%` }}
            />
          </div>

          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            <FieldRow
              label={isOwedToYou ? t("detail.lent") : t("detail.borrowed")}
              value={`${formatMoneyText(locale, d.totalAmount, d.currency, { tone: "plain" })} · ${d.creationDate}`}
            />
            <FieldRow
              label={t("detail.paidSoFar")}
              value={formatMoneyText(locale, d.paidAmount, d.currency, {
                tone: "plain",
              })}
            />
            {d.payBackDate && (
              <FieldRow
                label={t("detail.payBackBy")}
                value={d.payBackDate}
              />
            )}
            {d.account && (
              <FieldRow
                label={t("detail.account")}
                value={d.account.name}
              />
            )}
            {d.note && <FieldRow label={t("detail.note")} value={d.note} />}
          </div>

          {/* Payment history */}
          <section className="flex flex-col gap-2">
            <SectionHeader title={t("detail.payments")} />
            <Card variant="plain" className="divide-y overflow-hidden">
              {d.payments.length === 0 ? (
                <p className="p-4 text-[13px] text-muted-foreground">
                  {t("detail.noPayments")}
                </p>
              ) : (
                d.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">
                        {p.accountName}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {p.date ?? "—"}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <Money
                      value={p.amount}
                      currency={p.currency}
                      size="row"
                      tone="movement"
                      kind={p.type}
                    />
                  </div>
                ))
              )}
            </Card>
          </section>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {!d.paidBack && (
              <Button
                size="touch"
                onClick={() => onRecordPayment(d.id)}
                className="w-full"
              >
                {t("detail.recordPayment")}
              </Button>
            )}
            <Button
              variant="outline"
              size="touch"
              disabled={settleMutation.isPending}
              onClick={() =>
                settleMutation.mutate({ id: d.id, settled: !d.paidBack })
              }
              className="w-full"
            >
              {d.paidBack ? (
                <>
                  <RotateCcw className="size-4" aria-hidden />
                  <span>{t("detail.reopen")}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" aria-hidden />
                  <span>{t("detail.markSettled")}</span>
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="touch"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: d.id })}
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              <span>{t("detail.delete")}</span>
            </Button>
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}

function RecordPaymentSheet({
  debtId,
  onClose,
  onSaved,
}: {
  debtId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("Debts");
  const tShell = useTranslations("Shell");

  const detail = trpc.debts.get.useQuery(
    { id: debtId ?? 0 },
    { enabled: debtId !== null },
  );
  const options = trpc.records.formOptions.useQuery(undefined, {
    enabled: debtId !== null,
  });

  const [amountStr, setAmountStr] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState("");

  const recordMutation = trpc.debts.recordPayment.useMutation({
    onSuccess: async () => {
      await onSaved();
      setAmountStr("");
      setNote("");
      firecentToast(t("payment.savedToast"));
      onClose();
    },
  });

  const d = detail.data;
  const parsed = Number.parseFloat(amountStr);
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <ResponsiveSheet
      open={debtId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("detail.recordPayment")}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      {d && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid || recordMutation.isPending) return;
            recordMutation.mutate({
              debtId: d.id,
              amount: parsed,
              accountId: accountId ? Number(accountId) : null,
              date,
              note: note.trim() || null,
            });
          }}
          className="flex flex-col gap-4 px-5"
        >
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <span>{d.name}</span>
            <button
              type="button"
              onClick={() => setAmountStr(d.remainingAmount.toFixed(2))}
              className="font-medium text-primary-text hover:underline"
            >
              {t("payment.fillRemaining", {
                amount: formatMoneyText(locale, d.remainingAmount, d.currency, {
                  tone: "plain",
                }),
              })}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("payment.amount")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              autoFocus
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {d.type === "ME_TO_ANYONE"
                ? t("payment.intoAccount")
                : t("payment.fromAccount")}
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-12 w-full rounded-xl border bg-card px-3.5 text-[15px] outline-none"
            >
              <option value="">{t("payment.noAccount")}</option>
              {(options.data?.accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                {t("payment.date")}
              </label>
              <Input
                size="touch"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                {t("detail.note")}
              </label>
              <Input
                size="touch"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("form.optional")}
              />
            </div>
          </div>

          <Button
            type="submit"
            size="touch"
            disabled={!valid || recordMutation.isPending}
            className="w-full"
          >
            {valid
              ? t("payment.submitWithAmount", {
                  amount: formatMoneyText(locale, parsed, d.currency, {
                    tone: "plain",
                  }),
                })
              : t("detail.recordPayment")}
          </Button>
        </form>
      )}
    </ResponsiveSheet>
  );
}

function AddDebtSheet({
  open,
  onOpenChange,
  defaultCurrency,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
  onCreated: () => Promise<void>;
}) {
  const t = useTranslations("Debts");
  const tShell = useTranslations("Shell");

  const options = trpc.records.formOptions.useQuery(undefined, {
    enabled: open,
  });

  const [type, setType] = useState<DebtTab>("ANYONE_TO_ME");
  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [creationDate, setCreationDate] = useState(todayStr);
  const [payBackDate, setPayBackDate] = useState("");
  const [note, setNote] = useState("");
  const [alsoRecord, setAlsoRecord] = useState(false);
  const [accountId, setAccountId] = useState("");

  const createMutation = trpc.debts.create.useMutation({
    onSuccess: async () => {
      await onCreated();
      setName("");
      setAmountStr("");
      setPayBackDate("");
      setNote("");
      setAlsoRecord(false);
      firecentToast(t("form.createdToast"));
      onOpenChange(false);
    },
  });

  const parsed = Number.parseFloat(amountStr);
  const valid = name.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("addDebt")}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || createMutation.isPending) return;
          createMutation.mutate({
            type,
            name: name.trim(),
            amount: parsed,
            currency,
            creationDate,
            payBackDate: payBackDate || null,
            note: note.trim() || null,
            accountId: accountId ? Number(accountId) : null,
            alsoRecordInAccount: alsoRecord && Boolean(accountId),
          });
        }}
        className="flex flex-col gap-4 px-5"
      >
        <ToggleGroup
          variant="segmented"
          value={[type]}
          onValueChange={(vals) => {
            const next = vals[0] as DebtTab | undefined;
            if (next) setType(next);
          }}
          className="w-full"
        >
          <ToggleGroupItem value="ANYONE_TO_ME" className="flex-1">
            {t("form.iOwe")}
          </ToggleGroupItem>
          <ToggleGroupItem value="ME_TO_ANYONE" className="flex-1">
            {t("form.owedToMe")}
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("form.who")}
          </label>
          <Input
            size="touch"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("form.whoPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("payment.amount")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("form.currency")}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-12 w-full rounded-xl border bg-card px-3 text-[15px] outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("payment.date")}
            </label>
            <Input
              size="touch"
              type="date"
              value={creationDate}
              onChange={(e) => setCreationDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("detail.payBackBy")}
            </label>
            <Input
              size="touch"
              type="date"
              value={payBackDate}
              onChange={(e) => setPayBackDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("detail.note")}
          </label>
          <Input
            size="touch"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("form.notePlaceholder")}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
          <span className="text-[14px] font-medium">
            {t("form.alsoRecord")}
          </span>
          <Switch checked={alsoRecord} onCheckedChange={setAlsoRecord} />
        </div>

        {alsoRecord && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("detail.account")}
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-12 w-full rounded-xl border bg-card px-3.5 text-[15px] outline-none"
            >
              <option value="">{t("form.pickAccount")}</option>
              {(options.data?.accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          type="submit"
          size="touch"
          disabled={!valid || createMutation.isPending}
          className="w-full"
        >
          {createMutation.isPending ? t("form.saving") : t("addDebt")}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}
