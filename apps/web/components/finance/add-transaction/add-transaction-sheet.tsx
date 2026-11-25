"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpDown,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Calendar,
  Check,
  ChevronRight,
  ClockPlus,
  Grid2x2,
  Info,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  AccountSwatch,
  AmountKeypad,
  CategoryIcon,
  Money,
  formatMoneyText,
  localizeCategoryName,
  resolveTransferFlow,
} from "@/components/finance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

type RecordType = "EXPENSE" | "INCOME" | "TRANSFER";

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTimeStr = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function currencyPrefix(currency: string): string {
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? "$"
    );
  } catch {
    return "$";
  }
}

/**
 * Session-level sticky defaults for rapid multi-entry logging: preserves the
 * last selected account, date, and category when the quick-add sheet closes.
 */
const stickyQuickAdd: {
  accountId: number | null;
  recordDate: string | null;
  categoryId: number | null;
} = {
  accountId: null,
  recordDate: null,
  categoryId: null,
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
      className="max-lg:h-[96dvh]"
    >
      {open ? (
        <AddTransactionBody
          key={editRecordId ?? "new"}
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
  const tFinance = useTranslations("Finance");
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
    defaultAccountId ?? (!editRecordId ? stickyQuickAdd.accountId : null),
  );
  const [transferAccountId, setTransferAccountId] = useState<number | null>(
    null,
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    !editRecordId ? stickyQuickAdd.categoryId : null,
  );
  const [payeeName, setPayeeName] = useState("");
  const [note, setNote] = useState("");
  const [recordDate, setRecordDate] = useState(
    () => (!editRecordId && stickyQuickAdd.recordDate) || todayStr(),
  );
  const [recordTime, setRecordTime] = useState<string>("");
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [showLabels, setShowLabels] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatParentId, setNewCatParentId] = useState<string>("");
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState<
    null | "from" | "to"
  >(null);
  const [saveError, setSaveError] = useState(false);
  const [hydratedEdit, setHydratedEdit] = useState(false);
  const pushedHistoryRef = useRef(false);

  const openCategoriesSubview = useCallback(() => {
    if (!pushedHistoryRef.current && typeof window !== "undefined") {
      window.history.pushState({ firecentQuickAddSubview: "categories" }, "");
      pushedHistoryRef.current = true;
    }
    setShowAllCategories(true);
  }, []);

  const openAccountSubview = useCallback((which: "from" | "to") => {
    if (!pushedHistoryRef.current && typeof window !== "undefined") {
      window.history.pushState({ firecentQuickAddSubview: "account" }, "");
      pushedHistoryRef.current = true;
    }
    setShowAccountPicker(which);
  }, []);

  const closeSubview = useCallback(() => {
    setShowAllCategories(false);
    setShowAccountPicker(null);
    setShowNewCatForm(false);
    setCategorySearch("");
    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }, []);

  // Intercept mobile hardware/gesture Back so it returns to the form instead of navigating away
  useEffect(() => {
    const onPopState = () => {
      if (!pushedHistoryRef.current) return;
      pushedHistoryRef.current = false;
      setShowAllCategories(false);
      setShowAccountPicker(null);
      setShowNewCatForm(false);
      setCategorySearch("");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const suggestions = trpc.records.suggestions.useQuery(
    { accountId, type },
    { enabled: type !== "TRANSFER" },
  );

  const accounts = options.data?.accounts ?? [];
  const categories = options.data?.categories ?? [];
  const payees = options.data?.payees ?? [];
  const labels = options.data?.labels ?? [];

  const catLabel = (c: { name: string; nameEn?: string | null; nameEs?: string | null }) =>
    localizeCategoryName(c, locale);

  // Hydrate edit mode once (always resolving true From -> To direction for transfers)
  useEffect(() => {
    if (!editRecordId || !existing.data || hydratedEdit) return;
    const r = existing.data;
    const isRecTransfer = r.transfer || r.type === "TRANSFER";

    if (isRecTransfer) {
      setType("TRANSFER");
      if (r.transferPair) {
        setAccountId(r.transferPair.fromAccount.id);
        setTransferAccountId(r.transferPair.toAccount.id);
        setAmountStr(r.transferPair.fromAmount.toFixed(2));
        if (
          r.transferPair.fromAccount.currency !==
          r.transferPair.toAccount.currency
        ) {
          setReceiveAmountStr(r.transferPair.toAmount.toFixed(2));
        }
      } else {
        const flow = resolveTransferFlow(r.amount, r.account, r.transferAccount);
        setAccountId(flow.from?.id ?? null);
        setTransferAccountId(flow.to?.id ?? null);
        setAmountStr(Math.abs(r.amount).toFixed(2));
      }
    } else {
      setType(r.type);
      setAmountStr(Math.abs(r.amount).toFixed(2));
      setAccountId(r.account.id);
      setTransferAccountId(null);
    }

    setCategoryId(r.category?.id ?? null);
    setPayeeName(r.payee?.name ?? "");
    setNote(r.note ?? "");
    if (r.date) setRecordDate(r.date);
    if (r.time) setRecordTime(r.time);
    setSelectedLabels(r.labels.map((l) => l.id));
    if (r.labels.length > 0) setShowLabels(true);
    setHydratedEdit(true);
  }, [editRecordId, existing.data, hydratedEdit]);

  // Persist account, date, and category for the next quick-add entry
  useEffect(() => {
    if (editRecordId) return;
    if (accountId !== null) stickyQuickAdd.accountId = accountId;
    if (recordDate) stickyQuickAdd.recordDate = recordDate;
    if (type !== "TRANSFER") stickyQuickAdd.categoryId = categoryId;
  }, [editRecordId, accountId, recordDate, categoryId, type]);

  // Default account from suggestions or first account (and guard against cross-org stale IDs)
  useEffect(() => {
    if (editRecordId || !options.data) return;
    if (accountId === null || !accounts.some((a) => a.id === accountId)) {
      const preferred =
        defaultAccountId ?? suggestions.data?.lastAccountId ?? accounts[0]?.id;
      if (preferred) setAccountId(preferred);
    }
    if (
      categoryId !== null &&
      type !== "TRANSFER" &&
      !categories.some(
        (c) =>
          c.id === categoryId &&
          (type === "INCOME" ? c.type === "INCOME" : c.type !== "INCOME"),
      )
    ) {
      setCategoryId(null);
    }
  }, [
    editRecordId,
    options.data,
    accountId,
    categoryId,
    type,
    defaultAccountId,
    suggestions.data?.lastAccountId,
    accounts,
    categories,
  ]);

  // Default transfer destination when creating a new transfer (never overwrite edit hydration)
  useEffect(() => {
    if (
      editRecordId ||
      type !== "TRANSFER" ||
      transferAccountId !== null ||
      accounts.length < 2
    ) {
      return;
    }
    const other = accounts.find((a) => a.id !== accountId);
    if (other) setTransferAccountId(other.id);
  }, [editRecordId, type, transferAccountId, accountId, accounts]);

  // Include archived accounts referenced by the record being edited so edit never silently falls back to accounts[0]
  const knownAccounts = useMemo(() => {
    const extra = [
      existing.data?.account,
      existing.data?.transferAccount,
      existing.data?.transferPair?.fromAccount,
      existing.data?.transferPair?.toAccount,
    ].filter((a): a is NonNullable<typeof a> => Boolean(a));
    if (extra.length === 0) return accounts;
    const seen = new Set(accounts.map((a) => a.id));
    const merged = [...accounts];
    for (const acc of extra) {
      if (!seen.has(acc.id)) {
        seen.add(acc.id);
        merged.push(acc);
      }
    }
    return merged;
  }, [accounts, existing.data]);

  const activeAccount =
    knownAccounts.find((a) => a.id === accountId) ??
    (!editRecordId ? accounts[0] : undefined);
  const destAccount = knownAccounts.find((a) => a.id === transferAccountId);
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
      utils.records.get.invalidate(),
      utils.records.monthSummary.invalidate(),
      utils.records.suggestions.invalidate(),
      utils.accounts.list.invalidate(),
      utils.accounts.get.invalidate(),
      utils.dashboard.home.invalidate(),
      utils.dashboard.netWorth.invalidate(),
      utils.assistant.getProposal.invalidate(),
      utils.assistant.getThread.invalidate(),
    ]);
  };

  const createCategoryMutation = trpc.categories.create.useMutation({
    onSuccess: async (created) => {
      await Promise.all([
        utils.records.formOptions.invalidate(),
        utils.records.suggestions.invalidate(),
        utils.categories.list.invalidate(),
      ]);
      setCategoryId(created.id);
      setNewCatName("");
      setNewCatParentId("");
      closeSubview();
      firecentToast(t("categoryCreated", { name: created.name }));
    },
  });

  const createMutation = trpc.records.create.useMutation({
    onSuccess: async (res) => {
      setSaveError(false);
      await invalidateAll();
      const cat = categories.find((c) => c.id === categoryId);
      const label = cat
        ? catLabel(cat)
        : isTransfer
          ? t("types.TRANSFER")
          : t(`types.${type}`);
      const signed = type === "EXPENSE" ? -(cents / 100) : cents / 100;
      const amtText = formatMoneyText(locale, signed, currency, {
        kind: type,
        tone: "movement",
      });
      firecentToast(t("savedToast", { label, amount: amtText }));
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

  const typedCategories = useMemo(() => {
    const byType = categories.filter((c) =>
      type === "INCOME" ? c.type === "INCOME" : c.type !== "INCOME",
    );
    return byType.length > 0 ? byType : categories;
  }, [categories, type]);

  const topCategories = useMemo(() => {
    const suggested = suggestions.data?.categories ?? [];
    const base = suggested.length > 0 ? suggested : typedCategories;
    const picked = base.slice(0, 7);
    // Keep currently selected category visible in the quick grid if it's outside top 7
    if (categoryId && !picked.some((c) => c.id === categoryId)) {
      const sel = typedCategories.find((c) => c.id === categoryId);
      if (sel) return [sel, ...picked.slice(0, 6)];
    }
    return picked;
  }, [suggestions.data?.categories, typedCategories, categoryId]);

  const parentCategories = useMemo(
    () => typedCategories.filter((c) => c.parentId === null),
    [typedCategories],
  );

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
        recordTime: recordTime || null,
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
      recordTime: recordTime || null,
      labelIds: selectedLabels,
    });
  }

  // Avoid rendering stale defaults (like accounts[0]) before an edited record has hydrated
  if (editRecordId && !hydratedEdit) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-2">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-13 rounded-xl" />
          <Skeleton className="h-13 rounded-xl" />
          <Skeleton className="h-13 rounded-xl" />
        </div>
        <Skeleton className="mx-auto h-10 w-36 rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  // ── Category picker subview (Parent → Subcategories + inline "+ New category") ──
  if (showAllCategories) {
    const q = categorySearch.trim().toLowerCase();
    const matchesSearch = (c: (typeof typedCategories)[number]) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.nameEn?.toLowerCase().includes(q) ?? false) ||
        (c.nameEs?.toLowerCase().includes(q) ?? false)
      );
    };

    const hierarchy = parentCategories
      .map((parent) => {
        const children = typedCategories.filter(
          (c) => c.parentId === parent.id && matchesSearch(c),
        );
        const parentMatch = matchesSearch(parent);
        if (!parentMatch && children.length === 0) return null;
        return { parent, children };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Orphans (if any category has parentId pointing to a soft-deleted parent)
    const parentIds = new Set(parentCategories.map((p) => p.id));
    const orphans = typedCategories.filter(
      (c) => c.parentId !== null && !parentIds.has(c.parentId) && matchesSearch(c),
    );

    return (
      <div className="flex flex-col gap-3 px-5">
        <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-2.5 bg-card px-5 pt-1 pb-2.5">
          {/* Subview header: Back ← Title on left, subtle "+ New" on right */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={closeSubview}
              className="-ml-1.5 flex h-9 items-center gap-1.5 rounded-xl px-1.5 text-[15px] font-semibold transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              <span>{t("pickCategory")}</span>
            </button>
            <Button
              type="button"
              variant={showNewCatForm ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setShowNewCatForm((v) => !v);
                if (!showNewCatForm && categorySearch.trim() && !newCatName) {
                  setNewCatName(categorySearch.trim());
                }
              }}
              className="h-8 gap-1 rounded-xl px-2.5 text-[13px]"
            >
              <Plus className="size-3.5" aria-hidden />
              <span>{t("newCategory")}</span>
            </Button>
          </div>

          {/* Full-width search bar (no autoFocus on mobile so the list stays visible) */}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder={t("searchCategories")}
              className="h-10 w-full rounded-xl pr-9 pl-10 text-[14px]"
            />
            {categorySearch && (
              <button
                type="button"
                aria-label={t("clear")}
                onClick={() => setCategorySearch("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Inline "+ New category" creator */}
          {showNewCatForm && (
            <div className="flex flex-col gap-2 rounded-2xl border bg-muted/30 p-3">
              <Input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={t("newCategoryPlaceholder")}
                className="h-10 w-full rounded-xl bg-card text-[14px]"
                maxLength={60}
              />
              <div className="flex items-center gap-2">
                {type !== "INCOME" && parentCategories.length > 0 && (
                  <select
                    value={newCatParentId}
                    onChange={(e) => setNewCatParentId(e.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-xl border bg-card px-2.5 text-[13px] outline-none"
                  >
                    <option value="">{t("topLevel")}</option>
                    {parentCategories.map((p) => (
                      <option key={p.id} value={p.id}>
                        {catLabel(p)}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={!newCatName.trim() || createCategoryMutation.isPending}
                  onClick={() =>
                    createCategoryMutation.mutate({
                      name: newCatName.trim(),
                      type: type === "INCOME" ? "INCOME" : "EXPENSE",
                      parentId: newCatParentId ? Number(newCatParentId) : null,
                    })
                  }
                  className="ml-auto h-9 rounded-xl px-4"
                >
                  {t("add")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5 pb-2 lg:max-h-[58dvh] lg:overflow-y-auto">
          {hierarchy.length === 0 && orphans.length === 0 && categorySearch.trim() && (
            <button
              type="button"
              disabled={createCategoryMutation.isPending}
              onClick={() =>
                createCategoryMutation.mutate({
                  name: categorySearch.trim(),
                  type: type === "INCOME" ? "INCOME" : "EXPENSE",
                  parentId: null,
                })
              }
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-4 text-[14px] font-medium text-primary-text transition-colors hover:bg-primary/10"
            >
              <Plus className="size-4" aria-hidden />
              <span>{t("createFromSearch", { name: categorySearch.trim() })}</span>
            </button>
          )}

          {hierarchy.map(({ parent, children }) => (
            <div key={parent.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCategoryId(parent.id);
                  closeSubview();
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-semibold transition-colors",
                  categoryId === parent.id
                    ? "bg-primary/10 text-primary-text"
                    : "text-foreground hover:bg-accent",
                )}
              >
                <CategoryIcon icon={parent.icon} color={parent.color} size="sm" />
                <span className="truncate">{catLabel(parent)}</span>
                {categoryId === parent.id && (
                  <Check className="ml-auto size-4 shrink-0" />
                )}
              </button>

              {children.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 pl-2">
                  {children.map((sub) => {
                    const active = sub.id === categoryId;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(sub.id);
                          closeSubview();
                        }}
                        className={cn(
                          "flex min-h-10 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary-text"
                            : "bg-card hover:bg-accent",
                        )}
                      >
                        <CategoryIcon
                          icon={sub.icon}
                          color={sub.color ?? parent.color}
                          size="sm"
                        />
                        <span className="truncate">{catLabel(sub)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {orphans.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {orphans.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(c.id);
                      closeSubview();
                    }}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary-text"
                        : "bg-card hover:bg-accent",
                    )}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="truncate">{catLabel(c)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Account picker subview (with metallic/color AccountSwatch!) ──
  if (showAccountPicker) {
    const targetIsFrom = showAccountPicker === "from";
    const list = targetIsFrom
      ? accounts
      : accounts.filter((a) => a.id !== activeAccount?.id);

    return (
      <div className="flex flex-col gap-2 px-5">
        <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between bg-card px-5 pt-1 pb-2">
          <button
            type="button"
            onClick={closeSubview}
            className="-ml-1.5 flex h-9 items-center gap-1.5 rounded-xl px-1.5 text-[15px] font-semibold transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span>{targetIsFrom ? t("pickAccount") : t("toAccount")}</span>
          </button>
        </div>
        <div className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card lg:max-h-[58dvh] lg:overflow-y-auto">
          {list.map((acc) => {
            const selected = targetIsFrom
              ? acc.id === activeAccount?.id
              : acc.id === destAccount?.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  if (targetIsFrom) {
                    if (isTransfer && acc.id === transferAccountId) {
                      setTransferAccountId(accountId);
                    }
                    setAccountId(acc.id);
                  } else {
                    if (isTransfer && acc.id === accountId) {
                      setAccountId(transferAccountId);
                    }
                    setTransferAccountId(acc.id);
                  }
                  closeSubview();
                }}
                className="flex min-h-13 items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AccountSwatch type={acc.type} color={acc.color} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">
                      {acc.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
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

  const dateBadgeLabel =
    recordDate === todayStr()
      ? tFinance("day.today")
      : recordDate === yesterdayStr()
        ? tFinance("day.yesterday")
        : recordDate.slice(5);

  const saveLabel =
    cents > 0
      ? t("saveWithAmount", {
          amount: formatMoneyText(locale, cents / 100, currency, { tone: "plain" }),
        })
      : t("save");

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 px-5 pt-1 max-lg:min-h-full"
    >
      {/* Color-coded type selector */}
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {(
          [
            {
              value: "EXPENSE" as const,
              Icon: BanknoteArrowDown,
              iconClass: "text-red-500 dark:text-red-400",
              activeClass:
                "border-red-400/80 ring-2 ring-red-400/80 bg-red-400/12 text-foreground",
            },
            {
              value: "INCOME" as const,
              Icon: BanknoteArrowUp,
              iconClass: "text-emerald-500 dark:text-emerald-400",
              activeClass:
                "border-emerald-400/80 ring-2 ring-emerald-400/80 bg-emerald-400/12 text-foreground",
            },
            {
              value: "TRANSFER" as const,
              Icon: ArrowRightLeft,
              iconClass: "text-blue-500 dark:text-blue-400",
              activeClass:
                "border-blue-400/80 ring-2 ring-blue-400/80 bg-blue-400/12 text-foreground",
            },
          ] as const
        ).map(({ value, Icon, iconClass, activeClass }) => {
          const active = type === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (type !== value) {
                  setType(value);
                  setCategoryId(null);
                  if (
                    value === "TRANSFER" &&
                    transferAccountId === null &&
                    accounts.length >= 2
                  ) {
                    const other = accounts.find((a) => a.id !== accountId);
                    if (other) setTransferAccountId(other.id);
                  }
                }
              }}
              className={cn(
                "flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card text-[12px] font-medium text-muted-foreground transition-all duration-200 hover:bg-accent/60",
                active && activeClass,
              )}
            >
              <Icon className={cn("size-[18px]", iconClass)} aria-hidden />
              <span>{t(`types.${value}`)}</span>
            </button>
          );
        })}
      </div>

      {saveError && (
        <Alert variant="notice-warning">
          <Info className="size-4" />
          <AlertDescription>{t("saveError")}</AlertDescription>
        </Alert>
      )}

      {/* Compact inline Currency + Amount hero */}
      <div className="flex items-center justify-center py-1">
        <div className="lg:hidden">
          <Money
            value={Number.isFinite(parsedAmount) ? parsedAmount : 0}
            currency={currency}
            size="sheet"
            tone="plain"
            className={cn(
              cents === 0 && "text-muted-foreground",
              type === "INCOME" && cents > 0 && "text-positive",
            )}
          />
        </div>
        <label className="hidden w-full cursor-text items-baseline justify-center gap-1 lg:flex">
          <span
            className={cn(
              "text-[22px] font-medium text-muted-foreground",
              type === "INCOME" && cents > 0 && "text-positive/70",
            )}
          >
            {currencyPrefix(currency)}
          </span>
          <span className="relative inline-block">
            <span
              aria-hidden
              className="num invisible block whitespace-pre px-1 text-[34px] leading-[40px] font-semibold tracking-[-0.03em]"
            >
              {amountStr || "0.00"}
            </span>
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
              className={cn(
                "num absolute inset-0 w-full bg-transparent px-1 text-left text-[34px] leading-[40px] font-semibold tracking-[-0.03em] outline-none placeholder:text-muted-foreground/45 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
                type === "INCOME" && cents > 0 && "text-positive",
              )}
            />
          </span>
        </label>
      </div>

      {/* Repeat suggestions (compact chips) */}
      {!editRecordId &&
        !isTransfer &&
        (suggestions.data?.repeats.length ?? 0) > 0 && (
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
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
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 text-[12px] font-medium hover:bg-accent"
              >
                <span className="max-w-[110px] truncate">{rep.payeeName}</span>
                <span className="num text-muted-foreground">
                  {formatMoneyText(locale, rep.amount, rep.currency, {
                    tone: "plain",
                  })}
                </span>
              </button>
            ))}
          </div>
        )}

      {/* Transfer From/To OR Compact 2x4 Category Grid */}
      {isTransfer ? (
        <div className="flex flex-col gap-2.5">
          <div className="relative overflow-hidden rounded-2xl border bg-card">
            <button
              type="button"
              onClick={() => openAccountSubview("from")}
              className="flex h-14 w-full items-center gap-3 px-3.5 text-left transition-colors hover:bg-accent/60"
            >
              {activeAccount ? (
                <AccountSwatch
                  type={activeAccount.type}
                  color={activeAccount.color}
                  size="sm"
                />
              ) : (
                <span className="h-[19px] w-[30px] shrink-0 rounded-[4px] bg-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {t("fromAccount")}
                </span>
                <span className="block truncate text-[14px] leading-snug font-medium">
                  {activeAccount ? activeAccount.name : t("pickAccount")}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </button>

            <div className="relative border-t">
              {activeAccount && destAccount && (
                <button
                  type="button"
                  aria-label={t("types.TRANSFER")}
                  onClick={() => {
                    const prevFrom = activeAccount.id;
                    const prevTo = destAccount.id;
                    setAccountId(prevTo);
                    setTransferAccountId(prevFrom);
                  }}
                  className="absolute top-0 right-10 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowUpDown className="size-3.5" aria-hidden />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => openAccountSubview("to")}
              className="flex h-14 w-full items-center gap-3 px-3.5 text-left transition-colors hover:bg-accent/60"
            >
              {destAccount ? (
                <AccountSwatch
                  type={destAccount.type}
                  color={destAccount.color}
                  size="sm"
                />
              ) : (
                <span className="h-[19px] w-[30px] shrink-0 rounded-[4px] bg-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {t("toAccount")}
                </span>
                <span className="block truncate text-[14px] leading-snug font-medium">
                  {destAccount ? destAccount.name : t("pickAccount")}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </button>
          </div>

          {crossCurrency && destAccount && (
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={receiveAmountStr}
              onChange={(e) => setReceiveAmountStr(e.target.value)}
              placeholder={t("theyReceive", { currency: destAccount.currency })}
              className="h-10 text-[14px]"
            />
          )}
        </div>
      ) : (
        <div className="flex items-stretch gap-1.5 lg:grid lg:grid-cols-4">
          <div className="relative min-w-0 flex-1 lg:contents">
            <div className="no-scrollbar flex items-stretch gap-1.5 overflow-x-auto pr-5 lg:contents">
              {topCategories.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(active ? null : c.id)}
                    className={cn(
                      "flex w-[70px] shrink-0 flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center transition-colors lg:w-auto",
                      active
                        ? "border-primary bg-primary/10 text-primary-text"
                        : "border-transparent bg-muted/50 hover:bg-accent",
                    )}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="w-full truncate text-[11px] font-medium">
                      {catLabel(c)}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Right fade mask so the peeking 4th tile clearly signals horizontal scroll */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-card to-transparent lg:hidden"
            />
          </div>
          <button
            type="button"
            onClick={openCategoriesSubview}
            className="flex w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-1.5 py-2 text-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:w-auto"
          >
            <Grid2x2 className="size-4" aria-hidden />
            <span className="text-[11px] font-medium">{t("more")}</span>
          </button>
        </div>
      )}

      {/* Single-line context bar: Account + unified split Date | Time pill */}
      <div className="flex items-center gap-2">
        {!isTransfer && activeAccount && (
          <button
            type="button"
            onClick={() => openAccountSubview("from")}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-2.5 text-[13px] font-medium hover:bg-accent"
          >
            <AccountSwatch
              type={activeAccount.type}
              color={activeAccount.color}
              size="sm"
            />
            <span className="truncate">{activeAccount.name}</span>
          </button>
        )}

        {/* Unified split pill: Date (left) and optional Time (right) stay independent */}
        <div
          className={cn(
            "flex h-9 shrink-0 items-stretch divide-x overflow-hidden rounded-xl border bg-card text-[13px] font-medium",
            isTransfer && "flex-1",
          )}
        >
          <label
            className={cn(
              "relative flex cursor-pointer items-center justify-center gap-1.5 px-2.5 hover:bg-accent",
              isTransfer && "flex-1",
            )}
          >
            <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="whitespace-nowrap">{dateBadgeLabel}</span>
            <input
              type="date"
              aria-label={t("date")}
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  // Fallback for browsers without showPicker
                }
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>

          <label className="relative flex cursor-pointer items-center justify-center gap-1 px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            {recordTime ? (
              <span className="num whitespace-nowrap text-foreground">
                {recordTime}
              </span>
            ) : (
              <ClockPlus className="size-4 shrink-0" aria-hidden />
            )}
            <input
              type="time"
              aria-label={t("time")}
              value={recordTime}
              onChange={(e) => setRecordTime(e.target.value)}
              onClick={(e) => {
                if (!recordTime) {
                  const now = nowTimeStr();
                  e.currentTarget.value = now;
                  setRecordTime(now);
                }
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  // Fallback for browsers without showPicker
                }
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {labels.length > 0 && (
          <button
            type="button"
            aria-label={t("labels")}
            onClick={() => setShowLabels((v) => !v)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[12px] font-medium transition-colors",
              selectedLabels.length > 0 || showLabels
                ? "border-primary/40 bg-primary/10 text-primary-text"
                : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <Tag className="size-3.5" aria-hidden />
            {selectedLabels.length > 0 && (
              <span className="num">{selectedLabels.length}</span>
            )}
          </button>
        )}
      </div>

      {/* Compact inline Payee + Note row (always 1 tap away, no awkward collapsible box!) */}
      <div className={cn("grid gap-2", !isTransfer && "grid-cols-2")}>
        {!isTransfer && (
          <div className="relative">
            <Input
              list="firecent-payees-datalist"
              value={payeeName}
              onChange={(e) => handlePayeeChange(e.target.value)}
              placeholder={t("payeePlaceholder")}
              className="h-10 rounded-xl px-3 text-[14px]"
            />
            {payeeName && (
              <button
                type="button"
                aria-label={t("clear")}
                onClick={() => setPayeeName("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
            <datalist id="firecent-payees-datalist">
              {payees.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
        )}
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePlaceholder")}
          maxLength={500}
          className="h-10 rounded-xl px-3 text-[14px]"
        />
      </div>

      {showLabels && labels.length > 0 && (
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
                className="h-8 text-[12px]"
              >
                {l.name}
              </Toggle>
            );
          })}
        </div>
      )}

      {/* Mobile keypad (fills leftover vertical space, scrolls at min-height) + Save CTA */}
      <div className="flex flex-col gap-3 max-lg:flex-1 max-lg:pt-1">
        <AmountKeypad
          value={amountStr}
          onChange={setAmountStr}
          backspaceLabel={t("backspace")}
          className="max-lg:flex-1 lg:hidden"
        />

        <Button
          type="submit"
          size="touch"
          disabled={!canSave || isPending}
          className="w-full shrink-0"
        >
          {isPending ? t("saving") : saveLabel}
        </Button>
      </div>
    </form>
  );
}
