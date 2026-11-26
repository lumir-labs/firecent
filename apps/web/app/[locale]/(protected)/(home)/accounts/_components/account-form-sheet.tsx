"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, Banknote, Check, PiggyBank } from "lucide-react";
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

type CycleType = "MONTHLY_DAY" | "EVERY_X_DAYS";

export type EditableAccount = {
  id: number;
  name: string;
  type: string;
  currency: string;
  color: string | null;
  hasCard?: boolean;
  accountNumber: string | null;
  creditLimit: number | null;
  paymentDayType?: CycleType | null;
  paymentDay: number | null;
  paymentEveryDays?: number | null;
  paymentAnchorDate?: string | null;
  cutoffDayType?: CycleType | null;
  cutoffDay?: number | null;
  cutoffEveryDays?: number | null;
  cutoffAnchorDate?: string | null;
  interestRate: number | null;
  displayCreditMode: "CREDIT_BALANCE" | "AVAILABLE_CREDIT";
  excludeFromStats: boolean;
};

function CardCycleEditor({
  title,
  dayType,
  onDayTypeChange,
  monthlyLabel,
  everyXDaysLabel,
  dayLabel,
  dayPlaceholder,
  dayValue,
  onDayChange,
  everyDaysLabel,
  everyDaysValue,
  onEveryDaysChange,
  daysSuffix,
  anchorLabel,
  anchorValue,
  onAnchorChange,
  hint,
}: {
  title: string;
  dayType: CycleType;
  onDayTypeChange: (next: CycleType) => void;
  monthlyLabel: string;
  everyXDaysLabel: string;
  dayLabel: string;
  dayPlaceholder: string;
  dayValue: string;
  onDayChange: (v: string) => void;
  everyDaysLabel: string;
  everyDaysValue: string;
  onEveryDaysChange: (v: string) => void;
  daysSuffix: string;
  anchorLabel: string;
  anchorValue: string;
  onAnchorChange: (v: string) => void;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-muted/25 p-3">
      <span className="text-[12px] font-medium text-muted-foreground">
        {title}
      </span>
      <ToggleGroup
        variant="segmented"
        value={[dayType]}
        onValueChange={(vals) => {
          const next = vals[0] as CycleType | undefined;
          if (next) {
            onDayTypeChange(next);
            if (next === "EVERY_X_DAYS" && !everyDaysValue) {
              onEveryDaysChange("30");
            }
          }
        }}
        className="w-full"
      >
        <ToggleGroupItem value="MONTHLY_DAY" className="flex-1 text-[12px]">
          {monthlyLabel}
        </ToggleGroupItem>
        <ToggleGroupItem value="EVERY_X_DAYS" className="flex-1 text-[12px]">
          {everyXDaysLabel}
        </ToggleGroupItem>
      </ToggleGroup>

      {dayType === "MONTHLY_DAY" ? (
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-muted-foreground">
            {dayLabel}
          </label>
          <Input
            size="touch"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={dayValue}
            onChange={(e) => onDayChange(e.target.value)}
            placeholder={dayPlaceholder}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex min-w-0 flex-col gap-1">
              <label className="text-[12px] font-medium text-muted-foreground">
                {everyDaysLabel}
              </label>
              <div className="relative">
                <Input
                  size="touch"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="365"
                  value={everyDaysValue}
                  onChange={(e) => onEveryDaysChange(e.target.value)}
                  placeholder="30"
                  className="pr-12"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12.5px] text-muted-foreground">
                  {daysSuffix}
                </span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label className="text-[12px] font-medium text-muted-foreground">
                {anchorLabel}
              </label>
              <Input
                size="touch"
                type="date"
                value={anchorValue}
                onChange={(e) => onAnchorChange(e.target.value)}
                className="num min-w-0 text-[13px]"
              />
            </div>
          </div>
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            {hint}
          </p>
        </div>
      )}
    </div>
  );
}

export function AccountFormSheet({
  open,
  onOpenChange,
  account,
  defaultType,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: EditableAccount | null;
  defaultType?: CreatableType;
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
  const [hasCard, setHasCard] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [paymentDayType, setPaymentDayType] = useState<CycleType>("MONTHLY_DAY");
  const [paymentDay, setPaymentDay] = useState("");
  const [paymentEveryDays, setPaymentEveryDays] = useState("");
  const [paymentAnchorDate, setPaymentAnchorDate] = useState("");
  const [cutoffDayType, setCutoffDayType] = useState<CycleType>("MONTHLY_DAY");
  const [cutoffDay, setCutoffDay] = useState("");
  const [cutoffEveryDays, setCutoffEveryDays] = useState("");
  const [cutoffAnchorDate, setCutoffAnchorDate] = useState("");
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
      setHasCard(Boolean(account.hasCard));
      setAccountNumber(account.accountNumber ?? "");
      setCurrentBalance("");
      setCreditLimit(account.creditLimit != null ? String(account.creditLimit) : "");
      setPaymentDayType(
        account.paymentDayType === "EVERY_X_DAYS"
          ? "EVERY_X_DAYS"
          : "MONTHLY_DAY",
      );
      setPaymentDay(account.paymentDay != null ? String(account.paymentDay) : "");
      setPaymentEveryDays(
        account.paymentEveryDays != null ? String(account.paymentEveryDays) : "",
      );
      setPaymentAnchorDate(account.paymentAnchorDate ?? "");
      setCutoffDayType(
        account.cutoffDayType === "EVERY_X_DAYS"
          ? "EVERY_X_DAYS"
          : "MONTHLY_DAY",
      );
      setCutoffDay(account.cutoffDay != null ? String(account.cutoffDay) : "");
      setCutoffEveryDays(
        account.cutoffEveryDays != null ? String(account.cutoffEveryDays) : "",
      );
      setCutoffAnchorDate(account.cutoffAnchorDate ?? "");
      setInterestRate(
        account.interestRate != null ? String(account.interestRate) : "",
      );
      setExcludeFromStats(account.excludeFromStats);
    } else {
      const initialType: CreatableType = defaultType ?? "CHECKING_ACCOUNT";
      setName("");
      setType(initialType);
      setCurrency("USD");
      setColor(initialType === "CREDIT_CARD" ? "obsidian" : "indigo");
      setHasCard(false);
      setAccountNumber("");
      setCurrentBalance("");
      setCreditLimit("");
      setPaymentDayType("MONTHLY_DAY");
      setPaymentDay("");
      setPaymentEveryDays("30");
      setPaymentAnchorDate("");
      setCutoffDayType("MONTHLY_DAY");
      setCutoffDay("");
      setCutoffEveryDays("30");
      setCutoffAnchorDate("");
      setInterestRate("");
      setExcludeFromStats(false);
    }
  }, [open, account, defaultType]);

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
  const effectiveType = type;
  const isCard = effectiveType === "CREDIT_CARD";
  const isSavings = effectiveType === "SAVINGS_ACCOUNT";
  const showAsCard =
    isCard || effectiveType === "CHECKING_ACCOUNT" || (isSavings && hasCard);
  const namePlaceholder = t(
    `form.namePlaceholders.${effectiveType}` as never,
  );
  const resolvedFinish = resolveAccountFinish(color);
  const isEs = locale.startsWith("es");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setErrorMsg(null);

    const parsedLimit = Number.parseFloat(creditLimit);
    const parsedDay = Number.parseInt(paymentDay, 10);
    const parsedEveryDays = Number.parseInt(paymentEveryDays, 10);
    const parsedCutoffDay = Number.parseInt(cutoffDay, 10);
    const parsedCutoffEveryDays = Number.parseInt(cutoffEveryDays, 10);
    const parsedApr = Number.parseFloat(interestRate);

    const resolvedPaymentDay =
      isCard &&
      paymentDayType === "MONTHLY_DAY" &&
      Number.isFinite(parsedDay) &&
      parsedDay >= 1 &&
      parsedDay <= 31
        ? parsedDay
        : null;
    const resolvedEveryDays =
      isCard &&
      paymentDayType === "EVERY_X_DAYS" &&
      Number.isFinite(parsedEveryDays) &&
      parsedEveryDays >= 1 &&
      parsedEveryDays <= 365
        ? parsedEveryDays
        : null;
    const resolvedPaymentAnchor =
      isCard &&
      paymentDayType === "EVERY_X_DAYS" &&
      /^\d{4}-\d{2}-\d{2}$/.test(paymentAnchorDate)
        ? paymentAnchorDate
        : null;

    const resolvedCutoffDay =
      isCard &&
      cutoffDayType === "MONTHLY_DAY" &&
      Number.isFinite(parsedCutoffDay) &&
      parsedCutoffDay >= 1 &&
      parsedCutoffDay <= 31
        ? parsedCutoffDay
        : null;
    const resolvedCutoffEveryDays =
      isCard &&
      cutoffDayType === "EVERY_X_DAYS" &&
      Number.isFinite(parsedCutoffEveryDays) &&
      parsedCutoffEveryDays >= 1 &&
      parsedCutoffEveryDays <= 365
        ? parsedCutoffEveryDays
        : null;
    const resolvedCutoffAnchor =
      isCard &&
      cutoffDayType === "EVERY_X_DAYS" &&
      /^\d{4}-\d{2}-\d{2}$/.test(cutoffAnchorDate)
        ? cutoffAnchorDate
        : null;

    if (account) {
      updateMutation.mutate({
        id: account.id,
        name: name.trim(),
        type,
        color: color || null,
        hasCard: isSavings ? hasCard : false,
        accountNumber: accountNumber.trim() || null,
        creditLimit:
          isCard && Number.isFinite(parsedLimit) && parsedLimit > 0
            ? parsedLimit
            : null,
        paymentDayType: isCard ? paymentDayType : null,
        paymentDay: resolvedPaymentDay,
        paymentEveryDays: resolvedEveryDays,
        paymentAnchorDate: resolvedPaymentAnchor,
        cutoffDayType: isCard ? cutoffDayType : null,
        cutoffDay: resolvedCutoffDay,
        cutoffEveryDays: resolvedCutoffEveryDays,
        cutoffAnchorDate: resolvedCutoffAnchor,
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
      hasCard: isSavings ? hasCard : false,
      accountNumber: accountNumber.trim() || null,
      currentBalance: Number.isFinite(parsedBalance) ? parsedBalance : 0,
      creditLimit:
        isCard && Number.isFinite(parsedLimit) && parsedLimit > 0
          ? parsedLimit
          : null,
      paymentDayType: isCard ? paymentDayType : "MONTHLY_DAY",
      paymentDay: resolvedPaymentDay,
      paymentEveryDays: resolvedEveryDays,
      paymentAnchorDate: resolvedPaymentAnchor,
      cutoffDayType: isCard ? cutoffDayType : "MONTHLY_DAY",
      cutoffDay: resolvedCutoffDay,
      cutoffEveryDays: resolvedCutoffEveryDays,
      cutoffAnchorDate: resolvedCutoffAnchor,
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
      <form
        noValidate
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-col gap-4 overflow-x-hidden px-5"
      >

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
              {t(`types.${effectiveType}` as never)}
              {isSavings && hasCard ? ` · ${t("detail.debitBadge")}` : ""} ·{" "}
              {currency}
            </p>
            <p className="mt-0.5 truncate text-[16px] font-semibold">
              {name.trim() || namePlaceholder}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {accountNumber.trim() && (
              <span
                className="num text-[13px] font-medium"
                style={{
                  color: resolvedFinish?.mutedInk ?? "rgba(255,255,255,0.72)",
                }}
              >
                ···· {accountNumber.trim().slice(-4)}
              </span>
            )}
            {showAsCard ? (
              !accountNumber.trim() && (
                <span
                  aria-hidden
                  className="h-5 w-7 rounded-md"
                  style={{
                    backgroundColor: resolvedFinish?.ink ?? "#ffffff",
                    opacity: 0.25,
                  }}
                />
              )
            ) : (
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-xl"
                style={{
                  backgroundColor: "rgba(255,255,255,0.16)",
                  color: resolvedFinish?.ink ?? "#ffffff",
                }}
              >
                {effectiveType === "CASH" ? (
                  <Banknote className="size-4" strokeWidth={2} />
                ) : (
                  <PiggyBank className="size-4" strokeWidth={2} />
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t("form.type")}
          </span>
          <ToggleGroup
            variant="segmented"
            value={[type]}
            onValueChange={(vals) => {
              const next = vals[0] as CreatableType | undefined;
              if (next) {
                setType(next);
                if (!isEdit && next === "CREDIT_CARD" && color === "indigo") {
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
          <p className="text-[12px] leading-snug text-muted-foreground">
            {t(`form.typeHints.${effectiveType}` as never)}
          </p>
        </div>

        {isSavings && (
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
            <div className="pr-3">
              <p className="text-[14px] font-medium">{t("form.hasCard")}</p>
              <p className="text-[12px] text-muted-foreground">
                {t("form.hasCardHint")}
              </p>
            </div>
            <Switch checked={hasCard} onCheckedChange={setHasCard} />
          </div>
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
            placeholder={namePlaceholder}
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
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  {t("form.creditLimit")}
                </label>
                <Input
                  size="touch"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  {t("form.apr")}
                </label>
                <Input
                  size="touch"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="200"
                  step="any"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="24.9"
                />
              </div>
            </div>

            <CardCycleEditor
              title={t("form.cutoffSchedule")}
              dayType={cutoffDayType}
              onDayTypeChange={setCutoffDayType}
              monthlyLabel={t("form.monthlyDay")}
              everyXDaysLabel={t("form.everyXDaysOption")}
              dayLabel={t("form.cutoffDay")}
              dayPlaceholder="20"
              dayValue={cutoffDay}
              onDayChange={setCutoffDay}
              everyDaysLabel={t("form.paymentEveryDays")}
              everyDaysValue={cutoffEveryDays}
              onEveryDaysChange={setCutoffEveryDays}
              daysSuffix={t("form.daysSuffix")}
              anchorLabel={t("form.nextCutoffDate")}
              anchorValue={cutoffAnchorDate}
              onAnchorChange={setCutoffAnchorDate}
              hint={t("form.everyXDaysHint")}
            />

            <CardCycleEditor
              title={t("form.paymentSchedule")}
              dayType={paymentDayType}
              onDayTypeChange={setPaymentDayType}
              monthlyLabel={t("form.monthlyDay")}
              everyXDaysLabel={t("form.everyXDaysOption")}
              dayLabel={t("form.paymentDay")}
              dayPlaceholder="15"
              dayValue={paymentDay}
              onDayChange={setPaymentDay}
              everyDaysLabel={t("form.paymentEveryDays")}
              everyDaysValue={paymentEveryDays}
              onEveryDaysChange={setPaymentEveryDays}
              daysSuffix={t("form.daysSuffix")}
              anchorLabel={t("form.nextPaymentDate")}
              anchorValue={paymentAnchorDate}
              onAnchorChange={setPaymentAnchorDate}
              hint={t("form.everyXDaysHint")}
            />
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

        {errorMsg && (
          <Alert variant="notice-warning">
            <AlertCircle className="size-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

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
