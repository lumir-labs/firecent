"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { trpc } from "@app/api/client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { firecentToast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type CreatableType = "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CASH" | "CREDIT_CARD";

const CURRENCIES = ["USD", "MXN", "EUR", "CAD", "GBP", "COP", "ARS", "BRL"];

export type EditableAccount = {
  id: number;
  name: string;
  type: string;
  currency: string;
  accountNumber: string | null;
  creditLimit: number | null;
  paymentDay: number | null;
  interestRate: number | null;
  displayCreditMode: "CREDIT_BALANCE" | "AVAILABLE_CREDIT";
  excludeFromStats: boolean;
};

export function AccountFormSheet({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: EditableAccount | null;
  onSaved?: (id: number) => void;
}) {
  const t = useTranslations("Accounts");
  const tShell = useTranslations("Shell");
  const utils = trpc.useUtils();

  const isEdit = Boolean(account);

  const [name, setName] = useState("");
  const [type, setType] = useState<CreatableType>("CHECKING_ACCOUNT");
  const [currency, setCurrency] = useState("USD");
  const [accountNumber, setAccountNumber] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [excludeFromStats, setExcludeFromStats] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (account) {
      setName(account.name);
      setType(
        account.type === "SAVINGS_ACCOUNT" ||
          account.type === "CASH" ||
          account.type === "CREDIT_CARD"
          ? account.type
          : "CHECKING_ACCOUNT",
      );
      setCurrency(account.currency);
      setAccountNumber(account.accountNumber ?? "");
      setCurrentBalance("");
      setCreditLimit(account.creditLimit != null ? String(account.creditLimit) : "");
      setPaymentDay(account.paymentDay != null ? String(account.paymentDay) : "");
      setInterestRate(
        account.interestRate != null ? String(account.interestRate) : "",
      );
      setExcludeFromStats(account.excludeFromStats);
    } else {
      setName("");
      setType("CHECKING_ACCOUNT");
      setCurrency("USD");
      setAccountNumber("");
      setCurrentBalance("");
      setCreditLimit("");
      setPaymentDay("");
      setInterestRate("");
      setExcludeFromStats(false);
    }
  }, [open, account]);

  const invalidate = async () => {
    await Promise.all([
      utils.accounts.list.invalidate(),
      utils.accounts.get.invalidate(),
      utils.records.formOptions.invalidate(),
      utils.dashboard.home.invalidate(),
      utils.dashboard.netWorth.invalidate(),
    ]);
  };

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: async (res) => {
      await invalidate();
      firecentToast(t("form.created"));
      onSaved?.(res.id);
      onOpenChange(false);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: async (res) => {
      await invalidate();
      firecentToast(t("form.updated"));
      onSaved?.(res.id);
      onOpenChange(false);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCard = (account ? account.type : type) === "CREDIT_CARD";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setErrorMsg(null);

    const parsedLimit = Number.parseFloat(creditLimit);
    const parsedDay = Number.parseInt(paymentDay, 10);
    const parsedApr = Number.parseFloat(interestRate);

    if (account) {
      updateMutation.mutate({
        id: account.id,
        name: name.trim(),
        accountNumber: accountNumber.trim() || null,
        creditLimit:
          isCard && Number.isFinite(parsedLimit) && parsedLimit > 0
            ? parsedLimit
            : null,
        paymentDay:
          isCard && Number.isFinite(parsedDay) && parsedDay >= 1 && parsedDay <= 31
            ? parsedDay
            : null,
        interestRate:
          isCard && Number.isFinite(parsedApr) && parsedApr >= 0
            ? parsedApr
            : null,
        excludeFromStats,
      });
      return;
    }

    const parsedBalance = Number.parseFloat(currentBalance);
    createMutation.mutate({
      name: name.trim(),
      type,
      currency,
      accountNumber: accountNumber.trim() || null,
      currentBalance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
      creditLimit:
        isCard && Number.isFinite(parsedLimit) && parsedLimit > 0
          ? parsedLimit
          : null,
      paymentDay:
        isCard && Number.isFinite(parsedDay) && parsedDay >= 1 && parsedDay <= 31
          ? parsedDay
          : null,
      interestRate:
        isCard && Number.isFinite(parsedApr) && parsedApr >= 0 ? parsedApr : null,
      excludeFromStats,
    });
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("form.editTitle") : t("form.addTitle")}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5">
        {errorMsg && (
          <Alert variant="notice-warning">
            <AlertCircle className="size-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("form.type")}
            </label>
            <ToggleGroup
              variant="segmented"
              value={[type]}
              onValueChange={(vals) => {
                const next = vals[0] as CreatableType | undefined;
                if (next) setType(next);
              }}
              className="w-full"
            >
              <ToggleGroupItem value="CHECKING_ACCOUNT" className="flex-1 text-[12px]">
                {t("types.CHECKING_ACCOUNT")}
              </ToggleGroupItem>
              <ToggleGroupItem value="SAVINGS_ACCOUNT" className="flex-1 text-[12px]">
                {t("types.SAVINGS_ACCOUNT")}
              </ToggleGroupItem>
              <ToggleGroupItem value="CASH" className="flex-1 text-[12px]">
                {t("types.CASH")}
              </ToggleGroupItem>
              <ToggleGroupItem value="CREDIT_CARD" className="flex-1 text-[12px]">
                {t("types.CREDIT_CARD")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("form.name")}
          </label>
          <Input
            size="touch"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("form.namePlaceholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                {t("form.currency")}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-12 w-full rounded-xl border bg-card px-3.5 text-[15px] outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("form.last4")}
            </label>
            <Input
              size="touch"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="4242"
              maxLength={16}
            />
          </div>
        </div>

        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {isCard ? t("form.currentDebt") : t("form.currentBalance")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
        )}

        {isCard && (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">
                {t("form.creditLimit")}
              </label>
              <Input
                size="touch"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">
                {t("form.paymentDay")}
              </label>
              <Input
                size="touch"
                type="number"
                min="1"
                max="31"
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value)}
                placeholder="15"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">
                {t("form.apr")}
              </label>
              <Input
                size="touch"
                type="number"
                min="0"
                max="200"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="24.9"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
          <div className="pr-3">
            <p className="text-[14px] font-medium">{t("form.excludeFromStats")}</p>
            <p className="text-[12px] text-muted-foreground">
              {t("form.excludeHint")}
            </p>
          </div>
          <Switch
            checked={excludeFromStats}
            onCheckedChange={setExcludeFromStats}
          />
        </div>

        <Button
          type="submit"
          size="touch"
          disabled={!name.trim() || isPending}
          className="mt-1 w-full"
        >
          {isPending ? t("form.saving") : isEdit ? t("form.saveChanges") : t("form.create")}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}
