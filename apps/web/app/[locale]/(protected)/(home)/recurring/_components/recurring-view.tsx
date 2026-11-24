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
  Grid2x2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  AccountSwatch,
  CategoryIcon,
  FieldRow,
  Money,
  PageHeader,
  SectionHeader,
  StateBlock,
  formatMoneyText,
  localizeCategoryName,
} from "@/components/finance";
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

type ViewTab = "upcoming" | "all";
type RecType = "EXPENSE" | "INCOME" | "TRANSFER";
type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type Mode = "AUTO" | "MANUAL";
type SchedulePreset =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"
  | "yearly"
  | "custom";

function formatScheduleLabel(
  item: { frequency: Freq; interval: number; daysOfMonth?: number[] },
  t: ReturnType<typeof useTranslations<"Recurring">>,
): string {
  const step = Math.max(1, item.interval);
  const days = item.daysOfMonth ?? [];

  if (item.frequency === "DAILY") {
    return step === 1
      ? t("freq.DAILY")
      : t("schedule.everyNDays", { n: String(step) });
  }
  if (item.frequency === "WEEKLY") {
    return step === 1
      ? t("freq.WEEKLY")
      : t("schedule.everyNWeeks", { n: String(step) });
  }
  if (item.frequency === "YEARLY") {
    return step === 1
      ? t("freq.YEARLY")
      : t("schedule.everyNYears", { n: String(step) });
  }

  // MONTHLY
  if (step === 1 && days.length === 2) {
    if (days[0] === 15 && days[1] === 31) {
      return `${t("presets.semimonthly")} (${t("schedule.semi15End")})`;
    }
    if (days[0] === 1 && days[1] === 15) {
      return `${t("presets.semimonthly")} (${t("schedule.semi1And15")})`;
    }
  }
  const base =
    step === 1
      ? t("freq.MONTHLY")
      : t("schedule.everyNMonths", { n: String(step) });
  if (days.length === 1) {
    const d = days[0]!;
    return d === 31
      ? `${base} · ${t("schedule.lastDay")}`
      : `${base} · ${t("schedule.onDay", { day: String(d) })}`;
  }
  if (days.length > 1) {
    const formatted = days
      .map((d) => (d === 31 ? t("schedule.lastDay") : String(d)))
      .join(", ");
    return `${base} · ${t("schedule.onDays", { days: formatted })}`;
  }
  return base;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

export function RecurringView() {
  const locale = useLocale();
  const t = useTranslations("Recurring");
  const tShell = useTranslations("Shell");
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<ViewTab>("upcoming");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const query = trpc.recurring.list.useQuery();
  const data = query.data;
  const selected = data?.items.find((i) => i.id === selectedId) ?? null;

  const invalidate = async () => {
    await Promise.all([
      utils.recurring.list.invalidate(),
      utils.records.list.invalidate(),
      utils.accounts.list.invalidate(),
      utils.dashboard.home.invalidate(),
    ]);
  };

  const confirmMutation = trpc.recurring.confirm.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("confirmedToast"));
    },
  });

  const skipMutation = trpc.recurring.skip.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("skippedToast"));
    },
  });

  const updateMutation = trpc.recurring.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("updatedToast"));
    },
  });

  const deleteMutation = trpc.recurring.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      setSelectedId(null);
      firecentToast(t("deletedToast"));
    },
  });

  type RecItem = NonNullable<typeof data>["items"][number];

  const renderRow = (item: RecItem) => (
    <div
      key={item.id}
      onClick={() => setSelectedId(item.id)}
      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon
          icon={item.category?.icon}
          color={item.category?.color}
          size="md"
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-foreground">
            {item.name}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">
            {formatScheduleLabel(item, t)} · {item.accountName}
            {item.nextDate ? ` · ${item.nextDate}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Money
          value={item.type === "EXPENSE" ? -item.amount : item.amount}
          currency={item.currency}
          size="row"
          tone="upcoming"
          kind={item.type}
          approx={item.isEstimate}
        />
        <span className="text-[11px] text-muted-foreground">
          {item.paused
            ? t("paused")
            : item.type === "INCOME"
              ? t("mode.expected")
              : t(`mode.${item.mode}`)}
        </span>
      </div>
    </div>
  );

  const upcomingContent = data && (
    <div className="flex flex-col gap-5">
      {data.needsYou.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader title={t("needsYou")} />
          {data.needsYou.map((item) => (
            <Card
              key={item.id}
              variant="plain"
              className="flex flex-col gap-3 border-warning/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold">{item.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {item.accountName} ·{" "}
                    {formatMoneyText(locale, item.amount, item.currency, {
                      tone: "plain",
                      approx: item.isEstimate,
                    })}
                  </p>
                </div>
                <Badge variant="warning">{t("dueNow")}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="touch"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate({ id: item.id })}
                  className="flex-1"
                >
                  <Check className="size-4" aria-hidden />
                  <span>{t("confirm")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="touch"
                  disabled={skipMutation.isPending}
                  onClick={() => skipMutation.mutate({ id: item.id })}
                >
                  <SkipForward className="size-4" aria-hidden />
                  <span>{t("skip")}</span>
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionHeader title={t("next7Days")} />
        <Card variant="plain" className="divide-y overflow-hidden">
          {data.next7Days.length === 0 ? (
            <p className="p-4 text-[14px] text-muted-foreground">
              {t("nothingSoon")}
            </p>
          ) : (
            data.next7Days.map(renderRow)
          )}
        </Card>
      </section>

      {data.later.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader title={t("later")} />
          <Card variant="plain" className="divide-y overflow-hidden">
            {data.later.map(renderRow)}
          </Card>
        </section>
      )}
    </div>
  );

  const allContent = data && (
    <section className="flex flex-col gap-2">
      <SectionHeader title={t("allTemplates")} />
      <Card variant="plain" className="divide-y overflow-hidden">
        {data.items.map(renderRow)}
      </Card>
    </section>
  );

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
            aria-label={t("addRecurring")}
            onClick={() => setAddOpen(true)}
          >
            <Plus aria-hidden />
          </Button>
        }
        desktopActions={
          <Button size="touch" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span>{t("addRecurring")}</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-5 lg:px-0">
        {query.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        ) : query.isError || !data ? (
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => query.refetch() }}
          />
        ) : data.items.length === 0 ? (
          <StateBlock
            kind="empty"
            icon={Repeat}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={{
              label: t("addRecurring"),
              onClick: () => setAddOpen(true),
            }}
          />
        ) : (
          <>
            <section className="flex flex-col gap-1">
              <span className="text-[13px] text-muted-foreground">
                {t("heroLabel")}
              </span>
              <Money
                value={data.monthlyPaymentsTotal}
                currency={data.currency}
                size="hero"
                tone="plain"
                dimCents
              />
              <p className="text-[14px] text-muted-foreground">
                {t("heroSub", { count: String(data.activeExpenseCount) })}
              </p>
            </section>

            {/* Mobile toggle */}
            <div className="flex flex-col gap-4 lg:hidden">
              <ToggleGroup
                variant="segmented"
                value={[tab]}
                onValueChange={(vals) => {
                  const next = vals[0] as ViewTab | undefined;
                  if (next) setTab(next);
                }}
                className="w-full"
              >
                <ToggleGroupItem value="upcoming" className="flex-1">
                  {t("tabs.upcoming")}
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="flex-1">
                  {t("tabs.all")}
                </ToggleGroupItem>
              </ToggleGroup>
              {tab === "upcoming" ? upcomingContent : allContent}
            </div>

            {/* Desktop 2-col */}
            <div className="hidden gap-6 lg:grid lg:grid-cols-12 lg:items-start">
              <div className="min-w-0 lg:col-span-5">{upcomingContent}</div>
              <div className="min-w-0 lg:col-span-7">{allContent}</div>
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      <ResponsiveSheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected?.name ?? t("title")}
        closeLabel={tShell("close")}
        desktop="panel"
      >
        {selected && (
          <div className="flex flex-col gap-5 px-5">
            <div className="flex flex-col items-center gap-1 pt-2 text-center">
              <Money
                value={selected.amount}
                currency={selected.currency}
                size="sheet"
                tone="plain"
                approx={selected.isEstimate}
              />
              <p className="text-[13px] text-muted-foreground">
                {formatScheduleLabel(selected, t)}
                {selected.nextDate
                  ? ` · ${t("nextDate", { date: selected.nextDate })}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("howAdded")}
              </span>
              <ToggleGroup
                variant="segmented"
                value={[selected.mode]}
                onValueChange={(vals) => {
                  const next = vals[0] as Mode | undefined;
                  if (next && next !== selected.mode) {
                    updateMutation.mutate({ id: selected.id, mode: next });
                  }
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="AUTO"
                  disabled={selected.isEstimate}
                  className="flex-1"
                >
                  {t("mode.AUTO")}
                </ToggleGroupItem>
                <ToggleGroupItem value="MANUAL" className="flex-1">
                  {t("mode.MANUAL")}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[12px] text-muted-foreground">
                {selected.isEstimate
                  ? t("autoNeedsFixed")
                  : selected.mode === "AUTO"
                    ? t("autoHint")
                    : t("manualHint")}
              </p>
            </div>

            <div className="divide-y overflow-hidden rounded-2xl border bg-card">
              <FieldRow label={t("account")} value={selected.accountName} />
              {selected.category && (
                <FieldRow
                  label={t("category")}
                  value={localizeCategoryName(selected.category, locale)}
                />
              )}
              <FieldRow
                label={t("ends")}
                value={selected.endDate ?? t("never")}
              />
            </div>

            <div className="flex flex-col gap-2">
              {!selected.paused && selected.nextDate && (
                <>
                  <Button
                    size="touch"
                    disabled={confirmMutation.isPending}
                    onClick={() => {
                      confirmMutation.mutate({ id: selected.id });
                      setSelectedId(null);
                    }}
                    className="w-full"
                  >
                    <Check className="size-4" aria-hidden />
                    <span>{t("confirmNow")}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="touch"
                    disabled={skipMutation.isPending}
                    onClick={() => skipMutation.mutate({ id: selected.id })}
                    className="w-full"
                  >
                    <SkipForward className="size-4" aria-hidden />
                    <span>{t("skipNext")}</span>
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="touch"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: selected.id,
                    paused: !selected.paused,
                  })
                }
                className="w-full"
              >
                {selected.paused ? (
                  <>
                    <Play className="size-4" aria-hidden />
                    <span>{t("resume")}</span>
                  </>
                ) : (
                  <>
                    <Pause className="size-4" aria-hidden />
                    <span>{t("pause")}</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="touch"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: selected.id })}
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
                <span>{t("delete")}</span>
              </Button>
            </div>
          </div>
        )}
      </ResponsiveSheet>

      {/* Add Recurring Sheet */}
      <AddRecurringSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={invalidate}
      />
    </div>
  );
}

function AddRecurringSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const t = useTranslations("Recurring");
  const tShell = useTranslations("Shell");

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("addRecurring")}
      hideTitle
      closeLabel={tShell("close")}
      desktop="dialog"
      className="max-lg:h-[96dvh]"
    >
      {open ? (
        <AddRecurringBody
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      ) : null}
    </ResponsiveSheet>
  );
}

function AddRecurringBody({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("Recurring");
  const tQuick = useTranslations("QuickAdd");
  const tFinance = useTranslations("Finance");
  const options = trpc.records.formOptions.useQuery();

  const [name, setName] = useState("");
  const [type, setType] = useState<RecType>("EXPENSE");
  const [amountStr, setAmountStr] = useState("");
  const [isEstimate, setIsEstimate] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [transferAccountId, setTransferAccountId] = useState<number | null>(
    null,
  );
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [preset, setPreset] = useState<SchedulePreset>("monthly");
  const [frequency, setFrequency] = useState<Freq>("MONTHLY");
  const [interval, setInterval] = useState<number>(1);
  const [semiOption, setSemiOption] = useState<"15-end" | "1-15">("15-end");
  const [dayOfMonth, setDayOfMonth] = useState<number>(() =>
    new Date().getDate(),
  );
  const [mode] = useState<Mode>("MANUAL");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState<string>("");

  function selectPreset(next: SchedulePreset) {
    setPreset(next);
    if (next === "weekly") {
      setFrequency("WEEKLY");
      setInterval(1);
    } else if (next === "biweekly") {
      setFrequency("WEEKLY");
      setInterval(2);
    } else if (next === "semimonthly") {
      setFrequency("MONTHLY");
      setInterval(1);
    } else if (next === "monthly") {
      setFrequency("MONTHLY");
      setInterval(1);
    } else if (next === "yearly") {
      setFrequency("YEARLY");
      setInterval(1);
    } else if (next === "custom") {
      if (frequency === "MONTHLY" && interval === 1) {
        setFrequency("DAILY");
        setInterval(15);
      }
    }
  }

  const effectiveDaysOfMonth: number[] =
    frequency !== "MONTHLY"
      ? []
      : preset === "semimonthly"
        ? semiOption === "15-end"
          ? [15, 31]
          : [1, 15]
        : [dayOfMonth];

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [showAccountPicker, setShowAccountPicker] = useState<
    null | "from" | "to"
  >(null);
  const pushedHistoryRef = useRef(false);

  const accounts = options.data?.accounts ?? [];
  const categories = options.data?.categories ?? [];

  const catLabel = (c: {
    name: string;
    nameEn?: string | null;
    nameEs?: string | null;
  }) => localizeCategoryName(c, locale);

  useEffect(() => {
    if (accountId === null && accounts[0]) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  useEffect(() => {
    if (type !== "TRANSFER" || transferAccountId !== null || accounts.length < 2)
      return;
    const other = accounts.find((a) => a.id !== accountId);
    if (other) setTransferAccountId(other.id);
  }, [type, transferAccountId, accountId, accounts]);

  const openCategoriesSubview = useCallback(() => {
    if (!pushedHistoryRef.current && typeof window !== "undefined") {
      window.history.pushState({ firecentRecSubview: "categories" }, "");
      pushedHistoryRef.current = true;
    }
    setShowAllCategories(true);
  }, []);

  const openAccountSubview = useCallback((which: "from" | "to") => {
    if (!pushedHistoryRef.current && typeof window !== "undefined") {
      window.history.pushState({ firecentRecSubview: "account" }, "");
      pushedHistoryRef.current = true;
    }
    setShowAccountPicker(which);
  }, []);

  const closeSubview = useCallback(() => {
    setShowAllCategories(false);
    setShowAccountPicker(null);
    setCategorySearch("");
    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (!pushedHistoryRef.current) return;
      pushedHistoryRef.current = false;
      setShowAllCategories(false);
      setShowAccountPicker(null);
      setCategorySearch("");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: async () => {
      await onCreated();
      firecentToast(t("createdToast"));
      onClose();
    },
  });

  const activeAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const destAccount = accounts.find((a) => a.id === transferAccountId);
  const currency = activeAccount?.currency ?? "USD";
  const isTransfer = type === "TRANSFER";

  const typedCategories = useMemo(() => {
    const byType = categories.filter((c) =>
      type === "INCOME" ? c.type === "INCOME" : c.type !== "INCOME",
    );
    return byType.length > 0 ? byType : categories;
  }, [categories, type]);

  const parentCategories = useMemo(
    () => typedCategories.filter((c) => c.parentId === null),
    [typedCategories],
  );

  const topCategories = useMemo(() => {
    const picked = typedCategories.slice(0, 7);
    if (categoryId && !picked.some((c) => c.id === categoryId)) {
      const sel = typedCategories.find((c) => c.id === categoryId);
      if (sel) return [sel, ...picked.slice(0, 6)];
    }
    return picked;
  }, [typedCategories, categoryId]);

  const parsed = Number.parseFloat(amountStr);
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    Boolean(activeAccount) &&
    (!isTransfer ||
      (Boolean(destAccount) && destAccount?.id !== activeAccount?.id));

  // ── Category picker subview ──
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

    const parentIds = new Set(parentCategories.map((p) => p.id));
    const orphans = typedCategories.filter(
      (c) =>
        c.parentId !== null && !parentIds.has(c.parentId) && matchesSearch(c),
    );

    return (
      <div className="flex flex-col gap-3 px-5">
        <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-2.5 bg-card px-5 pt-1 pb-2.5">
          <button
            type="button"
            onClick={closeSubview}
            className="-ml-1.5 flex h-9 w-fit items-center gap-1.5 rounded-xl px-1.5 text-[15px] font-semibold transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span>{tQuick("pickCategory")}</span>
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder={tQuick("searchCategories")}
              className="h-10 w-full rounded-xl pr-9 pl-10 text-[14px]"
            />
            {categorySearch && (
              <button
                type="button"
                aria-label={tQuick("clear")}
                onClick={() => setCategorySearch("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3.5 pb-2 lg:max-h-[58dvh] lg:overflow-y-auto">
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
                <CategoryIcon
                  icon={parent.icon}
                  color={parent.color}
                  size="sm"
                />
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

  // ── Account picker subview ──
  if (showAccountPicker) {
    const targetIsFrom = showAccountPicker === "from";
    const list = targetIsFrom
      ? accounts
      : accounts.filter((a) => a.id !== activeAccount?.id);

    return (
      <div className="flex flex-col gap-2 px-5">
        <div className="sticky top-0 z-10 -mx-5 flex items-center bg-card px-5 pt-1 pb-2">
          <button
            type="button"
            onClick={closeSubview}
            className="-ml-1.5 flex h-9 items-center gap-1.5 rounded-xl px-1.5 text-[15px] font-semibold transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span>
              {targetIsFrom ? tQuick("pickAccount") : tQuick("toAccount")}
            </span>
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
                  if (targetIsFrom) setAccountId(acc.id);
                  else setTransferAccountId(acc.id);
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
    startDate === todayStr() ? tFinance("day.today") : startDate.slice(5);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || !activeAccount || createMutation.isPending) return;
        createMutation.mutate({
          name: name.trim(),
          type,
          amount: parsed,
          isEstimate,
          accountId: activeAccount.id,
          transferAccountId: isTransfer ? (destAccount?.id ?? null) : null,
          categoryId: !isTransfer ? categoryId : null,
          frequency,
          interval: Math.max(1, Math.min(365, interval || 1)),
          daysOfMonth:
            frequency === "MONTHLY" ? effectiveDaysOfMonth : undefined,
          mode: isEstimate ? "MANUAL" : mode,
          startDate,
          endDate: endDate || null,
        });
      }}
      className="flex flex-col gap-3.5 px-5 pt-1 max-lg:min-h-full"
    >
      {/* Color-coded type selector (matches AddTransactionSheet) */}
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

      {/* Centered hero amount input */}
      <label className="flex w-full cursor-text items-baseline justify-center gap-1 py-1">
        <span
          className={cn(
            "text-[22px] font-medium text-muted-foreground",
            type === "INCOME" && parsed > 0 && "text-positive/70",
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
            min="0.01"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            className={cn(
              "num absolute inset-0 w-full bg-transparent px-1 text-left text-[34px] leading-[40px] font-semibold tracking-[-0.03em] outline-none placeholder:text-muted-foreground/45 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
              type === "INCOME" && parsed > 0 && "text-positive",
            )}
          />
        </span>
      </label>

      {/* Recurring name */}
      <Input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("namePlaceholder")}
        maxLength={100}
        className="h-10 rounded-xl px-3.5 text-[14px]"
      />

      {/* Transfer From/To OR Category quick strip */}
      {isTransfer ? (
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
                {tQuick("fromAccount")}
              </span>
              <span className="block truncate text-[14px] leading-snug font-medium">
                {activeAccount ? activeAccount.name : tQuick("pickAccount")}
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
                {tQuick("toAccount")}
              </span>
              <span className="block truncate text-[14px] leading-snug font-medium">
                {destAccount ? destAccount.name : tQuick("pickAccount")}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
          </button>
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
            <span className="text-[11px] font-medium">{tQuick("more")}</span>
          </button>
        </div>
      )}

      {/* Single-line context bar: Account + Start date pill */}
      <div className="flex items-center gap-2">
        {!isTransfer && activeAccount && (
          <button
            type="button"
            onClick={() => openAccountSubview("from")}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-2.5 text-[13px] font-medium hover:bg-accent"
          >
            <AccountSwatch
              type={activeAccount.type}
              color={activeAccount.color}
              size="sm"
            />
            <span className="truncate">{activeAccount.name}</span>
          </button>
        )}

        <label
          className={cn(
            "relative flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border bg-card px-3 text-[13px] font-medium hover:bg-accent",
            isTransfer ? "flex-1" : "shrink-0",
          )}
        >
          <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{t("starts")}:</span>
          <span className="whitespace-nowrap">{dateBadgeLabel}</span>
          <input
            type="date"
            aria-label={t("starts")}
            value={startDate}
            onChange={(e) => {
              const next = e.target.value;
              setStartDate(next);
              const parsedDay = Number.parseInt(next.slice(8, 10), 10);
              if (parsedDay >= 1 && parsedDay <= 31) {
                setDayOfMonth(parsedDay);
              }
            }}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                // Fallback
              }
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      {/* Rich schedule builder: presets + contextual day-of-month / custom interval */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t("repeats")}
          </span>
          <span className="truncate text-[12px] font-medium text-primary-text">
            {formatScheduleLabel(
              {
                frequency,
                interval: Math.max(1, interval || 1),
                daysOfMonth: effectiveDaysOfMonth,
              },
              t,
            )}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              "weekly",
              "biweekly",
              "semimonthly",
              "monthly",
              "yearly",
              "custom",
            ] as const
          ).map((key) => {
            const active = preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-xl border px-2 text-[12px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary-text"
                    : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t(`presets.${key}`)}
              </button>
            );
          })}
        </div>

        {/* Semimonthly (Quincenal) days selector */}
        {preset === "semimonthly" && (
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border bg-muted/25 p-1.5">
            {(
              [
                { id: "15-end" as const, label: t("schedule.semi15End") },
                { id: "1-15" as const, label: t("schedule.semi1And15") },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSemiOption(opt.id)}
                className={cn(
                  "h-8 rounded-lg text-[12px] font-medium transition-colors",
                  semiOption === opt.id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Monthly day-of-month picker */}
        {preset === "monthly" && (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 px-3 py-2">
            <span className="text-[12px] font-medium text-muted-foreground">
              {t("schedule.dayOfMonth")}
            </span>
            <select
              aria-label={t("schedule.dayOfMonth")}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
              className="h-8 rounded-lg border bg-card px-2.5 text-[13px] font-medium outline-none"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {t("schedule.dayNumber", { day: String(d) })}
                </option>
              ))}
              <option value={31}>{t("schedule.lastDay")}</option>
            </select>
          </div>
        )}

        {/* Custom interval builder (e.g. every 15 days, every 3 months, etc.) + optional end date */}
        {preset === "custom" && (
          <div className="flex flex-col gap-2 rounded-xl border bg-muted/25 p-2.5">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
                {t("schedule.every")}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={interval}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setInterval(Number.isFinite(n) && n >= 1 ? Math.min(365, n) : 1);
                }}
                className="num h-9 w-18 rounded-lg bg-card text-center text-[14px] font-medium"
              />
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Freq)}
                className="h-9 min-w-0 flex-1 rounded-lg border bg-card px-2.5 text-[13px] font-medium outline-none"
              >
                <option value="DAILY">{t("schedule.units.DAILY")}</option>
                <option value="WEEKLY">{t("schedule.units.WEEKLY")}</option>
                <option value="MONTHLY">{t("schedule.units.MONTHLY")}</option>
                <option value="YEARLY">{t("schedule.units.YEARLY")}</option>
              </select>
            </div>

            {frequency === "MONTHLY" && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-muted-foreground">
                  {t("schedule.dayOfMonth")}
                </span>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="h-8 rounded-lg border bg-card px-2.5 text-[12px] font-medium outline-none"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {t("schedule.dayNumber", { day: String(d) })}
                    </option>
                  ))}
                  <option value={31}>{t("schedule.lastDay")}</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">
                {t("schedule.endDate")}
              </span>
              <div className="flex items-center gap-1.5">
                <label className="relative flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[12px] font-medium hover:bg-accent">
                  <Calendar className="size-3 text-muted-foreground" />
                  <span>{endDate || t("schedule.noEnd")}</span>
                  <input
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {
                        // Fallback
                      }
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                {endDate && (
                  <button
                    type="button"
                    aria-label={tQuick("clear")}
                    onClick={() => setEndDate("")}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Amount varies toggle */}
      <div className="flex h-11 items-center justify-between rounded-xl border bg-muted/25 px-3.5">
        <span className="text-[13px] font-medium">{t("amountVaries")}</span>
        <Switch checked={isEstimate} onCheckedChange={setIsEstimate} />
      </div>

      {/* Primary Save CTA (anchored to thumb zone on tall mobile drawer) */}
      <div className="pt-1 max-lg:mt-auto">
        <Button
          type="submit"
          size="touch"
          disabled={!valid || createMutation.isPending}
          className="w-full"
        >
          {t("addRecurring")}
        </Button>
      </div>
    </form>
  );
}
