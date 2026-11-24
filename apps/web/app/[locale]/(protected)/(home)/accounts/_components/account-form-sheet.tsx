"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Check } from "lucide-react";
import { trpc } from "@app/api/client";

import {
  ACCOUNT_COLOR_PRESETS,
  METALLIC_FINISHES,
  resolveAccountFinish,
} from "@/components/finance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { firecentToast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type CreatableType = "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CASH" | "CREDIT_CARD";

const CURRENCIES = ["USD", "MXN", "EUR", "CAD", "GBP", "COP", "ARS", "BRL"];

export type EditableAccount = {
  id: number;
  name: string;
  type: string;
  currency: string;
  color: string | null;
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
  const locale = useLocale();
  const t = useTranslations("Accounts");
  const tShell = useTranslations("Shell");
  const utils = trpc.useUtils();

  const isEdit = Boolean(account);

  const [name, setName] = useState("");
  const [type, setType] = useState<CreatableType>("CHECKING_ACCOUNT");
  const [currency, setCurrency] = useState("USD");
  const [color, setColor] = useState<string>("indigo");
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
      setColor(account.color || (account.type === "CREDIT_CARD" ? "obsidian" : "indigo"));
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
      setColor("indigo");
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
  const effectiveType = account ? account.type : type;
  const isCard = effectiveType === "CREDIT_CARD";
  const resolvedFinish = resolveAccountFinish(color);
  const isEs = locale.startsWith("es");

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
        color: color || null,
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
      color: color || null,
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

        {/* Live compact preview card */}
        <div
          style={{
            background:
              resolvedFinish?.cardBackground ??
              "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
            color: resolvedFinish?.ink ?? "#ffffff",
            borderColor: resolvedFinish?.border ?? "rgba(255,255,255,0.14)",
          }}
          className="flex items-center justify-between rounded-2xl border px-4 py-3.5 shadow-xs transition-all"
        >
          <div className="min-w-0">
            <p
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: resolvedFinish?.mutedInk ?? "rgba(255,255,255,0.72)" }}
            >
              {t(`types.${effectiveType}` as never)} · {currency}
            </p>
            <p className="mt-0.5 truncate text-[16px] font-semibold">
              {name.trim() || t("form.namePlaceholder")}
            </p>
          </div>
          {accountNumber.trim() ? (
            <span
              className="num shrink-0 text-[13px] font-medium"
              style={{ color: resolvedFinish?.mutedInk ?? "rgba(255,255,255,0.72)" }}
            >
              ···· {accountNumber.trim().slice(-4)}
            </span>
          ) : (
            <span
              aria-hidden
              className="h-5 w-7 shrink-0 rounded-md"
              style={{
                backgroundColor: resolvedFinish?.ink ?? "#ffffff",
                opacity: 0.25,
              }}
            />
          )}
        </div>

        {!isEdit && (
          <ToggleGroup
            variant="segmented"
            value={[type]}
            onValueChange={(vals) => {
              const next = vals[0] as CreatableType | undefined;
              if (next) {
                setType(next);
                if (next === "CREDIT_CARD" && color === "indigo") {
                  setColor("gold");
                }
              }
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
        )}

        {/* Appearance: Metallic finishes + Bank colors + Custom */}
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t("form.cardFinish")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {METALLIC_FINISHES.map((m) => {
              const active = color.toLowerCase() === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setColor(m.key)}
                  style={{
                    background: m.finish.cardBackground,
                    color: m.finish.ink,
                    borderColor: active ? "var(--ring)" : m.finish.border,
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-transform active:scale-95",
                    active && "ring-2 ring-ring ring-offset-1 ring-offset-card",
                  )}
                >
                  {active && <Check className="size-3.5" aria-hidden />}
                  <span>{isEs ? m.labelEs : m.labelEn}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {ACCOUNT_COLOR_PRESETS.map((p) => {
              const active =
                color.toLowerCase() === p.key ||
                color.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-label={isEs ? p.labelEs : p.labelEn}
                  onClick={() => setColor(p.hex)}
                  style={{ backgroundColor: p.hex }}
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-white transition-transform hover:scale-105",
                    active && "ring-2 ring-ring ring-offset-2 ring-offset-card",
                  )}
                >
                  {active && <Check className="size-3.5" aria-hidden />}
                </button>
              );
            })}
            <label
              aria-label={t("form.customColor")}
              className="relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-muted-foreground/50 bg-muted text-[11px] font-semibold text-muted-foreground hover:border-foreground"
              title={t("form.customColor")}
            >
              +
              <input
                type="color"
                value={color.startsWith("#") ? color : "#5e54f0"}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

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
