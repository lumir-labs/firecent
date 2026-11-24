"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Grid2x2,
  Info,
  Search,
  Wallet,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  AmountKeypad,
  CategoryIcon,
  FieldRow,
  Money,
  NatureSwatch,
  formatMoneyText,
} from "@/components/finance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { firecentToast } from "@/components/ui/sonner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type RecordType = "EXPENSE" | "INCOME" | "TRANSFER";

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTimeStr = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function AddTransactionSheet({
  open,
  onOpenChange,
  defaultAccountId,
  editRecordId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: number;
  editRecordId?: number;
  onSaved?: (id: number) => void;
}) {
  const t = useTranslations("QuickAdd");
  const tShell = useTranslations("Shell");

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editRecordId ? t("editTitle") : t("title")}
      hideTitle={!editRecordId}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      {open ? (
        <AddTransactionBody
          defaultAccountId={defaultAccountId}
          editRecordId={editRecordId}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      ) : null}
    </ResponsiveSheet>
  );
}

function AddTransactionBody({
  defaultAccountId,
  editRecordId,
  onClose,
  onSaved,
}: {
  defaultAccountId?: number;
  editRecordId?: number;
  onClose: () => void;
  onSaved?: (id: number) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("QuickAdd");
  const utils = trpc.useUtils();

  const options = trpc.records.formOptions.useQuery();
  const existing = trpc.records.get.useQuery(
    { id: editRecordId ?? 0 },
    { enabled: Boolean(editRecordId) },
  );

  const [type, setType] = useState<RecordType>("EXPENSE");
  const [amountStr, setAmountStr] = useState("");
  const [receiveAmountStr, setReceiveAmountStr] = useState("");
  const [accountId, setAccountId] = useState<number | null>(
    defaultAccountId ?? null,
  );
  const [transferAccountId, setTransferAccountId] = useState<number | null>(
    null,
  );
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [payeeName, setPayeeName] = useState("");
  const [note, setNote] = useState("");
  const [recordDate, setRecordDate] = useState(todayStr);
  const [recordTime, setRecordTime] = useState(nowTimeStr);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [showAccountPicker, setShowAccountPicker] = useState<
    null | "from" | "to"
  >(null);
  const [saveError, setSaveError] = useState(false);
  const [hydratedEdit, setHydratedEdit] = useState(false);

  const suggestions = trpc.records.suggestions.useQuery(
    { accountId, type },
    { enabled: type !== "TRANSFER" },
  );

  const accounts = options.data?.accounts ?? [];
  const categories = options.data?.categories ?? [];
  const payees = options.data?.payees ?? [];
  const labels = options.data?.labels ?? [];

  // Hydrate edit mode once
  useEffect(() => {
    if (!editRecordId || !existing.data || hydratedEdit) return;
    const r = existing.data;
    setType(r.transfer ? "TRANSFER" : r.type);
    setAmountStr(Math.abs(r.amount).toFixed(2));
    setAccountId(r.account.id);
    setTransferAccountId(r.transferAccount?.id ?? null);
    setCategoryId(r.category?.id ?? null);
    setPayeeName(r.payee?.name ?? "");
    setNote(r.note ?? "");
    if (r.date) setRecordDate(r.date);
    if (r.time) setRecordTime(r.time);
    setSelectedLabels(r.labels.map((l) => l.id));
    if (r.payee || r.note || r.labels.length > 0) {
      setShowMoreDetails(true);
    }
    setHydratedEdit(true);
  }, [editRecordId, existing.data, hydratedEdit]);

  // Default account from suggestions or first account
  useEffect(() => {
    if (editRecordId || accountId !== null) return;
    const preferred =
      defaultAccountId ?? suggestions.data?.lastAccountId ?? accounts[0]?.id;
    if (preferred) setAccountId(preferred);
  }, [
    editRecordId,
    accountId,
    defaultAccountId,
    suggestions.data?.lastAccountId,
    accounts,
  ]);

  // Default transfer destination when switching to TRANSFER
  useEffect(() => {
    if (type !== "TRANSFER" || transferAccountId !== null || accounts.length < 2)
      return;
    const other = accounts.find((a) => a.id !== accountId);
    if (other) setTransferAccountId(other.id);
  }, [type, transferAccountId, accountId, accounts]);

  const activeAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const destAccount = accounts.find((a) => a.id === transferAccountId);
  const currency = activeAccount?.currency ?? "USD";
  const crossCurrency =
    type === "TRANSFER" &&
    activeAccount &&
    destAccount &&
    activeAccount.currency !== destAccount.currency;

  const parsedAmount = Number.parseFloat(amountStr);
  const cents = Number.isFinite(parsedAmount)
    ? Math.round(parsedAmount * 100)
    : 0;
  const parsedReceive = Number.parseFloat(receiveAmountStr);
  const receiveCents = Number.isFinite(parsedReceive)
    ? Math.round(parsedReceive * 100)
    : null;

  const isTransfer = type === "TRANSFER";
  const canSave =
    cents > 0 &&
    Boolean(activeAccount) &&
    (!isTransfer ||
      (Boolean(destAccount) && destAccount?.id !== activeAccount?.id));

  const invalidateAll = async () => {
    await Promise.all([
      utils.records.list.invalidate(),
      utils.records.monthSummary.invalidate(),
      utils.records.suggestions.invalidate(),
      utils.accounts.list.invalidate(),
      utils.accounts.get.invalidate(),
      utils.dashboard.home.invalidate(),
      utils.dashboard.netWorth.invalidate(),
    ]);
  };

  const createMutation = trpc.records.create.useMutation({
    onSuccess: async (res) => {
      setSaveError(false);
      await invalidateAll();
      const catName =
        categories.find((c) => c.id === categoryId)?.name ??
        (isTransfer ? t("types.TRANSFER") : t(`types.${type}`));
      const signed = type === "EXPENSE" ? -(cents / 100) : cents / 100;
      const amtText = formatMoneyText(locale, signed, currency, {
        kind: type,
        tone: "movement",
      });
      firecentToast(t("savedToast", { label: catName, amount: amtText }));
      onSaved?.(res.id);
      onClose();
    },
    onError: () => setSaveError(true),
  });

  const updateMutation = trpc.records.update.useMutation({
    onSuccess: async (res) => {
      setSaveError(false);
      await invalidateAll();
      firecentToast(t("updatedToast"));
      onSaved?.(res.id);
      onClose();
    },
    onError: () => setSaveError(true),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredCategories = useMemo(() => {
    const byType = categories.filter(
      (c) => (type === "INCOME" ? c.type === "INCOME" : c.type !== "INCOME"),
    );
    const list = byType.length > 0 ? byType : categories;
    if (!categorySearch.trim()) return list;
    const q = categorySearch.trim().toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, type, categorySearch]);

  const topCategories = useMemo(() => {
    const suggested = suggestions.data?.categories ?? [];
    if (suggested.length > 0) return suggested.slice(0, 7);
    return filteredCategories.slice(0, 7);
  }, [suggestions.data?.categories, filteredCategories]);

  // Payee autocomplete: when exact match selected, preselect most-used category
  function handlePayeeChange(next: string) {
    setPayeeName(next);
    if (!categoryId && !isTransfer) {
      const match = payees.find(
        (p) => p.name.toLowerCase() === next.trim().toLowerCase(),
      );
      if (match) {
        const defaultCat = suggestions.data?.payeeDefaultCategory?.[match.id];
        if (defaultCat) setCategoryId(defaultCat);
      }
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSave || isPending || !activeAccount) return;
    setSaveError(false);

    if (editRecordId) {
      updateMutation.mutate({
        id: editRecordId,
        type,
        amount: cents,
        receiveAmount:
          crossCurrency && receiveCents && receiveCents > 0
            ? receiveCents
            : null,
        accountId: activeAccount.id,
        transferAccountId: isTransfer ? (destAccount?.id ?? null) : null,
        categoryId: !isTransfer ? categoryId : null,
        payeeName: !isTransfer ? payeeName.trim() || null : null,
        note: note.trim() || null,
        recordDate,
        recordTime,
        labelIds: selectedLabels,
      });
      return;
    }

    createMutation.mutate({
      type,
      amount: cents,
      receiveAmount:
        crossCurrency && receiveCents && receiveCents > 0 ? receiveCents : null,
      accountId: activeAccount.id,
      transferAccountId: isTransfer ? (destAccount?.id ?? null) : null,
      categoryId: !isTransfer ? categoryId : null,
      payeeName: !isTransfer ? payeeName.trim() || null : null,
      paymentType:
        activeAccount.type === "CREDIT_CARD" ? "CREDIT_CARD" : "CASH",
      note: note.trim() || null,
      recordDate,
      recordTime,
      labelIds: selectedLabels,
    });
  }

  // Category full-list subview
  if (showAllCategories) {
    const groups: { key: string; nature: "DEBO" | "NECESITO" | "QUIERO" | null; items: typeof filteredCategories }[] =
      type === "INCOME"
        ? [{ key: "income", nature: null, items: filteredCategories }]
        : (
            [
              {
                key: "DEBO",
                nature: "DEBO" as const,
                items: filteredCategories.filter((c) => c.spendingNature === "DEBO"),
              },
              {
                key: "NECESITO",
                nature: "NECESITO" as const,
                items: filteredCategories.filter(
                  (c) => !c.spendingNature || c.spendingNature === "NECESITO",
                ),
              },
              {
                key: "QUIERO",
                nature: "QUIERO" as const,
                items: filteredCategories.filter((c) => c.spendingNature === "QUIERO"),
              },
            ] satisfies {
              key: string;
              nature: "DEBO" | "NECESITO" | "QUIERO";
              items: typeof filteredCategories;
            }[]
          ).filter((g) => g.items.length > 0);

    return (
      <div className="flex flex-col gap-3 px-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              size="touch"
              autoFocus
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder={t("searchCategories")}
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="touch"
            onClick={() => setShowAllCategories(false)}
          >
            {t("done")}
          </Button>
        </div>

        <div className="flex max-h-[55dvh] flex-col gap-4 overflow-y-auto pb-4">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-1">
              {g.nature && (
                <div className="flex items-center gap-2 px-1 py-1 text-[12px] font-semibold text-muted-foreground">
                  <NatureSwatch nature={g.nature} />
                  <span>{t(`nature.${g.nature}`)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {g.items.map((c) => {
                  const active = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(c.id);
                        setShowAllCategories(false);
                      }}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary-text"
                          : "bg-card hover:bg-accent",
                      )}
                    >
                      <CategoryIcon icon={c.icon} size="sm" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Account picker subview
  if (showAccountPicker) {
    const targetIsFrom = showAccountPicker === "from";
    const list = targetIsFrom
      ? accounts
      : accounts.filter((a) => a.id !== activeAccount?.id);

    return (
      <div className="flex flex-col gap-2 px-5">
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-[15px] font-semibold">
            {targetIsFrom ? t("pickAccount") : t("toAccount")}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAccountPicker(null)}
          >
            {t("done")}
          </Button>
        </div>
        <div className="flex max-h-[55dvh] flex-col divide-y overflow-y-auto rounded-2xl border bg-card">
          {list.map((acc) => {
            const selected = targetIsFrom
              ? acc.id === activeAccount?.id
              : acc.id === destAccount?.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  if (targetIsFrom) setAccountId(acc.id);
                  else setTransferAccountId(acc.id);
                  setShowAccountPicker(null);
                }}
                className="flex min-h-13 items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Wallet className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">
                      {acc.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {acc.currency}
                    </p>
                  </div>
                </div>
                {selected && (
                  <Check className="size-4 shrink-0 text-primary-text" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const saveLabel =
    cents > 0
      ? t("saveWithAmount", {
          amount: formatMoneyText(locale, cents / 100, currency, { tone: "plain" }),
        })
      : t("save");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5">
      {/* Segmented type control */}
      <ToggleGroup
        variant="segmented"
        value={[type]}
        onValueChange={(vals) => {
          const next = vals[0] as RecordType | undefined;
          if (next) {
            setType(next);
            setCategoryId(null);
          }
        }}
        className="w-full"
      >
        <ToggleGroupItem value="EXPENSE" className="flex-1">
          {t("types.EXPENSE")}
        </ToggleGroupItem>
        <ToggleGroupItem value="INCOME" className="flex-1">
          {t("types.INCOME")}
        </ToggleGroupItem>
        <ToggleGroupItem value="TRANSFER" className="flex-1">
          {t("types.TRANSFER")}
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Error banner (keeps form open & preserves input) */}
      {saveError && (
        <Alert variant="notice-warning">
          <Info className="size-4" />
          <AlertDescription>{t("saveError")}</AlertDescription>
        </Alert>
      )}

      {/* Amount display: Money on mobile, direct autoFocus input on desktop */}
      <div className="flex flex-col items-center py-2">
        <div className="lg:hidden">
          <Money
            value={Number.isFinite(parsedAmount) ? parsedAmount : 0}
            currency={currency}
            size="sheet"
            tone="plain"
            className={cn(cents === 0 && "text-muted-foreground")}
          />
        </div>
        <div className="hidden w-full items-center justify-center lg:flex">
          <input
            aria-label={t("amount")}
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
            autoFocus
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            className="num w-full bg-transparent text-center text-[34px] leading-[40px] font-semibold tracking-[-0.03em] outline-none placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Repeat suggestions (non-transfer, new entry) */}
      {!editRecordId &&
        !isTransfer &&
        (suggestions.data?.repeats.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.data?.repeats.map((rep) => (
              <button
                key={`${rep.payeeId}-${rep.amount}-${rep.categoryId}`}
                type="button"
                onClick={() => {
                  setAmountStr(rep.amount.toFixed(2));
                  setCategoryId(rep.categoryId);
                  setAccountId(rep.accountId);
                  setPayeeName(rep.payeeName);
                }}
                className="flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <span className="max-w-[120px] truncate">{rep.payeeName}</span>
                <span className="num text-muted-foreground">
                  {formatMoneyText(locale, rep.amount, rep.currency, { tone: "plain" })}
                </span>
              </button>
            ))}
          </div>
        )}

      {/* Transfer accounts OR Category grid */}
      {isTransfer ? (
        <div className="flex flex-col gap-3">
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            <FieldRow
              label={t("fromAccount")}
              value={activeAccount?.name ?? t("pickAccount")}
              onClick={() => setShowAccountPicker("from")}
            />
            <FieldRow
              label={t("toAccount")}
              value={destAccount?.name ?? t("pickAccount")}
              onClick={() => setShowAccountPicker("to")}
            />
          </div>

          {crossCurrency && destAccount && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                {t("theyReceive", { currency: destAccount.currency })}
              </label>
              <Input
                size="touch"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={receiveAmountStr}
                onChange={(e) => setReceiveAmountStr(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          <Alert variant="notice">
            <Info className="size-4" />
            <AlertDescription>{t("transferNotice")}</AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {topCategories.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(active ? null : c.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary-text"
                    : "border-transparent bg-muted/50 hover:bg-accent",
                )}
              >
                <CategoryIcon icon={c.icon} size="sm" />
                <span className="w-full truncate text-[11px] font-medium">
                  {c.name}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowAllCategories(true)}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-1.5 py-2.5 text-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Grid2x2 className="size-5" aria-hidden />
            <span className="text-[11px] font-medium">{t("more")}</span>
          </button>
        </div>
      )}

      {/* Context row: account + date + more details */}
      <div className="flex flex-wrap items-center gap-2">
        {!isTransfer && (
          <button
            type="button"
            onClick={() => setShowAccountPicker("from")}
            className="flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-[13px] font-medium hover:bg-accent"
          >
            <Wallet className="size-3.5 text-muted-foreground" />
            <span className="max-w-[130px] truncate">
              {activeAccount?.name ?? t("pickAccount")}
            </span>
          </button>
        )}

        <label className="relative flex h-9 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 text-[13px] font-medium hover:bg-accent">
          <Calendar className="size-3.5 text-muted-foreground" />
          <input
            type="date"
            aria-label={t("date")}
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
            className="w-[108px] bg-transparent text-[13px] outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowMoreDetails((v) => !v)}
          className="ml-auto flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-primary-text hover:bg-accent"
        >
          <span>{t("moreDetails")}</span>
          {showMoreDetails ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      {/* More details: Payee, Note, Labels */}
      {showMoreDetails && (
        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3.5">
          {!isTransfer && (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-muted-foreground">
                {t("payee")}
              </label>
              <Input
                size="touch"
                list="firecent-payees-datalist"
                value={payeeName}
                onChange={(e) => handlePayeeChange(e.target.value)}
                placeholder={t("payeePlaceholder")}
              />
              <datalist id="firecent-payees-datalist">
                {payees.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-muted-foreground">
              {t("note")}
            </label>
            <Input
              size="touch"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              maxLength={500}
            />
          </div>

          {labels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">
                {t("labels")}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const pressed = selectedLabels.includes(l.id);
                  return (
                    <Toggle
                      key={l.id}
                      variant="chip"
                      pressed={pressed}
                      onPressedChange={(on) =>
                        setSelectedLabels((prev) =>
                          on ? [...prev, l.id] : prev.filter((id) => id !== l.id),
                        )
                      }
                    >
                      {l.name}
                    </Toggle>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile touch keypad */}
      <AmountKeypad
        value={amountStr}
        onChange={setAmountStr}
        backspaceLabel={t("backspace")}
        className="lg:hidden"
      />

      {/* Primary Save CTA */}
      <Button
        type="submit"
        size="touch"
        disabled={!canSave || isPending}
        className="w-full"
      >
        {isPending ? t("saving") : saveLabel}
      </Button>
    </form>
  );
}
